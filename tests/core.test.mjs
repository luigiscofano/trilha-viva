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
  recordHistory,
  renameMaterial,
  deleteMaterial,
  getMaterialDependencies,
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

test("backup v1 migra para v2 sem apagar dados ou inventar histórico", () => {
  const old = {
    schemaVersion: 1,
    materials: [material()],
    suggestions: [],
    tasks: [],
  };
  const migrated = importBackup(JSON.stringify(old));
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.materials, old.materials);
  assert.deepEqual(migrated.history, []);
  assert.equal(old.schemaVersion, 1);
});

test("histórico durável sobrevive exportação, importação e união", () => {
  const event = {
    id: "event-1",
    occurredAt: "2026-01-01T12:00:00.000Z",
    type: "material-added",
    entityId: "mat-1",
    summary: "Material adicionado.",
  };
  const s = recordHistory(state(), event);
  assert.deepEqual(importBackup(exportBackup(s)), s);
  const extra = recordHistory(state(), {
    ...event,
    id: "event-2",
    summary: "Outra ação.",
  });
  assert.equal(importBackup(exportBackup(extra), s).history.length, 2);
  assert.equal(importBackup(exportBackup(s), s).history.length, 1);
});

test("renomear não altera referências, sugestões ou páginas", () => {
  const s = state();
  s.suggestions = [validateSuggestion(suggestion(), s.materials)];
  const renamed = renameMaterial(s, "mat-1", "Novo nome");
  assert.equal(renamed.materials[0].title, "Novo nome");
  assert.deepEqual(renamed.materials[0].chunks, s.materials[0].chunks);
  assert.deepEqual(renamed.suggestions, s.suggestions);
  assert.equal(renamed.history.at(-1).type, "material-renamed");
  assert.equal(s.materials[0].title, "Texto fictício");
});

test("excluir fonte em uso bloqueia sem perder sugestões ou tarefas", () => {
  const s = state();
  s.suggestions = [validateSuggestion(suggestion(), s.materials)];
  s.tasks = [
    createTask(
      {
        id: "t1",
        title: "Revisar",
        dueDate: "2026-01-01",
        materialId: "mat-1",
      },
      s.materials,
    ),
  ];
  const before = exportBackup(s);
  assert.deepEqual(getMaterialDependencies(s, "mat-1"), {
    suggestions: ["q-1"],
    tasks: ["t1"],
  });
  assert.throws(() => deleteMaterial(s, "mat-1"), /Confirme explicitamente/);
  assert.equal(exportBackup(s), before);
  const deleted = deleteMaterial(s, "mat-1", { cascade: true });
  assert.equal(deleted.materials.length, 0);
  assert.equal(deleted.suggestions.length, 0);
  assert.equal(deleted.tasks.length, 0);
  assert.equal(deleted.history.at(-1).entityId, "mat-1");
  assert.match(deleted.history.at(-1).summary, /1 sugestão.*1 tarefa/);
  assert.deepEqual(importBackup(exportBackup(deleted)), deleted);
});

test("exclusão isolada preserva registros sem vínculo", () => {
  const s = state();
  s.tasks = [createTask({ id: "t1", title: "Livre", dueDate: "2026-01-01" })];
  const deleted = deleteMaterial(s, "mat-1");
  assert.deepEqual(deleted.tasks, s.tasks);
  assert.equal(deleted.history.length, 1);
});

test("revisão grava evento e eventos inválidos ou conflitantes não entram", () => {
  const s = state();
  s.suggestions = [validateSuggestion(suggestion(), s.materials)];
  assert.equal(
    reviewSuggestion(s, "q-1", { status: "accepted" }).history.at(-1).type,
    "suggestion-reviewed",
  );
  assert.throws(() => recordHistory(s, { type: "inventado", summary: "A" }));
  assert.throws(() =>
    recordHistory(s, {
      type: "task-created",
      occurredAt: "2026-02-30T12:00:00.000Z",
      summary: "A",
    }),
  );
  const event = {
    id: "ev",
    type: "task-created",
    occurredAt: "2026-01-01T12:00:00.000Z",
    summary: "A",
  };
  const one = recordHistory(s, event);
  const other = recordHistory(s, { ...event, summary: "B" });
  assert.throws(() => importBackup(exportBackup(other), one), /Conflito/);
});

test("referência não pode trocar fonte por trecho de outro material", () => {
  const other = createMaterial({
    id: "other",
    title: "Outra fonte",
    content: "Texto igual não torna as fontes intercambiáveis.",
  });
  assert.throws(
    () =>
      validateSuggestion(
        {
          ...suggestion(),
          references: [{ chunkId: other.chunks[0].id, page: null }],
        },
        [material(), other],
      ),
    /não existe no material/,
  );
});

test("página omitida é recuperada do trecho, mas tipo incorreto nunca é aceito", () => {
  const good = validateSuggestion(
    { ...suggestion(), references: [{ chunkId: "mat-1-trecho-2" }] },
    [material()],
  );
  assert.equal(good.references[0].page, 2);
  assert.throws(
    () =>
      validateSuggestion(
        {
          ...suggestion(),
          references: [{ chunkId: "mat-1-trecho-2", page: "2" }],
        },
        [material()],
      ),
    /não corresponde/,
  );
});

test("backup inválido em qualquer parte preserva integralmente estado existente", () => {
  const current = state();
  const before = JSON.stringify(current);
  const bad = state();
  bad.tasks = [
    {
      id: "t",
      title: "T",
      dueDate: "2026-01-01",
      materialId: "ausente",
      completed: false,
    },
  ];
  assert.throws(() => importBackup(JSON.stringify(bad), current));
  assert.equal(JSON.stringify(current), before);
  bad.tasks = [];
  bad.suggestions = [suggestion()];
  bad.suggestions[0].references[0].page = 999;
  assert.throws(() => importBackup(JSON.stringify(bad), current));
  assert.equal(JSON.stringify(current), before);
});

test("importação retornada não compartilha objetos mutáveis com estado anterior", () => {
  const current = state();
  const restored = importBackup(exportBackup(current), current);
  restored.materials[0].chunks[0].text = "Alterado depois";
  assert.equal(
    current.materials[0].chunks[0].text,
    "A água evapora com calor.",
  );
});

test("campos de protótipo em JSON não contaminam objetos da aplicação", () => {
  const input = JSON.parse(exportBackup(state()));
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
  });
  input.materials[0].constructor = { prototype: { polluted: true } };
  const restored = importBackup(JSON.stringify(input));
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.hasOwn(restored, "__proto__"), false);
  assert.equal(Object.hasOwn(restored.materials[0], "constructor"), false);
});

test("mesclagem de backups que excede limite exportável aborta sem mutação", () => {
  const largeState = (prefix) => ({
    ...createEmptyState(),
    materials: Array.from({ length: 9 }, (_, i) =>
      createMaterial({
        id: `${prefix}-${i}`,
        title: `Material ${i}`,
        content: "x".repeat(299_000),
      }),
    ),
  });
  const current = largeState("a");
  const incoming = largeState("b");
  const before = exportBackup(current);
  const payload = exportBackup(incoming);
  assert.throws(() => importBackup(payload, current), /Backup excede/);
  assert.equal(exportBackup(current), before);
});

test("limite de registros é aplicado na união e não descarta itens antigos", () => {
  const current = createEmptyState();
  current.tasks = Array.from({ length: 5000 }, (_, i) =>
    createTask({ id: `task-${i}`, title: "T", dueDate: "2026-01-01" }),
  );
  const incoming = createEmptyState();
  incoming.tasks = [
    createTask({ id: "extra", title: "Extra", dueDate: "2026-01-01" }),
  ];
  assert.throws(
    () => importBackup(exportBackup(incoming), current),
    /Lista inválida/,
  );
  assert.equal(current.tasks.length, 5000);
});

test("identificador longo não gera material impossível de exportar", () => {
  assert.throws(
    () => createMaterial({ id: "m".repeat(120), title: "T", content: "Fonte" }),
    /muito longo/,
  );
  const valid = createMaterial({
    id: "m".repeat(100),
    title: "T",
    content: "Fonte",
  });
  assert.deepEqual(
    importBackup(exportBackup({ ...createEmptyState(), materials: [valid] }))
      .materials[0],
    valid,
  );
});

test("divisão de texto não corta emoji no limite entre trechos", () => {
  const content = "a".repeat(1799) + "🌿" + "b".repeat(20);
  const m = createMaterial({ id: "unicode", title: "Fonte", content });
  assert.equal(m.chunks.map((c) => c.text).join(""), content);
  assert.equal(m.chunks[0].text.length, 1799);
  assert.ok(m.chunks[1].text.startsWith("🌿"));
});

test("referência e estado aceito permanecem iguais após ciclos repetidos de backup", () => {
  let current = state();
  current.suggestions = [
    validateSuggestion(
      { ...suggestion(), status: "accepted" },
      current.materials,
    ),
  ];
  const original = structuredClone(current);
  for (let i = 0; i < 5; i++) current = importBackup(exportBackup(current));
  assert.deepEqual(current, original);
});
