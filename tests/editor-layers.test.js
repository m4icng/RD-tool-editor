import test from "node:test";
import assert from "node:assert/strict";
import { createLayer, reindexLayers } from "../js/core/editor-state.js";
import { serializeLevel } from "../js/data/serializer.js";

test("reindexLayers cập nhật lại chỉ số layer và tên Layer 01, Layer 02...", () => {
  const l0 = createLayer(0);
  const l1 = createLayer(1);
  const l2 = createLayer(2);
  const layers = [l0, l1, l2];

  // Xóa layer 0 (l0)
  const remaining = layers.filter((layer) => layer.id !== l0.id);
  reindexLayers(remaining);

  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].layer, 0);
  assert.equal(remaining[0].name, "Layer 01");
  assert.equal(remaining[1].layer, 1);
  assert.equal(remaining[1].name, "Layer 02");
});

test("serializeLevel cập nhật data JSON theo đúng chỉ số layer đã được đẩy lên", () => {
  const l1 = createLayer(0);
  l1.cells["0,0"] = { item: { kind: "fruit", fruitType: "apple" } };

  const l2 = createLayer(1);
  l2.cells["1,1"] = { item: { kind: "fruit", fruitType: "banana" } };

  const editorData = {
    grid: { columns: 4, rows: 4 },
    sharedCells: {},
    grassCells: {},
    priorityPoints: {},
    layers: [l1, l2]
  };

  // Xóa layer 0 (l1) và reindex layer 1 (l2) thành 0
  editorData.layers = [l2];
  reindexLayers(editorData.layers);

  const json = serializeLevel(editorData);

  assert.equal(json.itemLayers.length, 1);
  assert.equal(json.itemLayers[0].layer, 0);
});

test("xóa layer ở giữa (Layer 02) tự động đẩy Layer 03 thành Layer 02", () => {
  const l0 = createLayer(0);
  const l1 = createLayer(1);
  const l2 = createLayer(2);
  const layers = [l0, l1, l2];

  // Xóa layer giữa (l1)
  const remaining = layers.filter((layer) => layer.id !== l1.id);
  reindexLayers(remaining);

  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].name, "Layer 01");
  assert.equal(remaining[0].layer, 0);
  assert.equal(remaining[1].name, "Layer 02");
  assert.equal(remaining[1].layer, 1);
});
