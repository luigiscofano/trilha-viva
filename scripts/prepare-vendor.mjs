import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("vendor", { recursive: true });
for (const name of ["pdf.mjs", "pdf.worker.mjs"])
  await copyFile(`node_modules/pdfjs-dist/build/${name}`, `vendor/${name}`);
await copyFile("node_modules/pdfjs-dist/LICENSE", "vendor/PDFJS-LICENSE.txt");

for (const directory of ["standard_fonts", "cmaps", "wasm"]) {
  await cp(`node_modules/pdfjs-dist/${directory}`, `vendor/${directory}`, {
    recursive: true,
  });
}

// OCR carregado sob demanda; modelos e WebAssembly permanecem na mesma origem.
await mkdir("vendor/ocr/lang", { recursive: true });
for (const name of ["tesseract.esm.min.js", "worker.min.js"])
  await copyFile(
    `node_modules/tesseract.js/dist/${name}`,
    `vendor/ocr/${name}`,
  );
await cp("node_modules/tesseract.js-core", "vendor/ocr/core", {
  recursive: true,
});
for (const language of ["por", "eng"])
  await copyFile(
    `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
    `vendor/ocr/lang/${language}.traineddata.gz`,
  );
await copyFile(
  "node_modules/tesseract.js/LICENSE.md",
  "vendor/ocr/LICENSE-tesseract.txt",
);

// Fontes auto-hospedadas: nenhuma conexão ao Google Fonts ao abrir a aplicação.
const { readFile, writeFile } = await import("node:fs/promises");
await mkdir("vendor/fonts", { recursive: true });
let typography = "";
for (const family of ["manrope", "dm-sans"]) {
  const base = `node_modules/@fontsource-variable/${family}`;
  for (const sheet of family === "dm-sans"
    ? ["index.css", "wght-italic.css"]
    : ["index.css"]) {
    const css = await readFile(`${base}/${sheet}`, "utf8");
    const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    for (const face of faces) {
      const file = face.match(
        /url\(\.\/files\/([^)]*latin[^)]*\.woff2)\)/,
      )?.[1];
      if (!file) continue;
      await copyFile(`${base}/files/${file}`, `vendor/fonts/${file}`);
      typography += face.replace("./files/", "./") + "\n";
    }
  }
  await copyFile(`${base}/LICENSE`, `vendor/fonts/LICENSE-${family}.txt`);
}
await writeFile("vendor/fonts/fonts.css", typography);
