import { mkdir, cp, rm } from "node:fs/promises";
await import("./prepare-vendor.mjs");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "src", "vendor", "assets"])
  await cp(file, `dist/${file}`, { recursive: true });
