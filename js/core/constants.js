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
  smart: "Thông minh",
  path: "Đường đi",
  item: "Item",
  element: "Element"
});

export const TERRAIN_ASSET_IDS = Object.freeze({
  GRASS: "terrain-grass",
  EMPTY: "terrain-empty",
  PRIORITY_POINT: "priority-point"
});

export const FRUIT_TYPES = Object.freeze(["apple", "banana", "grape", "eggplant"]);
export const FRUIT_SHORT = Object.freeze({ apple: "T", banana: "C", grape: "N", eggplant: "CT" });
export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});
