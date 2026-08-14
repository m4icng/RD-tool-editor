import test from "node:test";
import assert from "node:assert/strict";
import { changeMapSize, getNextMapSize } from "../js/ui/level-settings.js";

test("một bước size thay đổi đồng thời +2 width và +4 height", () => {
  assert.deepEqual(getNextMapSize({ columns: 17, rows: 28 }, 1), { columns: 19, rows: 32 });
  assert.deepEqual(getNextMapSize({ columns: 17, rows: 28 }, -1), { columns: 15, rows: 24 });
});

test("khóa đúng giới hạn kích thước 5x4 và 33x60", () => {
  const minState = { grid: { columns: 5, rows: 4 }, layers: [], selectedCell: null };
  const maxState = { grid: { columns: 33, rows: 60 }, layers: [], selectedCell: null };
  assert.equal(changeMapSize(minState, -1).changed, false);
  assert.equal(changeMapSize(maxState, 1).changed, false);
});

test("không giảm map nếu vùng bị cắt còn dữ liệu", () => {
  const state = {
    grid: { columns: 17, rows: 28 },
    layers: [{ cells: { "16,27": { path: true, item: null } } }],
    selectedCell: null
  };
  assert.deepEqual(changeMapSize(state, -1), { changed: false, reason: "occupied" });
  assert.deepEqual(state.grid, { columns: 17, rows: 28 });
});
