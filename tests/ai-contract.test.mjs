import test from "node:test";
import assert from "node:assert/strict";
import { createMaterial } from "../src/core.mjs";
import {
  createStudyRequest,
  validateStudyResponse,
  generateStudyContent,
} from "../src/ai-contract.mjs";
const material = createMaterial({
  id: "m1",
  title: "Energia",
  content: "A energia flui nos ecossistemas.",
});
test("pedido inclui somente o material e referências selecionados", () => {
  const req = createStudyRequest(material);
  assert.equal(req.materialId, "m1");
  assert.equal(req.chunks[0].page, null);
  assert.equal(req.chunks[0].id, material.chunks[0].id);
  assert.equal(req.history, undefined);
});
test("IA não configurada falha de maneira explícita", async () => {
  await assert.rejects(generateStudyContent(), /não configurada/);
});
test("resposta insuficiente não inventa sugestão", () => {
  assert.deepEqual(
    validateStudyResponse(
      { schemaVersion: 1, insufficientEvidence: true },
      [material],
      "m1",
    ),
    { suggestions: [], insufficientEvidence: true },
  );
});
test("resposta de IA exige a mesma fonte e revisão humana", () => {
  const item = {
    id: "s1",
    materialId: "m1",
    type: "summary",
    title: "Energia",
    content: "A energia flui.",
    references: [{ chunkId: material.chunks[0].id }],
    status: "accepted",
  };
  const result = validateStudyResponse(
    { schemaVersion: 1, suggestions: [item] },
    [material],
    "m1",
  );
  assert.equal(result.suggestions[0].status, "pending");
  assert.throws(
    () =>
      validateStudyResponse(
        { schemaVersion: 1, suggestions: [{ ...item, materialId: "other" }] },
        [material],
        "m1",
      ),
    /outro material/,
  );
});
