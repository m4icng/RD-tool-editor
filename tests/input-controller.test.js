import test from "node:test";
import assert from "node:assert/strict";
import { rasterizeGridLine } from "../js/editor/input-controller.js";

test("nội suy các ô khi rê chuột nhanh để nét vẽ không bị đứt", () => {
  assert.deepEqual(rasterizeGridLine({ x: 1, y: 2 }, { x: 5, y: 2 }), [
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 5, y: 2 }
  ]);
});
