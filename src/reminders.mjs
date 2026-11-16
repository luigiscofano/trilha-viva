/** Calendário exportado apenas sob pedido. Importar o ICS é uma escolha do jogador. */
const escapeIcs = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function createReminderCalendar(
  tasks,
  { alarm = false, now = new Date() } = {},
) {
  if (!Array.isArray(tasks) || tasks.length > 5000)
    throw new Error("Tarefas inválidas.");
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trilha Viva//Revisoes//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const task of tasks.filter((t) => !t.completed)) {
    if (
      !/^[\w-]+$/.test(task.id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ||
      new Date(`${task.dueDate}T00:00:00Z`).toISOString().slice(0, 10) !==
        task.dueDate
    )
      throw new Error("Tarefa com data ou identificador inválido.");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@trilha-viva.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${task.dueDate.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      "DESCRIPTION:Revisão planejada no Trilha Viva.",
    );
    if (alarm)
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT12H",
        "DESCRIPTION:Revisão do Trilha Viva",
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // Dobra por bytes UTF-8, sem cortar caracteres multibyte (RFC 5545).
  return (
    lines
      .map((line) => {
        let out = "",
          part = "";
        for (const char of line) {
          if (new TextEncoder().encode(part + char).length > 74) {
            out += part + "\r\n";
            part = " ";
          }
          part += char;
        }
        return out + part;
      })
      .join("\r\n") + "\r\n"
  );
}
