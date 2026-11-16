import { loadBrowserPdfEngine } from "./pdf.mjs";

export const OCR_LIMITS = Object.freeze({
  bytes: 10 * 1024 * 1024,
  documentPages: 100,
  pages: 8,
  pixelsPerPage: 4_000_000,
  characters: 100_000,
  scale: 2,
  timeoutMs: 120_000,
});
export const OCR_LANGUAGES = Object.freeze(["por", "eng", "por+eng"]);

function abortError(message = "OCR cancelado. Nenhum resultado foi salvo.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}
function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason || abortError();
}
function report(callback, event) {
  if (typeof callback === "function") callback(event);
}

/** Caminhos fixos: documentos nunca viram URLs e não há fallback para CDN. */
export function browserOcrAssetUrls(baseUrl = import.meta.url) {
  return {
    module: new URL("../vendor/ocr/tesseract.esm.min.js", baseUrl).href,
    worker: new URL("../vendor/ocr/worker.min.js", baseUrl).href,
    core: new URL("../vendor/ocr/core/", baseUrl).href,
    languages: new URL("../vendor/ocr/lang/", baseUrl).href,
  };
}

/** Um worker supervisor permite encerrar a inicialização e os workers filhos. */
export async function createBrowserOcrWorker({ language, signal, onProgress }) {
  checkAbort(signal);
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    throw new Error(
      "OCR local indisponível neste navegador. Cole o texto ou use outro navegador compatível.",
    );
  }
  const supervisor = new Worker(new URL("./ocr.mjs", import.meta.url), {
    type: "module",
  });
  let sequence = 0;
  let stopped = false;
  const pending = new Map();
  const terminate = () => {
    if (stopped) return;
    stopped = true;
    supervisor.terminate();
    for (const item of pending.values()) item.reject(abortError());
    pending.clear();
    signal?.removeEventListener("abort", terminate);
  };
  signal?.addEventListener("abort", terminate, { once: true });
  supervisor.addEventListener("message", ({ data }) => {
    if (data?.type === "progress") {
      report(onProgress, {
        phase: "recognition",
        status: data.status,
        progress: data.progress,
      });
      return;
    }
    const item = pending.get(data?.id);
    if (!item) return;
    pending.delete(data.id);
    if (data.error) item.reject(new Error(data.error));
    else item.resolve(data.result);
  });
  supervisor.addEventListener("error", () => {
    const error = new Error(
      "Não foi possível carregar o OCR local. Confira os arquivos de idioma e tente novamente.",
    );
    for (const item of pending.values()) item.reject(error);
    pending.clear();
    terminate();
  });
  const call = (type, input) =>
    new Promise((resolve, reject) => {
      if (stopped) return reject(abortError());
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      supervisor.postMessage({ id, type, ...input });
    });
  try {
    await call("initialize", { language });
    checkAbort(signal);
    return { recognize: (image) => call("recognize", { image }), terminate };
  } catch (error) {
    terminate();
    throw error;
  }
}

/** Executado apenas no worker supervisor, não ao importar no navegador ou Node. */
async function installSupervisor() {
  let engineWorker;
  let currentRequestId;
  const sendError = (id, error) =>
    self.postMessage({
      id,
      error: `OCR local indisponível: ${String(error?.message || error).slice(0, 300)}`,
    });
  self.addEventListener("message", async ({ data }) => {
    currentRequestId = data.id;
    try {
      if (data.type === "initialize") {
        if (!OCR_LANGUAGES.includes(data.language))
          throw new Error("Idioma não permitido.");
        const assets = browserOcrAssetUrls();
        const module = await import(assets.module);
        const tesseract = module.default || module;
        engineWorker = await tesseract.createWorker(data.language, 1, {
          workerPath: assets.worker,
          corePath: assets.core,
          langPath: assets.languages,
          workerBlobURL: false,
          cacheMethod: "none",
          gzip: true,
          logger: ({ status, progress }) =>
            self.postMessage({ type: "progress", status, progress }),
          errorHandler: (error) => sendError(currentRequestId, error),
        });
        self.postMessage({ id: data.id, result: { ready: true } });
      } else if (data.type === "recognize") {
        if (!engineWorker) throw new Error("OCR não inicializado.");
        const { data: result } = await engineWorker.recognize(data.image);
        self.postMessage({
          id: data.id,
          result: {
            data: { text: result.text, confidence: result.confidence },
          },
        });
      }
    } catch (error) {
      sendError(data.id, error);
    }
  });
}
if (
  typeof WorkerGlobalScope !== "undefined" &&
  globalThis instanceof WorkerGlobalScope
) {
  void installSupervisor();
}

/** Rasteriza uma página local com limite de memória e cancelamento de PDF.js. */
export async function renderPageForOcr(
  page,
  { signal, limits = OCR_LIMITS } = {},
) {
  checkAbort(signal);
  if (typeof document === "undefined")
    throw new Error("A renderização de OCR precisa de um navegador.");
  const original = page.getViewport({ scale: 1 });
  if (
    !Number.isFinite(original.width) ||
    !Number.isFinite(original.height) ||
    original.width <= 0 ||
    original.height <= 0
  ) {
    throw new Error("A página possui dimensões inválidas para OCR.");
  }
  const scale = Math.min(
    limits.scale,
    Math.sqrt(limits.pixelsPerPage / (original.width * original.height)),
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível preparar a imagem para OCR.");
  const dispose = () => {
    canvas.width = 0;
    canvas.height = 0;
  };
  const rendering = page.render({
    canvasContext: context,
    viewport,
    background: "rgb(255,255,255)",
  });
  const cancel = () => rendering.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await rendering.promise;
    checkAbort(signal);
    const image = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Falha ao rasterizar página para OCR.")),
        "image/png",
      ),
    );
    checkAbort(signal);
    return { image, dispose };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

/**
 * OCR opcional: nunca é chamado automaticamente pela extração de PDF.
 * Retorna texto não revisado, com páginas reais. O chamador decide se o salva.
 */
export async function recognizePdf(
  input,
  {
    language = "por",
    pageNumbers,
    signal,
    onProgress = () => {},
    limits = OCR_LIMITS,
    loadPdfEngine = loadBrowserPdfEngine,
    createOcrWorker = createBrowserOcrWorker,
    renderPage = renderPageForOcr,
  } = {},
) {
  checkAbort(signal);
  if (!OCR_LANGUAGES.includes(language))
    throw new Error(
      "Escolha português, inglês ou português e inglês para OCR.",
    );
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > limits.bytes)
    throw new Error("Selecione um PDF de até 10 MB para OCR.");
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new Error("Arquivo sem assinatura de PDF válida.");
  if (
    pageNumbers !== undefined &&
    (!Array.isArray(pageNumbers) ||
      !pageNumbers.length ||
      pageNumbers.some((number) => !Number.isInteger(number) || number < 1) ||
      new Set(pageNumbers).size !== pageNumbers.length)
  ) {
    throw new Error(
      "Seleção de páginas inválida: use números únicos a partir de 1.",
    );
  }
  if (pageNumbers?.length > limits.pages)
    throw new Error(`Processe no máximo ${limits.pages} páginas por vez.`);

  const operation = new AbortController();
  const forwardAbort = () => operation.abort(signal?.reason || abortError());
  signal?.addEventListener("abort", forwardAbort, { once: true });
  let timer;
  let loading;
  let worker;
  let pageImage;
  const abortPromise = new Promise((_, reject) => {
    operation.signal.addEventListener(
      "abort",
      () => reject(operation.signal.reason || abortError()),
      { once: true },
    );
    timer = setTimeout(
      () =>
        operation.abort(
          abortError(
            "OCR interrompido por tempo limite. Tente menos páginas por vez.",
          ),
        ),
      limits.timeoutMs,
    );
  });
  const run = async () => {
    report(onProgress, { phase: "loading", progress: 0 });
    const engine = await loadPdfEngine();
    checkAbort(operation.signal);
    const assets =
      typeof window !== "undefined"
        ? {
            standardFontDataUrl: new URL(
              "../vendor/standard_fonts/",
              import.meta.url,
            ).href,
            cMapUrl: new URL("../vendor/cmaps/", import.meta.url).href,
            cMapPacked: true,
            wasmUrl: new URL("../vendor/wasm/", import.meta.url).href,
          }
        : {};
    loading = engine.getDocument({
      ...assets,
      data: bytes.slice(),
      isEvalSupported: false,
      useSystemFonts: false,
    });
    const document = await loading.promise;
    checkAbort(operation.signal);
    if (document.numPages > limits.documentPages)
      throw new Error(
        `O PDF excede o limite de ${limits.documentPages} páginas.`,
      );
    const selected =
      pageNumbers ??
      Array.from({ length: document.numPages }, (_, index) => index + 1);
    if (selected.length > limits.pages)
      throw new Error(
        `Escolha no máximo ${limits.pages} páginas por vez para OCR.`,
      );
    if (selected.some((number) => number > document.numPages))
      throw new Error("A seleção inclui uma página que não existe no PDF.");
    report(onProgress, {
      phase: "initializing",
      progress: 0,
      total: selected.length,
    });
    worker = await createOcrWorker({
      language,
      signal: operation.signal,
      onProgress,
    });
    if (operation.signal.aborted) {
      await worker.terminate();
      checkAbort(operation.signal);
    }
    const pages = [];
    let characters = 0;
    for (let index = 0; index < selected.length; index += 1) {
      checkAbort(operation.signal);
      const number = selected[index];
      const page = await document.getPage(number);
      try {
        report(onProgress, {
          phase: "rendering",
          page: number,
          completed: index,
          total: selected.length,
        });
        pageImage = await renderPage(page, {
          signal: operation.signal,
          limits,
        });
        checkAbort(operation.signal);
        report(onProgress, {
          phase: "recognition",
          page: number,
          completed: index,
          total: selected.length,
        });
        const result = await worker.recognize(pageImage.image);
        checkAbort(operation.signal);
        const text =
          typeof result?.data?.text === "string" ? result.data.text.trim() : "";
        characters += text.length;
        if (characters > limits.characters)
          throw new Error(
            "O OCR excedeu o limite de 100 mil caracteres. Processe menos páginas.",
          );
        const confidence = Number.isFinite(result?.data?.confidence)
          ? Math.max(0, Math.min(100, result.data.confidence))
          : null;
        pages.push({
          page: number,
          text,
          confidence,
          method: "ocr",
          needsReview: true,
        });
        report(onProgress, {
          phase: "page-complete",
          page: number,
          completed: index + 1,
          total: selected.length,
        });
      } finally {
        pageImage?.dispose();
        pageImage = undefined;
        page.cleanup();
      }
    }
    const emptyPages = pages
      .filter((page) => !page.text)
      .map((page) => page.page);
    if (emptyPages.length === pages.length)
      throw new Error(
        "O OCR não reconheceu texto nas páginas selecionadas. A imagem pode estar ilegível; nenhum conteúdo foi inventado.",
      );
    const warnings = [
      "Texto reconhecido por OCR: confira e corrija antes de estudar. Colunas, fórmulas, tabelas e manuscritos podem ser reconhecidos incorretamente.",
    ];
    if (emptyPages.length)
      warnings.push(
        `Sem texto reconhecido nas páginas ${emptyPages.join(", ")}.`,
      );
    const lowConfidence = pages
      .filter(
        (page) =>
          page.text && (page.confidence === null || page.confidence < 70),
      )
      .map((page) => page.page);
    if (lowConfidence.length)
      warnings.push(
        `Revise com cuidado as páginas ${lowConfidence.join(", ")}: confiança do reconhecimento baixa ou indisponível. Isso não é uma medida de veracidade.`,
      );
    return {
      pages,
      emptyPages,
      warnings,
      selectedPages: selected,
      documentPages: document.numPages,
      needsReview: true,
      method: "ocr",
    };
  };
  try {
    return await Promise.race([run(), abortPromise]);
  } catch (error) {
    if (error.name === "PasswordException")
      throw new Error(
        "O PDF está protegido por senha. Use uma cópia desbloqueada autorizada para OCR.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
    operation.abort(abortError());
    pageImage?.dispose();
    await worker?.terminate();
    await loading?.destroy();
  }
}
