import { stringifyJson } from "../utils/file-utils.js";
import { scanDataFolder, readDataFile } from "./data-folder-scanner.js";
import { clearDirectoryHandle, getDirectoryHandle, saveDirectoryHandle } from "./directory-handle-storage.js";
import {
  DIRECTORY_PERMISSION_MODE,
  isDirectoryPickerSupported,
  queryDirectoryPermission,
  requestDirectoryPermission
} from "./directory-permission-service.js";

export class LevelFileManager {
  constructor() { this.directory = null; }
  get supported() { return isDirectoryPickerSupported(); }
  get connected() { return Boolean(this.directory); }
  get directoryName() { return this.directory?.name ?? ""; }

  setDirectory(handle) {
    this.directory = handle ?? null;
  }

  async chooseDirectory() {
    if (!this.supported) throw new Error("Trình duyệt này không hỗ trợ quản lý thư mục trực tiếp.");
    const handle = await window.showDirectoryPicker({ id: "railwaydash-levels", mode: DIRECTORY_PERMISSION_MODE });
    this.directory = handle;
    saveDirectoryHandle(handle).catch((error) => console.warn("Không thể lưu folder đã chọn", error));
    return handle;
  }

  async restoreDirectory() {
    const handle = await getDirectoryHandle();
    this.directory = handle ?? null;
    return this.directory;
  }

  async forgetDirectory() {
    this.directory = null;
    await clearDirectoryHandle();
  }

  queryPermission() {
    return queryDirectoryPermission(this.directory, DIRECTORY_PERMISSION_MODE);
  }

  requestPermission() {
    return requestDirectoryPermission(this.directory, DIRECTORY_PERMISSION_MODE);
  }

  async listFiles(scanContext = {}) {
    if (!this.directory) return [];
    const result = await scanDataFolder(this.directory, scanContext);
    return result.cancelled ? null : result.files;
  }

  async read(name) {
    const handle = await this.directory.getFileHandle(name);
    const entry = await readDataFile(handle);
    if (entry.status !== "valid") throw new Error(entry.errorMessage ?? "File JSON không hợp lệ.");
    return entry.data;
  }

  async write(name, data) {
    const handle = await this.directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(stringifyJson(data));
    await writable.close();
  }

  async rename(oldName, newName) {
    const oldHandle = await this.directory.getFileHandle(oldName);
    const content = await (await oldHandle.getFile()).text();
    const newHandle = await this.directory.getFileHandle(newName, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();
    await this.directory.removeEntry(oldName);
  }

  async remove(name) { await this.directory.removeEntry(name); }
}
