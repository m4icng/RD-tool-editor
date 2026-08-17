export const DIRECTORY_PERMISSION_MODE = "readwrite";

function normalizePermission(value) {
  return ["granted", "prompt", "denied"].includes(value) ? value : "unknown";
}

export function isDirectoryPickerSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function queryDirectoryPermission(handle, mode = DIRECTORY_PERMISSION_MODE) {
  if (!handle) return "unknown";
  if (!isDirectoryPickerSupported()) return "unsupported";
  if (typeof handle.queryPermission !== "function") return "unknown";
  return normalizePermission(await handle.queryPermission({ mode }));
}

export async function requestDirectoryPermission(handle, mode = DIRECTORY_PERMISSION_MODE) {
  if (!handle) return "unknown";
  if (!isDirectoryPickerSupported()) return "unsupported";
  if (typeof handle.requestPermission !== "function") return "unknown";
  return normalizePermission(await handle.requestPermission({ mode }));
}
