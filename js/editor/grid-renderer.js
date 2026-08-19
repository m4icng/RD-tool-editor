import { applyBlockItemVisual } from "../core/block-visuals.js";
import { applyVisualScaleConfig } from "../core/visual-scale.js";
import { isBridgeElement } from "../objects/bridge-object.js";
import { gateDirectionClass, isGateElement } from "../objects/gate-object.js";
import { findCountBarrierAtIndex } from "../objects/count-barrier-object.js";
import { findTunnelDraftEntryAtIndex, findTunnelEntryAtIndex, isTunnelTool, tunnelColor, tunnelDirectionClass, tunnelDirectionIcon } from "../objects/tunnel-object.js";
import { findOneWayDraftEntryAtIndex, findOneWayEntryAtIndex, oneWayColor, oneWayDirectionClass, oneWayDirectionIcon } from "../objects/one-way-object.js";
import { findObject } from "../objects/object-registry.js";
import { PLACEMENT_MESSAGES, validateBridgePlacement, validateGatePlacement, validateTunnelPointPlacement } from "../objects/element-placement-rules.js";
import { cellKey, createMergedLayer, ensureTerrainState, getCell, getTrayVisualCells, isMysteryFruitAt, positionToIndex } from "../utils/grid-utils.js";
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
  const bridgeVisuals = new Map();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isBridgeElement(cell?.element)) return;
    const [bridgeX, bridgeY] = key.split(",").map(Number);
    const centerIndex = positionToIndex(bridgeX, bridgeY, editorData.grid.columns);
    bridgeVisuals.set(key, { centerIndex });
  });
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return;
    const [trayX, trayY] = key.split(",").map(Number);
    trayCheckpoints.set(key, { x: trayX, y: trayY, item: cell.item });
    getTrayVisualCells(cell.item, { x: trayX, y: trayY }).forEach((visual) => {
      trayVisuals.set(cellKey(visual.x, visual.y), { x: trayX, y: trayY, item: cell.item, role: visual.role, center: visual.center });
    });
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
      const visualBridge = bridgeVisuals.get(cellKey(x, y));
      const selectedObject = editorData.tool === "item" ? findObject(editorData.selectedAssetId) : null;
      let placementState = null;
      if (selectedObject?.kind === "bridge") placementState = validateBridgePlacement(editorData, index);
      else if (selectedObject?.kind === "gate") placementState = validateGatePlacement(editorData, index);
      else if (isTunnelTool(selectedObject)) placementState = validateTunnelPointPlacement(editorData, index);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `grid-cell${grass ? " grass" : " terrain-empty"}${data.path ? " path" : ""}${priorityPoint ? " priority-point" : ""}${countBarrier ? " count-barrier-cell" : ""}${activeBarrier ? " active-count-barrier-cell" : ""}${barrierEndpoint ? " count-barrier-endpoint" : ""}${tunnelEntry || tunnelDraftEntry ? " tunnel-cell" : ""}${tunnelDraftEntry ? " tunnel-draft-cell" : ""}${activeTunnel ? " active-tunnel-cell" : ""}${oneWayEntry || oneWayDraftEntry ? " one-way-cell" : ""}${oneWayDraftEntry ? " one-way-draft-cell" : ""}${activeOneWay ? " active-one-way-cell" : ""}${placementState ? (placementState.valid ? " placement-valid" : " placement-invalid") : ""}${samePosition(editorData.selectedCell, { x, y }) ? " selected" : ""}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (tunnelEntry || tunnelDraftEntry) cell.style.setProperty("--tunnel-color", tunnelColor((tunnelEntry?.tunnel ?? tunnelDraftEntry?.draft).tunnelId));
      if (oneWayEntry || oneWayDraftEntry) cell.style.setProperty("--one-way-color", oneWayColor((oneWayEntry?.oneWay ?? oneWayDraftEntry?.draft).oneWayId));
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Ô Index ${index}${priorityPoint ? ", PriorityPoint" : ""}${grass ? ", Grass" : data.path ? ", Path" : ", Terrain trống"}`);
      if (placementState) {
        cell.title = placementState.valid ? "✓ Có thể đặt" : (PLACEMENT_MESSAGES[placementState.reason] ?? "Không thể đặt");
      }

      if (visualBridge) {
        const bridge = document.createElement("span");
        bridge.className = "bridge-preview bridge-joined";
        bridge.title = `Bridge Center #${visualBridge.centerIndex}`;
        for (let segment = 0; segment < 3; segment += 1) {
          const icon = document.createElement("span");
          icon.textContent = "🟰";
          bridge.appendChild(icon);
        }
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
        if (data.item.kind === "fruit") {
          applyBlockItemVisual(icon, data.item, { mystery: isHiddenFruit });
        } else {
          icon.textContent = data.item.icon;
        }
        cell.appendChild(icon);
      }
      if (visualTray) {
        const icon = document.createElement("span");
        icon.className = `tray-footprint ${visualTray.role}${visualTray.center ? " center" : ""}`;
        icon.textContent = visualTray.center ? (visualTray.item.icon ?? "🧺") : "";
        icon.title = visualTray.role === "conveyor" ? "Tray Conveyor / trayPosition" : "Tray Main 3x3";
        cell.appendChild(icon);
      }
      if (checkpointTray) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "delivery-checkpoint editor-checkpoint";
        checkpoint.title = `Checkpoint khay ID ${checkpointTray.item.trayId} tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, editorData.grid.columns)}`;
        checkpoint.textContent = "⭕";
        cell.appendChild(checkpoint);
      }
      container.appendChild(cell);
    }
  }
}
