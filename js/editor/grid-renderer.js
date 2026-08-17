import { FRUIT_SHORT } from "../core/constants.js";
import { applyVisualScaleConfig } from "../core/visual-scale.js";
import { isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { gateDirectionClass, isGateElement } from "../objects/gate-object.js";
import { findCountBarrierAtIndex } from "../objects/count-barrier-object.js";
import { findTunnelDraftEntryAtIndex, findTunnelEntryAtIndex, tunnelColor, tunnelDirectionClass, tunnelDirectionIcon } from "../objects/tunnel-object.js";
import { findOneWayDraftEntryAtIndex, findOneWayEntryAtIndex, oneWayColor, oneWayDirectionClass, oneWayDirectionIcon } from "../objects/one-way-object.js";
import { cellKey, createMergedLayer, ensureTerrainState, getCell, getTrayVisualPosition, isMysteryFruitAt, positionToIndex } from "../utils/grid-utils.js";
import { samePosition } from "../utils/math-utils.js";

export function renderGrid(container, editorData) {
  ensureTerrainState(editorData);
  applyVisualScaleConfig(container);
  const activeLayer = editorData.layers.find((candidate) => candidate.id === editorData.activeLayerId) ?? editorData.layers[0];
  const layer = createMergedLayer(editorData);
  if (activeLayer?.visible === false) {
    Object.values(layer.cells).forEach((cell) => {
      cell.item = cell.sharedItem ?? null;
      cell.layerItem = null;
    });
  }
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${editorData.grid.columns}, minmax(0, 1fr))`;
  const trayVisuals = new Map();
  const trayCheckpoints = new Map();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return;
    const [trayX, trayY] = key.split(",").map(Number);
    trayCheckpoints.set(key, { x: trayX, y: trayY, item: cell.item });
    const visual = getTrayVisualPosition(cell.item, { x: trayX, y: trayY });
    trayVisuals.set(cellKey(visual.x, visual.y), { x: trayX, y: trayY, item: cell.item });
  });

  for (let y = 0; y < editorData.grid.rows; y += 1) {
    for (let x = 0; x < editorData.grid.columns; x += 1) {
      const data = getCell(layer, x, y);
      const index = positionToIndex(x, y, editorData.grid.columns);
      const priorityPoint = Boolean(editorData.priorityPoints[cellKey(x, y)]);
      const countBarrier = findCountBarrierAtIndex(editorData, index);
      const tunnelEntry = findTunnelEntryAtIndex(editorData, index);
      const tunnelDraftEntry = findTunnelDraftEntryAtIndex(editorData, index);
      const oneWayEntry = findOneWayEntryAtIndex(editorData, index);
      const oneWayDraftEntry = findOneWayDraftEntryAtIndex(editorData, index);
      const barrierEndpoint = countBarrier && (countBarrier.startIndex === index || countBarrier.endIndex === index);
      const activeBarrier = countBarrier && countBarrier.barrierId === editorData.activeBarrierId;
      const activeTunnel = (tunnelEntry && tunnelEntry.tunnel.tunnelId === editorData.activeTunnelId) || Boolean(tunnelDraftEntry);
      const activeOneWay = (oneWayEntry && oneWayEntry.oneWay.oneWayId === editorData.activeOneWayId) || Boolean(oneWayDraftEntry);
      const grass = Boolean(editorData.grassCells[cellKey(x, y)]);
      const checkpointTray = trayCheckpoints.get(cellKey(x, y));
      const visualTray = trayVisuals.get(cellKey(x, y));
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `grid-cell${grass ? " grass" : " terrain-empty"}${data.path ? " path" : ""}${priorityPoint ? " priority-point" : ""}${countBarrier ? " count-barrier-cell" : ""}${activeBarrier ? " active-count-barrier-cell" : ""}${barrierEndpoint ? " count-barrier-endpoint" : ""}${tunnelEntry || tunnelDraftEntry ? " tunnel-cell" : ""}${tunnelDraftEntry ? " tunnel-draft-cell" : ""}${activeTunnel ? " active-tunnel-cell" : ""}${oneWayEntry || oneWayDraftEntry ? " one-way-cell" : ""}${oneWayDraftEntry ? " one-way-draft-cell" : ""}${activeOneWay ? " active-one-way-cell" : ""}${samePosition(editorData.selectedCell, { x, y }) ? " selected" : ""}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (tunnelEntry || tunnelDraftEntry) cell.style.setProperty("--tunnel-color", tunnelColor((tunnelEntry?.tunnel ?? tunnelDraftEntry?.draft).tunnelId));
      if (oneWayEntry || oneWayDraftEntry) cell.style.setProperty("--one-way-color", oneWayColor((oneWayEntry?.oneWay ?? oneWayDraftEntry?.draft).oneWayId));
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Ô Index ${index}${priorityPoint ? ", PriorityPoint" : ""}${grass ? ", Grass" : data.path ? ", Path" : ", Terrain trống"}`);

      if (isBridgeElement(data.element)) {
        const bridge = document.createElement("span");
        bridge.className = `bridge-preview${normalizeBridgeAxis(data.element.axis) === 1 ? " vertical" : ""}`;
        bridge.title = normalizeBridgeAxis(data.element.axis) === 1 ? "Bridge Vertical" : "Bridge Horizontal";
        bridge.textContent = "🟰";
        cell.appendChild(bridge);
      }
      if (isGateElement(data.element)) {
        const gate = document.createElement("span");
        gate.className = `gate-preview ${gateDirectionClass(data.element.direction)}`;
        gate.title = `Gate ${gateDirectionClass(data.element.direction)}`;
        cell.appendChild(gate);
      }
      if (barrierEndpoint) {
        const barrier = document.createElement("span");
        barrier.className = "count-barrier-preview";
        barrier.title = `Count Barrier ${countBarrier.barrierId} · count ${countBarrier.count}`;
        barrier.textContent = String(countBarrier.count);
        cell.appendChild(barrier);
      }
      if (tunnelEntry) {
        const tunnel = document.createElement("span");
        tunnel.className = `tunnel-preview ${tunnelDirectionClass(tunnelEntry.entryPoint.direction)}`;
        tunnel.title = `Tunnel ${tunnelEntry.tunnel.tunnelId} · Entry ${tunnelEntry.entryIndex === 0 ? "A" : "B"}`;
        tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
        const symbol = document.createElement("span");
        symbol.className = "tunnel-symbol";
        symbol.textContent = tunnelDirectionIcon(tunnelEntry.entryPoint.direction);
        tunnel.appendChild(symbol);
        cell.appendChild(tunnel);
      }
      if (tunnelDraftEntry) {
        const tunnel = document.createElement("span");
        const hasDirection = Number.isInteger(tunnelDraftEntry.entryPoint.direction);
        tunnel.className = `tunnel-preview draft ${hasDirection ? tunnelDirectionClass(tunnelDraftEntry.entryPoint.direction) : "pending"}`;
        tunnel.title = `Tunnel ${tunnelDraftEntry.draft.tunnelId} draft · Entry ${tunnelDraftEntry.entryIndex === 0 ? "A" : "B"}`;
        tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelDraftEntry.draft.tunnelId));
        const symbol = document.createElement("span");
        symbol.className = "tunnel-symbol";
        symbol.textContent = "⏭";
        tunnel.appendChild(symbol);
        cell.appendChild(tunnel);
      }
      if (oneWayEntry) {
        const oneWay = document.createElement("span");
        oneWay.className = `one-way-preview ${oneWayDirectionClass(oneWayEntry.entryPoint.direction)}`;
        oneWay.title = `One Way ${oneWayEntry.oneWay.oneWayId} · Entry ${oneWayEntry.entryIndex === 0 ? "A" : "B"}`;
        oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
        oneWay.textContent = oneWayDirectionIcon(oneWayEntry.entryPoint.direction);
        cell.appendChild(oneWay);
      }
      if (oneWayDraftEntry) {
        const oneWay = document.createElement("span");
        const hasDirection = Number.isInteger(oneWayDraftEntry.entryPoint.direction);
        oneWay.className = `one-way-preview draft ${hasDirection ? oneWayDirectionClass(oneWayDraftEntry.entryPoint.direction) : "pending"}`;
        oneWay.title = `One Way ${oneWayDraftEntry.draft.oneWayId} draft · Entry ${oneWayDraftEntry.entryIndex === 0 ? "A" : "B"}`;
        oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayDraftEntry.draft.oneWayId));
        oneWay.textContent = hasDirection ? oneWayDirectionIcon(oneWayDraftEntry.entryPoint.direction) : "▲";
        cell.appendChild(oneWay);
      }
      if (data.item && data.item.kind !== "tray") {
        const isHiddenFruit = data.item.kind === "fruit"
          && data.layerItem?.kind === "fruit"
          && isMysteryFruitAt(editorData, Number.isInteger(activeLayer?.layer) ? activeLayer.layer : 0, index)
          && !editorData.mysteryFruitDebug;
        const icon = document.createElement("span");
        icon.className = `placed-icon ${data.item.kind}${isHiddenFruit ? " mystery-fruit-preview" : ""}`;
        icon.textContent = data.item.icon;
        if (data.item.kind === "fruit") {
          const badge = document.createElement("small");
          badge.textContent = isHiddenFruit ? "?" : data.item.unknown ? `#${data.item.itemId ?? data.item.id}` : FRUIT_SHORT[data.item.fruitType];
          icon.appendChild(badge);
        }
        cell.appendChild(icon);
      }
      if (visualTray) {
        const icon = document.createElement("span");
        icon.className = "placed-icon tray tray-visual-proxy";
        icon.textContent = visualTray.item.icon ?? "🧺";
        cell.appendChild(icon);
      }
      if (checkpointTray) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "delivery-checkpoint editor-checkpoint";
        checkpoint.title = `Checkpoint khay ID ${checkpointTray.item.trayId} tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, editorData.grid.columns)}`;
        cell.appendChild(checkpoint);
      }
      container.appendChild(cell);
    }
  }
}
