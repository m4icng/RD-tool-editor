export const STORAGE_KEY = "railwaydash-level-editor-v04";
export const LEGACY_STORAGE_KEYS = [];
export const SCHEMA_VERSION = 3;
export const MAX_HISTORY = 50;
export const BASE_MAP_SIZE = Object.freeze({ columns: 17, rows: 28 });

export const TOOL_LABELS = Object.freeze({
  path: "Vẽ đường",
  item: "Đặt item",
  terrain: "Chỉnh terrain",
  select: "Chọn ô",
  erase: "Xóa"
});

export const ERASE_MODE_LABELS = Object.freeze({
  smart: "Auto",
  path: "Path",
  grass: "Grass",
  item: "Item",
  "mystery-fruit": "Mystery Fruit",
  bridge: "Bridge",
  gate: "Gate",
  tunnel: "Tunnel",
  "one-way": "One Way",
  "count-barrier": "Count Barrier",
  tray: "Tray"
});

export const TERRAIN_ASSET_IDS = Object.freeze({
  GRASS: "terrain-grass",
  EMPTY: "terrain-empty",
  PRIORITY_POINT: "priority-point"
});

export const BRIDGE_ASSET_ID = "bridge";
export const BRIDGE_AXES = Object.freeze({
  HORIZONTAL: 0,
  VERTICAL: 1
});

export const GATE_ASSET_ID = "gate";
export const GATE_DIRECTIONS = Object.freeze({
  UP: 0,
  DOWN: 1,
  RIGHT: 2,
  LEFT: 3
});

export const MYSTERY_FRUIT_ASSET_ID = "mystery-fruit";
export const COUNT_BARRIER_ASSET_ID = "count-barrier";
export const TUNNEL_ASSET_ID = "tunnel";
export const ONE_WAY_ASSET_ID = "one-way";

export const FRUIT_TYPES = Object.freeze(["apple", "banana", "grape", "eggplant", "block5", "block6", "block7"]);
export const FRUIT_SHORT = Object.freeze({ apple: "B1", banana: "B2", grape: "B3", eggplant: "B4", block5: "B5", block6: "B6", block7: "B7" });
export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});
