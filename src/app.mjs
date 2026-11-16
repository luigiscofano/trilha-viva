import { readIntegrationStatus, requestSuggestions } from "./ai-client.mjs";
import { brandMarkup, learningIllustration } from "./brand.mjs";
import { extractPdf } from "./pdf.mjs";
import {
  createEmptyState,
  createMaterial,
  createTask,
  exportBackup,
  importBackup,
  getProgress,
  reviewSuggestion,
  validateSuggestion,
} from "./core.mjs";
import { icon, escape } from "./ui-helpers.mjs";
const uid = () => crypto.randomUUID();
const KEY = "trilha-viva-preview-v1";
import { sampleState } from "./demo.mjs";
let state;
let storageBlocked = false;
let damagedBackup = null;
let unsavedChanges = false;
try {
  const stored = localStorage.getItem(KEY);
  state = stored ? importBackup(stored) : sampleState();
} catch {
  storageBlocked = true;
  try {
    damagedBackup = localStorage.getItem(KEY);
  } catch {}
  state = createEmptyState();
}
let view = "dashboard";
let search = "";
let reviewFilter = "pending";
let selectedSuggestion = null;
let integrationStatus = { configured: false };
let operatorToken = "";
const pages = {
  dashboard: "Visão geral",
  materials: "Meus materiais",
  review: "Revisão de conteúdo",
  plan: "Plano de estudos",
  settings: "Dados e integrações",
};
function save() {
  try {
    if (storageBlocked)
      throw new Error(
        "Armazenamento bloqueado para preservar dados anteriores.",
      );
    localStorage.setItem(KEY, exportBackup(state));
    unsavedChanges = false;
    return true;
  } catch {
    unsavedChanges = true;
    toast(
      "Não foi possível salvar neste navegador. Exporte um backup antes de fechar.",
    );
    return false;
  }
}
function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = unsavedChanges
    ? "Alterações apenas nesta sessão. Exporte um backup. " + text
    : text;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4200);
}
const button = (label, action, type = "", ico) =>
  `<button class="btn ${type}" data-action="${action}">${ico ? icon(ico, 16) : ""}${label}</button>`;
const materialTitle = (id) =>
  state.materials.find((m) => m.id === id)?.title || "Estudo livre";
const progress = () => getProgress(state);
function heading(eyebrow, title, subtitle, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
function shell() {
  const pending = state.suggestions.filter(
    (s) => s.status === "pending",
  ).length;
  const navigation = [
    ["dashboard", "chart", "Visão geral"],
    ["materials", "book", "Materiais"],
    ["review", "file", "Revisões"],
    ["plan", "calendar", "Meu plano"],
  ];
  document.getElementById("app").innerHTML = `
    <div class="shell">
      <header class="site-header"><div class="header-inner">
        ${brandMarkup()}
        <nav class="nav" aria-label="Navegação principal">${navigation.map(([id, symbol, label]) => `<button data-view="${id}" class="${view === id ? "active" : ""}" ${view === id ? 'aria-current="page"' : ""}>${icon(symbol, 17)}${label}${id === "review" && pending ? `<span class="count">${pending}</span>` : ""}</button>`).join("")}</nav>
        <div class="header-actions"><button class="icon-button" data-view="settings" aria-label="Dados e integrações" title="Dados e integrações">${icon("settings")}</button><span class="avatar" aria-label="Perfil local">TV</span></div>
      </div></header>
      <main class="main"><div class="content fade-in" id="content" tabindex="-1">
        ${storageBlocked ? `<div class="callout" role="alert">O armazenamento anterior não pôde ser lido. Ele foi preservado sem sobrescrever. Exporte uma cópia dos dados originais em Dados e integrações; novas alterações permanecem somente nesta sessão.</div>` : ""}
        ${{ dashboard, materials, review, plan, settings }[view]()}
        <footer class="footer-note">${icon("shield", 14)} Dados salvos apenas neste navegador. Faça backup para não perder seus estudos. <button class="text-link" data-action="export">Exportar backup</button></footer>
      </div></main>
    </div>`;
}
function dashboard() {
  const pending = state.suggestions.filter(
      (s) => s.status === "pending",
    ).length,
    done = state.tasks.filter((t) => t.completed).length;
  return `<section class="hero" aria-label="Seu espaço de aprendizado"><div class="hero-copy"><div class="eyebrow">UM ESPAÇO PARA APRENDER MELHOR</div><h1>Conhecimento que<br>faz <span>sentido para você.</span></h1><p>Reúna seus materiais, conecte ideias e transforme cada revisão em um próximo passo. Com clareza, no seu ritmo.</p>${button("Adicionar material", "add-material", "", "plus")}</div>${learningIllustration()}</section><section class="stats" aria-label="Seu progresso">${[
    [state.materials.length, "materiais organizados", "book", ""],
    [pending, "sugestões para conferir", "spark", "amber"],
    [
      state.tasks.filter((t) => !t.completed).length,
      "revisões planejadas",
      "calendar",
      "blue",
    ],
    [done, "tarefas concluídas", "check", "clay"],
  ]
    .map(
      ([n, l, i, c]) =>
        `<div class="stat"><div class="stat-icon ${c}">${icon(i)}</div><div><strong>${n}</strong><span>${l}</span></div></div>`,
    )
    .join(
      "",
    )}</section><div class="two-col"><section><div class="section-title"><h2>Seus materiais</h2><button class="text-link" data-view="materials">Ver biblioteca ${icon("arrow", 14)}</button></div><div class="panel">${
    state.materials.length
      ? state.materials
          .slice(0, 3)
          .map((m, i) => materialRow(m, i))
          .join("")
      : '<p class="muted small">Adicione seu primeiro material para começar.</p>'
  }</div></section><section><div class="section-title"><h2>Próximos passos</h2><button class="text-link" data-view="plan">Ver plano ${icon("arrow", 14)}</button></div><div class="panel">${state.tasks.length ? state.tasks.slice(0, 3).map(taskRow).join("") : '<p class="muted small">Seu plano começa com uma tarefa.</p>'}<div class="mini-progress"><div class="progress-track"><i style="width:${state.tasks.length ? (done / state.tasks.length) * 100 : 0}%"></i></div>${done} de ${state.tasks.length} concluídas</div></div></section></div><div class="footer-note">${icon("shield", 14)} Amostras iniciais são fictícias. Sugestões precisam da sua revisão. Nenhum conteúdo é enviado à IA sem sua confirmação.</div>`;
}
function materialRow(m, i) {
  return `<div class="material-row"><div class="material-icon ${["", "amber", "blue"][i % 3]}">${icon("file", 21)}</div><div class="row-grow"><h3>${escape(m.title)}</h3><p>${m.sourceType === "pdf" ? "PDF" : "Texto"} · ${m.chunks.length} trecho${m.chunks.length === 1 ? "" : "s"} de origem</p></div><div class="row-meta"><span class="tag">Fonte disponível</span><button class="icon-button" data-material="${escape(m.id)}" aria-label="Abrir ${escape(m.title)}">${icon("arrow", 17)}</button></div></div>`;
}
function taskRow(t) {
  return `<label class="task-row"><input type="checkbox" data-task="${escape(t.id)}" ${t.completed ? "checked" : ""}><span><strong>${escape(t.title)}</strong><small>${escape(materialTitle(t.materialId))} · ${formatDate(t.dueDate)}</small></span></label>`;
}
function formatDate(s) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}
function materials() {
  const list = state.materials.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    heading(
      "SUA BIBLIOTECA",
      "Conhecimento começa aqui.",
      "Um lugar para guardar materiais e encontrar suas referências.",
      button("Adicionar material", "add-material", "", "plus"),
    ) +
    `<div class="toolbar"><label class="search">${icon("search", 17)}<input aria-label="Buscar material" id="search" value="${escape(search)}" placeholder="Buscar nos seus materiais..."></label><span class="tag">${state.materials.length} materiais · armazenamento local</span></div><div class="card-grid">${list.map((m, i) => `<article class="material-card"><div class="card-top"><div class="material-icon ${["", "amber", "blue"][i % 3]}">${icon("book", 22)}</div><span class="tag ${["", "gold", "blue"][i % 3]}">${m.sourceType === "pdf" ? "PDF" : "Texto"}</span></div><h3>${escape(m.title)}</h3><p>${escape(m.chunks[0]?.text.slice(0, 140) || "")}...</p><div class="card-footer"><span class="small muted">${m.chunks.length} trecho de origem</span><button class="text-link" data-material="${escape(m.id)}">Abrir ${icon("arrow", 15)}</button></div></article>`).join("")}</div>${!list.length ? '<div class="empty">Nenhum material encontrado.</div>' : ""}<div class="footer-note">${icon("link", 14)} Fontes sempre ao alcance. O exemplo público utiliza textos fictícios escritos para esta demonstração.</div>`
  );
}
function activeSuggestion() {
  const candidates = state.suggestions.filter((s) => s.status === reviewFilter);
  return candidates.find((s) => s.id === selectedSuggestion) || candidates[0];
}
function review() {
  const suggestion = activeSuggestion();
  const labels = { question: "Pergunta", summary: "Resumo", topic: "Tópico" };
  const tabs = [
    ["pending", "Para conferir"],
    ["accepted", "Aceitos"],
    ["discarded", "Descartados"],
  ];
  const list = state.suggestions.filter((s) => s.status === reviewFilter);
  const material = state.materials.find((m) => m.id === suggestion?.materialId);
  const references =
    suggestion?.references
      .map((ref) => material?.chunks.find((c) => c.id === ref.chunkId))
      .filter(Boolean) || [];
  return (
    heading(
      "REVISÃO COM FONTES",
      "A compreensão começa com uma boa pergunta.",
      "Confira a sugestão no material e decida o que merece entrar na sua trilha.",
      button("Gerar com IA", "generate", "", "spark") +
        button("Adicionar anotação", "add-note", "secondary", "plus"),
    ) +
    `<div class="callout"><strong>Você tem a palavra final.</strong> A IA pode errar. Referências válidas não garantem que a conclusão esteja correta. A amostra inicial é editorial e não foi gerada por IA.</div>
    <div class="toolbar review-tabs" role="group" aria-label="Filtrar conteúdo">${tabs.map(([value, label]) => `<button class="btn ${value === reviewFilter ? "" : "secondary"} small" data-review-filter="${value}" aria-pressed="${value === reviewFilter}">${label} · ${state.suggestions.filter((s) => s.status === value).length}</button>`).join("")}</div>
    ${list.length > 1 ? `<label class="field suggestion-picker">Conteúdo<select id="suggestion-select">${list.map((s) => `<option value="${escape(s.id)}" ${s.id === suggestion?.id ? "selected" : ""}>${escape(labels[s.type])}: ${escape(s.title)}</option>`).join("")}</select></label>` : ""}
    ${suggestion ? `<div class="review-layout"><article class="review-card"><div class="review-header"><span>${labels[suggestion.type]} para estudo</span><span class="tag">${reviewFilter === "pending" ? "Aguardando você" : reviewFilter === "accepted" ? "Aceito por você" : "Descartado"}</span></div><div class="review-body"><span class="label">${labels[suggestion.type]}</span><h2>${escape(suggestion.title)}</h2><p class="answer">${escape(suggestion.content)}</p>${suggestion.answer ? `<span class="label" style="margin-top:24px">RESPOSTA</span><p class="answer">${escape(suggestion.answer)}</p>` : ""}<span class="source-pill">${icon("link", 13)} ${references.length} trecho(s) verificável(is)</span></div><div class="review-actions">${reviewFilter !== "accepted" ? button("Aceitar conteúdo", "accept-review", "", "check") : ""}${button("Editar", "edit-review", "secondary")}${reviewFilter !== "discarded" ? button("Descartar", "discard-review", "quiet") : ""}</div></article><aside class="review-card"><div class="review-header"><span>No material original</span>${icon("book", 17)}</div><div class="review-body"><div class="source-title"><div class="material-icon">${icon("file", 21)}</div><div><h3>${escape(material?.title)}</h3><p class="small muted">${material?.sourceType === "pdf" ? "PDF com páginas de origem" : "Texto · sem página atribuída"}</p></div></div>${references.map((c) => `<section><span class="label">${c.page ? "PÁGINA " + c.page : "TRECHO DE TEXTO"}</span><p class="source-quote">${escape(c.text)}</p></section>`).join("")}</div></aside></div>` : `<div class="empty">Nenhum conteúdo nesta categoria.<p class="small" style="margin-top:10px">Adicione uma anotação manual ou configure uma integração real de IA.</p></div>`}`
  );
}
function plan() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    heading(
      "SEU RITMO, SUA TRILHA",
      "Planeje com espaço para viver.",
      "Organize revisões sem uma rotina obrigatória ou notificações inesperadas.",
      button("Nova tarefa", "add-task", "", "plus"),
    ) +
    `<div class="plan-grid">${[
      ["Para agora", (t) => !t.completed && t.dueDate <= today],
      ["Próximas revisões", (t) => !t.completed && t.dueDate > today],
      ["Concluídas", (t) => t.completed],
    ]
      .map(
        ([title, filter]) =>
          `<section class="plan-column"><h3>${title} · ${state.tasks.filter(filter).length}</h3>${
            state.tasks
              .filter(filter)
              .map(
                (t) =>
                  `<article class="plan-task"><span class="tag ${t.completed ? "" : "gold"}">${formatDate(t.dueDate)}</span><h3>${escape(t.title)}</h3><p>${escape(materialTitle(t.materialId))}</p><button class="btn secondary small" data-toggle-task="${escape(t.id)}">${icon(t.completed ? "clock" : "check", 14)}${t.completed ? "Reabrir tarefa" : "Marcar como concluída"}</button><button class="btn quiet small" data-edit-task="${escape(t.id)}">Editar</button></article>`,
              )
              .join("") || '<p class="small muted">Nenhuma tarefa por aqui.</p>'
          }</section>`,
      )
      .join(
        "",
      )}</div><div class="footer-note">${icon("calendar", 14)}Datas servem para organizar. Nenhum e-mail ou notificação é enviado.</div>`
  );
}
function settings() {
  return (
    heading(
      "TRANSPARÊNCIA POR PADRÃO",
      "Seus dados, suas escolhas.",
      "Saiba o que funciona localmente e o que ainda precisa ser conectado.",
    ) +
    `<div class="balance-card"><h2>Armazenamento e backup</h2>${damagedBackup ? button("Exportar dados originais preservados", "export-original", "secondary") : ""}<p>Este aplicativo salva materiais, revisão e tarefas apenas neste navegador. Limpar seus dados ou mudar de aparelho pode apagar o acesso ao progresso. Não existe sincronização ou conta nesta etapa.</p><div class="settings-row"><div><h3>Exportar uma cópia</h3><p>Arquivo JSON com materiais, sugestões e tarefas.</p></div>${button("Exportar backup", "export", "secondary", "download")}</div><div class="settings-row"><div><h3>Restaurar um backup</h3><p>Importação validada, sem sobrescrever registros conflitantes.</p></div>${button("Importar arquivo", "import", "secondary")}</div><div class="settings-row"><div><h3>IA e automações</h3><p>A geração só funciona com backend configurado. Materiais nunca são enviados automaticamente. Make, Zapier, v0, Bolt e Cursor não foram utilizados na implementação.</p></div>${button("Configurar sessão", "configure-ai", "secondary")}</div><div class="settings-row"><div><h3>PDFs locais e links</h3><p>PDFs com texto são extraídos localmente, com referência de página. Imagens não são interpretadas e não há OCR. Links externos não são lidos nesta versão.</p></div><span class="tag">PDF local disponível</span></div></div>`
  );
}
function modal(title, content) {
  const d = document.getElementById("modal");
  d.innerHTML = `<div class="modal-heading"><h2>${title}</h2><button class="icon-button" data-action="close" aria-label="Fechar">${icon("close")}</button></div>${content}`;
  if (!d.open) d.showModal();
}
function openMaterial(id) {
  const m = state.materials.find((m) => m.id === id);
  if (!m) return;
  modal(
    escape(m.title),
    `<div class="form-grid">${m.chunks.map((c, i) => `<section><span class="label">TRECHO ${i + 1}${c.page ? " · PÁGINA " + c.page : ""}</span><p style="font-size:14px;line-height:1.8">${escape(c.text)}</p></section>`).join("")}<div class="callout">Fonte extraída localmente. Confira possíveis erros de leitura, principalmente em tabelas e documentos com várias colunas.</div></div>`,
  );
}
function addMaterial() {
  modal(
    "Um novo ponto de partida",
    `<form id="material-form" class="form-grid"><label class="field">Nome do material<input name="title" required maxlength="200" placeholder="Ex.: Introdução à biologia"></label><label class="field">Formato<select name="sourceType" id="material-type"><option value="text">Texto</option><option value="pdf">PDF local</option></select></label><label class="field" id="text-field">Texto para estudar<textarea name="content" required maxlength="50000" placeholder="Cole um texto que você tenha permissão para utilizar..."></textarea><small>Até 50 mil caracteres nesta versão. O texto fica neste navegador.</small></label><label class="field" id="pdf-field" hidden>PDF para estudar<input type="file" name="pdf" accept="application/pdf,.pdf"><small>Até 10 MB e 100 páginas. Extração local, sem envio. PDFs digitalizados precisam de OCR externo.</small></label><p id="import-progress" class="small muted" role="status"></p><div class="callout">Importação de links não está habilitada. Não simulamos uma leitura que não aconteceu.</div><button class="btn" type="submit">${icon("plus", 16)}Adicionar material</button></form>`,
  );
}
function noteModal(suggestion) {
  if (!state.materials.length) {
    toast("Adicione um material antes de criar uma anotação com fonte.");
    return;
  }
  const selected =
    state.materials.find((m) => m.id === suggestion?.materialId) ||
    state.materials[0];
  modal(
    suggestion ? "Editar conteúdo" : "Anotar com suas palavras",
    `<form id="note-form" data-id="${suggestion?.id || ""}" class="form-grid">
    <label class="field">Material de origem<select name="materialId">${state.materials.map((m) => `<option value="${escape(m.id)}" ${m.id === selected.id ? "selected" : ""}>${escape(m.title)}</option>`).join("")}</select></label>
    <label class="field">Tipo<select name="type" id="note-type">${[
      ["summary", "Resumo"],
      ["topic", "Tópico"],
      ["question", "Pergunta"],
    ]
      .map(
        ([id, label]) =>
          `<option value="${id}" ${suggestion?.type === id ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
    <label class="field">Título<input name="title" required maxlength="240" value="${escape(suggestion?.title || "")}"></label>
    <label class="field">Conteúdo<textarea name="content" required maxlength="10000">${escape(suggestion?.content || "")}</textarea></label>
    <label class="field" id="note-answer" ${suggestion?.type === "question" ? "" : "hidden"}>Resposta<textarea name="answer" maxlength="10000" ${suggestion?.type === "question" ? "required" : ""}>${escape(suggestion?.answer || "")}</textarea></label>
    <p class="small muted">A anotação ficará pendente para sua conferência. Referências apontarão para os trechos do material selecionado. Nada será enviado a uma IA.</p>
    <button class="btn" type="submit">Salvar para conferir</button></form>`,
  );
}
function taskModal(id) {
  const task = state.tasks.find((t) => t.id === id);
  modal(
    task ? "Editar revisão" : "Planejar um próximo passo",
    `<form id="task-form" data-id="${id || ""}" class="form-grid"><label class="field">O que você quer revisar?<input name="title" required maxlength="200" value="${escape(task?.title || "")}" placeholder="Ex.: Rever o ciclo da matéria"></label><label class="field">Material<select name="materialId"><option value="">Estudo livre</option>${state.materials.map((m) => `<option value="${escape(m.id)}" ${task?.materialId === m.id ? "selected" : ""}>${escape(m.title)}</option>`).join("")}</select></label><label class="field">Data planejada<input type="date" name="dueDate" required value="${task?.dueDate || new Date().toISOString().slice(0, 10)}"></label><button class="btn" type="submit">Salvar tarefa</button></form>`,
  );
}
function configureAi() {
  modal(
    "Integração desta sessão",
    `<form id="ai-config-form" class="form-grid"><div class="callout"><strong>${integrationStatus.configured ? "Backend configurado: " + escape(integrationStatus.provider) : "Nenhum backend de IA configurado nesta origem."}</strong> Em hospedagem estática, os recursos locais funcionam normalmente. Para ativar IA, execute o servidor opcional com suas credenciais e orçamento autorizados. Consulte o README do GitHub.</div><label class="field">Token de acesso ao backend<input type="password" name="token" autocomplete="off" placeholder="Token do operador, não a chave do provedor"><small>Fica somente na memória desta aba. Não vai ao backup nem ao armazenamento local. Nunca cole uma chave de provedor aqui.</small></label><button class="btn" type="submit">Usar nesta sessão</button></form>`,
  );
}
function generateModal() {
  if (!integrationStatus.configured) {
    configureAi();
    return;
  }
  if (!state.materials.length) {
    toast("Adicione um material primeiro.");
    return;
  }
  modal(
    "Gerar conteúdo com suas fontes",
    `<form id="ai-form" class="form-grid"><label class="field">Material<select name="materialId">${state.materials.map((m) => `<option value="${escape(m.id)}">${escape(m.title)}</option>`).join("")}</select></label><div class="callout">O texto completo do material escolhido, seu título e referências serão enviados ao backend desta origem e ao serviço ${escape(integrationStatus.provider)} configurado pelo operador. Pode haver custo de API no plano configurado. Não envie materiais privados sem autorização.</div><label class="task-row"><input type="checkbox" name="consent" required><span>Tenho permissão para compartilhar este material e autorizo esse envio para gerar tópicos, resumo e perguntas.</span></label><p class="small muted" id="ai-progress" role="status"></p><button class="btn" type="submit">Enviar material e gerar</button></form>`,
  );
}
const actions = {
  "add-material": addMaterial,
  "configure-ai": configureAi,
  generate: generateModal,
  "export-original": () =>
    downloadText(damagedBackup, "trilha-viva-dados-preservados.json"),
  "add-task": () => taskModal(),
  close: () => document.getElementById("modal").close(),
  "go-review": () => go("review"),
  "accept-review": () => reviewAction("accepted"),
  "discard-review": () => reviewAction("discarded"),
  "add-note": () => noteModal(),
  "edit-review": () => noteModal(activeSuggestion()),
  export: () => {
    downloadText(exportBackup(state), "trilha-viva-backup.json");
    toast("Backup exportado. Guarde o arquivo em um local seguro.");
  },
  import: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const f = input.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024)
          throw new Error("Arquivo maior que 5 MB.");
        const restored = importBackup(await f.text(), state);
        state = restored;
        save();
        shell();
        toast("Backup validado e importado.");
      } catch (e) {
        toast("Importação recusada: " + e.message);
      }
    };
    input.click();
  },
};
function downloadText(content, name) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function reviewAction(status) {
  const s = activeSuggestion();
  if (s) {
    state = reviewSuggestion(state, s.id, { status });
    save();
    shell();
    toast(
      status === "accepted"
        ? "Conteúdo aceito e registrado."
        : "Sugestão descartada.",
    );
  }
}
function go(id) {
  if (!pages[id]) return;
  view = id;
  history.replaceState(null, "", "#" + id);
  shell();
  document.getElementById("content").focus({ preventScroll: true });
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]"),
    v = e.target.closest("[data-view]"),
    m = e.target.closest("[data-material]"),
    t = e.target.closest("[data-toggle-task]"),
    et = e.target.closest("[data-edit-task]");
  const filter = e.target.closest("[data-review-filter]");
  if (filter) {
    reviewFilter = filter.dataset.reviewFilter;
    selectedSuggestion = null;
    shell();
  }
  if (a) actions[a.dataset.action]?.();
  if (v) go(v.dataset.view);
  if (m) openMaterial(m.dataset.material);
  if (et) taskModal(et.dataset.editTask);
  if (t) {
    const task = state.tasks.find((x) => x.id === t.dataset.toggleTask);
    if (task) {
      task.completed = !task.completed;
      save();
      shell();
    }
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "suggestion-select") {
    selectedSuggestion = e.target.value;
    shell();
  }
  if (e.target.id === "note-type") {
    document.getElementById("note-answer").hidden =
      e.target.value !== "question";
    document.querySelector("[name=answer]").required =
      e.target.value === "question";
  }

  if (e.target.id === "material-type") {
    const pdf = e.target.value === "pdf";
    document.getElementById("text-field").hidden = pdf;
    document.getElementById("pdf-field").hidden = !pdf;
    document.querySelector("[name=content]").required = !pdf;
    document.querySelector("[name=pdf]").required = pdf;
  }
  if (e.target.matches("[data-task]")) {
    const t = state.tasks.find((t) => t.id === e.target.dataset.task);
    if (t) {
      t.completed = e.target.checked;
      save();
      shell();
    }
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    const cursor = e.target.selectionStart;
    search = e.target.value;
    shell();
    const input = document.getElementById("search");
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  try {
    if (f.id === "ai-config-form") {
      operatorToken = data.token.trim();
      toast("Token guardado somente nesta aba.");
    } else if (f.id === "ai-form") {
      if (!data.consent)
        throw new Error("Confirme o envio antes de continuar.");
      const material = state.materials.find((m) => m.id === data.materialId);
      const submit = f.querySelector("[type=submit]");
      submit.disabled = true;
      document.getElementById("ai-progress").textContent =
        "Gerando e validando referências…";
      try {
        const result = await requestSuggestions(
          material,
          state.materials,
          operatorToken,
        );
        if (result.insufficientEvidence) {
          throw new Error(
            "O serviço informou que não há evidência suficiente. Nenhum conteúdo foi inventado ou salvo.",
          );
        }
        const newItems = result.suggestions.map((item) => ({
          ...item,
          id: uid(),
        }));
        state.suggestions.push(...newItems);
        reviewFilter = "pending";
        selectedSuggestion = newItems[0]?.id;
        toast(
          `${newItems.length} sugestão(ões) recebida(s). Confira todas antes de aceitar.`,
        );
      } finally {
        submit.disabled = false;
      }
    } else if (f.id === "material-form") {
      const submit = f.querySelector("[type=submit]");
      submit.disabled = true;
      try {
        if (data.sourceType === "pdf") {
          const file = f.querySelector("[name=pdf]").files[0];
          if (!file) throw new Error("Selecione um PDF.");
          if (file.size > 10 * 1024 * 1024)
            throw new Error("PDF maior que 10 MB.");
          const extracted = await extractPdf(await file.arrayBuffer(), {
            onProgress: ({ completed, total }) => {
              document.getElementById("import-progress").textContent =
                `Lendo página ${completed} de ${total}…`;
            },
          });
          state.materials.push(
            createMaterial({
              id: uid(),
              title: data.title,
              sourceType: "pdf",
              pages: extracted.pages,
            }),
          );
          toast(
            extracted.warnings.length
              ? extracted.warnings.join(" ")
              : "PDF extraído com páginas de origem.",
          );
        } else {
          state.materials.push(
            createMaterial({
              id: uid(),
              title: data.title,
              content: data.content,
            }),
          );
          toast("Material salvo com referências aos trechos.");
        }
      } finally {
        submit.disabled = false;
      }
    } else if (f.id === "note-form") {
      const material = state.materials.find((m) => m.id === data.materialId);
      const note = validateSuggestion(
        {
          ...data,
          id: f.dataset.id || uid(),
          status: "pending",
          references: material.chunks.map((c) => ({
            chunkId: c.id,
            page: c.page,
          })),
        },
        state.materials,
      );
      if (f.dataset.id)
        state.suggestions = state.suggestions.map((s) =>
          s.id === note.id ? note : s,
        );
      else state.suggestions.push(note);
      reviewFilter = "pending";
      selectedSuggestion = note.id;
      toast("Conteúdo salvo para conferência.");
    } else if (f.id === "task-form") {
      const existing = state.tasks.find((t) => t.id === f.dataset.id);
      const task = createTask(
        {
          id: existing?.id || uid(),
          ...data,
          materialId: data.materialId || undefined,
          completed: existing?.completed || false,
        },
        state.materials,
      );
      if (existing)
        state.tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
      else state.tasks.push(task);
      toast("Tarefa salva.");
    } else if (f.id === "review-form") {
      state = reviewSuggestion(state, f.dataset.id, {
        ...data,
        status: "pending",
      });
      toast("Edição salva. Confira antes de aceitar.");
    }
    save();
    document.getElementById("modal").close();
    shell();
  } catch (err) {
    toast(err.message);
  }
});
window.addEventListener("hashchange", () => go(location.hash.slice(1)));
view = pages[location.hash.slice(1)] ? location.hash.slice(1) : "dashboard";
shell();

readIntegrationStatus().then((status) => {
  integrationStatus = status;
});
