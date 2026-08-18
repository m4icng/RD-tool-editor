import { createFruit } from "./fruit-object.js";
import { createEmptyTray } from "./tray-object.js";
import { createBridge } from "./bridge-object.js";
import { createGate } from "./gate-object.js";
import { createCountBarrierTool } from "./count-barrier-object.js";
import { createTunnelTool } from "./tunnel-object.js";
import { createOneWayTool } from "./one-way-object.js";
import { MYSTERY_FRUIT_ASSET_ID, TERRAIN_ASSET_IDS } from "../core/constants.js";
import { BLOCK_ITEM_GLYPH, TRAIN_HEAD_ICON } from "../core/block-visuals.js";

const objects = [
  { id: "snake-start", kind: "snake", category: "item", label: "Train Head", icon: TRAIN_HEAD_ICON, direction: "right", uniqueOnMap: true },
  createEmptyTray(),
  createFruit("apple", "Block 1", BLOCK_ITEM_GLYPH),
  createFruit("banana", "Block 2", BLOCK_ITEM_GLYPH),
  createFruit("grape", "Block 3", BLOCK_ITEM_GLYPH),
  createFruit("eggplant", "Block 4", BLOCK_ITEM_GLYPH),
  createFruit("block5", "Block 5", BLOCK_ITEM_GLYPH),
  createFruit("block6", "Block 6", BLOCK_ITEM_GLYPH),
  createFruit("block7", "Block 7", BLOCK_ITEM_GLYPH),
  createBridge(),
  createGate(),
  createCountBarrierTool(),
  createTunnelTool(),
  createOneWayTool(),
  { id: MYSTERY_FRUIT_ASSET_ID, kind: "mystery-fruit", category: "element", label: "Mystery Fruit", icon: "?" },
  { id: TERRAIN_ASSET_IDS.GRASS, kind: "terrain", category: "terrain", label: "Grass", icon: "▦" },
  { id: TERRAIN_ASSET_IDS.EMPTY, kind: "terrain", category: "terrain", label: "Terrain trống", icon: "□" },
  { id: TERRAIN_ASSET_IDS.PRIORITY_POINT, kind: "priority-point", category: "terrain", label: "PriorityPoint", icon: "•" }
];

export const OBJECTS = Object.freeze(objects.map(Object.freeze));

export function findObject(id) {
  return OBJECTS.find((object) => String(object.id) === String(id)) ?? null;
}

export function cloneObject(object) {
  return object ? structuredClone(object) : null;
}

export function objectsByCategory(category) {
  return OBJECTS.filter((object) => object.category === category);
}
