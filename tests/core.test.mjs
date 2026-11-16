import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyState,
  createMaterial,
  validateSuggestion,
  reviewSuggestion,
  createTask,
  exportBackup,
  importBackup,
  getProgress,
  validateState,
  validateAiSuggestion,
} from "../src/core.mjs";
const material = () =>
  createMaterial({
    id: "mat-1",
    title: "Texto fictício",
    pages: [
      { page: 1, text: "A água evapora com calor." },
      { page: 2, text: "O vapor pode condensar." },
    ],
    sourceType: "pdf",
    createdAt: "2026-01-01",
  });
const suggestion = () => ({
  id: "q-1",
  materialId: "mat-1",
  type: "question",
  title: "O que pode condensar?",
  content: "Identifique no texto.",
  answer: "O vapor.",
  references: [{ chunkId: "mat-1-trecho-2", page: 2 }],
});
const state = () => ({ ...createEmptyState(), materials: [material()] });
test("extração preserva página e texto colado não inventa página", () => {
  assert.equal(material().chunks[1].page, 2);
  assert.equal(
    createMaterial({ id: "x", title: "T", content: "Texto" }).chunks[0].page,
    null,
  );
});
test("PDF vazio falha explicitamente", () =>
  assert.throws(
    () =>
      createMaterial({
        id: "x",
        title: "T",
        pages: [{ page: 1, text: "  " }],
        sourceType: "pdf",
      }),
    /OCR/,
  ));
test("trechos grandes são limitados e continuam na página original", () => {
  const m = createMaterial({
    id: "x",
    title: "T",
    pages: [{ page: 8, text: "palavra ".repeat(800) }],
  });
  assert.ok(m.chunks.length > 1);
  assert.ok(m.chunks.every((c) => c.text.length <= 1800 && c.page === 8));
});
test("referências e páginas inventadas são recusadas", () => {
  assert.throws(() =>
    validateSuggestion(
      { ...suggestion(), references: [{ chunkId: "falso" }] },
      [material()],
    ),
  );
  assert.throws(() =>
    validateSuggestion(
      {
        ...suggestion(),
        references: [{ chunkId: "mat-1-trecho-2", page: 99 }],
      },
      [material()],
    ),
  );
  assert.throws(() =>
    validateSuggestion({ ...suggestion(), references: [] }, [material()]),
  );
});
test("sugestão começa pendente e aceita edição humana imutável", () => {
  const s = state();
  s.suggestions = [validateSuggestion(suggestion(), s.materials)];
  const updated = reviewSuggestion(s, "q-1", {
    status: "accepted",
    answer: "Vapor de água.",
  });
  assert.equal(s.suggestions[0].status, "pending");
  assert.equal(updated.suggestions[0].status, "accepted");
  assert.equal(updated.suggestions[0].answer, "Vapor de água.");
});
test("backup vai e volta preservando registros", () => {
  const s = state();
  s.tasks.push(
    createTask(
      {
        id: "t1",
        title: "Revisar",
        dueDate: "2026-01-03",
        materialId: "mat-1",
      },
      s.materials,
    ),
  );
  assert.deepEqual(importBackup(exportBackup(s)), s);
});
test("importação combina e não apaga progresso existente", () => {
  const s = state();
  const newer = state();
  newer.tasks.push(
    createTask({ id: "t1", title: "Revisar", dueDate: "2026-01-03" }),
  );
  const merged = importBackup(exportBackup(newer), s);
  assert.equal(merged.materials.length, 1);
  assert.equal(merged.tasks.length, 1);
  assert.equal(s.tasks.length, 0);
});
test("conflitos abortam sem mutar estado", () => {
  const s = state();
  const other = state();
  other.materials[0].title = "Alterado";
  assert.throws(() => importBackup(exportBackup(other), s), /Conflito/);
  assert.equal(s.materials[0].title, "Texto fictício");
});
test("dados malformados, schema futuro, IDs duplicados e datas impossíveis falham", () => {
  assert.throws(() => importBackup("{"));
  assert.throws(() => validateState({ ...state(), schemaVersion: 99 }));
  assert.throws(() =>
    validateState({ ...state(), materials: [material(), material()] }),
  );
  assert.throws(() =>
    createTask({ id: "t", title: "T", dueDate: "2026-02-30" }),
  );
});
test("campos desconhecidos não são importados", () => {
  const s = state();
  s.token = "não importar";
  s.materials[0].secret = "não importar";
  const clean = importBackup(JSON.stringify(s));
  assert.equal(clean.token, undefined);
  assert.equal(clean.materials[0].secret, undefined);
});
test("progresso conta vencidas, concluídas e revisão humana", () => {
  const s = state();
  s.tasks = [
    createTask({ id: "a", title: "A", dueDate: "2026-01-01" }),
    createTask({ id: "b", title: "B", dueDate: "2026-01-02", completed: true }),
  ];
  assert.deepEqual(getProgress(s, "2026-01-03"), {
    materials: 1,
    pendingSuggestions: 0,
    acceptedSuggestions: 0,
    completedTasks: 1,
    totalTasks: 2,
    dueTasks: 1,
    percent: 50,
  });
});

test("provedor não pode aceitar a própria sugestão", () =>
  assert.equal(
    validateAiSuggestion({ ...suggestion(), status: "accepted" }, [material()])
      .status,
    "pending",
  ));
