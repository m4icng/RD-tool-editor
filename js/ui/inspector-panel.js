import { getMergedCell, isGrassAt, isPriorityPointAt, positionToIndex } from "../utils/grid-utils.js";

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function renderInspector(container, editorData) {
  if (!editorData.selectedCell) {
    container.innerHTML = '<div class="empty-state">Chọn công cụ <strong>Chọn ô</strong>, sau đó click vào một ô để xem thuộc tính.</div>';
    return;
  }
  const { x, y } = editorData.selectedCell;
  const index = positionToIndex(x, y, editorData.grid.columns);
  const cell = getMergedCell(editorData, x, y);
  const capacity = cell.item?.kind === "truck"
    ? `<div class="property-row"><span>Sức chứa</span><span class="capacity-control"><button type="button" data-capacity-step="-1">−</button><output>${cell.item.capacity}</output><button type="button" data-capacity-step="1">+</button></span></div>`
    : "";
  container.innerHTML = `<div class="property-list">
    <div class="property-row"><span>Vị trí</span><strong>Index ${index}</strong></div>
    <div class="property-row"><span>Đường đi</span><strong>${cell.path ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>Grass</span><strong>${isGrassAt(editorData, x, y) ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>PriorityPoint</span><strong>${isPriorityPointAt(editorData, x, y) ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>Item layer</span><strong>${escapeHtml(cell.layerItem?.label ?? "Không có fruit")}</strong></div>
    <div class="property-row"><span>Dùng chung</span><strong>${escapeHtml(cell.sharedItem?.label ?? cell.element?.label ?? "Không có")}</strong></div>
    ${capacity}</div>
    <div class="inspector-actions"><button class="btn" type="button" id="togglePathBtn">${cell.path ? "Bỏ đường" : "Thêm đường"}</button><button class="btn" type="button" id="deleteCellBtn">Xóa lớp trên cùng</button></div>`;
}
