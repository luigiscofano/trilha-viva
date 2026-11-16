const icons = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  book: "M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M14 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2",
  spark: "m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z",
  calendar: "M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6",
  chart: "M4 3v18h17 M8 16v-4 M13 16V7 M18 16V4",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  file: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h5",
  search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M15 15l6 6",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  close: "m6 6 12 12 M6 18 18 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4 2",
  shield: "m12 3 8 3v5c0 5-5 9-8 10-3-1-8-5-8-10V6z m-4 9 3 3 5-6",
  link: "m9 15 6-6 M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0 M16 8l2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0",
  leaf: "M20 3C5 2 2 8 5 15s16 5 15-12z M5 20 15 9",
};
export const icon = (n, size = 19) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.file}"/></svg>`;
export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
