import { BRIDGE_AXES, GATE_DIRECTIONS } from "../core/constants.js";
import { getMergedCell, isGrassAt, isMysteryFruitAt, isPriorityPointAt, positionToIndex } from "../utils/grid-utils.js";
import { bridgeAxisLabel, isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { gateDirectionLabel, isGateElement, normalizeGateDirection } from "../objects/gate-object.js";
import { findCountBarrierAtIndex, normalizeCountBarrierCount } from "../objects/count-barrier-object.js";
import { findTunnelById, findTunnelDraftEntryAtIndex, findTunnelEntryAtIndex, normalizeTunnelDirection, tunnelColor, tunnelDirectionLabel } from "../objects/tunnel-object.js";
import { findOneWayById, findOneWayEntryAtIndex, normalizeOneWayDirection, oneWayColor, oneWayDirectionLabel } from "../objects/one-way-object.js";
import { createTrayContextAt, createTrayInspectorCard } from "./tray-editor.js";

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function activeLayerNumber(editorData) {
  const layer = editorData.layers.find((candidate) => candidate.id === editorData.activeLayerId) ?? editorData.layers[0];
  return Number.isInteger(layer?.layer) ? layer.layer : Math.max(0, editorData.layers.indexOf(layer));
}

export function getSelectedCellIndex(editorData) {
  if (!editorData.selectedCell) return null;
  return positionToIndex(editorData.selectedCell.x, editorData.selectedCell.y, editorData.grid.columns);
}

function segmentedButton(value, activeValue, label, dataName) {
  const active = Number(value) === Number(activeValue);
  return `<button class="segmented-option${active ? " active" : ""}" type="button" ${dataName}="${value}" aria-pressed="${active}">${escapeHtml(label)}${active ? " ✓" : ""}</button>`;
}

function bridgeCard(bridge) {
  const axis = normalizeBridgeAxis(bridge.axis);
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">=</span><h3>Bridge</h3></header>
    <div class="inspector-field">
      <span>Hướng cầu</span>
      <div class="segmented-control">
        ${segmentedButton(BRIDGE_AXES.HORIZONTAL, axis, "Horizontal", "data-inspector-bridge-axis")}
        ${segmentedButton(BRIDGE_AXES.VERTICAL, axis, "Vertical", "data-inspector-bridge-axis")}
      </div>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="bridge">Xóa Bridge</button>
  </article>`;
}

function gateCard(gate) {
  const direction = normalizeGateDirection(gate.direction);
  const directionButtons = [
    [GATE_DIRECTIONS.UP, "↑", "Up"],
    [GATE_DIRECTIONS.LEFT, "←", "Left"],
    [GATE_DIRECTIONS.RIGHT, "→", "Right"],
    [GATE_DIRECTIONS.DOWN, "↓", "Down"]
  ].map(([value, icon, label]) => {
    const active = Number(value) === direction;
    return `<button class="direction-option${active ? " active" : ""}" type="button" data-inspector-gate-direction="${value}" aria-label="${label}" aria-pressed="${active}"><span>${icon}</span><small>${label}</small></button>`;
  }).join("");

  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">›</span><h3>Gate</h3></header>
    <div class="inspector-field">
      <span>Hướng cổng</span>
      <div class="direction-control">${directionButtons}</div>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="gate">Xóa Gate</button>
  </article>`;
}

function countBarrierCard(barrier, selectedIndex) {
  const count = normalizeCountBarrierCount(barrier.count);
  const isStart = barrier.startIndex === selectedIndex;
  const isEnd = barrier.endIndex === selectedIndex;
  const active = barrier.barrierId === Number(barrier.activeBarrierId);
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">#</span><h3>Count Barrier ${barrier.barrierId}${active ? " · Active" : ""}</h3></header>
    <div class="inspector-field">
      <span>Countdown</span>
      <input class="property-select" type="number" min="1" step="1" value="${count}" data-inspector-count-barrier-count="${barrier.barrierId}" aria-label="Count Barrier countdown">
    </div>
    <div class="inspector-kv"><span>Start</span><strong>${barrier.startIndex}${isStart ? " · ô đang chọn" : ""}</strong></div>
    <div class="inspector-kv"><span>End</span><strong>${barrier.endIndex}${isEnd ? " · ô đang chọn" : ""}</strong></div>
    <div class="inspector-kv"><span>Cells</span><strong>${barrier.index.length}</strong></div>
    <div class="quick-actions">
      <button class="btn" type="button" data-inspector-count-barrier-start="${barrier.barrierId}"${isStart ? " disabled" : ""}>Set Start</button>
      <button class="btn" type="button" data-inspector-count-barrier-end="${barrier.barrierId}"${isEnd ? " disabled" : ""}>Set End</button>
      <button class="btn" type="button" data-inspector-count-barrier-new>New Barrier</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-count-barrier-remove-cell="${barrier.barrierId}">Xóa Cell khỏi Barrier</button>
    <button class="inspector-link danger" type="button" data-inspector-delete="count-barrier">Xóa Barrier</button>
  </article>`;
}

function directionSelect(value, dataAttrs) {
  const direction = normalizeTunnelDirection(value);
  return `<select class="property-select" ${dataAttrs} aria-label="Tunnel direction">
    ${[
      [0, "Up"],
      [1, "Down"],
      [2, "Right"],
      [3, "Left"]
    ].map(([optionValue, label]) => `<option value="${optionValue}"${direction === optionValue ? " selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function oneWayDirectionSelect(value, dataAttrs) {
  const direction = normalizeOneWayDirection(value);
  return `<select class="property-select" ${dataAttrs} aria-label="One Way direction">
    ${[
      [0, "Up"],
      [1, "Down"],
      [2, "Right"],
      [3, "Left"]
    ].map(([optionValue, label]) => `<option value="${optionValue}"${direction === optionValue ? " selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function tunnelCard(tunnel, selectedIndex, tunnels, cell) {
  const activeOptions = tunnels.map((entry) => `<option value="${entry.tunnelId}"${entry.tunnelId === tunnel.tunnelId ? " selected" : ""}>Tunnel #${entry.tunnelId}</option>`).join("");
  const selectedIsPath = Boolean(cell.path);
  const entries = tunnel.entryPoints.map((point, entryIndex) => {
    const label = entryIndex === 0 ? "A" : "B";
    const selected = point.index === selectedIndex;
    const direction = tunnelDirectionLabel(point.direction);
    return `<div class="inspector-kv wide"><span>Entry Point ${label}</span><strong>Index ${point.index} · ${direction}${selected ? " · ô đang chọn" : ""}</strong></div>
      <div class="inspector-field">
        <span>Direction ${label}</span>
        ${directionSelect(point.direction, `data-inspector-tunnel-direction="${tunnel.tunnelId}" data-tunnel-entry="${entryIndex}"`)}
      </div>`;
  }).join("");
  return `<article class="inspector-card tunnel-inspector-card" style="--tunnel-color:${tunnelColor(tunnel.tunnelId)}">
    <header><span class="inspector-card-icon tunnel-card-icon">→</span><h3>Tunnel #${tunnel.tunnelId}</h3></header>
    <div class="inspector-field">
      <span>Active Tunnel</span>
      <select class="property-select" data-inspector-active-tunnel aria-label="Active Tunnel">${activeOptions}</select>
    </div>
    ${entries}
    <div class="quick-actions tunnel-actions">
      <button class="btn" type="button" data-inspector-tunnel-focus="${tunnel.tunnelId}" data-tunnel-entry="0">Focus A</button>
      <button class="btn" type="button" data-inspector-tunnel-focus="${tunnel.tunnelId}" data-tunnel-entry="1">Focus B</button>
      <button class="btn" type="button" data-inspector-tunnel-move="${tunnel.tunnelId}" data-tunnel-entry="0"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set A Here</button>
      <button class="btn" type="button" data-inspector-tunnel-move="${tunnel.tunnelId}" data-tunnel-entry="1"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set B Here</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="tunnel">Xóa Tunnel</button>
  </article>`;
}

function tunnelDraftStatus(step) {
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select Tunnel Point B",
    "direction-b": "Point B selected — Choose direction"
  }[step] ?? "Select Tunnel Point A";
}

function tunnelDraftCard(draft) {
  const pointA = draft.entryPoints[0];
  const pointB = draft.entryPoints[1];
  const activeDirectionStep = draft.step === "direction-a" || draft.step === "direction-b";
  const directionButtons = [
    [GATE_DIRECTIONS.UP, "↑", "Up"],
    [GATE_DIRECTIONS.DOWN, "↓", "Down"],
    [GATE_DIRECTIONS.RIGHT, "→", "Right"],
    [GATE_DIRECTIONS.LEFT, "←", "Left"]
  ].map(([value, icon, label]) => `<button class="direction-option" type="button" data-inspector-tunnel-draft-direction="${value}" aria-label="${label}"><span>${icon}</span><small>${label}</small></button>`).join("");
  return `<article class="inspector-card tunnel-inspector-card" style="--tunnel-color:${tunnelColor(draft.tunnelId)}">
    <header><span class="inspector-card-icon tunnel-card-icon">⏭</span><h3>Tunnel #${draft.tunnelId} Draft</h3></header>
    <div class="inspector-note">${escapeHtml(tunnelDraftStatus(draft.step))}</div>
    <div class="inspector-kv wide"><span>Entry Point A</span><strong>Index ${pointA.index}${Number.isInteger(pointA.direction) ? ` · ${tunnelDirectionLabel(pointA.direction)}` : " · pending"}</strong></div>
    ${pointB ? `<div class="inspector-kv wide"><span>Entry Point B</span><strong>Index ${pointB.index}${Number.isInteger(pointB.direction) ? ` · ${tunnelDirectionLabel(pointB.direction)}` : " · pending"}</strong></div>` : ""}
    ${activeDirectionStep ? `<div class="inspector-field"><span>Direction ${draft.step === "direction-a" ? "A" : "B"}</span><div class="direction-control tunnel-draft-direction-control">${directionButtons}</div></div>` : ""}
    <button class="inspector-link danger" type="button" data-inspector-tunnel-draft-cancel>Hủy Tunnel Draft</button>
  </article>`;
}

function oneWayCard(oneWay, selectedIndex, oneWays, cell) {
  const activeOptions = oneWays.map((entry) => `<option value="${entry.oneWayId}"${entry.oneWayId === oneWay.oneWayId ? " selected" : ""}>One Way #${entry.oneWayId}</option>`).join("");
  const selectedIsPath = Boolean(cell.path);
  const direction = normalizeOneWayDirection(oneWay.entryPoints[0]?.direction);
  const entries = oneWay.entryPoints.map((point, entryIndex) => {
    const label = entryIndex === 0 ? "A" : "B";
    const selected = point.index === selectedIndex;
    return `<div class="inspector-kv wide"><span>Entry Point ${label}</span><strong>Index ${point.index} · ${oneWayDirectionLabel(direction)}${selected ? " · ô đang chọn" : ""}</strong></div>`;
  }).join("");
  return `<article class="inspector-card one-way-inspector-card" style="--one-way-color:${oneWayColor(oneWay.oneWayId)}">
    <header><span class="inspector-card-icon one-way-card-icon">▲</span><h3>One Way #${oneWay.oneWayId}</h3></header>
    <div class="inspector-field">
      <span>Active One Way</span>
      <select class="property-select" data-inspector-active-one-way aria-label="Active One Way">${activeOptions}</select>
    </div>
    <div class="inspector-field">
      <span>Direction</span>
      ${oneWayDirectionSelect(direction, `data-inspector-one-way-direction="${oneWay.oneWayId}"`)}
    </div>
    ${entries}
    <div class="quick-actions one-way-actions">
      <button class="btn" type="button" data-inspector-one-way-focus="${oneWay.oneWayId}" data-one-way-entry="0">Focus A</button>
      <button class="btn" type="button" data-inspector-one-way-focus="${oneWay.oneWayId}" data-one-way-entry="1">Focus B</button>
      <button class="btn" type="button" data-inspector-one-way-move="${oneWay.oneWayId}" data-one-way-entry="0"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set A Here</button>
      <button class="btn" type="button" data-inspector-one-way-move="${oneWay.oneWayId}" data-one-way-entry="1"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set B Here</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="one-way">Xóa One Way</button>
  </article>`;
}

function fruitCard(cell, isMystery) {
  const fruit = cell.layerItem;
  const title = isMystery ? "Mystery Fruit" : "Fruit";
  const status = isMystery ? "ON" : "OFF";
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">${escapeHtml(fruit.icon ?? "?")}</span><h3>${title}</h3></header>
    <div class="inspector-field">
      <span>Mystery</span>
      <button class="toggle-control${isMystery ? " active" : ""}" type="button" data-inspector-mystery-toggle aria-pressed="${isMystery}">
        <span>${status}</span>
      </button>
    </div>
    <div class="inspector-note">${escapeHtml(fruit.label ?? "Fruit")} ${isMystery ? "đang ẩn bằng badge ?" : "đang hiển thị bình thường"}</div>
    <button class="inspector-link danger" type="button" data-inspector-delete="${isMystery ? "mystery-fruit" : "item"}">${isMystery ? "Tắt Mystery" : "Xóa Fruit"}</button>
  </article>`;
}

function sharedItemCard(cell, editorData, x, y) {
  if (!cell.sharedItem) return "";
  if (["tray", "truck"].includes(cell.sharedItem.kind)) {
    const context = createTrayContextAt(editorData, x, y);
    return context ? createTrayInspectorCard(context, editorData.grid).outerHTML : "";
  }
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">${escapeHtml(cell.sharedItem.icon ?? "□")}</span><h3>${escapeHtml(cell.sharedItem.label ?? "Item")}</h3></header>
    <button class="inspector-link danger" type="button" data-inspector-delete="item">Xóa Item</button>
  </article>`;
}

function emptyCellActions(cell, hasTopLevelElement = false) {
  if (cell.element || cell.layerItem || cell.sharedItem || hasTopLevelElement) return "";
  const gateDisabled = !cell.path;
  const barrierDisabled = !cell.path;
  const tunnelDisabled = !cell.path;
  const oneWayDisabled = !cell.path;
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">＋</span><h3>Thêm Element</h3></header>
    <div class="quick-actions">
      <button class="btn" type="button" data-inspector-add="bridge">Bridge</button>
      <button class="btn" type="button" data-inspector-add="gate"${gateDisabled ? ' disabled title="Gate chỉ có thể đặt trên Path"' : ""}>Gate</button>
      <button class="btn" type="button" data-inspector-add="count-barrier"${barrierDisabled ? ' disabled title="Barrier chỉ có thể đặt trên Path"' : ""}>Barrier</button>
      <button class="btn" type="button" data-inspector-add="tunnel"${tunnelDisabled ? ' disabled title="Tunnel chỉ có thể đặt trên Path"' : ""}>Tunnel</button>
      <button class="btn" type="button" data-inspector-add="one-way"${oneWayDisabled ? ' disabled title="One Way chỉ có thể đặt trên Path"' : ""}>One Way</button>
    </div>
  </article>`;
}

function cellTypeLabel(editorData, cell, x, y) {
  if (cell.path) return "Path";
  if (isGrassAt(editorData, x, y)) return "Grass";
  return "Terrain trống";
}

export function renderInspector(container, editorData) {
  if (!editorData.selectedCell) {
    container.innerHTML = "";
    return;
  }
  const { x, y } = editorData.selectedCell;
  const index = getSelectedCellIndex(editorData);
  const layerNumber = activeLayerNumber(editorData);
  const cell = getMergedCell(editorData, x, y);
  const bridge = isBridgeElement(cell.element) ? cell.element : null;
  const gate = isGateElement(cell.element) ? cell.element : null;
  const countBarrier = findCountBarrierAtIndex(editorData, index);
  if (countBarrier) countBarrier.activeBarrierId = editorData.activeBarrierId;
  const tunnels = editorData.tunnelElement ?? [];
  const tunnelAtCell = findTunnelEntryAtIndex(editorData, index);
  const tunnelDraftAtCell = findTunnelDraftEntryAtIndex(editorData, index);
  const tunnel = tunnelAtCell?.tunnel ?? null;
  const oneWays = editorData.oneWayElement ?? [];
  const oneWayAtCell = findOneWayEntryAtIndex(editorData, index);
  const oneWay = oneWayAtCell?.oneWay ?? null;
  const mystery = cell.layerItem?.kind === "fruit" && isMysteryFruitAt(editorData, layerNumber, index);
  const cards = [
    bridge ? bridgeCard(bridge) : "",
    gate ? gateCard(gate) : "",
    tunnel ? tunnelCard(tunnel, index, tunnels, cell) : "",
    oneWay ? oneWayCard(oneWay, index, oneWays, cell) : "",
    countBarrier ? countBarrierCard(countBarrier, index) : "",
    cell.layerItem?.kind === "fruit" ? fruitCard(cell, mystery) : "",
    sharedItemCard(cell, editorData, x, y),
    emptyCellActions(cell, Boolean(countBarrier || tunnelAtCell || tunnelDraftAtCell || oneWayAtCell))
  ].filter(Boolean).join("");
  const elementSummary = [
    bridge ? `Bridge · ${bridgeAxisLabel(bridge.axis)}` : "",
    gate ? `Gate · ${gateDirectionLabel(gate.direction)}` : "",
    tunnelDraftAtCell ? `Tunnel Draft ${tunnelDraftAtCell.draft.tunnelId}` : "",
    tunnelAtCell ? `Tunnel ${tunnelAtCell.tunnel.tunnelId}` : "",
    oneWayAtCell ? `One Way ${oneWayAtCell.oneWay.oneWayId}` : "",
    countBarrier ? `Count Barrier ${countBarrier.barrierId}` : "",
    mystery ? "Mystery Fruit" : cell.layerItem?.kind === "fruit" ? cell.layerItem.label : "",
    cell.sharedItem?.label ?? ""
  ].filter(Boolean).join(", ") || "Không có";

  container.innerHTML = `<div class="context-inspector">
    <section class="cell-summary">
      <div class="inspector-kv"><span>Type</span><strong>${cellTypeLabel(editorData, cell, x, y)}</strong></div>
      <div class="inspector-kv"><span>X</span><strong>${x}</strong></div>
      <div class="inspector-kv"><span>Y</span><strong>${y}</strong></div>
      <div class="inspector-kv wide"><span>Element</span><strong>${escapeHtml(elementSummary)}</strong></div>
      ${isPriorityPointAt(editorData, x, y) ? '<div class="cell-badge">PriorityPoint</div>' : ""}
    </section>
    ${cards || '<div class="empty-state">Ô này không có element đặc biệt.</div>'}
  </div>`;
}
