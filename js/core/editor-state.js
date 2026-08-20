import { BASE_MAP_SIZE, MAX_HISTORY } from "./constants.js";
import { EventBus } from "./event-bus.js";
import { HistoryManager } from "./history-manager.js";
import { createId } from "../utils/id-generator.js";
import { createFullGrassCells, ensureTerrainState } from "../utils/grid-utils.js";

export function createLayer(layerNumber = 0) {
  return {
    id: createId("layer"),
    layer: layerNumber,
    name: `Layer ${String(layerNumber + 1).padStart(2, "0")}`,
    visible: true,
    cells: {}
  };
}

export function reindexLayers(layers) {
  if (!Array.isArray(layers)) return layers;
  layers.forEach((layer, index) => {
    layer.layer = index;
    layer.name = `Layer ${String(index + 1).padStart(2, "0")}`;
  });
  return layers;
}


export function createInitialState() {
  const firstLayer = createLayer(0);
  const grid = structuredClone(BASE_MAP_SIZE);
  return {
    grid,
    sharedCells: {},
    grassCells: createFullGrassCells(grid),
    priorityPoints: {},
    mysteryFruitElement: [],
    mysteryFruitDebug: false,
    countBarrierElement: [],
    selectedCountBarrierCount: 1,
    activeBarrierId: null,
    nextBarrierId: 0,
    drawingCountBarrierId: null,
    tunnelElement: [],
    activeTunnelId: null,
    nextTunnelId: 0,
    tunnelDraft: null,
    oneWayElement: [],
    activeOneWayId: null,
    nextOneWayId: 0,
    oneWayDraft: null,
    itemLayerLocks: {},
    layers: [firstLayer],
    activeLayerId: firstLayer.id,
    selectedCell: null,
    activeTrayCell: null,
    selectedAssetId: "snake-start",
    selectedBridgeAxis: 0,
    selectedGateDirection: 0,
    tool: "path",
    eraseMode: "smart",
    tab: "level",
    fileName: "untitled-level.json",
    sourceFileName: null,
    fileDirty: true
  };
}

export class EditorState {
  constructor(initialState = createInitialState()) {
    this.data = ensureTerrainState(structuredClone(initialState));
    this.events = new EventBus();
    this.history = new HistoryManager(MAX_HISTORY);
    this.inTransaction = false;
  }

  get activeLayer() {
    return this.data.layers.find((layer) => layer.id === this.data.activeLayerId) ?? this.data.layers[0];
  }

  replace(nextState, { record = false } = {}) {
    if (record) this.history.push(this.data);
    this.data = ensureTerrainState(structuredClone(nextState));
    this.events.emit("change", this.data);
  }

  mutate(mutator) {
    if (!this.inTransaction) this.history.push(this.data);
    const result = mutator(this.data);
    this.events.emit("change", this.data);
    return result;
  }

  beginTransaction() {
    if (this.inTransaction) return;
    this.history.push(this.data);
    this.inTransaction = true;
  }

  endTransaction() {
    this.inTransaction = false;
  }

  notify() {
    this.events.emit("change", this.data);
  }

  undo() {
    this.endTransaction();
    const snapshot = this.history.undo(this.data);
    if (snapshot) this.replace(snapshot);
  }

  redo() {
    this.endTransaction();
    const snapshot = this.history.redo(this.data);
    if (snapshot) this.replace(snapshot);
  }
}
