import test from "node:test";
import assert from "node:assert/strict";
import { extractPdf, PDF_LIMITS } from "../src/pdf.mjs";

const loadEngine = () => import("pdfjs-dist/legacy/build/pdf.mjs");

/** PDF sintético autorizado; os offsets xref são calculados em bytes, não estimados. */
function makePdf(pageTexts) {
  const objects = [];
  const pageIds = pageTexts.map((_, index) => 4 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageTexts.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageTexts.forEach((value, index) => {
    const stream =
      value === null
        ? ""
        : `BT /F1 12 Tf 30 700 Td (${value.replace(/[\\()]/g, "\\$&")}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}

test("PDF.js real extrai texto e preserva páginas e arquivo de entrada", async () => {
  const bytes = makePdf([
    "Material ficticio: a agua evapora.",
    "O vapor pode condensar.",
  ]);
  const original = bytes.slice();
  const progress = [];
  const result = await extractPdf(bytes, {
    loadEngine,
    onProgress: (step) => progress.push(step),
  });
  assert.deepEqual(result.pages, [
    { page: 1, text: "Material ficticio: a agua evapora." },
    { page: 2, text: "O vapor pode condensar." },
  ]);
  assert.deepEqual(result.emptyPages, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(progress, [
    { completed: 1, total: 2 },
    { completed: 2, total: 2 },
  ]);
  assert.deepEqual(bytes, original);
});

test("PDF sem texto é rejeitado sem fingir OCR", async () => {
  await assert.rejects(
    extractPdf(makePdf([null, null]), { loadEngine }),
    /Nenhum texto.*OCR/,
  );
});

test("PDF misto mantém numeração e avisa sobre página sem texto", async () => {
  const result = await extractPdf(
    makePdf(["Texto inicial.", null, "Texto final."]),
    { loadEngine },
  );
  assert.deepEqual(result.emptyPages, [2]);
  assert.equal(result.pages[2].page, 3);
  assert.equal(result.pages[1].text, "");
  assert.match(result.warnings[0], /páginas 2.*não foram interpretadas/);
});

test("entrada vazia e arquivo sem assinatura são recusados antes de carregar engine", async () => {
  const unavailable = () => {
    throw new Error("Engine não deveria carregar.");
  };
  await assert.rejects(
    extractPdf(new Uint8Array(), { loadEngine: unavailable }),
    /vazio/,
  );
  await assert.rejects(
    extractPdf(new TextEncoder().encode("texto comum"), {
      loadEngine: unavailable,
    }),
    /PDF reconhecível/,
  );
});

test("PDF estruturalmente inválido é recusado pelo PDF.js real", async () => {
  await assert.rejects(
    extractPdf(new TextEncoder().encode("%PDF-1.4\nisto nao e um PDF"), {
      loadEngine,
    }),
  );
});

test("limite de bytes é aplicado antes de carregar PDF", async () => {
  await assert.rejects(
    extractPdf(makePdf(["Texto."]), {
      loadEngine,
      limits: { ...PDF_LIMITS, bytes: 10 },
    }),
    /até 10 MB/,
  );
});

test("limite de páginas é aplicado após leitura estrutural real", async () => {
  await assert.rejects(
    extractPdf(makePdf(["A", "B"]), {
      loadEngine,
      limits: { ...PDF_LIMITS, pages: 1 },
    }),
    /limite de 1 páginas/,
  );
});

test("limite de caracteres interrompe extração real", async () => {
  await assert.rejects(
    extractPdf(makePdf(["Texto maior que o limite."]), {
      loadEngine,
      limits: { ...PDF_LIMITS, characters: 5 },
    }),
    /texto extraído excede/,
  );
});

test("timeout cancela engine e libera recursos", async () => {
  let destroyed = false;
  const neverFinishes = async () => ({
    getDocument: () => ({
      promise: new Promise(() => {}),
      destroy: async () => {
        destroyed = true;
      },
    }),
  });
  await assert.rejects(
    extractPdf(makePdf(["Texto."]), {
      loadEngine: neverFinishes,
      limits: { ...PDF_LIMITS, timeoutMs: 5 },
    }),
    /demorou demais/,
  );
  assert.equal(destroyed, true);
});
