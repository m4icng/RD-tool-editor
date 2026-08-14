import { EditorState, createInitialState, createLayer, reindexLayers } from "./core/editor-state.js";
import { FRUIT_TYPES, LEGACY_STORAGE_KEYS, STORAGE_KEY, TOOL_LABELS } from "./core/constants.js";
import { OBJECTS, findObject, objectsByCategory } from "./objects/object-registry.js";
import { applyTool, clearEntireMap, eraseAtPosition, togglePathAt } from "./editor/object-placement.js";
import { selectCell, changeSelectedTruckCapacity } from "./editor/selection-manager.js";
import { renderGrid } from "./editor/grid-renderer.js";
import { InputController } from "./editor/input-controller.js";
import { changeMapDimension } from "./ui/level-settings.js";
import { renderObjectPalette } from "./ui/object-palette.js";
import { renderInspector } from "./ui/inspector-panel.js";
import { activateTab, renderToolbar } from "./ui/toolbar.js";
import { showNotification } from "./ui/notification.js";
import { validateLevel } from "./data/validator.js";
import { deserializeEditorState, deserializeLevel, normalizeFileName, serializeEditorState, serializeLevel } from "./data/serializer.js";
import { migrateLevel } from "./data/migration.js";
import { LevelFileManager } from "./data/file-manager.js";
import { downloadJson, readJsonFile, stringifyJson } from "./utils/file-utils.js";
import { getMergedCell, getTrayVisualPosition } from "./utils/grid-utils.js";
import { createPlayableController } from "./gameplay/playable-controller.js";
import { renderDataSummary } from "./ui/data-summary.js";
import { initPanelResizers } from "./ui/panel-resizer.js";
import { createGridIndexTooltip } from "./ui/grid-index-tooltip.js";
import {
  addTrayLayer,
  changeTrayLayerRecipe,
  convertLegacyTruckToTray,
  getSelectedTrayContext,
  moveTrayLayer,
  removeTrayLayer,
  removeTrayLayerUnknownItem,
  selectTrayLayerFruit,
  setTrayVisualDirection,
  renderTrayEditor
} from "./ui/tray-editor.js";

const byId = (id) => document.getElementById(id);
const elements = Object.fromEntries([
  "gridBoard", "boardWrap", "canvasArea", "mapWidthInput", "mapHeightInput", "gridMeta", "assetPalette", "assetCount",
  "layerSelect", "toggleActiveLayerVisibilityBtn", "deleteActiveLayerBtn", "trayPanel", "pathStat", "grassStat", "priorityStat", "itemStat", "fruitStat", "fruitTypeStat", "trayStat", "capacityStat", "dataSummary", "validationList", "inspectorBody", "inspectorDetails",
  "undoBtn", "redoBtn", "activeToolBadge", "topbarEyebrow", "levelWorkspace", "playableWorkspace", "levelLayerPicker", "levelRightRail", "jsonFolderCard",
  "placeholderView", "placeholderIcon", "placeholderTitle", "placeholderCopy", "levelControls", "playableControls", "jsonControls", "levelActions", "jsonActions",
  "playableGridBoard", "playableBoardWrap", "playableCanvasArea", "playableGridMeta", "playableStatusBadge", "playableStatusCopy", "playableBlocker",
  "playModeSelect", "playSpeedSelect", "playPauseBtn", "playRestartBtn", "playableDirectionHint", "playableCargoCount", "playableCargo",
  "playableTrayCount", "playableTrayProgress", "playableEndOverlay", "playableEndIcon", "playableEndTitle", "playableEndCopy", "playAgainBtn", "exitPlayableBtn",
  "toast", "saveStatus", "fileInput", "newLevelBtn", "jsonImportBtn", "jsonDownloadBtn", "chooseFolderBtn", "refreshFolderBtn",
  "jsonFileNameInput", "folderStatus", "jsonFileList", "jsonPreview", "jsonValidationStatus", "jsonDirtyStatus"
].map((id) => [id, byId(id)]));

const editor = new EditorState(loadSavedState());
const fileManager = new LevelFileManager();
let folderFiles = [];
let fileDirty = editor.data.fileDirty ?? !editor.data.sourceFileName;
let activePaletteCategory = "item";
const playable = createPlayableController({
  getLevel: () => editor.data,
  elements,
  onExitEditor: () => switchTab("level")
});
initPanelResizers();
const gridIndexTooltip = createGridIndexTooltip({
  grid: elements.gridBoard,
  getGrid: () => editor.data.grid,
  isEnabled: () => ["level", "json"].includes(editor.data.tab)
});

function switchTab(tab) {
  if (tab === "playable") gridIndexTooltip.hide();
  if (editor.data.tab === "playable" && tab !== "playable") playable.leave();
  activateTab(tab, editor.data, elements);
  if (tab === "playable") playable.enter();
  requestAnimationFrame(() => {
    fitBoardToCanvas();
    playable.resize();
  });
}

function hasPlacedObject(objectId) {
  return Object.values(editor.data.sharedCells ?? {}).some((cell) => cell.item?.id === objectId);
}

function fitBoardToCanvas() {
  const areaWidth = elements.canvasArea.clientWidth;
  const areaHeight = elements.canvasArea.clientHeight;
  if (!areaWidth || !areaHeight) return;

  const areaStyle = getComputedStyle(elements.canvasArea);
  const boardStyle = getComputedStyle(elements.boardWrap);
  const availableWidth = areaWidth - parseFloat(areaStyle.paddingLeft) - parseFloat(areaStyle.paddingRight);
  const availableHeight = areaHeight - parseFloat(areaStyle.paddingTop) - parseFloat(areaStyle.paddingBottom);
  const frameWidth = parseFloat(boardStyle.paddingLeft) + parseFloat(boardStyle.paddingRight)
    + parseFloat(boardStyle.borderLeftWidth) + parseFloat(boardStyle.borderRightWidth);
  const frameHeight = parseFloat(boardStyle.paddingTop) + parseFloat(boardStyle.paddingBottom)
    + parseFloat(boardStyle.borderTopWidth) + parseFloat(boardStyle.borderBottomWidth);
  const ratio = editor.data.grid.columns / editor.data.grid.rows;
  const widthFromHeight = Math.max(0, availableHeight - frameHeight) * ratio + frameWidth;
  const fittedWidth = Math.max(120, Math.min(790, availableWidth, widthFromHeight));

  elements.boardWrap.style.width = `${fittedWidth}px`;
}

function loadSavedState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { return deserializeEditorState(raw); }
        catch {
          const legacy = migrateLevel(JSON.parse(raw));
          return { grid: legacy.grid, sharedCells: legacy.sharedCells ?? {}, layers: legacy.layers, activeLayerId: legacy.activeLayerId ?? legacy.layers?.[0]?.id, selectedCell: null, selectedAssetId: "snake-start", tool: "path", eraseMode: "smart", tab: "level", fileName: "untitled-level.json", sourceFileName: null, fileDirty: true };
        }
      }
    } catch (error) {
      console.warn("Không thể đọc level đã lưu", error);
    }
  }
  return undefined;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeEditorState(editor.data)));
    elements.saveStatus.textContent = "Đã lưu";
  } catch (error) {
    elements.saveStatus.textContent = "Lỗi lưu";
    console.warn(error);
  }
}

function renderLayers() {
  reindexLayers(editor.data.layers);
  elements.layerSelect.innerHTML = "";
  editor.data.layers.forEach((layer, index) => {
    const option = document.createElement("option");
    option.value = layer.id;
    const fruitCount = Object.values(layer.cells ?? {}).filter((cell) => cell?.item?.kind === "fruit").length;
    const numLabel = String(index + 1).padStart(2, "0");
    option.textContent = `${numLabel} · ${layer.name} · ${fruitCount} fruit${layer.visible ? "" : " · Đang ẩn"}`;
    elements.layerSelect.appendChild(option);
  });
  elements.layerSelect.value = editor.data.activeLayerId;
  elements.toggleActiveLayerVisibilityBtn.textContent = editor.activeLayer.visible ? "◉" : "○";
  elements.toggleActiveLayerVisibilityBtn.title = editor.activeLayer.visible ? "Ẩn hoa quả của layer đang chọn" : "Hiện hoa quả của layer đang chọn";
  elements.deleteActiveLayerBtn.disabled = editor.data.layers.length === 1;
}

function renderValidation(layer) {
  const report = validateLevel(editor.data);
  const balanceOk = FRUIT_TYPES.every((type) =>
    report.stats.allFruitsByType[type] === report.stats.capacityByType[type]
  ) && report.stats.allFruits > 0;
  const trayRecipesOk = report.stats.trays > 0 && report.stats.invalidTrayRecipes === 0;
  const checks = [
    { ok: report.stats.snake === 1, text: report.stats.snake === 1 ? "Có đúng 1 điểm bắt đầu" : `Cần đúng 1 điểm bắt đầu (hiện có ${report.stats.snake})` },
    { ok: report.stats.allFruits > 0, text: report.stats.allFruits > 0 ? `${report.stats.allFruits} fruit trong ${report.stats.fruitLayers} layer` : "Chưa có trái cây trong các layer" },
    { ok: trayRecipesOk, text: trayRecipesOk ? `${report.stats.trayLayers} layer khay đã đủ recipe 9/9` : `Còn ${report.stats.invalidTrayRecipes || "khay chưa có"} recipe khay chưa hoàn tất` },
    { ok: balanceOk, text: balanceOk ? "Tổng fruit các layer khớp recipe khay" : "Tổng fruit các layer và recipe khay chưa khớp" }
  ];
  const details = [...report.errors, ...report.warnings].filter((message) => !checks.some((check) => check.text === message));
  elements.validationList.innerHTML = checks.map((check) => `<div class="validation-row ${check.ok ? "ok" : "warn"}"><span>${check.ok ? "✓" : "!"}</span><span>${check.text}</span></div>`).join("")
    + details.map((message) => `<div class="validation-row warn"><span>!</span><span>${message}</span></div>`).join("");
  return report.stats;
}

function renderAll() {
  const layer = editor.activeLayer;
  const paletteObjects = objectsByCategory(activePaletteCategory);
  renderObjectPalette(elements.assetPalette, paletteObjects, editor.data.selectedAssetId, {
    emptyLabel: activePaletteCategory === "element" ? "Element sẽ được bổ sung ở bước tiếp theo." : `Chưa có ${activePaletteCategory}.`,
    unavailableIds: hasPlacedObject("snake-start") ? ["snake-start"] : []
  });
  document.querySelectorAll("[data-palette-tab]").forEach((button) => {
    const active = button.dataset.paletteTab === activePaletteCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  renderGrid(elements.gridBoard, editor.data);
  renderLayers();
  renderTrayEditor(elements.trayPanel, editor.data);
  renderInspector(elements.inspectorBody, editor.data);
  const dataSummary = renderDataSummary(elements.dataSummary, editor.data);
  renderToolbar(editor, elements);
  if (editor.data.tool === "terrain") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Chỉnh terrain";
  const stats = renderValidation(layer);
  elements.pathStat.textContent = stats.paths;
  elements.grassStat.textContent = Object.keys(editor.data.grassCells ?? {}).length;
  elements.priorityStat.textContent = Object.keys(editor.data.priorityPoints ?? {}).length;
  const sharedItemCount = Object.values(editor.data.sharedCells ?? {}).filter((cell) => Boolean(cell.item)).length;
  elements.itemStat.textContent = sharedItemCount + dataSummary.totalFruits;
  elements.fruitStat.textContent = dataSummary.totalFruits;
  elements.fruitTypeStat.textContent = `${dataSummary.fruitKinds}/${FRUIT_TYPES.length}`;
  elements.trayStat.textContent = dataSummary.trays.length;
  elements.capacityStat.textContent = `${dataSummary.trayConfigured}/${dataSummary.trayTarget}`;
  elements.capacityStat.title = "Số item đã setup / tổng số item cần cho mọi khay";
  elements.mapWidthInput.value = String(editor.data.grid.columns);
  elements.mapHeightInput.value = String(editor.data.grid.rows);
  elements.gridMeta.textContent = `${editor.data.grid.columns} × ${editor.data.grid.rows} · ${layer.name} · chỉ hoa quả thay đổi`;
  if (editor.data.tab === "level") elements.topbarEyebrow.textContent = "Level Design / Layer fruit đang chọn";
  elements.boardWrap.classList.remove("hidden-layer");
  elements.assetCount.textContent = `${paletteObjects.length} ${activePaletteCategory}`;
  renderJsonWorkspace();
  requestAnimationFrame(fitBoardToCanvas);
  persist();
}

function mutate(mutator) {
  fileDirty = true;
  editor.data.fileDirty = true;
  return editor.mutate(mutator);
}

function renderJsonWorkspace() {
  editor.data.fileName = normalizeFileName(editor.data.fileName);
  if (document.activeElement !== elements.jsonFileNameInput) elements.jsonFileNameInput.value = editor.data.fileName;
  const report = validateLevel(editor.data);
  const documentData = serializeLevel(editor.data);
  elements.jsonPreview.textContent = stringifyJson(documentData);
  elements.jsonValidationStatus.textContent = report.exportable ? "Hợp lệ · sẵn sàng export" : `${report.errors.length + report.warnings.length} lỗi cần sửa`;
  elements.jsonDownloadBtn.disabled = !report.exportable;
  byId("exportBtn").disabled = !report.exportable;
  elements.jsonDirtyStatus.textContent = fileDirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ file";
  elements.jsonDirtyStatus.classList.toggle("clean", !fileDirty);
  elements.chooseFolderBtn.disabled = !fileManager.supported;
  elements.refreshFolderBtn.disabled = !fileManager.connected;
  if (!fileManager.supported) elements.folderStatus.textContent = "Trình duyệt không hỗ trợ quản lý thư mục; vẫn có thể Import và Tải xuống.";
  renderFolderFiles();
}

function renderFolderFiles() {
  elements.jsonFileList.innerHTML = "";
  if (!fileManager.connected || folderFiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "json-file-empty";
    empty.textContent = fileManager.connected ? "Thư mục chưa có file JSON." : "Chọn một thư mục để quản lý các level JSON đã có trên ổ đĩa.";
    elements.jsonFileList.appendChild(empty);
    return;
  }
  folderFiles.forEach((file) => {
    const row = document.createElement("div");
    row.className = `json-file-row${editor.data.sourceFileName === file.name ? " active" : ""}`;
    row.dataset.fileName = file.name;
    const copy = document.createElement("div");
    copy.className = "json-file-copy";
    const title = document.createElement("strong");
    title.textContent = file.name;
    const meta = document.createElement("small");
    meta.textContent = `${Math.max(1, Math.ceil(file.size / 1024))} KB · ${new Date(file.updatedAt).toLocaleString("vi-VN")}`;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "json-file-actions";
    [["open", "Mở"], ["save", "Lưu đè"], ["rename", "Đổi tên"], ["delete", "Xóa"]].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.fileAction = action; button.textContent = label;
      if (action === "delete") button.className = "danger";
      if (action === "save" && !validateLevel(editor.data).exportable) button.disabled = true;
      actions.appendChild(button);
    });
    row.append(copy, actions);
    elements.jsonFileList.appendChild(row);
  });
}

function showEraseFeedback(result) {
  if (result?.reason === "fruit-on-other-layer") {
    showNotification(elements.toast, "Ô này vẫn còn fruit ở layer khác. Chuyển sang layer đó để xóa fruit trước khi xóa đường đi.");
  }
}

const input = new InputController({
  isEnabled: () => editor.data.tab === "level",
  canDrag: () => editor.data.tool !== "select",
  onStrokeStart: () => editor.beginTransaction(),
  onStrokeEnd: () => editor.endTransaction(),
  onCell(x, y, { eraseOverride = false } = {}) {
    const visualTray = Object.entries(editor.data.sharedCells ?? {}).map(([key, cell]) => {
      if (!["tray", "truck"].includes(cell.item?.kind)) return null;
      const [deliverX, deliverY] = key.split(",").map(Number);
      const visual = getTrayVisualPosition(cell.item, { x: deliverX, y: deliverY });
      return visual.x === x && visual.y === y ? { x: deliverX, y: deliverY } : null;
    }).find(Boolean);
    const routeVisualToTray = visualTray && (eraseOverride || editor.data.tool !== "terrain");
    if (routeVisualToTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, visualTray.x, visualTray.y);
      editor.notify();
      return;
    }
    const targetX = routeVisualToTray ? visualTray.x : x;
    const targetY = routeVisualToTray ? visualTray.y : y;
    const clickedCell = getMergedCell(editor.data, targetX, targetY);
    const clickedTray = ["tray", "truck"].includes(clickedCell?.item?.kind);
    if (clickedTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else if (editor.data.tool === "select" && !eraseOverride) {
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else {
      const result = mutate((state) => applyTool(state, targetX, targetY, eraseOverride ? "smart-erase" : null));
      if (result?.reason === "unique-object-exists") {
        showNotification(elements.toast, "Map chỉ được có một đầu rắn. Hãy xóa đầu rắn hiện tại trước khi đặt lại.");
      } else if (result?.reason === "tray-visual-outside-grid") {
        showNotification(elements.toast, "Không thể đặt khay: vị trí visual mặc định phía trên nằm ngoài map.");
      } else if (result?.reason === "tray-checkpoint-needs-road") {
        showNotification(elements.toast, "Hãy vẽ đường trước, sau đó đặt khay trực tiếp lên checkpoint đó.");
      } else if (result?.reason === "tray-visual-occupied") {
        showNotification(elements.toast, "Ô visual mặc định phía trên checkpoint phải trống.");
      } else if (["shared-position-occupied", "fruit-position-occupied"].includes(result?.reason)) {
        showNotification(elements.toast, "Ô này đã có object dùng chung hoặc fruit ở một layer khác.");
      } else if (result?.reason === "grass-on-path") {
        showNotification(elements.toast, "Grass không thể trùng Path. Hãy xóa Path trước.");
      } else if (result?.reason === "terrain-on-path") {
        showNotification(elements.toast, "Không thể chuyển ô Path thành Terrain trống. Hãy xóa Path trước.");
      } else if (result?.reason === "priority-needs-path") {
        showNotification(elements.toast, "PriorityPoint chỉ được đặt trên Path.");
      } else showEraseFeedback(result);
    }
  },
  onShortcut({ key, shift }) {
    if (key === "z") shift ? editor.redo() : editor.undo();
    else if (key === "y") editor.redo();
    else if (["delete", "backspace"].includes(key) && editor.data.selectedCell) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
    else if (["1", "2", "3", "4"].includes(key)) {
      editor.data.tool = ["path", "item", "select", "erase"][Number(key) - 1];
      editor.notify();
    }
  }
});
input.connect(elements.gridBoard);

document.querySelector(".tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (button) switchTab(button.dataset.tab);
});
document.querySelector(".tool-list").addEventListener("click", (event) => {
  const eraseAction = event.target.closest("[data-erase-action]");
  if (eraseAction?.dataset.eraseAction === "all") {
    if (!confirm("Xóa toàn bộ đường đi, item và element trên tất cả layer? Hành động này có thể hoàn tác bằng Undo.")) return;
    const result = mutate(clearEntireMap);
    showNotification(elements.toast, result.changed ? `Đã xóa ${result.removedCells} ô dữ liệu trên toàn bộ map` : "Map hiện đang trống");
    return;
  }
  const eraseMode = event.target.closest("[data-erase-mode]");
  if (eraseMode) {
    editor.data.eraseMode = eraseMode.dataset.eraseMode;
    editor.data.tool = "erase";
    editor.notify();
    return;
  }
  const button = event.target.closest("[data-tool]");
  if (button && TOOL_LABELS[button.dataset.tool]) { editor.data.tool = button.dataset.tool; editor.notify(); }
});
const eraseToolMenu = document.querySelector(".erase-tool-menu");
const setEraseMenuExpanded = (expanded) => byId("eraseToolBtn").setAttribute("aria-expanded", String(expanded));
eraseToolMenu.addEventListener("pointerenter", () => setEraseMenuExpanded(true));
eraseToolMenu.addEventListener("pointerleave", () => setEraseMenuExpanded(false));
eraseToolMenu.addEventListener("focusin", () => setEraseMenuExpanded(true));
eraseToolMenu.addEventListener("focusout", (event) => {
  if (!eraseToolMenu.contains(event.relatedTarget)) setEraseMenuExpanded(false);
});
elements.assetPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset]");
  if (!button || !findObject(button.dataset.asset)) return;
  if (button.getAttribute("aria-disabled") === "true") {
    showNotification(elements.toast, "Item này đã đạt số lượng tối đa trên map.");
    return;
  }
  editor.data.selectedAssetId = button.dataset.asset;
  editor.data.tool = activePaletteCategory === "terrain" ? "terrain" : "item";
  editor.notify();
});
document.querySelector(".palette-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-palette-tab]");
  if (!button || button.dataset.paletteTab === activePaletteCategory) return;
  activePaletteCategory = button.dataset.paletteTab;
  renderAll();
});
document.querySelector(".dimension-card").addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-dimension]");
  if (!button) return;
  const dimension = button.dataset.mapDimension;
  const next = editor.data.grid[dimension] + Number(button.dataset.delta);
  const result = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!result.changed && result.reason === "occupied") return showNotification(elements.toast, "Không thể giảm: hãy xóa hoặc di chuyển dữ liệu ngoài vùng mới");
  if (!result.changed) return;
  mutate((state) => changeMapDimension(state, dimension, next));
});
[elements.mapWidthInput, elements.mapHeightInput].forEach((inputElement) => inputElement.addEventListener("change", () => {
  const dimension = inputElement === elements.mapWidthInput ? "columns" : "rows";
  const next = Math.max(1, Math.floor(Number(inputElement.value) || 1));
  const probe = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!probe.changed && probe.reason === "occupied") showNotification(elements.toast, "Không thể giảm: vùng bị cắt vẫn còn dữ liệu.");
  else if (probe.changed) mutate((state) => changeMapDimension(state, dimension, next));
  else renderAll();
}));
elements.layerSelect.addEventListener("change", () => {
  editor.data.activeLayerId = elements.layerSelect.value;
  editor.notify();
});
elements.toggleActiveLayerVisibilityBtn.addEventListener("click", () => mutate((state) => {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  layer.visible = !layer.visible;
}));

function deleteActiveLayer() {
  if (editor.data.layers.length <= 1 || !confirm("Xóa layer fruit đang chọn và toàn bộ hoa quả trong layer này? Map, rắn và khay chứa sẽ được giữ nguyên.")) return;
  mutate((state) => {
    const deletedId = state.activeLayerId;
    const deletedIndex = state.layers.findIndex((layer) => layer.id === deletedId);
    state.layers = state.layers.filter((layer) => layer.id !== deletedId);
    reindexLayers(state.layers);
    const nextIndex = Math.min(deletedIndex, state.layers.length - 1);
    state.activeLayerId = state.layers[Math.max(0, nextIndex)].id;
  });
}
elements.deleteActiveLayerBtn.addEventListener("click", deleteActiveLayer);
elements.trayPanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-tray-add-layer]")) {
    mutate(addTrayLayer);
    showNotification(elements.toast, "Đã thêm layer khay mới · recipe 0/9");
    return;
  }
  const recipeButton = event.target.closest("[data-recipe-step]");
  if (recipeButton) {
    const changed = mutate((state) => changeTrayLayerRecipe(
      state,
      Number(recipeButton.dataset.trayLayerIndex),
      recipeButton.dataset.fruitType,
      Number(recipeButton.dataset.recipeStep)
    ));
    if (!changed && Number(recipeButton.dataset.recipeStep) > 0) showNotification(elements.toast, "Layer đã đủ sức chứa 9/9");
    return;
  }
  const unknownButton = event.target.closest("[data-remove-unknown-item]");
  if (unknownButton) {
    if (!confirm(`Xóa Unknown #${unknownButton.dataset.removeUnknownItem} khỏi recipe?`)) return;
    mutate((state) => removeTrayLayerUnknownItem(state, Number(unknownButton.dataset.trayLayerIndex), unknownButton.dataset.removeUnknownItem));
    return;
  }
  const moveButton = event.target.closest("[data-tray-layer-move]");
  if (moveButton) {
    const fromIndex = Number(moveButton.dataset.trayLayerIndex);
    mutate((state) => moveTrayLayer(state, fromIndex, fromIndex + Number(moveButton.dataset.trayLayerMove)));
    return;
  }
  const deleteButton = event.target.closest("[data-tray-layer-delete]");
  if (deleteButton) {
    const layerIndex = Number(deleteButton.dataset.trayLayerIndex);
    const context = getSelectedTrayContext(editor.data);
    const recipe = context?.item?.trayLayers?.[layerIndex]?.recipe ?? {};
    const hasRecipe = Object.values(recipe).some((amount) => Number(amount) > 0);
    if (hasRecipe && !confirm(`Xóa Layer ${layerIndex + 1} và toàn bộ recipe đã setup?`)) return;
    mutate((state) => removeTrayLayer(state, layerIndex));
    return;
  }
  if (event.target.closest("[data-convert-truck]")) {
    mutate(convertLegacyTruckToTray);
    showNotification(elements.toast, "Đã chuyển xe cũ thành khay chứa sức chứa 9");
    return;
  }
  const tray = event.target.closest("[data-tray-x]");
  if (!tray) return;
  editor.data.tool = "select";
  selectCell(editor.data, Number(tray.dataset.trayX), Number(tray.dataset.trayY));
  editor.notify();
});
elements.trayPanel.addEventListener("change", (event) => {
  const directionPicker = event.target.closest("[data-tray-position-direction]");
  if (directionPicker) {
    const result = mutate((state) => setTrayVisualDirection(state, directionPicker.value));
    if (result?.reason === "outside-grid") showNotification(elements.toast, "Hướng đã chọn làm visual khay nằm ngoài map.");
    else if (result?.reason === "occupied") showNotification(elements.toast, "Ô visual đã chọn đang có đường, item, element, fruit hoặc visual khay khác.");
    return;
  }
  const picker = event.target.closest("[data-tray-fruit-picker]");
  if (!picker || !picker.value) return;
  const changed = mutate((state) => selectTrayLayerFruit(state, Number(picker.dataset.trayLayerIndex), picker.value));
  if (!changed) showNotification(elements.toast, "Layer đã đủ sức chứa 9/9 hoặc loại quả đã được chọn.");
});

let draggedTrayLayerIndex = null;
elements.trayPanel.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-tray-layer-index]");
  if (!card || event.target.closest("button, select, input")) return;
  draggedTrayLayerIndex = Number(card.dataset.trayLayerIndex);
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
elements.trayPanel.addEventListener("dragover", (event) => {
  if (draggedTrayLayerIndex === null || !event.target.closest("[data-tray-layer-index]")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});
elements.trayPanel.addEventListener("drop", (event) => {
  const card = event.target.closest("[data-tray-layer-index]");
  if (!card || draggedTrayLayerIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(card.dataset.trayLayerIndex);
  mutate((state) => moveTrayLayer(state, draggedTrayLayerIndex, targetIndex));
  draggedTrayLayerIndex = null;
});
elements.trayPanel.addEventListener("dragend", () => {
  draggedTrayLayerIndex = null;
  elements.trayPanel.querySelectorAll(".dragging").forEach((card) => card.classList.remove("dragging"));
});

function addLayer() {
  mutate((state) => {
    reindexLayers(state.layers);
    const nextNumber = state.layers.length;
    const layer = createLayer(nextNumber);
    state.layers.push(layer);
    state.activeLayerId = layer.id;
  });
  showNotification(elements.toast, "Đã thêm layer fruit · map dùng chung được giữ nguyên");
}
byId("addLayerBtn").addEventListener("click", addLayer);
elements.undoBtn.addEventListener("click", () => { editor.undo(); fileDirty = true; editor.data.fileDirty = true; renderAll(); });
elements.redoBtn.addEventListener("click", () => { editor.redo(); fileDirty = true; editor.data.fileDirty = true; renderAll(); });
byId("backToLevelBtn").addEventListener("click", () => { switchTab("level"); renderAll(); });
elements.inspectorBody.addEventListener("click", (event) => {
  const capacity = event.target.closest("[data-capacity-step]");
  if (capacity) mutate((state) => changeSelectedTruckCapacity(state, Number(capacity.dataset.capacityStep)));
  else if (event.target.closest("#togglePathBtn")) mutate((state) => togglePathAt(state, state.selectedCell));
  else if (event.target.closest("#deleteCellBtn")) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
});
function canReplaceCurrentLevel() {
  return !fileDirty || confirm("Level hiện tại có thay đổi chưa lưu hoặc chưa tải xuống. Thay toàn bộ level hiện tại?");
}

function downloadCurrentLevel() {
  const report = validateLevel(editor.data);
  if (!report.exportable) return showNotification(elements.toast, "Chưa thể Export: hãy sửa toàn bộ lỗi level trước.");
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value || editor.data.fileName);
  downloadJson(serializeLevel(editor.data), editor.data.fileName);
  editor.data.sourceFileName = null;
  fileDirty = false;
  editor.data.fileDirty = false;
  renderAll();
  showNotification(elements.toast, `Đã tải xuống ${editor.data.fileName}`);
}

function openImportedData(raw, fileName) {
  const data = deserializeLevel(raw, { fileName });
  editor.history.clear();
  fileDirty = false;
  data.fileDirty = false;
  editor.replace(data);
  switchTab("level");
  const report = validateLevel(data);
  renderAll();
  showNotification(elements.toast, report.exportable ? `Đã mở ${fileName}` : `Đã mở ${fileName} · có ${report.warnings.length} lỗi cần sửa`);
}

byId("exportBtn").addEventListener("click", downloadCurrentLevel);
elements.jsonDownloadBtn.addEventListener("click", downloadCurrentLevel);
const requestImport = () => { if (canReplaceCurrentLevel()) elements.fileInput.click(); };
byId("importBtn").addEventListener("click", requestImport);
elements.jsonImportBtn.addEventListener("click", requestImport);
elements.fileInput.addEventListener("change", async () => {
  try {
    const file = elements.fileInput.files[0];
    if (file) openImportedData(await readJsonFile(file), file.name);
  } catch (error) { showNotification(elements.toast, `Không thể nhập: ${error.message}`); }
  elements.fileInput.value = "";
});

elements.jsonFileNameInput.addEventListener("change", () => {
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value);
  elements.jsonFileNameInput.value = editor.data.fileName;
  fileDirty = true;
  editor.data.fileDirty = true;
  renderAll();
});

elements.newLevelBtn.addEventListener("click", () => {
  if (!canReplaceCurrentLevel()) return;
  editor.history.clear();
  fileDirty = true;
  editor.replace(createInitialState());
  renderAll();
});

async function refreshFolder() {
  folderFiles = await fileManager.listFiles();
  elements.folderStatus.textContent = `${fileManager.directory.name} · ${folderFiles.length} file JSON`;
  renderAll();
}

elements.chooseFolderBtn.addEventListener("click", async () => {
  try { await fileManager.chooseDirectory(); await refreshFolder(); }
  catch (error) { if (error.name !== "AbortError") showNotification(elements.toast, error.message); }
});
elements.refreshFolderBtn.addEventListener("click", () => refreshFolder().catch((error) => showNotification(elements.toast, error.message)));

elements.jsonFileList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-file-action]");
  const row = event.target.closest("[data-file-name]");
  if (!button || !row) return;
  const name = row.dataset.fileName;
  try {
    if (button.dataset.fileAction === "open") {
      if (!canReplaceCurrentLevel()) return;
      openImportedData(await fileManager.read(name), name);
    } else if (button.dataset.fileAction === "save") {
      if (!confirm(`Lưu đè toàn bộ nội dung hiện tại vào ${name}?`)) return;
      const report = validateLevel(editor.data);
      if (!report.exportable) return showNotification(elements.toast, "Không thể lưu đè khi level còn lỗi.");
      await fileManager.write(name, serializeLevel(editor.data));
      editor.data.fileName = name; editor.data.sourceFileName = name; fileDirty = false;
      editor.data.fileDirty = false;
      await refreshFolder(); showNotification(elements.toast, `Đã lưu đè ${name}`);
    } else if (button.dataset.fileAction === "rename") {
      const proposed = prompt("Tên file mới:", name);
      if (!proposed) return;
      const nextName = normalizeFileName(proposed);
      if (!confirm(`Đổi tên ${name} thành ${nextName}?`)) return;
      if (folderFiles.some((file) => file.name === nextName)) return showNotification(elements.toast, `${nextName} đã tồn tại.`);
      await fileManager.rename(name, nextName);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = nextName; editor.data.fileName = nextName; }
      await refreshFolder(); showNotification(elements.toast, `Đã đổi tên thành ${nextName}`);
    } else if (button.dataset.fileAction === "delete") {
      if (!confirm(`Xóa vĩnh viễn file ${name} khỏi ổ đĩa?`)) return;
      await fileManager.remove(name);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = null; fileDirty = true; editor.data.fileDirty = true; }
      await refreshFolder(); showNotification(elements.toast, `Đã xóa ${name}`);
    }
  } catch (error) { showNotification(elements.toast, `Không thể thao tác file: ${error.message}`); }
});

editor.events.on("change", renderAll);
new ResizeObserver(fitBoardToCanvas).observe(elements.canvasArea);
renderAll();
switchTab(["playable", "json"].includes(editor.data.tab) ? editor.data.tab : "level");
