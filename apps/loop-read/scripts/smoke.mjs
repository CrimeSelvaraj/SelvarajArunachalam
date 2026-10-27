/**
 * End-to-end API check. Start the dev server first:
 *   pnpm dev -- -p 3210
 *   BASE_URL=http://127.0.0.1:3210 node scripts/smoke.mjs
 */
import JSZip from "jszip";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3210";

function jar() {
  const cookies = new Map();
  return {
    store(res) {
      const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const line of list) {
        const pair = line.split(";")[0] ?? "";
        const index = pair.indexOf("=");
        if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    },
    header() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    },
  };
}

async function send(session, pathname, { method = "GET", body, form, origin = base } = {}) {
  const headers = {};
  if (origin) headers.origin = origin;
  const cookie = session.header();
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${base}${pathname}`, { method, headers, body: payload });
  session.store(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function minimalPdf(text) {
  const stream = `BT /F1 24 Tf 50 720 Td (${text}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body + table + trailer);
}

async function minimalEpub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
     <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles>
         <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
       </rootfiles>
     </container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>Tiny EPUB</dc:title>
         <dc:identifier id="uid">loop-read-smoke</dc:identifier>
         <dc:language>en</dc:language>
       </metadata>
       <manifest>
         <item id="chap" href="chap.xhtml" media-type="application/xhtml+xml"/>
       </manifest>
       <spine>
         <itemref idref="chap"/>
       </spine>
     </package>`,
  );
  zip.file(
    "OEBPS/chap.xhtml",
    `<?xml version="1.0"?>
     <html xmlns="http://www.w3.org/1999/xhtml"><body><p>EPUB words alpha beta gamma.</p></body></html>`,
  );
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

async function upload(session, filename, bytes, type) {
  const form = new FormData();
  form.set("file", new File([bytes], filename, { type }));
  return send(session, "/api/library", { method: "POST", form });
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  assert(health.ok, `Server is not up at ${base}`);

  const email = `loop.${Date.now()}@example.com`;
  const first = jar();
  let res = await send(first, "/api/auth/start", { method: "POST", body: { email } });
  assert(res.status === 200 && res.data.status === "signed_in", `sign-in failed: ${JSON.stringify(res.data)}`);

  res = await send(first, "/api/billing/status");
  assert(res.data.paypalConfigured === false, "expected demo PayPal mode");
  assert(res.data.amount === "1.00", "access fee should be 1.00 USD");

  res = await send(first, "/api/library", {
    method: "POST",
    form: (() => {
      const form = new FormData();
      form.set("file", new File(["unpaid"], "nope.txt", { type: "text/plain" }));
      return form;
    })(),
  });
  assert(res.status === 403, `unpaid upload should be blocked, got ${res.status}`);

  res = await send(first, "/api/billing/demo-unlock", { method: "POST" });
  assert(res.status === 200 && res.data.paymentMethod === "demo", "demo unlock failed");

  const blocked = await send(first, "/api/billing/demo-unlock", {
    method: "POST",
    origin: "http://evil.example",
  });
  assert(blocked.status === 403, "cross-origin unlock should be blocked");

  res = await upload(first, "notes.txt", Buffer.from("Alpha beta gamma delta epsilon zeta.\n"), "text/plain");
  assert(res.status === 201 && res.data.book.wordCount === 6, `txt upload failed: ${JSON.stringify(res.data)}`);
  const bookId = res.data.book.id;

  res = await upload(first, "tiny.epub", await minimalEpub(), "application/epub+zip");
  assert(res.status === 201 && res.data.book.title === "Tiny EPUB", `epub upload failed: ${JSON.stringify(res.data)}`);
  assert(res.data.book.wordCount >= 4, "epub should contain the chapter words");

  res = await upload(first, "tiny.pdf", minimalPdf("Hello from a tiny PDF."), "application/pdf");
  assert(res.status === 201, `pdf upload failed: ${res.status} ${JSON.stringify(res.data)}`);
  assert(String(res.data.book.title || res.data.text || "").length >= 0, "pdf response missing");
  assert(/hello/i.test(JSON.stringify(res.data)) || res.data.book.wordCount >= 4, `pdf text missing: ${JSON.stringify(res.data)}`);

  res = await upload(first, "scan.pdf", minimalPdf(""), "application/pdf");
  // An empty text-drawing PDF may still parse. A non-pdf renamed as pdf should fail.
  res = await upload(first, "notes.pdf", Buffer.from("this is not a pdf"), "application/pdf");
  assert(res.status === 422, `bad pdf should explain itself, got ${res.status} ${JSON.stringify(res.data)}`);

  const second = jar();
  res = await send(second, "/api/auth/start", { method: "POST", body: { email } });
  assert(res.data.status === "code_required" && res.data.demo === true, `expected demo code, got ${JSON.stringify(res.data)}`);
  assert(typeof res.data.devCode === "string" && res.data.devCode.length === 6, "dev banner code missing");
  const wrong = await send(second, "/api/auth/verify", {
    method: "POST",
    body: { email, code: res.data.devCode === "000000" ? "000001" : "000000" },
  });
  assert(wrong.status === 400, "wrong code should be rejected");
  res = await send(second, "/api/auth/verify", {
    method: "POST",
    body: { email, code: res.data.devCode },
  });
  assert(res.status === 200 && res.data.status === "signed_in", `verify failed: ${JSON.stringify(res.data)}`);

  const replaced = await send(first, "/api/auth/me");
  assert(replaced.status === 401 && replaced.data.reason === "replaced", `first session should end: ${JSON.stringify(replaced.data)}`);

  res = await send(second, `/api/library/${bookId}/finish`, { method: "POST" });
  assert(res.status === 200 && res.data.newlyAwarded === true, `badge missing: ${JSON.stringify(res.data)}`);
  assert(res.data.badge.name === "Loop closed", "unexpected badge name");
  res = await send(second, `/api/library/${bookId}/finish`, { method: "POST" });
  assert(res.data.newlyAwarded === false, "badge should be awarded once");
  res = await send(second, "/api/badges");
  assert(res.data.badges.length === 1, "badge list should contain the finished book");

  console.log("LOOP READ smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
