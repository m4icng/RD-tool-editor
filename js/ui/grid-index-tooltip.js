const POINTER_OFFSET = 14;
const VIEWPORT_GAP = 8;

export function createGridIndexTooltip({ grid, getGrid, isEnabled }) {
  const tooltip = document.createElement("div");
  tooltip.className = "grid-index-tooltip";
  tooltip.setAttribute("role", "tooltip");
  document.body.appendChild(tooltip);

  function hide() {
    tooltip.classList.remove("show");
  }

  function positionAt(clientX, clientY) {
    const maxX = window.innerWidth - tooltip.offsetWidth - VIEWPORT_GAP;
    const maxY = window.innerHeight - tooltip.offsetHeight - VIEWPORT_GAP;
    tooltip.style.left = `${Math.max(VIEWPORT_GAP, Math.min(clientX + POINTER_OFFSET, maxX))}px`;
    tooltip.style.top = `${Math.max(VIEWPORT_GAP, Math.min(clientY + POINTER_OFFSET, maxY))}px`;
  }

  function showForCell(cell, clientX, clientY) {
    if (!isEnabled()) return hide();
    const columns = Number(getGrid()?.columns);
    const x = Number(cell?.dataset.x);
    const y = Number(cell?.dataset.y);
    if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(x) || !Number.isInteger(y)) return hide();
    tooltip.textContent = `Index: ${(y * columns) + x}`;
    tooltip.classList.add("show");
    positionAt(clientX, clientY);
  }

  grid.addEventListener("pointermove", (event) => {
    const cell = event.target.closest(".grid-cell");
    if (!cell || !grid.contains(cell)) return hide();
    showForCell(cell, event.clientX, event.clientY);
  });
  grid.addEventListener("pointerleave", hide);
  grid.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".grid-cell");
    if (!cell) return;
    const bounds = cell.getBoundingClientRect();
    showForCell(cell, bounds.right, bounds.top);
  });
  grid.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, true);

  return { hide };
}
