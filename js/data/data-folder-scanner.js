export function isSupportedDataFile(fileName) {
  return String(fileName ?? "").toLowerCase().endsWith(".json");
}

export async function readDataFile(fileHandle) {
  const name = fileHandle?.name ?? "";
  try {
    const file = await fileHandle.getFile();
    const rawText = await file.text();
    try {
      const data = JSON.parse(rawText);
      const validRoot = data !== null && typeof data === "object";
      return {
        name,
        handle: fileHandle,
        rawText,
        data: validRoot ? data : null,
        status: validRoot ? "valid" : "invalid",
        errorMessage: validRoot ? null : "Root JSON phải là object hoặc array.",
        lastModified: file.lastModified,
        size: file.size
      };
    } catch (error) {
      return {
        name,
        handle: fileHandle,
        rawText,
        data: null,
        status: "invalid",
        errorMessage: error.message,
        lastModified: file.lastModified,
        size: file.size
      };
    }
  } catch (error) {
    return {
      name,
      handle: fileHandle,
      rawText: null,
      data: null,
      status: "unreadable",
      errorMessage: error.message,
      lastModified: 0,
      size: 0
    };
  }
}

export async function scanDataFolder(directoryHandle, scanContext = {}) {
  const files = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (typeof scanContext.isCurrent === "function" && !scanContext.isCurrent()) return { cancelled: true, files: [] };
    if (handle.kind !== "file" || !isSupportedDataFile(name)) continue;
    files.push(await readDataFile(handle));
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return { cancelled: false, files };
}
