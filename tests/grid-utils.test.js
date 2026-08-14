import test from "node:test";
import assert from "node:assert/strict";
import { countPathNeighbors, isPathJunction } from "../js/utils/grid-utils.js";

test("nhận diện điểm giao khi ô đường nối với ít nhất ba hướng", () => {
  const layer = {
    cells: {
      "1,1": { path: true, item: null },
      "1,0": { path: true, item: null },
      "2,1": { path: true, item: null },
      "1,2": { path: true, item: null }
    }
  };

  assert.equal(countPathNeighbors(layer, 1, 1), 3);
  assert.equal(isPathJunction(layer, 1, 1), true);
  assert.equal(isPathJunction(layer, 1, 0), false);
});
