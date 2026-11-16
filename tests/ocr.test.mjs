import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { recognizePdf, OCR_LIMITS, browserOcrAssetUrls } from "../src/ocr.mjs";

const bytes = new TextEncoder().encode("%PDF-1.4\nfixture");
function harness({
  pageCount = 2,
  texts = ["Primeira página", "Segunda página"],
  confidence = 92,
  recognize,
} = {}) {
  const calls = {
    terminated: 0,
    destroyed: 0,
    disposed: 0,
    pageCleanup: 0,
    recognized: [],
  };
  const document = {
    numPages: pageCount,
    async getPage(number) {
      return {
        number,
        cleanup() {
          calls.pageCleanup += 1;
        },
      };
    },
  };
  return {
    calls,
    options: {
      loadPdfEngine: async () => ({
        getDocument: () => ({
          promise: Promise.resolve(document),
          async destroy() {
            calls.destroyed += 1;
          },
        }),
      }),
      createOcrWorker: async () => ({
        async recognize(image) {
          calls.recognized.push(image);
          return recognize
            ? recognize(image)
            : { data: { text: texts[image - 1] || "", confidence } };
        },
        async terminate() {
          calls.terminated += 1;
        },
      }),
      renderPage: async (page) => ({
        image: page.number,
        dispose() {
          calls.disposed += 1;
        },
      }),
    },
  };
}

test("OCR é opcional, mantém números reais e sinaliza revisão humana", async () => {
  const h = harness();
  const original = bytes.slice();
  const result = await recognizePdf(bytes, { ...h.options, pageNumbers: [2] });
  assert.equal(result.pages[0].page, 2);
  assert.equal(result.pages[0].text, "Segunda página");
  assert.equal(result.pages[0].method, "ocr");
  assert.equal(result.needsReview, true);
  assert.deepEqual(result.selectedPages, [2]);
  assert.deepEqual(bytes, original);
  assert.equal(h.calls.terminated, 1);
  assert.equal(h.calls.destroyed, 1);
  assert.equal(h.calls.disposed, 1);
});

test("OCR sem texto falha e não inventa conteúdo", async () => {
  const h = harness({ texts: [] });
  await assert.rejects(recognizePdf(bytes, h.options), /não reconheceu texto/);
  assert.equal(h.calls.terminated, 1);
  assert.equal(h.calls.destroyed, 1);
});

test("OCR parcial lista páginas vazias e confiança baixa", async () => {
  const h = harness({ texts: ["Texto incerto", ""], confidence: 45 });
  const result = await recognizePdf(bytes, h.options);
  assert.deepEqual(result.emptyPages, [2]);
  assert.match(result.warnings.join(" "), /páginas 2/);
  assert.match(result.warnings.join(" "), /páginas 1.*confiança/);
});

test("OCR recusa arquivo, idioma e seleção inválidos antes de carregar", async () => {
  const forbidden = async () => {
    throw new Error("Engine não deveria carregar");
  };
  for (const input of [new Uint8Array(), new TextEncoder().encode("comum")]) {
    await assert.rejects(
      recognizePdf(input, { loadPdfEngine: forbidden }),
      /PDF/,
    );
  }
  await assert.rejects(
    recognizePdf(bytes, { language: "https://evil.test/" }),
    /Escolha português/,
  );
  for (const pageNumbers of [[], [0], [1, 1], [1.5], "1"]) {
    await assert.rejects(
      recognizePdf(bytes, { pageNumbers, loadPdfEngine: forbidden }),
      /páginas inválida/,
    );
  }
});

test("limites de bytes, páginas e caracteres são aplicados", async () => {
  const h = harness();
  await assert.rejects(
    recognizePdf(bytes, { ...h.options, limits: { ...OCR_LIMITS, bytes: 1 } }),
    /10 MB/,
  );
  await assert.rejects(
    recognizePdf(bytes, { ...h.options, limits: { ...OCR_LIMITS, pages: 1 } }),
    /no máximo 1/,
  );
  await assert.rejects(
    recognizePdf(bytes, { ...h.options, pageNumbers: [3] }),
    /não existe/,
  );
  await assert.rejects(
    recognizePdf(bytes, {
      ...h.options,
      limits: { ...OCR_LIMITS, documentPages: 1 },
    }),
    /limite de 1 páginas/,
  );
  await assert.rejects(
    recognizePdf(bytes, {
      ...h.options,
      limits: { ...OCR_LIMITS, characters: 3 },
    }),
    /100 mil/,
  );
});

test("engine indisponível não retorna resultado falso", async () => {
  const h = harness();
  await assert.rejects(
    recognizePdf(bytes, {
      ...h.options,
      createOcrWorker: async () => {
        throw new Error("OCR local indisponível");
      },
    }),
    /indisponível/,
  );
  assert.equal(h.calls.destroyed, 1);
});

test("cancelamento antes de iniciar não carrega engine", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    recognizePdf(bytes, {
      signal: controller.signal,
      loadPdfEngine: () => {
        throw new Error("não carregar");
      },
    }),
    (error) => error.name === "AbortError",
  );
});

test("cancelamento durante OCR libera worker e documento sem salvar parcial", async () => {
  const controller = new AbortController();
  const h = harness({ recognize: () => new Promise(() => {}) });
  const result = recognizePdf(bytes, {
    ...h.options,
    signal: controller.signal,
    onProgress(event) {
      if (event.phase === "recognition")
        setTimeout(() => controller.abort(), 1);
    },
  });
  await assert.rejects(result, (error) => error.name === "AbortError");
  assert.equal(h.calls.terminated, 1);
  assert.equal(h.calls.destroyed, 1);
  assert.equal(h.calls.disposed, 1);
});

test("timeout limita execução e libera recursos", async () => {
  const h = harness({ recognize: () => new Promise(() => {}) });
  await assert.rejects(
    recognizePdf(bytes, {
      ...h.options,
      limits: { ...OCR_LIMITS, timeoutMs: 10 },
    }),
    /tempo limite/,
  );
  assert.equal(h.calls.terminated, 1);
  assert.equal(h.calls.destroyed, 1);
});

test("todos os caminhos de OCR pertencem à mesma origem e subdiretório", () => {
  const urls = browserOcrAssetUrls(
    "https://example.test/trilha-viva/src/ocr.mjs",
  );
  for (const url of Object.values(urls)) {
    assert.equal(new URL(url).origin, "https://example.test");
    assert.match(new URL(url).pathname, /^\/trilha-viva\/vendor\/ocr\//);
  }
});

let tesseract;
let languagePath;
let canvas;
try {
  const require = process.env.TRILHA_OCR_MODULE_ROOT
    ? createRequire(
        path.join(process.env.TRILHA_OCR_MODULE_ROOT, "package.json"),
      )
    : createRequire(import.meta.url);
  tesseract = require("tesseract.js");
  languagePath = path.join(
    path.dirname(require.resolve("@tesseract.js-data/eng")),
    "4.0.0_best_int",
  );
  canvas = await import("@napi-rs/canvas");
} catch {
  /* Este teste fica explicitamente pulado até instalar as dependências locais. */
}

/** PDF sintético autorizado com xref real; o texto será rasterizado, depois reconhecido. */
function fixturePdf() {
  const stream = "BT /F1 28 Tf 25 120 Td (LEARNING IS A JOURNEY) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}

test(
  "OCR real reconhece texto rasterizado de PDF sintético sem rede",
  { skip: !tesseract || !canvas, timeout: 60_000 },
  async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const standardFontDataUrl = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/standard_fonts/",
    );
    const result = await recognizePdf(fixturePdf(), {
      language: "eng",
      loadPdfEngine: async () => ({
        getDocument: (options) =>
          pdfjs.getDocument({ ...options, standardFontDataUrl }),
      }),
      createOcrWorker: async () =>
        tesseract.createWorker("eng", 1, {
          langPath: languagePath,
          cacheMethod: "none",
          gzip: true,
        }),
      renderPage: async (page) => {
        const viewport = page.getViewport({ scale: 2 });
        const image = canvas.createCanvas(viewport.width, viewport.height);
        await page.render({ canvasContext: image.getContext("2d"), viewport })
          .promise;
        return {
          image: image.toBuffer("image/png"),
          dispose() {
            image.width = 0;
            image.height = 0;
          },
        };
      },
    });
    assert.match(result.pages[0].text, /LEARNING IS A JOURNEY/);
    assert.equal(result.pages[0].page, 1);
    assert.equal(result.needsReview, true);
  },
);
