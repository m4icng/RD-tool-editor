export class HistoryManager {
  #past = [];
  #future = [];

  constructor(limit = 50) {
    this.limit = limit;
  }

  push(snapshot) {
    this.#past.push(structuredClone(snapshot));
    if (this.#past.length > this.limit) this.#past.shift();
    this.#future.length = 0;
  }

  undo(currentSnapshot) {
    if (!this.canUndo) return null;
    this.#future.push(structuredClone(currentSnapshot));
    return this.#past.pop();
  }

  redo(currentSnapshot) {
    if (!this.canRedo) return null;
    this.#past.push(structuredClone(currentSnapshot));
    return this.#future.pop();
  }

  clear() {
    this.#past.length = 0;
    this.#future.length = 0;
  }

  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }
}
