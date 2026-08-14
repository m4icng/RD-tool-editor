export function rasterizeGridLine(from, to) {
  const cells = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) break;
    const doubledError = error * 2;
    if (doubledError > -dy) { error -= dy; x += stepX; }
    if (doubledError < dx) { error += dx; y += stepY; }
  }
  return cells;
}

export class InputController {
  constructor({ root = document, onCell, onShortcut, isEnabled = () => true, canDrag = () => true, onStrokeStart = () => {}, onStrokeEnd = () => {} }) {
    this.root = root;
    this.onCell = onCell;
    this.onShortcut = onShortcut;
    this.isEnabled = isEnabled;
    this.canDrag = canDrag;
    this.onStrokeStart = onStrokeStart;
    this.onStrokeEnd = onStrokeEnd;
    this.isDrawing = false;
    this.strokeMode = "primary";
    this.visited = new Set();
    this.lastCell = null;
    this.handleClick = this.handleClick.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  connect(grid) {
    this.grid = grid;
    grid.addEventListener("click", this.handleClick);
    grid.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerUp);
    this.root.addEventListener("pointercancel", this.handlePointerUp);
    this.root.addEventListener("contextmenu", this.handleContextMenu);
    this.root.addEventListener("keydown", this.handleKeydown);
  }

  disconnect() {
    this.grid?.removeEventListener("click", this.handleClick);
    this.grid?.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerUp);
    this.root.removeEventListener("pointercancel", this.handlePointerUp);
    this.root.removeEventListener("contextmenu", this.handleContextMenu);
    this.root.removeEventListener("keydown", this.handleKeydown);
  }

  handleClick(event) {
    if (!this.isEnabled()) return;
    if (event.detail !== 0) return;
    const cell = event.target.closest(".grid-cell");
    if (cell) this.onCell(Number(cell.dataset.x), Number(cell.dataset.y));
  }

  handlePointerDown(event) {
    if (!this.isEnabled()) return;
    if (event.button !== 0 && event.button !== 2) return;
    const cell = event.target.closest(".grid-cell");
    if (!cell) return;
    event.preventDefault();
    const position = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    const eraseOverride = event.button === 2;

    if (!eraseOverride && !this.canDrag()) {
      this.onCell(position.x, position.y);
      return;
    }

    this.isDrawing = true;
    this.visited.clear();
    this.lastCell = null;
    this.strokeMode = eraseOverride ? "erase" : "primary";
    this.grid.classList.add("is-drawing");
    this.onStrokeStart();
    this.paintTo(position);
  }

  handlePointerMove(event) {
    if (!this.isDrawing) return;
    if (!this.isEnabled()) return this.handlePointerUp();
    const target = this.root.elementFromPoint?.(event.clientX, event.clientY);
    const cell = target?.closest?.(".grid-cell");
    if (!cell || !this.grid.contains(cell)) return;
    this.paintTo({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
  }

  handlePointerUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.grid.classList.remove("is-drawing");
    this.visited.clear();
    this.lastCell = null;
    this.strokeMode = "primary";
    this.onStrokeEnd();
  }

  handleContextMenu(event) {
    event.preventDefault();
  }

  paintTo(position) {
    const cells = this.lastCell ? rasterizeGridLine(this.lastCell, position) : [position];
    cells.forEach((cell) => {
      const key = `${cell.x},${cell.y}`;
      if (this.visited.has(key)) return;
      this.visited.add(key);
      this.onCell(cell.x, cell.y, { eraseOverride: this.strokeMode === "erase" });
    });
    this.lastCell = position;
  }

  handleKeydown(event) {
    if (!this.isEnabled()) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if ((modifier && ["z", "y"].includes(key)) || ["delete", "backspace", "1", "2", "3", "4"].includes(key)) {
      event.preventDefault();
      this.onShortcut({ key, modifier, shift: event.shiftKey });
    }
  }
}
