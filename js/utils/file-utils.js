export function stringifyJson(data) {
  const compactIndexArrays = [];
  const formatted = JSON.stringify(data, (key, value) => {
    if (key !== "index" || !Array.isArray(value)) return value;
    const token = `__RD_COMPACT_INDEX_${compactIndexArrays.length}__`;
    compactIndexArrays.push(JSON.stringify(value));
    return token;
  }, 2);
  return formatted.replace(/"__RD_COMPACT_INDEX_(\d+)__"/g, (_match, position) => compactIndexArrays[Number(position)]);
}

export function downloadJson(data, filename = "snacky-level.json") {
  const blob = new Blob([stringifyJson(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file) {
  return JSON.parse(await file.text());
}
