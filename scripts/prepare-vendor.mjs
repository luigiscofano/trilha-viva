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
