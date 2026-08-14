import { stringifyJson } from "../utils/file-utils.js";

export class LevelFileManager {
  constructor() { this.directory = null; }
  get supported() { return typeof window.showDirectoryPicker === "function"; }
  get connected() { return Boolean(this.directory); }

  async chooseDirectory() {
    if (!this.supported) throw new Error("Trình duyệt này không hỗ trợ quản lý thư mục trực tiếp.");
    this.directory = await window.showDirectoryPicker({ id: "railwaydash-levels", mode: "readwrite" });
    return this.listFiles();
  }

  async listFiles() {
    if (!this.directory) return [];
    const files = [];
    for await (const [name, handle] of this.directory.entries()) {
      if (handle.kind !== "file" || !name.toLowerCase().endsWith(".json")) continue;
      const file = await handle.getFile();
      files.push({ name, size: file.size, updatedAt: file.lastModified });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async read(name) {
    const handle = await this.directory.getFileHandle(name);
    return JSON.parse(await (await handle.getFile()).text());
  }

  async write(name, data) {
    const handle = await this.directory.getFileHandle(name);
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
