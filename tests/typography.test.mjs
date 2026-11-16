import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tipografia A aplica títulos e corpo por tokens globais sem CDN", async () => {
  const css = await readFile(
    new URL("../src/style.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /--font-heading: "Manrope Variable"/);
  assert.match(css, /--font-body: "DM Sans Variable"/);
  assert.match(
    css,
    /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{\s*font-family: var\(--font-heading\)/,
  );
  assert.match(css, /font-family: var\(--font-body\)/);
  assert.match(css, /font: inherit/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/);
});

test("dependências de fontes têm versões fixadas e dados Latin Extended", async () => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url)),
  );
  for (const name of ["manrope", "dm-sans"]) {
    assert.match(
      pkg.dependencies[`@fontsource-variable/${name}`],
      /^\d+\.\d+\.\d+$/,
    );
    const css = await readFile(
      new URL(
        `../node_modules/@fontsource-variable/${name}/index.css`,
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(css, /latin-ext/);
    assert.match(css, /font-display: swap/);
  }
});
