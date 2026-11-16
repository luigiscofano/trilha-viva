/** Núcleo local-first, sem dependência de DOM, rede ou provedor de IA. */
export const SCHEMA_VERSION = 2;
export const LIMITS = Object.freeze({
  materialCharacters: 300_000,
  chunkCharacters: 1_800,
  backupCharacters: 5_000_000,
  records: 5_000,
});
const text = (value, label, max = 10_000) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${label} inválido.`);
  return value.trim();
};
const id = (value) => {
  const result = text(value, "Identificador", 120);
  if (!/^[\w-]+$/.test(result)) throw new Error("Identificador inválido.");
  return result;
};
const date = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error("Data inválida.");
  return value;
};
const list = (value) => {
  if (!Array.isArray(value) || value.length > LIMITS.records)
    throw new Error("Lista inválida ou muito grande.");
  return value;
};
const unique = (items) => {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error("Identificadores duplicados.");
  return items;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
export function createEmptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    materials: [],
    suggestions: [],
    tasks: [],
    history: [],
  };
}

/** Mantém a página real da extração; texto colado não recebe página inventada. */
export function createMaterial({
  id: materialId,
  title,
  sourceType = "text",
  content = "",
  pages,
  createdAt = new Date().toISOString(),
}) {
  const safeId = id(materialId);
  if (!["text", "pdf"].includes(sourceType))
    throw new Error("Tipo de material não suportado.");
  const sourcePages = pages ?? [{ page: null, text: content }];
  if (!Array.isArray(sourcePages) || sourcePages.length > LIMITS.records)
    throw new Error("Páginas inválidas.");
  let characters = 0;
  const chunks = [];
  for (const sourcePage of sourcePages) {
    if (!sourcePage || typeof sourcePage.text !== "string")
      throw new Error("Texto da página inválido.");
    const page = sourcePage.page ?? null;
    if (page !== null && (!Number.isInteger(page) || page < 1))
      throw new Error("Página inválida.");
    const normalized = sourcePage.text.replace(/\r\n/g, "\n").trim();
    characters += normalized.length;
    if (characters > LIMITS.materialCharacters)
      throw new Error("Material excede o limite de caracteres.");
    let rest = normalized;
    while (rest) {
      let end = Math.min(rest.length, LIMITS.chunkCharacters);
      if (end < rest.length) {
        const boundary = rest.lastIndexOf(" ", end);
        if (boundary > end / 2) end = boundary;
      }
      chunks.push({
        id: `${safeId}-trecho-${chunks.length + 1}`,
        materialId: safeId,
        page,
        text: rest.slice(0, end).trim(),
      });
      rest = rest.slice(end).trim();
    }
  }
  if (!chunks.length)
    throw new Error(
      "Nenhum texto extraído. O PDF pode ser digitalizado; use OCR ou cole o texto.",
    );
  return {
    id: safeId,
    title: text(title, "Título", 240),
    sourceType,
    createdAt: text(createdAt, "Data de criação", 80),
    chunks,
  };
}

/** Valida referências estruturais, não a veracidade semântica: revisão humana segue obrigatória. */
export function validateSuggestion(candidate, materials) {
  if (!candidate || !["summary", "topic", "question"].includes(candidate.type))
    throw new Error("Tipo de sugestão inválido.");
  const material = materials.find((item) => item.id === candidate.materialId);
  if (!material) throw new Error("Material de origem não encontrado.");
  const references = list(candidate.references).map((reference) => {
    const chunk = material.chunks.find((item) => item.id === reference.chunkId);
    if (!chunk) throw new Error("Referência não existe no material.");
    if (reference.page !== undefined && reference.page !== chunk.page)
      throw new Error("Página não corresponde à fonte.");
    return { chunkId: chunk.id, page: chunk.page };
  });
  if (!references.length)
    throw new Error(
      "Fonte insuficiente: indique pelo menos um trecho verificável.",
    );
  const status = candidate.status ?? "pending";
  if (!["pending", "accepted", "discarded"].includes(status))
    throw new Error("Estado de revisão inválido.");
  const result = {
    id: id(candidate.id),
    materialId: material.id,
    type: candidate.type,
    title: text(candidate.title, "Título", 240),
    content: text(candidate.content, "Conteúdo"),
    references,
    status,
  };
  if (candidate.type === "question")
    result.answer = text(candidate.answer, "Resposta");
  return result;
}

/** Conteúdo vindo do provedor nunca pode aprovar a si mesmo. */
export function validateAiSuggestion(candidate, materials) {
  return validateSuggestion({ ...candidate, status: "pending" }, materials);
}

/** Só altera o estado após validar integralmente a sugestão editada. */
export function reviewSuggestion(
  state,
  suggestionId,
  { status, title, content, answer } = {},
) {
  const current = state.suggestions.find((item) => item.id === suggestionId);
  if (!current) throw new Error("Sugestão não encontrada.");
  const patch = Object.fromEntries(
    Object.entries({ status, title, content, answer }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  const updated = validateSuggestion({ ...current, ...patch }, state.materials);
  return recordHistory(
    {
      ...state,
      suggestions: state.suggestions.map((item) =>
        item.id === suggestionId ? updated : item,
      ),
    },
    {
      type: "suggestion-reviewed",
      entityId: suggestionId,
      summary: `Sugestão revisada: ${updated.title} (${updated.status}).`,
    },
  );
}

export function createTask(
  { id: taskId, title, dueDate, materialId = null, completed = false },
  materials = [],
) {
  if (materialId !== null && !materials.some((item) => item.id === materialId))
    throw new Error("Material da tarefa não encontrado.");
  if (typeof completed !== "boolean")
    throw new Error("Progresso da tarefa inválido.");
  return {
    id: id(taskId),
    title: text(title, "Título da tarefa", 240),
    dueDate: date(dueDate),
    materialId,
    completed,
  };
}

/** Reconstrói apenas campos conhecidos; dados arbitrários não entram no estado da aplicação. */
export function validateState(input) {
  if (!input || ![1, SCHEMA_VERSION].includes(input.schemaVersion))
    throw new Error("Versão de backup incompatível.");
  const materials = unique(
    list(input.materials).map((material) => {
      const materialId = id(material.id);
      if (!["text", "pdf"].includes(material.sourceType))
        throw new Error("Tipo de material inválido.");
      const chunks = unique(
        list(material.chunks).map((chunk) => {
          if (
            chunk.materialId !== materialId ||
            (chunk.page !== null &&
              (!Number.isInteger(chunk.page) || chunk.page < 1))
          )
            throw new Error("Origem do trecho inválida.");
          return {
            id: id(chunk.id),
            materialId,
            page: chunk.page,
            text: text(chunk.text, "Trecho", LIMITS.chunkCharacters),
          };
        }),
      );
      if (
        !chunks.length ||
        chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) >
          LIMITS.materialCharacters
      )
        throw new Error("Conteúdo do material inválido.");
      return {
        id: materialId,
        title: text(material.title, "Título", 240),
        sourceType: material.sourceType,
        createdAt: text(material.createdAt, "Data de criação", 80),
        chunks,
      };
    }),
  );
  unique(materials.flatMap((material) => material.chunks));
  const suggestions = unique(
    list(input.suggestions).map((candidate) =>
      validateSuggestion(candidate, materials),
    ),
  );
  const tasks = unique(
    list(input.tasks).map((task) => createTask(task, materials)),
  );
  const history = unique(
    list(input.history ?? (input.schemaVersion === 1 ? [] : undefined)).map(
      validateHistoryEvent,
    ),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    materials,
    suggestions,
    tasks,
    history,
  };
}

export function exportBackup(state) {
  const serialized = JSON.stringify(validateState(state), null, 2);
  if (serialized.length > LIMITS.backupCharacters)
    throw new Error("Backup excede o limite permitido.");
  return serialized;
}

/** Importação atômica por união. Um conflito nunca substitui silenciosamente dados locais. */
export function importBackup(serialized, current = createEmptyState()) {
  if (
    typeof serialized !== "string" ||
    serialized.length > LIMITS.backupCharacters
  )
    throw new Error("Backup inválido ou muito grande.");
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Arquivo não contém JSON válido.");
  }
  const incoming = validateState(parsed);
  const existing = validateState(current);
  const merged = createEmptyState();
  for (const key of ["materials", "suggestions", "tasks", "history"]) {
    const byId = new Map(existing[key].map((item) => [item.id, item]));
    for (const item of incoming[key]) {
      if (
        byId.has(item.id) &&
        JSON.stringify(byId.get(item.id)) !== JSON.stringify(item)
      )
        throw new Error(
          `Conflito no item ${item.id}. Exporte uma cópia e resolva o conflito antes de importar.`,
        );
      byId.set(item.id, item);
    }
    merged[key] = [...byId.values()];
  }
  return clone(validateState(merged));
}

export function getProgress(
  state,
  today = new Date().toISOString().slice(0, 10),
) {
  date(today);
  const completed = state.tasks.filter((task) => task.completed).length;
  return {
    materials: state.materials.length,
    pendingSuggestions: state.suggestions.filter(
      (item) => item.status === "pending",
    ).length,
    acceptedSuggestions: state.suggestions.filter(
      (item) => item.status === "accepted",
    ).length,
    completedTasks: completed,
    totalTasks: state.tasks.length,
    dueTasks: state.tasks.filter(
      (task) => !task.completed && task.dueDate <= today,
    ).length,
    percent: state.tasks.length
      ? Math.round((completed / state.tasks.length) * 100)
      : 0,
  };
}

export const HISTORY_TYPES = Object.freeze([
  "material-added",
  "material-renamed",
  "material-deleted",
  "suggestion-created",
  "suggestion-reviewed",
  "task-created",
  "task-updated",
  "task-deleted",
  "backup-imported",
]);

function validateHistoryEvent(event) {
  if (!event || !HISTORY_TYPES.includes(event.type))
    throw new Error("Tipo de evento inválido.");
  const occurredAt = text(event.occurredAt, "Data do evento", 80);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(occurredAt) ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    new Date(occurredAt).toISOString() !== occurredAt
  )
    throw new Error("Data do evento inválida.");
  return {
    id: id(event.id),
    type: event.type,
    occurredAt,
    entityId: event.entityId === null ? null : id(event.entityId),
    summary: text(event.summary, "Descrição do evento", 1000),
  };
}

/** Eventos não precisam apontar para um registro ainda existente: preservam exclusões no histórico. */
export function recordHistory(
  state,
  {
    id: eventId = globalThis.crypto.randomUUID(),
    occurredAt = new Date().toISOString(),
    entityId = null,
    type,
    summary,
  },
) {
  const clean = validateState(state);
  const event = validateHistoryEvent({
    id: eventId,
    occurredAt,
    entityId,
    type,
    summary,
  });
  if (clean.history.some((item) => item.id === event.id))
    throw new Error("Evento de histórico duplicado.");
  if (clean.history.length >= LIMITS.records)
    throw new Error(
      "Histórico atingiu o limite. Exporte seus dados antes de continuar.",
    );
  return { ...clean, history: [...clean.history, event] };
}

/** A renomeação preserva IDs, trechos, páginas e todas as referências já existentes. */
export function renameMaterial(state, materialId, title) {
  const clean = validateState(state);
  const material = clean.materials.find((item) => item.id === materialId);
  if (!material) throw new Error("Material não encontrado.");
  const nextTitle = text(title, "Título", 240);
  if (nextTitle === material.title) return clean;
  return recordHistory(
    {
      ...clean,
      materials: clean.materials.map((item) =>
        item.id === materialId ? { ...item, title: nextTitle } : item,
      ),
    },
    {
      type: "material-renamed",
      entityId: materialId,
      summary: `Material renomeado de “${material.title}” para “${nextTitle}”.`,
    },
  );
}

/** Consulte estas dependências para explicar a consequência antes de confirmar uma exclusão. */
export function getMaterialDependencies(state, materialId) {
  const clean = validateState(state);
  if (!clean.materials.some((item) => item.id === materialId))
    throw new Error("Material não encontrado.");
  return {
    suggestions: clean.suggestions
      .filter((item) => item.materialId === materialId)
      .map((item) => item.id),
    tasks: clean.tasks
      .filter((item) => item.materialId === materialId)
      .map((item) => item.id),
  };
}

/** Sem cascata explícita, recusa excluir fontes usadas por sugestões ou tarefas. */
export function deleteMaterial(state, materialId, { cascade = false } = {}) {
  if (typeof cascade !== "boolean")
    throw new Error("Confirmação de exclusão inválida.");
  const clean = validateState(state);
  const dependencies = getMaterialDependencies(clean, materialId);
  if (
    !cascade &&
    (dependencies.suggestions.length || dependencies.tasks.length)
  ) {
    throw new Error(
      `Este material possui ${dependencies.suggestions.length} sugestão(ões) e ${dependencies.tasks.length} tarefa(s). Confirme explicitamente a exclusão conjunta ou mantenha a fonte.`,
    );
  }
  const material = clean.materials.find((item) => item.id === materialId);
  return recordHistory(
    {
      ...clean,
      materials: clean.materials.filter((item) => item.id !== materialId),
      suggestions: clean.suggestions.filter(
        (item) => item.materialId !== materialId,
      ),
      tasks: clean.tasks.filter((item) => item.materialId !== materialId),
    },
    {
      type: "material-deleted",
      entityId: materialId,
      summary: `Material “${material.title}” excluído com ${dependencies.suggestions.length} sugestão(ões) e ${dependencies.tasks.length} tarefa(s) vinculada(s).`,
    },
  );
}
