import test from "node:test";
import assert from "node:assert/strict";
import { applyTool, clearEntireMap } from "../js/editor/object-placement.js";
import { OBJECTS, objectsByCategory } from "../js/objects/object-registry.js";

function createState(tool, cell) {
  return {
    tool,
    selectedAssetId: "fruit-apple",
    activeLayerId: "main",
    selectedCell: null,
    layers: [{ id: "main", cells: cell ? { "2,3": structuredClone(cell) } : {} }]
  };
}

test("công cụ vẽ không xóa đường khi tô lại", () => {
  const state = createState("path", { path: true, item: null });
  applyTool(state, 2, 3);
  applyTool(state, 2, 3);
  assert.equal(state.layers[0].cells["2,3"].path, true);
});

test("chỉ công cụ xóa mới bỏ đường không có item", () => {
  const state = createState("erase", { path: true, item: null });
  applyTool(state, 2, 3);
  assert.equal(state.layers[0].cells["2,3"], undefined);
});

test("xóa item trước và giữ lại đường cho tới thao tác tiếp theo", () => {
  const state = createState("erase", {
    path: true,
    item: { id: "fruit-apple", kind: "fruit", fruitType: "apple" }
  });
  state.eraseMode = "item";
  applyTool(state, 2, 3);
  assert.deepEqual(state.layers[0].cells["2,3"], { path: true, item: null });
});

test("tool override cho phép chuột phải xóa mà không đổi tool active", () => {
  const state = createState("path", { path: true, item: null });
  applyTool(state, 2, 3, "erase");
  assert.equal(state.tool, "path");
  assert.equal(state.layers[0].cells["2,3"], undefined);
});

test("palette Item có đúng thứ tự ID đã chốt", () => {
  assert.deepEqual(objectsByCategory("item").map((object) => object.id), [
    "snake-start",
    "tray-empty",
    "fruit-apple",
    "fruit-banana",
    "fruit-grape",
    "fruit-eggplant"
  ]);
  assert.equal(OBJECTS.length, 6);
});

test("không cho đặt đầu rắn thứ hai trên layer khác", () => {
  const state = {
    tool: "item",
    selectedAssetId: "snake-start",
    activeLayerId: "secondary",
    selectedCell: null,
    layers: [
      { id: "main", cells: { "0,0": { path: true, item: { id: "snake-start", kind: "snake" } } } },
      { id: "secondary", cells: {} }
    ]
  };

  const result = applyTool(state, 2, 3);

  assert.deepEqual(result, { changed: false, reason: "unique-object-exists", objectId: "snake-start" });
  assert.equal(state.layers[1].cells["2,3"], undefined);
});

test("khay mới là khay trống sức chứa 9 và chưa có layer", () => {
  const state = createState("item");
  state.selectedAssetId = "tray-empty";

  applyTool(state, 2, 3);

  assert.equal(state.layers[0].cells["2,3"].item.kind, "tray");
  assert.equal(state.layers[0].cells["2,3"].item.capacity, 9);
  assert.deepEqual(state.layers[0].cells["2,3"].item.trayLayers, []);
});

test("xóa đường đi không xóa item", () => {
  const state = createState("erase", {
    path: true,
    item: { id: "fruit-apple", kind: "fruit", category: "item", fruitType: "apple" }
  });
  state.eraseMode = "path";

  applyTool(state, 2, 3);

  assert.equal(state.layers[0].cells["2,3"].path, false);
  assert.equal(state.layers[0].cells["2,3"].item.id, "fruit-apple");
});

test("xóa item không xóa element hoặc đường đi", () => {
  const state = createState("erase", {
    path: true,
    item: { id: "fruit-apple", kind: "fruit", category: "item" },
    element: { id: "tree", category: "element" }
  });
  state.eraseMode = "item";

  applyTool(state, 2, 3);

  assert.equal(state.layers[0].cells["2,3"].path, true);
  assert.equal(state.layers[0].cells["2,3"].item, null);
  assert.equal(state.layers[0].cells["2,3"].element.id, "tree");
});

test("xóa element không xóa item hoặc đường đi", () => {
  const state = createState("erase", {
    path: true,
    item: { id: "fruit-apple", kind: "fruit", category: "item" },
    element: { id: "tree", category: "element" }
  });
  state.eraseMode = "element";

  applyTool(state, 2, 3);

  assert.equal(state.layers[0].cells["2,3"].path, true);
  assert.equal(state.layers[0].cells["2,3"].item.id, "fruit-apple");
  assert.equal(state.layers[0].cells["2,3"].element, null);
});

test("xóa toàn bộ map làm trống mọi layer nhưng giữ cấu trúc layer", () => {
  const state = {
    selectedCell: { x: 2, y: 3 },
    layers: [
      { id: "main", cells: { "0,0": { path: true, item: null } } },
      { id: "secondary", cells: { "1,1": { path: false, element: { id: "tree" } } } }
    ]
  };

  const result = clearEntireMap(state);

  assert.deepEqual(result, { changed: true, removedCells: 2 });
  assert.equal(state.layers.length, 2);
  assert.deepEqual(state.layers.map((layer) => layer.cells), [{}, {}]);
  assert.equal(state.selectedCell, null);
});
