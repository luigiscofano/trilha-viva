import { createEmptyState, createMaterial, createTask } from "./core.mjs";
const sampleTexts = [
  [
    "Fundamentos de ecologia",
    "Ecossistemas são formados por seres vivos e pelos elementos não vivos do ambiente. Nas cadeias alimentares, a energia flui dos produtores aos consumidores e decompositores. Parte da energia é dissipada como calor em cada transferência. A matéria, diferentemente da energia, circula nos ciclos biogeoquímicos. Preservar a biodiversidade ajuda a manter o equilíbrio dos ecossistemas.",
  ],
  [
    "Introdução à estatística",
    "A média aritmética é a soma dos valores dividida pela quantidade de observações. A mediana é o valor central dos dados ordenados. Valores extremos podem deslocar a média mais do que a mediana. A escolha de uma medida de tendência central depende da distribuição dos dados e do objetivo da análise.",
  ],
  [
    "Pensamento computacional",
    "Decomposição significa dividir um problema em partes menores. Reconhecer padrões ajuda a identificar semelhanças entre problemas. A abstração destaca informações relevantes e descarta detalhes desnecessários. Um algoritmo descreve uma sequência de instruções para realizar uma tarefa.",
  ],
];
export function sampleState() {
  const s = createEmptyState();
  s.materials = sampleTexts.map(([title, content], i) =>
    createMaterial({
      id: `sample-${i}`,
      title,
      content,
      createdAt: "2026-11-16T09:00:00.000Z",
    }),
  );
  s.suggestions = [
    {
      id: "example-question",
      materialId: s.materials[0].id,
      type: "question",
      title: "Fluxo de energia",
      content:
        "Qual é a diferença entre o fluxo de energia e o ciclo da matéria em um ecossistema?",
      answer:
        "A energia flui pela cadeia alimentar e parte dela é dissipada como calor. A matéria circula e pode ser reutilizada por meio dos ciclos biogeoquímicos.",
      references: [{ chunkId: s.materials[0].chunks[0].id, page: null }],
      status: "pending",
    },
  ];
  s.tasks = [
    createTask(
      {
        id: "task-1",
        title: "Revisar fluxo de energia",
        dueDate: new Date().toISOString().slice(0, 10),
        materialId: "sample-0",
      },
      s.materials,
    ),
    createTask(
      {
        id: "task-2",
        title: "Comparar média e mediana",
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        materialId: "sample-1",
      },
      s.materials,
    ),
    createTask(
      {
        id: "task-3",
        title: "Conhecer as etapas do pensamento computacional",
        dueDate: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
        materialId: "sample-2",
      },
      s.materials,
    ),
  ];
  return s;
}
