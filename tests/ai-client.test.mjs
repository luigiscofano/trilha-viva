import test from "node:test";
import assert from "node:assert/strict";
import {
  readIntegrationStatus,
  requestSuggestions,
} from "../src/ai-client.mjs";
import { createMaterial } from "../src/core.mjs";
const material = createMaterial({
  id: "material",
  title: "Amostra",
  content: "A energia flui.",
});
test("status indisponível não finge backend configurado", async () => {
  assert.equal(
    (
      await readIntegrationStatus(async () => {
        throw Error("offline");
      })
    ).configured,
    false,
  );
});
test("geração sem token não envia requisição", async () => {
  let sent = false;
  await assert.rejects(
    requestSuggestions(material, [material], "", async () => {
      sent = true;
    }),
    /token/,
  );
  assert.equal(sent, false);
});
test("cliente envia somente material escolhido e exige revisão humana", async () => {
  let body;
  const response = await requestSuggestions(
    material,
    [material],
    "test-only",
    async (url, options) => {
      assert.equal(url, "./api/study");
      body = JSON.parse(options.body);
      assert.equal(options.credentials, "omit");
      return {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          suggestions: [
            {
              id: "s",
              materialId: "material",
              type: "topic",
              title: "Energia",
              content: "Fluxo de energia",
              references: [{ chunkId: material.chunks[0].id }],
              status: "accepted",
            },
          ],
        }),
      };
    },
  );
  assert.equal(body.materialId, "material");
  assert.equal(body.tasks, undefined);
  assert.equal(response.suggestions[0].status, "pending");
});
test("falha do provedor aparece como falha real", async () => {
  await assert.rejects(
    requestSuggestions(material, [material], "test-only", async () => ({
      ok: false,
      json: async () => ({ error: { message: "Limite atingido" } }),
    })),
    /Limite atingido/,
  );
});
