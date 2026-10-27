export function paginate(text: string, size = 700): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pages: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > size && buffer) {
      pages.push(buffer);
      buffer = paragraph;
    } else {
      buffer = next;
    }
  }
  if (buffer) pages.push(buffer);
  return pages.length > 0 ? pages : ["This document has no readable text."];
}

export function outlineOf(pages: string[]): { title: string; page: number }[] {
  const items: { title: string; page: number }[] = [];
  pages.forEach((page, index) => {
    for (const line of page.split("\n")) {
      const title = line.trim().replace(/^#+\s*/, "");
      if (title.length >= 4 && title.length <= 60 && !/[.!?]$/.test(title)) {
        items.push({ title, page: index });
      }
    }
  });
  return items.slice(0, 12);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractLoosePdfText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  const chunk = 0x1000;
  for (let index = 0; index < bytes.length; index += chunk) {
    const slice = bytes.subarray(index, index + chunk);
    binary += String.fromCharCode(...slice);
  }
  const parts: string[] = [];
  const pattern = /\((?:\\[()\\nrtbf]|[^\\)]){2,}\)/g;
  for (const match of binary.matchAll(pattern)) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z]{2,}/.test(inner)) parts.push(inner);
  }
  return parts.join(" ").replace(/[ \t]{2,}/g, " ").trim().slice(0, 200_000);
}
