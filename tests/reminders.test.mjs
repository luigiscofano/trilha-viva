import test from "node:test";
import assert from "node:assert/strict";
import { createReminderCalendar } from "../src/reminders.mjs";
const tasks = [
  {
    id: "a",
    title: "Revisar, água; solo\nAgora",
    dueDate: "2026-11-20",
    completed: false,
  },
  { id: "b", title: "Concluída", dueDate: "2026-11-20", completed: true },
];
test("ICS omite tarefas concluídas e não ativa alarme implicitamente", () => {
  const s = createReminderCalendar(tasks);
  assert.match(s, /DTSTART;VALUE=DATE:20261120/);
  assert.doesNotMatch(s, /VALARM|Concluída/);
  assert.match(s, /Revisar\\, água\\; solo\\nAgora/);
});
test("Alarme somente após opção explícita", () =>
  assert.match(createReminderCalendar(tasks, { alarm: true }), /BEGIN:VALARM/));
test("Datas inválidas recusadas", () =>
  assert.throws(() =>
    createReminderCalendar([{ ...tasks[0], dueDate: "2026-02-30" }]),
  ));
test("Linhas longas UTF8 dobradas", () => {
  const s = createReminderCalendar([{ ...tasks[0], title: "Á".repeat(200) }]);
  assert.ok(
    s
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  );
});
