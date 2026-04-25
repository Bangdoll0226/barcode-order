// csv.js — 発注リストを発注先ごとに CSV 化する

export function groupBySupplier(orderLines) {
  const map = {};
  for (const line of orderLines) {
    if (!map[line.supplier]) map[line.supplier] = [];
    map[line.supplier].push(line);
  }
  return map;
}

function escapeField(value) {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function generateCsv(orderLines) {
  const BOM = "\uFEFF";
  const header = ["品名", "数量", "JANコード"].join(",");
  const rows = orderLines.map(l =>
    [escapeField(l.name), escapeField(l.quantity), escapeField(l.barcode)].join(",")
  );
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

function pad2(n) { return String(n).padStart(2, "0"); }

export function generateFilename(store, supplier, date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `order-${store}-${supplier}-${y}${m}${d}-${h}${mi}.csv`;
}
