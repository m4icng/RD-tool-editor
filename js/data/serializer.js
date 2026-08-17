import { FRUIT_TYPES } from "../core/constants.js";
import { createLayer } from "../core/editor-state.js";
import { createBridge, isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { createGate, isGateElement, isValidGateDirection, normalizeGateDirection } from "../objects/gate-object.js";
import { nextCountBarrierSequence, normalizeCountBarrierElement } from "../objects/count-barrier-object.js";
import { isValidTunnelDirection, nextTunnelSequence, normalizeTunnelDirection, normalizeTunnelElement } from "../objects/tunnel-object.js";
import { isValidOneWayDirection, nextOneWaySequence, normalizeOneWayDirection, normalizeOneWayElement } from "../objects/one-way-object.js";
import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";
import {
  cellKey,
  ensureTerrainState,
  getTrayVisualPosition,
  indexToPosition,
  normalizeMysteryFruitElement,
  parseCellKey,
  positionToIndex
} from "../utils/grid-utils.js";

const TYPE_BY_ITEM_ID = Object.freeze(Object.fromEntries(Object.entries(FRUIT_ITEM_IDS).map(([type, id]) => [String(id), type])));
const GAME_FORMAT_FRUIT_META = Object.freeze({
  apple: { label: "Táo", icon: "🍎" }, banana: { label: "Chuối", icon: "🍌" },
  grape: { label: "Nho", icon: "🍇" }, eggplant: { label: "Cà tím", icon: "🍆" }
});

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} phải là một mảng.`);
}

function assertIndex(index, total, name) {
  if (!Number.isInteger(index) || index < 0 || index >= total) throw new Error(`${name} có index ${index} nằm ngoài map.`);
}

function createImportedItem(itemId) {
  const type = TYPE_BY_ITEM_ID[String(itemId)];
  if (!type) return { id: itemId, itemId, kind: "fruit", category: "item", fruitType: `unknown-${itemId}`, label: `Unknown #${itemId}`, icon: "❓", unknown: true };
  return { id: itemId, kind: "fruit", category: "item", fruitType: type, label: GAME_FORMAT_FRUIT_META[type].label, icon: GAME_FORMAT_FRUIT_META[type].icon };
}

function normalizeTrayGroups(rawTrays, width) {
  const withExplicitPositions = (tray) => {
    if (tray?.deliverPoint && tray?.trayPosition) return tray;
    const deliverPoint = tray?.deliverPoint ?? tray?.positions?.[0];
    if (!deliverPoint) return tray;
    return {
      trayId: tray.trayId,
      deliverPoint: { index: deliverPoint.index },
      trayPosition: { index: deliverPoint.index - width },
      layers: tray.layers ?? []
    };
  };
  if (Array.isArray(rawTrays)) return rawTrays.map(withExplicitPositions);
  if (!rawTrays || !Array.isArray(rawTrays.positions) || !Array.isArray(rawTrays.layers)) return rawTrays;
  const groups = new Map();
  const ensureGroup = (trayId) => {
    if (!groups.has(trayId)) groups.set(trayId, { trayId, positions: [], layers: [] });
    return groups.get(trayId);
  };
  rawTrays.positions.forEach(({ trayId, index }) => ensureGroup(trayId).positions.push({ index }));
  rawTrays.layers.forEach(({ trayId, layer, items }) => ensureGroup(trayId).layers.push({ layer, items }));
  return [...groups.values()].sort((a, b) => a.trayId - b.trayId).map(withExplicitPositions);
}

function validateStructure(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Root JSON phải là object.");
  const width = raw.map?.width;
  const height = raw.map?.height;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error("map.width và map.height phải là số nguyên dương.");
  assertArray(raw.Path?.index, "Path.index");
  assertArray(raw.Grass?.index, "Grass.index");
  assertArray(raw.PriorityPoint?.index, "PriorityPoint.index");
  assertArray(raw.spawns, "spawns");
  assertArray(raw.itemLayers, "itemLayers");
  assertArray(raw.trays, "trays");
  if (raw.bridgeElement !== undefined) assertArray(raw.bridgeElement, "bridgeElement");
  if (raw.gateElement !== undefined) assertArray(raw.gateElement, "gateElement");
  if (raw.tunnelElement !== undefined) assertArray(raw.tunnelElement, "tunnelElement");
  if (raw.oneWayElement !== undefined) assertArray(raw.oneWayElement, "oneWayElement");
  if (raw.mysteryFruitElement !== undefined) assertArray(raw.mysteryFruitElement, "mysteryFruitElement");
  if (raw.countBarrierElement !== undefined) assertArray(raw.countBarrierElement, "countBarrierElement");
  if (raw.elements !== undefined) {
    if (typeof raw.elements !== "object" || Array.isArray(raw.elements)) throw new Error("elements phải là object.");
    if (Object.keys(raw.elements).length > 0) throw new Error("Format element chưa được hỗ trợ; elements hiện phải là object rỗng.");
  }
  const total = width * height;
  raw.Path.index.forEach((index, i) => assertIndex(index, total, `Path.index[${i}]`));
  raw.Grass.index.forEach((index, i) => assertIndex(index, total, `Grass.index[${i}]`));
  raw.PriorityPoint.index.forEach((index, i) => assertIndex(index, total, `PriorityPoint.index[${i}]`));
  const pathIndexes = new Set(raw.Path.index);
  const grassIndexes = new Set(raw.Grass.index);
  if (pathIndexes.size !== raw.Path.index.length) throw new Error("Path.index không được chứa index trùng.");
  if (grassIndexes.size !== raw.Grass.index.length) throw new Error("Grass.index không được chứa index trùng.");
  if (new Set(raw.PriorityPoint.index).size !== raw.PriorityPoint.index.length) throw new Error("PriorityPoint.index không được chứa index trùng.");
  raw.Grass.index.forEach((index, i) => {
    if (pathIndexes.has(index)) throw new Error(`Grass.index[${i}] không được trùng Path.index.`);
  });
  raw.PriorityPoint.index.forEach((index, i) => {
    if (!pathIndexes.has(index)) throw new Error(`PriorityPoint.index[${i}] phải thuộc Path.index.`);
  });
  const bridgeIndexes = new Set();
  (raw.bridgeElement ?? []).forEach((bridge, i) => {
    assertIndex(bridge?.index, total, `bridgeElement[${i}]`);
    if (![0, 1].includes(bridge?.axis)) throw new Error(`bridgeElement[${i}].axis phải là 0 hoặc 1.`);
    if (bridgeIndexes.has(bridge.index)) throw new Error(`bridgeElement index ${bridge.index} bị trùng.`);
    bridgeIndexes.add(bridge.index);
  });
  const gateIndexes = new Set();
  (raw.gateElement ?? []).forEach((gate, i) => {
    assertIndex(gate?.index, total, `gateElement[${i}]`);
    if (!isValidGateDirection(gate?.direction)) throw new Error(`gateElement[${i}].direction phải là 0, 1, 2 hoặc 3.`);
    if (gateIndexes.has(gate.index)) throw new Error(`gateElement index ${gate.index} bị trùng.`);
    if (bridgeIndexes.has(gate.index)) throw new Error(`Gate và Bridge không được trùng index ${gate.index}.`);
    if (!pathIndexes.has(gate.index)) throw new Error(`gateElement[${i}].index phải thuộc Path.index.`);
    gateIndexes.add(gate.index);
  });
  const barrierIds = new Set();
  const barrierIndexes = new Set();
  (raw.countBarrierElement ?? []).forEach((barrier, i) => {
    if (!Number.isInteger(barrier?.barrierId) || barrier.barrierId < 0) throw new Error(`countBarrierElement[${i}].barrierId phải là số nguyên không âm.`);
    if (barrierIds.has(barrier.barrierId)) throw new Error(`countBarrierElement barrierId ${barrier.barrierId} bị trùng.`);
    barrierIds.add(barrier.barrierId);
    if (!Number.isInteger(barrier?.count) || barrier.count < 1) throw new Error(`countBarrierElement[${i}].count phải là số nguyên dương.`);
    assertIndex(barrier?.startIndex, total, `countBarrierElement[${i}].startIndex`);
    assertIndex(barrier?.endIndex, total, `countBarrierElement[${i}].endIndex`);
    if (barrier.startIndex === barrier.endIndex) throw new Error(`countBarrierElement[${i}] phải có startIndex và endIndex khác nhau.`);
    assertArray(barrier.index, `countBarrierElement[${i}].index`);
    if (barrier.index.length < 2) throw new Error(`countBarrierElement[${i}].index phải có ít nhất 2 ô Path.`);
    const localIndexes = new Set();
    barrier.index.forEach((index, j) => {
      assertIndex(index, total, `countBarrierElement[${i}].index[${j}]`);
      if (!pathIndexes.has(index)) throw new Error(`countBarrierElement[${i}].index[${j}] phải thuộc Path.index.`);
      if (localIndexes.has(index)) throw new Error(`countBarrierElement[${i}].index không được chứa index trùng.`);
      if (barrierIndexes.has(index)) throw new Error(`Count Barrier không được chồng index ${index}.`);
      localIndexes.add(index);
      barrierIndexes.add(index);
    });
    if (!localIndexes.has(barrier.startIndex)) throw new Error(`countBarrierElement[${i}].startIndex phải nằm trong index.`);
    if (!localIndexes.has(barrier.endIndex)) throw new Error(`countBarrierElement[${i}].endIndex phải nằm trong index.`);
  });
  const tunnelIds = new Set();
  const tunnelIndexes = new Set();
  (raw.tunnelElement ?? []).forEach((tunnel, i) => {
    if (!Number.isInteger(tunnel?.tunnelId) || tunnel.tunnelId < 0) throw new Error(`tunnelElement[${i}].tunnelId phải là số nguyên không âm.`);
    if (tunnelIds.has(tunnel.tunnelId)) throw new Error(`tunnelElement tunnelId ${tunnel.tunnelId} bị trùng.`);
    tunnelIds.add(tunnel.tunnelId);
    assertArray(tunnel.entryPoints, `tunnelElement[${i}].entryPoints`);
    if (tunnel.entryPoints.length !== 2) throw new Error(`tunnelElement[${i}].entryPoints phải có đúng 2 điểm.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, j) => {
      assertIndex(point?.index, total, `tunnelElement[${i}].entryPoints[${j}].index`);
      if (!pathIndexes.has(point.index)) throw new Error(`tunnelElement[${i}].entryPoints[${j}].index phải thuộc Path.index.`);
      if (!isValidTunnelDirection(point?.direction)) throw new Error(`tunnelElement[${i}].entryPoints[${j}].direction phải là 0, 1, 2 hoặc 3.`);
      if (localIndexes.has(point.index)) throw new Error(`tunnelElement[${i}].entryPoints không được chứa index trùng.`);
      if (tunnelIndexes.has(point.index)) throw new Error(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIds = new Set();
  const oneWayIndexes = new Set();
  (raw.oneWayElement ?? []).forEach((oneWay, i) => {
    if (!Number.isInteger(oneWay?.oneWayId) || oneWay.oneWayId < 0) throw new Error(`oneWayElement[${i}].oneWayId phải là số nguyên không âm.`);
    if (oneWayIds.has(oneWay.oneWayId)) throw new Error(`oneWayElement oneWayId ${oneWay.oneWayId} bị trùng.`);
    oneWayIds.add(oneWay.oneWayId);
    assertArray(oneWay.entryPoints, `oneWayElement[${i}].entryPoints`);
    if (oneWay.entryPoints.length !== 2) throw new Error(`oneWayElement[${i}].entryPoints phải có đúng 2 điểm.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, j) => {
      assertIndex(point?.index, total, `oneWayElement[${i}].entryPoints[${j}].index`);
      if (!pathIndexes.has(point.index)) throw new Error(`oneWayElement[${i}].entryPoints[${j}].index phải thuộc Path.index.`);
      if (!isValidOneWayDirection(point?.direction)) throw new Error(`oneWayElement[${i}].entryPoints[${j}].direction phải là 0, 1, 2 hoặc 3.`);
      if (localIndexes.has(point.index)) throw new Error(`oneWayElement[${i}].entryPoints không được chứa index trùng.`);
      if (oneWayIndexes.has(point.index)) throw new Error(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });
  raw.spawns.forEach((spawn, i) => assertIndex(spawn?.index, total, `spawns[${i}]`));
  const fruitIndexesByLayer = new Map();
  raw.itemLayers.forEach((layer, i) => {
    if (!Number.isInteger(layer?.layer) || layer.layer < 0) throw new Error(`itemLayers[${i}].layer phải là số nguyên không âm.`);
    assertArray(layer.items, `itemLayers[${i}].items`);
    const layerFruitIndexes = fruitIndexesByLayer.get(layer.layer) ?? new Set();
    layer.items.forEach((item, j) => {
      if (!Number.isInteger(item?.itemId) || item.itemId < 0) throw new Error(`itemLayers[${i}].items[${j}].itemId không hợp lệ.`);
      assertArray(item.index, `itemLayers[${i}].items[${j}].index`);
      item.index.forEach((index, k) => {
        assertIndex(index, total, `itemLayers[${i}].items[${j}].index[${k}]`);
        layerFruitIndexes.add(index);
      });
    });
    fruitIndexesByLayer.set(layer.layer, layerFruitIndexes);
  });
  const mysteryLayers = new Set();
  (raw.mysteryFruitElement ?? []).forEach((entry, i) => {
    if (!Number.isInteger(entry?.layer) || entry.layer < 0) throw new Error(`mysteryFruitElement[${i}].layer phải là số nguyên không âm.`);
    if (mysteryLayers.has(entry.layer)) throw new Error(`mysteryFruitElement layer ${entry.layer} bị trùng.`);
    mysteryLayers.add(entry.layer);
    assertArray(entry.index, `mysteryFruitElement[${i}].index`);
    if (new Set(entry.index).size !== entry.index.length) throw new Error(`mysteryFruitElement[${i}].index không được chứa index trùng.`);
    const fruitIndexes = fruitIndexesByLayer.get(entry.layer);
    entry.index.forEach((index, j) => {
      assertIndex(index, total, `mysteryFruitElement[${i}].index[${j}]`);
      if (!fruitIndexes?.has(index)) throw new Error(`mysteryFruitElement[${i}].index[${j}] phải trỏ tới Fruit thật trong itemLayers layer ${entry.layer}.`);
    });
  });
  const trayIds = new Set();
  raw.trays.forEach((tray, i) => {
    if (!Number.isInteger(tray?.trayId) || tray.trayId < 0) throw new Error(`trays[${i}].trayId không hợp lệ.`);
    if (trayIds.has(tray.trayId)) throw new Error(`trayId ${tray.trayId} bị trùng.`);
    trayIds.add(tray.trayId);
    assertIndex(tray.deliverPoint?.index, total, `trays[${i}].deliverPoint`);
    assertIndex(tray.trayPosition?.index, total, `trays[${i}].trayPosition`);
    const deliverPoint = indexToPosition(tray.deliverPoint.index, width);
    const trayPosition = indexToPosition(tray.trayPosition.index, width);
    const distance = Math.abs(deliverPoint.x - trayPosition.x) + Math.abs(deliverPoint.y - trayPosition.y);
    if (distance !== 1) throw new Error(`trays[${i}].trayPosition phải nằm liền kề deliverPoint theo hướng trên/dưới/trái/phải.`);
    assertArray(tray.layers, `trays[${i}].layers`);
    tray.layers.forEach((layer, layerIndex) => {
      if (!Number.isInteger(layer?.layer) || layer.layer < 0) throw new Error(`trays[${i}].layers[${layerIndex}].layer không hợp lệ.`);
      assertArray(layer.items, `trays[${i}].layers[${layerIndex}].items`);
      layer.items.forEach((item, itemIndex) => {
        if (!Number.isInteger(item?.itemId) || item.itemId < 0 || !Number.isInteger(item?.count) || item.count < 0) {
          throw new Error(`trays[${i}].layers[${layerIndex}].items[${itemIndex}] phải có itemId/count nguyên không âm.`);
        }
      });
    });
  });
  return { width, height };
}

export function deserializeLevel(rawData, { fileName = "untitled-level.json" } = {}) {
  const raw = typeof rawData === "string" ? JSON.parse(rawData) : structuredClone(rawData);
  raw.trays = normalizeTrayGroups(raw.trays, raw.map?.width);
  const { width, height } = validateStructure(raw);
  const sharedCells = {};
  const ensureShared = (key) => (sharedCells[key] ??= { path: false, item: null, element: null });
  raw.Path.index.forEach((index) => {
    const { x, y } = indexToPosition(index, width);
    ensureShared(cellKey(x, y)).path = true;
  });
  const grassCells = Object.fromEntries(raw.Grass.index.map((index) => {
    const { x, y } = indexToPosition(index, width);
    return [cellKey(x, y), true];
  }));
  const priorityPoints = Object.fromEntries(raw.PriorityPoint.index.map((index) => {
    const { x, y } = indexToPosition(index, width);
    return [cellKey(x, y), "manual"];
  }));
  (raw.bridgeElement ?? []).forEach((bridge) => {
    const { x, y } = indexToPosition(bridge.index, width);
    ensureShared(cellKey(x, y)).element = createBridge(bridge.axis);
  });
  (raw.gateElement ?? []).forEach((gate) => {
    const { x, y } = indexToPosition(gate.index, width);
    ensureShared(cellKey(x, y)).element = createGate(gate.direction);
  });
  raw.spawns.forEach((spawn) => {
    const { x, y } = indexToPosition(spawn.index, width);
    ensureShared(cellKey(x, y)).item = { id: "snake-start", kind: "snake", category: "item", label: "Đầu rắn", icon: "🐍", direction: "right" };
  });

  const sortedItemLayers = raw.itemLayers.slice().sort((a, b) => a.layer - b.layer);
  const sourceLayerToEditorLayer = new Map();
  const layers = sortedItemLayers
    .map((source, index) => {
      sourceLayerToEditorLayer.set(source.layer, index);
      const layer = createLayer(index);
      source.items.forEach((group) => group.index.forEach((idx) => {
        const { x, y } = indexToPosition(idx, width);
        layer.cells[cellKey(x, y)] = { item: createImportedItem(group.itemId) };
      }));
      return layer;
    });
  if (layers.length === 0) layers.push(createLayer(0));

  raw.trays.forEach((source) => {
    const trayLayers = source.layers.slice().sort((a, b) => a.layer - b.layer).map((trayLayer) => {
      const recipe = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
      const unknownItems = [];
      trayLayer.items.forEach(({ itemId, count }) => {
        const type = TYPE_BY_ITEM_ID[String(itemId)];
        if (type) recipe[type] += count;
        else unknownItems.push({ itemId, count });
      });
      return { id: `tray-${source.trayId}-layer-${trayLayer.layer}`, layer: trayLayer.layer, recipe, unknownItems };
    });
    const { x, y } = indexToPosition(source.deliverPoint.index, width);
    const trayPosition = indexToPosition(source.trayPosition.index, width);
    ensureShared(cellKey(x, y)).item = {
      id: `tray-${source.trayId}`, trayId: source.trayId, kind: "tray", category: "item", label: "Khay chứa", icon: "🧺", capacity: 9,
      trayPosition,
      trayLayers
    };
  });

  const mysteryFruitElement = normalizeMysteryFruitElement((raw.mysteryFruitElement ?? []).map((entry) => ({
    layer: sourceLayerToEditorLayer.get(entry.layer),
    index: entry.index
  })));

  return {
    grid: { columns: width, rows: height }, sharedCells, grassCells, priorityPoints, layers, activeLayerId: layers[0].id,
    mysteryFruitElement,
    mysteryFruitDebug: false,
    countBarrierElement: normalizeCountBarrierElement(raw.countBarrierElement ?? []),
    selectedCountBarrierCount: 1,
    activeBarrierId: null,
    nextBarrierId: nextCountBarrierSequence(raw.countBarrierElement ?? []),
    drawingCountBarrierId: null,
    tunnelElement: normalizeTunnelElement(raw.tunnelElement ?? []),
    activeTunnelId: null,
    nextTunnelId: nextTunnelSequence(raw.tunnelElement ?? []),
    oneWayElement: normalizeOneWayElement(raw.oneWayElement ?? []),
    activeOneWayId: null,
    nextOneWayId: nextOneWaySequence(raw.oneWayElement ?? []),
    selectedCell: null, activeTrayCell: null, selectedAssetId: "snake-start", selectedBridgeAxis: 0, selectedGateDirection: 0, tool: "path", eraseMode: "smart", tab: "level",
    fileName: normalizeFileName(fileName), sourceFileName: normalizeFileName(fileName), fileDirty: false
  };
}

function itemIdOf(item) { return item.unknown ? Number(item.itemId ?? item.id) : Number(FRUIT_ITEM_IDS[item.fruitType] ?? item.id); }

export function serializeLevel(editorData) {
  ensureTerrainState(editorData);
  const width = editorData.grid.columns;
  const road = [];
  const spawns = [];
  const trays = [];
  const bridgeElement = [];
  const gateElement = [];
  const tunnelElement = [];
  const oneWayElement = [];
  const pathIndexes = new Set();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    const index = positionToIndex(x, y, width);
    if (cell.path) {
      road.push(index);
      pathIndexes.add(index);
    }
    if (isBridgeElement(cell.element)) bridgeElement.push({ index, axis: normalizeBridgeAxis(cell.element.axis) });
    if (isGateElement(cell.element)) gateElement.push({ index, direction: normalizeGateDirection(cell.element.direction) });
    if (cell.item?.kind === "snake") spawns.push({ index });
    if (cell.item?.kind === "tray") {
      const trayId = Number(cell.item.trayId);
      const layers = (cell.item.trayLayers ?? []).map((layer, order) => {
        const items = FRUIT_TYPES.filter((type) => Number(layer.recipe?.[type]) > 0)
          .map((type) => ({ itemId: FRUIT_ITEM_IDS[type], count: Number(layer.recipe[type]) }));
        (layer.unknownItems ?? []).filter((item) => Number(item.count) > 0)
          .forEach((item) => items.push({ itemId: Number(item.itemId), count: Number(item.count) }));
        return { layer: Number.isInteger(layer.layer) ? layer.layer : order, items: items.sort((a, b) => a.itemId - b.itemId) };
      });
      const trayPosition = getTrayVisualPosition(cell.item, { x, y });
      trays.push({
        trayId,
        deliverPoint: { index },
        trayPosition: { index: positionToIndex(trayPosition.x, trayPosition.y, width) },
        layers: layers.sort((a, b) => a.layer - b.layer)
      });
    }
  });
  const fruitIndexesByLayer = new Map();
  const itemLayerEntries = (editorData.layers ?? []).map((layer, order) => {
    const groups = new Map();
    Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
      if (cell.item?.kind !== "fruit") return;
      const id = itemIdOf(cell.item);
      const { x, y } = parseCellKey(key);
      const indexes = groups.get(id) ?? [];
      indexes.push(positionToIndex(x, y, width));
      groups.set(id, indexes);
    });
    const sourceLayer = Number.isInteger(layer.layer) ? layer.layer : order;
    fruitIndexesByLayer.set(sourceLayer, new Set([...groups.values()].flat()));
    return {
      layer: sourceLayer,
      items: [...groups.entries()].sort(([a], [b]) => a - b).map(([itemId, index]) => ({ itemId, index: [...new Set(index)].sort((a, b) => a - b) }))
    };
  }).filter((layer) => layer.items.length > 0)
    .sort((a, b) => a.layer - b.layer);
  const exportLayerBySourceLayer = new Map();
  const itemLayers = itemLayerEntries.map((layer, index) => {
    exportLayerBySourceLayer.set(layer.layer, index);
    return { ...layer, layer: index };
  });
  const mysteryFruitElement = normalizeMysteryFruitElement(editorData.mysteryFruitElement)
    .map((entry) => {
      const exportedLayer = exportLayerBySourceLayer.get(entry.layer);
      const fruitIndexes = fruitIndexesByLayer.get(entry.layer) ?? new Set();
      if (!Number.isInteger(exportedLayer)) return null;
      return {
        layer: exportedLayer,
        index: entry.index.filter((index) => fruitIndexes.has(index))
      };
    })
    .filter((entry) => entry?.index.length > 0);
  const countBarrierElement = normalizeCountBarrierElement(editorData.countBarrierElement)
    .map((entry) => ({
      ...entry,
      index: entry.index.filter((index) => pathIndexes.has(index)).sort((a, b) => a - b)
    }))
    .filter((entry) => entry.index.length > 0 && entry.index.includes(entry.startIndex) && entry.index.includes(entry.endIndex));
  normalizeTunnelElement(editorData.tunnelElement)
    .forEach((entry) => {
      const points = entry.entryPoints
        .filter((point) => pathIndexes.has(point.index))
        .map((point) => ({ index: point.index, direction: normalizeTunnelDirection(point.direction) }));
      if (points.length === 2 && points[0].index !== points[1].index) {
        tunnelElement.push({ tunnelId: entry.tunnelId, entryPoints: points });
      }
    });
  normalizeOneWayElement(editorData.oneWayElement)
    .forEach((entry) => {
      const points = entry.entryPoints
        .filter((point) => pathIndexes.has(point.index))
        .map((point) => ({ index: point.index, direction: normalizeOneWayDirection(point.direction) }));
      if (points.length === 2 && points[0].index !== points[1].index) {
        oneWayElement.push({ oneWayId: entry.oneWayId, entryPoints: points });
      }
    });
  const grass = Object.keys(editorData.grassCells ?? {}).map((key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, width);
  }).sort((a, b) => a - b);
  const priorityPoints = Object.keys(editorData.priorityPoints ?? {}).map((key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, width);
  }).sort((a, b) => a - b);
  return {
    map: { width, height: editorData.grid.rows },
    Path: { index: [...new Set(road)].sort((a, b) => a - b) },
    Grass: { index: [...new Set(grass)] },
    PriorityPoint: { index: [...new Set(priorityPoints)] },
    spawns: spawns.sort((a, b) => a.index - b.index), itemLayers,
    trays: trays.sort((a, b) => a.trayId - b.trayId),
    bridgeElement: bridgeElement.sort((a, b) => a.index - b.index),
    gateElement: gateElement.sort((a, b) => a.index - b.index),
    mysteryFruitElement,
    countBarrierElement,
    tunnelElement: tunnelElement.sort((a, b) => a.tunnelId - b.tunnelId),
    oneWayElement: oneWayElement.sort((a, b) => a.oneWayId - b.oneWayId)
  };
}

export function serializeEditorState(editorData) { ensureTerrainState(editorData); return { editorStateVersion: 1, data: structuredClone(editorData) }; }
export function deserializeEditorState(rawData) {
  const raw = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (raw?.editorStateVersion !== 1 || !raw.data?.grid || !Array.isArray(raw.data.layers)) throw new Error("Stored editor state không hợp lệ.");
  return ensureTerrainState(structuredClone(raw.data));
}

export function normalizeFileName(value) {
  const base = String(value ?? "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\.json$/i, "") || "untitled-level";
  return `${base}.json`;
}
