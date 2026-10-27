import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { ParseError } from "./errors";
import type { BookFormat } from "./types";
import { normalizeText, splitWords } from "./words";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WORDS = 200_000;

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
});

export type ExtractedDocument = {
  format: BookFormat;
  title: string;
  text: string;
  wordCount: number;
};

export async function extractDocument(filename: string, buffer: Buffer): Promise<ExtractedDocument> {
  if (buffer.length === 0) {
    throw new ParseError("That file is empty.");
  }
  if (buffer.length > MAX_BYTES) {
    throw new ParseError("Files need to be 8 MB or smaller.");
  }

  const format = detectFormat(filename);
  const fallback = titleFromFilename(filename);
  let title = fallback;
  let text = "";

  if (format === "txt") {
    text = decodePlain(buffer);
    if (text.includes("\u0000")) {
      throw new ParseError("This file does not look like plain text. Upload a .txt file saved as UTF-8.");
    }
  } else if (format === "epub") {
    const epub = await extractEpub(buffer, fallback);
    title = epub.title;
    text = epub.text;
  } else {
    const pdf = await extractPdf(buffer, fallback);
    title = pdf.title;
    text = pdf.text;
  }

  text = normalizeText(text);
  const wordCount = splitWords(text).length;
  if (wordCount < 1) {
    throw new ParseError(emptyMessage(format));
  }
  if (wordCount > MAX_WORDS) {
    throw new ParseError(
      "This file is longer than LOOP READ can flash in the browser (200,000 words). Split it into smaller text files.",
    );
  }

  return { format, title: cleanTitle(title, fallback), text, wordCount };
}

function detectFormat(filename: string): BookFormat {
  const name = filename.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".text")) return "txt";
  if (name.endsWith(".epub")) return "epub";
  if (name.endsWith(".pdf")) return "pdf";
  throw new ParseError("Upload a .txt, .epub, or .pdf file you already own.");
}

function emptyMessage(format: BookFormat): string {
  if (format === "pdf") {
    return "No selectable text found in this PDF. It may be a scan. Export a .txt file, or a text-based PDF, from a copy you own.";
  }
  if (format === "epub") {
    return "This EPUB has no extractable text. It may be protected or image-only. Export a .txt file, or an unlocked EPUB, from a copy you own.";
  }
  return "That text file has no words to read.";
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  return cleanTitle(base, "Untitled");
}

function cleanTitle(value: string, fallback: string): string {
  const cleaned = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback || "Untitled").slice(0, 140);
}

function decodePlain(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - (buffer.length % 2 === 0 ? 2 : 1));
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1]!;
      swapped[i - 1] = buffer[i]!;
    }
    return swapped.toString("utf16le");
  }
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== "object") return "";
  const value = (node as Record<string, unknown>)[`@_${name}`];
  return typeof value === "string" ? value : "";
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join(" ").trim();
  if (value && typeof value === "object" && "#text" in value) {
    return textContent((value as { "#text"?: unknown })["#text"]);
  }
  return "";
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (entity) => {
    const body = entity.slice(1, -1);
    const lower = body.toLowerCase();
    if (lower === "nbsp") return " ";
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const code = lower.startsWith("#x")
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return " ";
    return String.fromCodePoint(code);
  });
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h\d|li|tr|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped);
}

function resolveZipPath(baseFile: string, href: string): string {
  const decoded = decodeURIComponent(href.split("#")[0] ?? "");
  const baseDir = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1) : "";
  const stack: string[] = [];
  for (const part of `${baseDir}${decoded}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function zipText(zip: JSZip, name: string): Promise<string | null> {
  const direct = zip.file(name);
  if (direct) return direct.async("string");
  const lower = name.toLowerCase();
  const found = zip.file(/.*/).find((entry) => entry.name.toLowerCase() === lower);
  return found ? found.async("string") : Promise.resolve(null);
}

async function extractEpub(buffer: Buffer, fallback: string): Promise<{ title: string; text: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ParseError("That file is not a readable EPUB. Upload a .txt file or another EPUB you own.");
  }

  const encrypted = zip.file(/encryption\.xml$/i).length > 0;
  const containerXml = await zipText(zip, "META-INF/container.xml");
  let opfPath = "";
  if (containerXml) {
    const container = xml.parse(containerXml) as {
      container?: { rootfiles?: { rootfile?: unknown } };
    };
    const rootfiles = asArray(container.container?.rootfiles?.rootfile);
    opfPath = attr(rootfiles[0], "full-path");
  }
  if (!opfPath) {
    const guessed = zip.file(/\.opf$/i)[0];
    opfPath = guessed?.name ?? "";
  }
  if (!opfPath) {
    throw new ParseError(
      encrypted
        ? "This EPUB looks protected. Export a .txt file, or an unlocked EPUB, from a copy you own."
        : "That EPUB is missing its package file. Upload a .txt file or another EPUB you own.",
    );
  }

  const opfXml = await zipText(zip, opfPath);
  if (!opfXml) {
    throw new ParseError("That EPUB is missing its package file. Upload a .txt file or another EPUB you own.");
  }
  const opf = xml.parse(opfXml) as {
    package?: {
      metadata?: { title?: unknown };
      manifest?: { item?: unknown };
      spine?: { itemref?: unknown };
    };
  };
  const title = textContent(opf.package?.metadata?.title) || fallback;
  const manifest = new Map<string, { href: string; type: string }>();
  for (const item of asArray(opf.package?.manifest?.item)) {
    const id = attr(item, "id");
    const href = attr(item, "href");
    if (!id || !href) continue;
    manifest.set(id, { href, type: attr(item, "media-type") });
  }

  const chapters: string[] = [];
  for (const ref of asArray(opf.package?.spine?.itemref)) {
    const item = manifest.get(attr(ref, "idref"));
    if (!item) continue;
    if (!isChapter(item.href, item.type)) continue;
    const file = await zipText(zip, resolveZipPath(opfPath, item.href));
    if (file) chapters.push(htmlToText(file));
  }

  if (chapters.length === 0) {
    const extras = zip.file(/\.(xhtml|html|htm)$/i);
    for (const entry of extras) {
      chapters.push(htmlToText(await entry.async("string")));
    }
  }

  const text = chapters.join(" ");
  if (splitWords(normalizeText(text)).length < 1 && encrypted) {
    throw new ParseError(
      "This EPUB looks protected or has no extractable text. Export a .txt file, or an unlocked EPUB, from a copy you own.",
    );
  }
  return { title, text };
}

function isChapter(href: string, mediaType: string): boolean {
  const type = mediaType.toLowerCase();
  if (type.includes("html") || type.includes("xml")) return true;
  return /\.(xhtml|html|htm)$/i.test(href);
}

async function extractPdf(buffer: Buffer, fallback: string): Promise<{ title: string; text: string }> {
  try {
    const bytes = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(bytes);
    const meta = await getMeta(pdf).catch(() => null);
    const infoTitle = meta && typeof meta.info?.Title === "string" ? meta.info.Title : "";
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join(" ") : extracted.text;
    return { title: infoTitle || fallback, text: text ?? "" };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    console.error("[LOOP READ] PDF extract failed", error);
    throw new ParseError(
      "This PDF could not be read. Export a .txt file, or a simpler text-based PDF, from a copy you own.",
    );
  }
}
