/** Extração local: o PDF nunca é enviado a um serviço externo. Não inclui OCR. */
export const PDF_LIMITS = Object.freeze({
  bytes: 10 * 1024 * 1024,
  pages: 100,
  characters: 300_000,
  timeoutMs: 30_000,
});

export async function loadBrowserPdfEngine() {
  const engine = await import("../vendor/pdf.mjs");
  engine.GlobalWorkerOptions.workerSrc = new URL(
    "../vendor/pdf.worker.mjs",
    import.meta.url,
  ).href;
  return engine;
}

export async function extractPdf(
  input,
  {
    loadEngine = loadBrowserPdfEngine,
    onProgress = () => {},
    limits = PDF_LIMITS,
  } = {},
) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > limits.bytes)
    throw new Error("O PDF deve ter até 10 MB e não pode estar vazio.");
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new Error("O arquivo não contém um PDF reconhecível.");
  const engine = await loadEngine();
  // Recursos da mesma origem: evita buscas externas durante a extração.
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
  const loading = engine.getDocument({
    ...assets,
    data: bytes.slice(),
    isEvalSupported: false,
    useSystemFonts: false,
  });
  let timer;
  const read = async () => {
    const document = await loading.promise;
    if (document.numPages > limits.pages)
      throw new Error(`O PDF excede o limite de ${limits.pages} páginas.`);
    const pages = [];
    const emptyPages = [];
    let characters = 0;
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => typeof item.str === "string")
        .map((item) => item.str + (item.hasEOL ? "\n" : " "))
        .join("")
        .trim();
      characters += text.length;
      if (characters > limits.characters)
        throw new Error(
          "O texto extraído excede o limite de 300 mil caracteres.",
        );
      if (!text) emptyPages.push(number);
      pages.push({ page: number, text });
      page.cleanup();
      onProgress({ completed: number, total: document.numPages });
    }
    if (emptyPages.length === pages.length)
      throw new Error(
        "Nenhum texto foi extraído. O PDF pode ser digitalizado ou conter somente imagens. Faça OCR fora do aplicativo ou cole o texto.",
      );
    return {
      pages,
      emptyPages,
      warnings: emptyPages.length
        ? [
            `Sem texto nas páginas ${emptyPages.join(", ")}. Elas podem conter imagens ou páginas em branco; não foram interpretadas.`,
          ]
        : [],
    };
  };
  try {
    return await Promise.race([
      read(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("A extração demorou demais. Tente um PDF menor.")),
          limits.timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    if (error.name === "PasswordException")
      throw new Error(
        "Este PDF está protegido por senha. Use uma cópia desbloqueada que você tenha autorização para ler.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    await loading.destroy();
  }
}
