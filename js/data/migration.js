import { SCHEMA_VERSION } from "../core/constants.js";
import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";

function migrateFruitItemId(item) {
  if (item?.kind !== "fruit") return item;
  return { ...item, id: FRUIT_ITEM_IDS[item.fruitType] ?? item.id };
}

export function migrateLevel(input) {
  const data = structuredClone(input);
  const version = Number(data.schemaVersion ?? 1);
  if (version > SCHEMA_VERSION) throw new Error(`Schema ${version} chưa được hỗ trợ.`);

  if (version === 1) {
    data.layers = (data.layers ?? []).map((layer) => ({
      ...layer,
      cells: Array.isArray(layer.cells) ? Object.fromEntries(layer.cells) : (layer.cells ?? {})
    }));
  }

  if (version < 3 || !data.sharedCells) {
    const sharedCells = {};
    data.layers = (data.layers ?? []).map((layer) => {
      const fruitCells = {};
      Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
        const shared = sharedCells[key] ?? { path: false, item: null, element: null };
        if (cell.path) shared.path = true;
        if (cell.element && !shared.element) shared.element = structuredClone(cell.element);
        if (cell.item?.kind === "fruit") {
          fruitCells[key] = { item: structuredClone(cell.item) };
        } else if (cell.item && !shared.item) {
          shared.item = structuredClone(cell.item);
        }
        if (shared.path || shared.item || shared.element) sharedCells[key] = shared;
      });
      return { ...layer, cells: fruitCells };
    });
    data.sharedCells = sharedCells;
  }

  Object.values(data.sharedCells ?? {}).forEach((cell) => {
    if (cell.item?.kind === "fruit") cell.item = migrateFruitItemId(cell.item);
  });
  (data.layers ?? []).forEach((layer) => {
    Object.values(layer.cells ?? {}).forEach((cell) => {
      if (cell.item?.kind === "fruit") cell.item = migrateFruitItemId(cell.item);
    });
  });

  data.schemaVersion = SCHEMA_VERSION;
  return data;
}
