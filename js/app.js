import { EditorState, createInitialState, createLayer, reindexLayers } from "./core/editor-state.js";
import { FRUIT_TYPES, LEGACY_STORAGE_KEYS, STORAGE_KEY, TOOL_LABELS } from "./core/constants.js";
import { OBJECTS, findObject, objectsByCategory } from "./objects/object-registry.js";
import { isBridgeElement, normalizeBridgeAxis } from "./objects/bridge-object.js";
import { isGateElement, normalizeGateDirection } from "./objects/gate-object.js";
import {
  createNewActiveCountBarrier,
  findCountBarrierById,
  findCountBarrierAtIndex,
  isCountBarrierTool,
  normalizeCountBarrierCount,
  removeCountBarrierCell
} from "./objects/count-barrier-object.js";
import {
  findTunnelAtIndex,
  findTunnelById,
  removeTunnelById,
  cancelTunnelDraft,
  setTunnelDraftDirection,
  setTunnelEntryDirection,
  setTunnelEntryIndex
} from "./objects/tunnel-object.js";
import {
  findOneWayAtIndex,
  findOneWayById,
  removeOneWayById,
  cancelOneWayDraft,
  setOneWayDraftDirection,
  setOneWayDirection,
  setOneWayEntryDirection,
  setOneWayEntryIndex
} from "./objects/one-way-object.js";
import { applyTool, clearEntireMap, eraseAtPosition, getEraseTargets, togglePathAt } from "./editor/object-placement.js";
import { selectCell, changeSelectedTruckCapacity } from "./editor/selection-manager.js";
import { renderGrid } from "./editor/grid-renderer.js";
import { InputController } from "./editor/input-controller.js";
import { CameraController } from "./editor/camera-controller.js";
import { changeMapDimension } from "./ui/level-settings.js";
import { renderObjectPalette } from "./ui/object-palette.js";
import { getSelectedCellIndex, renderInspector } from "./ui/inspector-panel.js";
import { activateTab, renderToolbar } from "./ui/toolbar.js";
import { showNotification } from "./ui/notification.js";
import { validateLevel } from "./data/validator.js";
import { deserializeEditorState, deserializeLevel, normalizeFileName, serializeEditorState, serializeLevel } from "./data/serializer.js";
import { migrateLevel } from "./data/migration.js";
import { LevelFileManager } from "./data/file-manager.js";
import { downloadJson, readJsonFile, stringifyJson } from "./utils/file-utils.js";
import { getMergedCell, getTrayVisualPosition, indexToPosition, isMysteryFruitAt, positionToIndex, setMysteryFruitAt } from "./utils/grid-utils.js";
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
  "zoomOutBtn", "zoomInBtn", "zoomResetBtn", "zoomValue",
  "layerSelect", "toggleActiveLayerVisibilityBtn", "mysteryFruitDebugBtn", "deleteActiveLayerBtn", "contextPanelTitle", "contextPanelSubtitle", "contextPanelCloseBtn", "trayPanel", "pathStat", "grassStat", "priorityStat", "itemStat", "fruitStat", "fruitTypeStat", "trayStat", "capacityStat", "dataSummary", "validationList", "inspectorBody", "inspectorDetails",
  "undoBtn", "redoBtn", "activeToolBadge", "topbarEyebrow", "levelWorkspace", "playableWorkspace", "levelLayerPicker", "levelRightRail", "jsonFolderCard",
  "placeholderView", "placeholderIcon", "placeholderTitle", "placeholderCopy", "levelControls", "playableControls", "jsonControls", "levelActions", "jsonActions",
  "playableGridBoard", "playableBoardWrap", "playableCanvasArea", "playableGridMeta", "playableStatusBadge", "playableStatusCopy", "playableBlocker",
  "playModeSelect", "playSpeedSelect", "playPauseBtn", "playRestartBtn", "playableDirectionHint", "playableCargoCount", "playableCargo",
  "playableTrayCount", "playableTrayProgress", "playableEndOverlay", "playableEndIcon", "playableEndTitle", "playableEndCopy", "playAgainBtn", "exitPlayableBtn",
  "toast", "saveStatus", "fileInput", "newLevelBtn", "jsonImportBtn", "jsonDownloadBtn", "chooseFolderBtn", "reconnectFolderBtn", "refreshFolderBtn",
  "jsonFileNameInput", "folderStatus", "jsonFileList", "jsonPreview", "jsonValidationStatus", "jsonDirtyStatus"
].map((id) => [id, byId(id)]));

const editor = new EditorState(loadSavedState());
const fileManager = new LevelFileManager();
const SELECTED_DATA_FILE_STORAGE_KEY = "railwaydash:lastSelectedDataFile";
const folderFileState = {
  directoryHandle: null,
  directoryName: "",
  permission: fileManager.supported ? "unknown" : "unsupported",
  files: [],
  selectedFileName: readSelectedDataFileName(),
  loading: false,
  error: null,
  scanId: 0
};
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
const editorCamera = new CameraController({
  onChange: updateZoomUi
});

function updateZoomUi() {
  if (elements.zoomValue) elements.zoomValue.textContent = `${Math.round(editorCamera.zoom * 100)}%`;
  if (elements.zoomOutBtn) elements.zoomOutBtn.disabled = editorCamera.zoom <= editorCamera.min;
  if (elements.zoomInBtn) elements.zoomInBtn.disabled = editorCamera.zoom >= editorCamera.max;
  if (elements.zoomResetBtn) elements.zoomResetBtn.disabled = Math.abs(editorCamera.zoom - 1) < 0.001;
  fitBoardToCanvas();
}

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

  const zoomedWidth = fittedWidth * editorCamera.zoom;
  elements.boardWrap.style.width = `${zoomedWidth}px`;
  elements.canvasArea.classList.toggle("map-zoomed", editorCamera.zoom > 1);
}

function loadSavedState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { return deserializeEditorState(raw); }
        catch {
          const legacy = migrateLevel(JSON.parse(raw));
          return { grid: legacy.grid, sharedCells: legacy.sharedCells ?? {}, layers: legacy.layers, activeLayerId: legacy.activeLayerId ?? legacy.layers?.[0]?.id, selectedCell: null, activeTrayCell: null, selectedAssetId: "snake-start", tool: "path", eraseMode: "smart", tab: "level", fileName: "untitled-level.json", sourceFileName: null, fileDirty: true };
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
  elements.mysteryFruitDebugBtn.classList.toggle("active", Boolean(editor.data.mysteryFruitDebug));
  elements.mysteryFruitDebugBtn.title = editor.data.mysteryFruitDebug ? "Tắt Debug Mystery Fruit" : "Bật Debug Mystery Fruit";
  elements.mysteryFruitDebugBtn.setAttribute("aria-pressed", String(Boolean(editor.data.mysteryFruitDebug)));
  elements.deleteActiveLayerBtn.disabled = editor.data.layers.length === 1;
}

function readSelectedDataFileName() {
  try { return localStorage.getItem(SELECTED_DATA_FILE_STORAGE_KEY); }
  catch { return null; }
}

function rememberSelectedDataFileName(fileName) {
  folderFileState.selectedFileName = fileName;
  try {
    if (fileName) localStorage.setItem(SELECTED_DATA_FILE_STORAGE_KEY, fileName);
    else localStorage.removeItem(SELECTED_DATA_FILE_STORAGE_KEY);
  } catch (error) {
    console.warn("Không thể lưu file data đang chọn", error);
  }
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
    { ok: true, text: `${report.stats.mysteryFruits} Mystery Fruit` },
    { ok: true, text: `${report.stats.countBarriers} Count Barrier · ${report.stats.countBarrierCells} ô khóa` },
    { ok: true, text: `${report.stats.tunnels} Tunnel` },
    { ok: true, text: `${report.stats.oneWays} One Way` },
    { ok: trayRecipesOk, text: trayRecipesOk ? `${report.stats.trayLayers} layer khay đã đủ recipe 9/9` : `Còn ${report.stats.invalidTrayRecipes || "khay chưa có"} recipe khay chưa hoàn tất` },
    { ok: balanceOk, text: balanceOk ? "Tổng fruit các layer khớp recipe khay" : "Tổng fruit các layer và recipe khay chưa khớp" }
  ];
  const details = [...report.errors, ...report.warnings].filter((message) => !checks.some((check) => check.text === message));
  elements.validationList.innerHTML = checks.map((check) => `<div class="validation-row ${check.ok ? "ok" : "warn"}"><span>${check.ok ? "✓" : "!"}</span><span>${check.text}</span></div>`).join("")
    + details.map((message) => `<div class="validation-row warn"><span>!</span><span>${message}</span></div>`).join("");
  return report.stats;
}

function tunnelDraftBadge(draft) {
  if (!draft) return "Select Tunnel Point A";
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select Tunnel Point B",
    "direction-b": "Point B selected — Choose direction"
  }[draft.step] ?? "Select Tunnel Point A";
}

function oneWayDraftBadge(draft) {
  if (!draft) return "Select One Way Point A";
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select One Way Point B",
    "direction-b": "Point B selected — Choose direction"
  }[draft.step] ?? "Select One Way Point A";
}

function renderAll() {
  const layer = editor.activeLayer;
  const paletteObjects = objectsByCategory(activePaletteCategory);
  renderObjectPalette(elements.assetPalette, paletteObjects, editor.data.selectedAssetId, {
    emptyLabel: activePaletteCategory === "element" ? "Element sẽ được bổ sung ở bước tiếp theo." : `Chưa có ${activePaletteCategory}.`,
    unavailableIds: hasPlacedObject("snake-start") ? ["snake-start"] : [],
    bridgeAxis: editor.data.selectedBridgeAxis ?? 0,
    countBarrierCount: normalizeCountBarrierCount(editor.data.selectedCountBarrierCount)
  });
  document.querySelectorAll("[data-palette-tab]").forEach((button) => {
    const active = button.dataset.paletteTab === activePaletteCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  renderGrid(elements.gridBoard, editor.data);
  renderLayers();
  if (editor.data.selectedCell) {
    elements.trayPanel.classList.add("inspector-mode");
    elements.contextPanelTitle.textContent = `Ô ${getSelectedCellIndex(editor.data)}`;
    elements.contextPanelSubtitle.textContent = "Chỉnh sửa nội dung tại ô đang chọn";
    elements.contextPanelCloseBtn.classList.remove("hidden");
    renderInspector(elements.trayPanel, editor.data);
  } else {
    elements.trayPanel.classList.remove("inspector-mode");
    elements.contextPanelTitle.textContent = "Khay chứa";
    elements.contextPanelSubtitle.textContent = "Hiển thị và setup layer của từng khay";
    elements.contextPanelCloseBtn.classList.add("hidden");
    renderTrayEditor(elements.trayPanel, editor.data);
  }
  elements.inspectorDetails.classList.add("hidden");
  const dataSummary = renderDataSummary(elements.dataSummary, editor.data);
  renderToolbar(editor, elements);
  if (editor.data.tool === "terrain") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Chỉnh terrain";
  else if (editor.data.tool === "item") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Đặt item";
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "mystery-fruit") elements.activeToolBadge.textContent = "Mystery Fruit";
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "count-barrier") {
    const activeId = Number.isInteger(editor.data.activeBarrierId) ? ` · Active ${editor.data.activeBarrierId}` : "";
    elements.activeToolBadge.textContent = `Count Barrier${activeId} · ${normalizeCountBarrierCount(editor.data.selectedCountBarrierCount)}`;
  }
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "tunnel") {
    const activeId = Number.isInteger(editor.data.activeTunnelId) ? ` · Active ${editor.data.activeTunnelId}` : "";
    elements.activeToolBadge.textContent = editor.data.tunnelDraft ? tunnelDraftBadge(editor.data.tunnelDraft) : `Tunnel${activeId || " · Select Point A"}`;
  }
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "one-way") {
    const activeId = Number.isInteger(editor.data.activeOneWayId) ? ` · Active ${editor.data.activeOneWayId}` : "";
    elements.activeToolBadge.textContent = editor.data.oneWayDraft ? oneWayDraftBadge(editor.data.oneWayDraft) : `One Way${activeId || " · Select Point A"}`;
  }
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
  elements.chooseFolderBtn.disabled = !fileManager.supported || folderFileState.loading;
  elements.chooseFolderBtn.textContent = fileManager.connected ? "Đổi thư mục" : "Mở thư mục";
  elements.refreshFolderBtn.disabled = !fileManager.connected || folderFileState.permission !== "granted" || folderFileState.loading;
  elements.reconnectFolderBtn.classList.toggle("hidden", !fileManager.connected || folderFileState.permission === "granted" || folderFileState.permission === "unknown");
  elements.reconnectFolderBtn.disabled = folderFileState.loading;
  elements.folderStatus.textContent = folderStatusText();
  renderFolderFiles();
}

function folderStatusText() {
  if (!fileManager.supported) return "Trình duyệt không hỗ trợ mở folder trực tiếp; vẫn có thể Nhập file và Tải xuống.";
  if (folderFileState.loading) return `Loading folder${folderFileState.directoryName ? ` ${folderFileState.directoryName}` : ""}...`;
  if (folderFileState.error) return folderFileState.error;
  if (!fileManager.connected) return "Chưa chọn thư mục. File mới sẽ được tải xuống.";
  if (folderFileState.permission === "prompt" || folderFileState.permission === "denied") return `${folderFileState.directoryName} · Cần cấp lại quyền để mở folder.`;
  if (folderFileState.permission === "unknown") return `${folderFileState.directoryName} · Đang kiểm tra quyền truy cập.`;
  const invalidCount = folderFiles.filter((file) => file.status !== "valid").length;
  return `${folderFileState.directoryName} · ${folderFiles.length} file JSON${invalidCount ? ` · ${invalidCount} file lỗi` : ""}`;
}

function renderFolderFiles() {
  elements.jsonFileList.innerHTML = "";
  if (folderFileState.loading) {
    const loading = document.createElement("div");
    loading.className = "json-file-empty";
    loading.textContent = "Loading folder...";
    elements.jsonFileList.appendChild(loading);
    return;
  }
  if (fileManager.connected && folderFileState.permission !== "granted") {
    const reconnect = document.createElement("div");
    reconnect.className = "json-file-empty";
    reconnect.textContent = "Cần cấp lại quyền để mở folder.";
    elements.jsonFileList.appendChild(reconnect);
    return;
  }
  if (!fileManager.connected || folderFiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "json-file-empty";
    empty.textContent = fileManager.connected ? "Thư mục chưa có file JSON." : "Chọn một thư mục để quản lý các level JSON đã có trên ổ đĩa.";
    elements.jsonFileList.appendChild(empty);
    return;
  }
  folderFiles.forEach((file) => {
    const row = document.createElement("div");
    row.className = `json-file-row${editor.data.sourceFileName === file.name ? " active" : ""}${file.status !== "valid" ? " file-error" : ""}`;
    row.dataset.fileName = file.name;
    const copy = document.createElement("div");
    copy.className = "json-file-copy";
    const title = document.createElement("strong");
    title.textContent = `${file.status === "valid" ? "" : "! "}${file.name}`;
    const meta = document.createElement("small");
    const statusLabel = file.status === "valid" ? "Hợp lệ" : file.status === "invalid" ? "JSON lỗi" : "Không đọc được";
    const updatedAt = file.lastModified ? new Date(file.lastModified).toLocaleString("vi-VN") : "Không rõ thời gian";
    meta.textContent = `${statusLabel} · ${Math.max(1, Math.ceil(file.size / 1024))} KB · ${updatedAt}`;
    if (file.errorMessage) meta.title = file.errorMessage;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "json-file-actions";
    [["open", "Mở"], ["save", "Lưu đè"], ["rename", "Đổi tên"], ["delete", "Xóa"]].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.fileAction = action; button.textContent = label;
      if (action === "delete") button.className = "danger";
      if (action === "open" && file.status !== "valid") {
        button.title = file.errorMessage ?? "File không thể mở vào editor.";
      }
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

let eraseChoiceMenu = null;
let directionPicker = null;

function hideEraseChoiceMenu() {
  eraseChoiceMenu?.remove();
  eraseChoiceMenu = null;
}

function showEraseChoiceMenu(position, targets) {
  hideEraseChoiceMenu();
  const cell = elements.gridBoard.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  const rect = cell?.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "erase-choice-menu";
  menu.innerHTML = `<strong>Xóa gì tại ô ${positionToIndex(position.x, position.y, editor.data.grid.columns)}?</strong>`;
  targets.forEach((target) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.eraseChoiceMode = target.mode;
    button.dataset.eraseChoiceX = String(position.x);
    button.dataset.eraseChoiceY = String(position.y);
    button.textContent = target.label;
    menu.appendChild(button);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.dataset.eraseChoiceCancel = "true";
  cancel.textContent = "Hủy";
  menu.appendChild(cancel);
  document.body.appendChild(menu);
  const left = rect ? rect.left + rect.width + 8 : window.innerWidth / 2;
  const top = rect ? rect.top : window.innerHeight / 2;
  menu.style.left = `${Math.min(left, window.innerWidth - menu.offsetWidth - 12)}px`;
  menu.style.top = `${Math.min(top, window.innerHeight - menu.offsetHeight - 12)}px`;
  eraseChoiceMenu = menu;
}

function directionLabel(type, step) {
  if (type === "gate") return "Gate Direction";
  const point = step?.endsWith("b") ? "B" : "A";
  return `${type === "tunnel" ? "Tunnel" : "One Way"} Point ${point}`;
}

function hideDirectionPicker({ force = false } = {}) {
  if (!directionPicker) return;
  if (!force && directionPicker.mode === "draft") return;
  directionPicker.element.remove();
  directionPicker = null;
}

function showDirectionPicker(type, position, { mode = "draft", id = null, entryIndex = 0, step = "direction-a" } = {}) {
  hideDirectionPicker({ force: true });
  const cell = elements.gridBoard.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  const rect = cell?.getBoundingClientRect();
  const picker = document.createElement("div");
  picker.className = `direction-popover ${type}-direction-popover`;
  picker.dataset.directionPickerType = type;
  picker.dataset.directionPickerMode = mode;
  picker.dataset.directionPickerId = id ?? "";
  picker.dataset.directionPickerEntry = String(entryIndex);
  picker.innerHTML = `<strong>${directionLabel(type, step)}</strong>`;
  [
    ["0", "↑", "Up"],
    ["1", "↓", "Down"],
    ["2", "→", "Right"],
    ["3", "←", "Left"]
  ].forEach(([value, icon, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.floatingDirection = value;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.textContent = icon;
    picker.appendChild(button);
  });
  if (type !== "gate") {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "direction-popover-cancel";
    cancel.dataset.directionPickerCancel = type;
    cancel.textContent = "×";
    cancel.title = "Cancel";
    picker.appendChild(cancel);
  }
  document.body.appendChild(picker);
  const left = rect ? rect.left + rect.width + 8 : window.innerWidth / 2;
  const top = rect ? rect.top : window.innerHeight / 2;
  picker.style.left = `${Math.min(left, window.innerWidth - picker.offsetWidth - 12)}px`;
  picker.style.top = `${Math.min(top, window.innerHeight - picker.offsetHeight - 12)}px`;
  directionPicker = { element: picker, type, mode, id, entryIndex, position };
}

function eraseSmartAt(position) {
  const targets = getEraseTargets(editor.data, position);
  if (targets.length === 0) {
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  if (targets.length > 1) {
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    showEraseChoiceMenu(position, targets);
    return;
  }
  hideEraseChoiceMenu();
  showEraseFeedback(mutate((state) => eraseAtPosition(state, position, targets[0].mode)));
}

const input = new InputController({
  isEnabled: () => editor.data.tab === "level",
  canDrag: () => editor.data.tool !== "select" && !(editor.data.tool === "item" && ["tunnel", "one-way", "gate"].includes(findObject(editor.data.selectedAssetId)?.kind)),
  onStrokeStart: () => {
    editor.beginTransaction();
  },
  onStrokeEnd: () => {
    editor.endTransaction();
  },
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
    const clickedBarrier = findCountBarrierAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedBarrier && !eraseOverride) {
      editor.data.activeBarrierId = clickedBarrier.barrierId;
      editor.data.selectedCountBarrierCount = normalizeCountBarrierCount(clickedBarrier.count);
    }
    const clickedTunnel = findTunnelAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedTunnel && !eraseOverride && !editor.data.tunnelDraft && !editor.data.oneWayDraft && editor.data.tool !== "erase") {
      const clickedIndex = positionToIndex(targetX, targetY, editor.data.grid.columns);
      const entryIndex = clickedTunnel.entryPoints.findIndex((point) => point.index === clickedIndex);
      editor.data.activeTunnelId = clickedTunnel.tunnelId;
      selectCell(editor.data, targetX, targetY);
      editor.notify();
      showDirectionPicker("tunnel", { x: targetX, y: targetY }, { mode: "edit", id: clickedTunnel.tunnelId, entryIndex, step: entryIndex === 1 ? "direction-b" : "direction-a" });
      return;
    }
    const clickedOneWay = findOneWayAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedOneWay && !eraseOverride && !editor.data.tunnelDraft && !editor.data.oneWayDraft && editor.data.tool !== "erase") {
      const clickedIndex = positionToIndex(targetX, targetY, editor.data.grid.columns);
      const entryIndex = clickedOneWay.entryPoints.findIndex((point) => point.index === clickedIndex);
      editor.data.activeOneWayId = clickedOneWay.oneWayId;
      selectCell(editor.data, targetX, targetY);
      editor.notify();
      showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "edit", id: clickedOneWay.oneWayId, entryIndex, step: entryIndex === 1 ? "direction-b" : "direction-a" });
      return;
    }
    const clickedCell = getMergedCell(editor.data, targetX, targetY);
    const clickedTray = ["tray", "truck"].includes(clickedCell?.item?.kind);
    if (clickedTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else if ((eraseOverride || editor.data.tool === "erase") && (eraseOverride || (editor.data.eraseMode ?? "smart") === "smart")) {
      eraseSmartAt({ x: targetX, y: targetY });
    } else if (editor.data.tool === "select" && !eraseOverride) {
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else {
      hideEraseChoiceMenu();
      const selectedObject = findObject(editor.data.selectedAssetId);
      const result = mutate((state) => applyTool(state, targetX, targetY, eraseOverride ? "smart-erase" : null));
      if (result?.reason === "unique-object-exists") {
        showNotification(elements.toast, "Map chỉ được có một đầu rắn. Hãy xóa đầu rắn hiện tại trước khi đặt lại.");
      } else if (result?.reason === "tray-visual-outside-grid") {
        showNotification(elements.toast, "Không thể đặt khay: vị trí visual mặc định phía trên nằm ngoài map.");
      } else if (result?.reason === "tray-checkpoint-needs-road") {
        showNotification(elements.toast, "Hãy vẽ đường trước, sau đó đặt khay trực tiếp lên checkpoint đó.");
      } else if (result?.reason === "gate-needs-path") {
        showNotification(elements.toast, "Gate chỉ được đặt trên Path.");
      } else if (result?.reason === "mystery-needs-fruit") {
        showNotification(elements.toast, "Mystery Fruit chỉ đánh dấu Fruit trong layer đang chọn.");
      } else if (result?.reason === "fruit-on-barrier-endpoint") {
        showNotification(elements.toast, "Không đặt Fruit tại 2 đầu Count Barrier. Hãy đặt Fruit ở ô giữa Barrier hoặc Path khác.");
      } else if (result?.reason === "barrier-needs-path") {
        showNotification(elements.toast, "Count Barrier chỉ có thể vẽ trên Path.");
      } else if (result?.reason === "tunnel-needs-path") {
        showNotification(elements.toast, "Tunnel chỉ có thể đặt trên Path.");
      } else if (result?.reason === "tunnel-same-point") {
        showNotification(elements.toast, "Point B không được trùng Point A.");
      } else if (result?.reason === "tunnel-overlap") {
        showNotification(elements.toast, "Ô này đã thuộc Tunnel khác.");
      } else if (result?.reason === "tunnel-needs-direction-a") {
        showNotification(elements.toast, "Chọn direction cho Point A trước.");
      } else if (result?.reason === "tunnel-needs-direction-b") {
        showNotification(elements.toast, "Chọn direction cho Point B trước.");
      } else if (result?.reason === "one-way-needs-path") {
        showNotification(elements.toast, "One Way chỉ có thể đặt trên Path.");
      } else if (result?.reason === "one-way-same-point") {
        showNotification(elements.toast, "Point B không được trùng Point A.");
      } else if (result?.reason === "one-way-overlap") {
        showNotification(elements.toast, "Ô này đã thuộc One Way khác.");
      } else if (result?.reason === "one-way-needs-direction-a") {
        showNotification(elements.toast, "Chọn direction cho Point A trước.");
      } else if (result?.reason === "one-way-needs-direction-b") {
        showNotification(elements.toast, "Chọn direction cho Point B trước.");
      } else if (result?.reason === "barrier-overlap") {
        showNotification(elements.toast, "Ô Path này đã thuộc một Count Barrier khác.");
      } else if (result?.reason === "tray-visual-occupied") {
        showNotification(elements.toast, "Ô visual mặc định phía trên checkpoint phải trống.");
      } else if (["shared-position-occupied", "fruit-position-occupied"].includes(result?.reason)) {
        showNotification(elements.toast, "Ô này đã có object dùng chung hoặc fruit ở một layer khác.");
      } else if (result?.reason === "element-position-occupied") {
        showNotification(elements.toast, "Ô này đã có element khác.");
      } else if (result?.reason === "grass-on-path") {
        showNotification(elements.toast, "Grass không thể trùng Path. Hãy xóa Path trước.");
      } else if (result?.reason === "terrain-on-path") {
        showNotification(elements.toast, "Không thể chuyển ô Path thành Terrain trống. Hãy xóa Path trước.");
      } else if (result?.reason === "priority-needs-path") {
        showNotification(elements.toast, "PriorityPoint chỉ được đặt trên Path.");
      } else if (result?.action === "tunnel-point-a-selected") {
        showNotification(elements.toast, "Point A selected — Choose direction");
        showDirectionPicker("tunnel", { x: targetX, y: targetY }, { mode: "draft", id: result.tunnelId, entryIndex: 0, step: "direction-a" });
      } else if (result?.action === "tunnel-point-b-selected") {
        showNotification(elements.toast, "Point B selected — Choose direction");
        showDirectionPicker("tunnel", { x: targetX, y: targetY }, { mode: "draft", id: result.tunnelId, entryIndex: 1, step: "direction-b" });
      } else if (result?.action === "one-way-point-a-selected") {
        showNotification(elements.toast, "Point A selected — Choose direction");
        showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "draft", id: result.oneWayId, entryIndex: 0, step: "direction-a" });
      } else if (result?.action === "one-way-point-b-selected") {
        showNotification(elements.toast, "Point B selected — Choose direction");
        showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "draft", id: result.oneWayId, entryIndex: 1, step: "direction-b" });
      } else if (result?.changed && selectedObject?.kind === "gate") {
        showDirectionPicker("gate", { x: targetX, y: targetY }, { mode: "edit" });
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
    setEraseMenuExpanded(false);
    editor.notify();
    return;
  }
  const button = event.target.closest("[data-tool]");
  if (button && TOOL_LABELS[button.dataset.tool]) { editor.data.tool = button.dataset.tool; editor.notify(); }
});
const eraseToolMenu = document.querySelector(".erase-tool-menu");
const setEraseMenuExpanded = (expanded) => {
  eraseToolMenu.classList.toggle("open", expanded);
  byId("eraseToolBtn").setAttribute("aria-expanded", String(expanded));
};
byId("eraseToolBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  editor.data.tool = "erase";
  setEraseMenuExpanded(byId("eraseToolBtn").getAttribute("aria-expanded") !== "true");
  editor.notify();
});
document.addEventListener("click", (event) => {
  if (!eraseToolMenu.contains(event.target)) setEraseMenuExpanded(false);
});
document.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-erase-choice-mode]");
  if (choice) {
    const mode = choice.dataset.eraseChoiceMode;
    const position = { x: Number(choice.dataset.eraseChoiceX), y: Number(choice.dataset.eraseChoiceY) };
    hideEraseChoiceMenu();
    showEraseFeedback(mutate((state) => eraseAtPosition(state, position, mode)));
    return;
  }
  if (event.target.closest("[data-erase-choice-cancel]")) hideEraseChoiceMenu();
  else if (eraseChoiceMenu && !eraseChoiceMenu.contains(event.target)) hideEraseChoiceMenu();
});
document.addEventListener("click", (event) => {
  const direction = event.target.closest("[data-floating-direction]");
  if (direction && directionPicker?.element.contains(direction)) {
    const value = Number(direction.dataset.floatingDirection);
    const current = directionPicker;
    let result = null;
    if (current.type === "tunnel" && current.mode === "draft") {
      result = mutate((state) => setTunnelDraftDirection(state, value));
      if (result?.action === "tunnel-created") showNotification(elements.toast, `Tunnel #${result.tunnelId} created`);
      else if (result?.action === "tunnel-direction-a-selected") showNotification(elements.toast, "Point A complete — Select Tunnel Point B");
    } else if (current.type === "one-way" && current.mode === "draft") {
      result = mutate((state) => setOneWayDraftDirection(state, value));
      if (result?.action === "one-way-created") showNotification(elements.toast, `One Way #${result.oneWayId} created`);
      else if (result?.action === "one-way-direction-a-selected") showNotification(elements.toast, "Point A complete — Select One Way Point B");
    } else if (current.type === "tunnel") {
      mutate((state) => setTunnelEntryDirection(state, Number(current.id), Number(current.entryIndex), value));
      showNotification(elements.toast, "Đã cập nhật direction Tunnel.");
    } else if (current.type === "one-way") {
      mutate((state) => setOneWayEntryDirection(state, Number(current.id), Number(current.entryIndex), value));
      showNotification(elements.toast, "Đã cập nhật direction One Way.");
    } else if (current.type === "gate") {
      mutate((state) => {
        const key = `${current.position.x},${current.position.y}`;
        const element = state.sharedCells?.[key]?.element;
        if (!isGateElement(element)) return false;
        element.direction = normalizeGateDirection(value);
        state.selectedGateDirection = element.direction;
        state.selectedCell = { ...current.position };
        return true;
      });
      showNotification(elements.toast, "Đã chọn hướng Gate.");
    }
    hideDirectionPicker({ force: true });
    return;
  }
  const cancel = event.target.closest("[data-direction-picker-cancel]");
  if (cancel && directionPicker?.element.contains(cancel)) {
    const type = directionPicker.type;
    if (directionPicker.mode === "draft") {
      mutate(type === "tunnel" ? cancelTunnelDraft : cancelOneWayDraft);
      showNotification(elements.toast, type === "tunnel" ? "Đã hủy Tunnel Draft." : "Đã hủy One Way Draft.");
    }
    hideDirectionPicker({ force: true });
    return;
  }
  if (directionPicker && !directionPicker.element.contains(event.target)) hideDirectionPicker();
});
elements.assetPalette.addEventListener("click", (event) => {
  const bridgeAxis = event.target.closest("[data-bridge-axis]");
  if (bridgeAxis) editor.data.selectedBridgeAxis = normalizeBridgeAxis(bridgeAxis.dataset.bridgeAxis);
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
elements.mysteryFruitDebugBtn.addEventListener("click", () => mutate((state) => {
  state.mysteryFruitDebug = !state.mysteryFruitDebug;
}));

function deleteActiveLayer() {
  if (editor.data.layers.length <= 1 || !confirm("Xóa layer fruit đang chọn và toàn bộ hoa quả trong layer này? Map, rắn và khay chứa sẽ được giữ nguyên.")) return;
  mutate((state) => {
    const deletedId = state.activeLayerId;
    const deletedIndex = state.layers.findIndex((layer) => layer.id === deletedId);
    const deletedLayerNumber = Number.isInteger(state.layers[deletedIndex]?.layer) ? state.layers[deletedIndex].layer : deletedIndex;
    state.mysteryFruitElement = (state.mysteryFruitElement ?? []).flatMap((entry) => {
      if (entry.layer === deletedLayerNumber) return [];
      return [{ ...entry, layer: entry.layer > deletedLayerNumber ? entry.layer - 1 : entry.layer }];
    });
    state.layers = state.layers.filter((layer) => layer.id !== deletedId);
    reindexLayers(state.layers);
    const nextIndex = Math.min(deletedIndex, state.layers.length - 1);
    state.activeLayerId = state.layers[Math.max(0, nextIndex)].id;
  });
}
elements.deleteActiveLayerBtn.addEventListener("click", deleteActiveLayer);
elements.contextPanelCloseBtn.addEventListener("click", () => {
  editor.data.selectedCell = null;
  editor.notify();
});

function selectedLayerNumber(state) {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId) ?? state.layers[0];
  return Number.isInteger(layer?.layer) ? layer.layer : Math.max(0, state.layers.indexOf(layer));
}

function placeInspectorElement(assetId) {
  if (!editor.data.selectedCell) return;
  const { x, y } = editor.data.selectedCell;
  const result = mutate((state) => {
    const previousTool = state.tool;
    const previousAsset = state.selectedAssetId;
    state.tool = "item";
    state.selectedAssetId = assetId;
    const placement = applyTool(state, x, y);
    state.tool = previousTool;
    state.selectedAssetId = previousAsset;
    return placement;
  });
  if (result?.reason === "gate-needs-path") showNotification(elements.toast, "Gate chỉ có thể đặt trên Path.");
  else if (result?.reason === "tunnel-needs-path") showNotification(elements.toast, "Tunnel chỉ có thể đặt trên Path.");
  else if (result?.reason === "tunnel-same-point") showNotification(elements.toast, "Point B không được trùng Point A.");
  else if (result?.reason === "tunnel-overlap") showNotification(elements.toast, "Ô này đã thuộc Tunnel khác.");
  else if (result?.reason === "tunnel-needs-direction-a") showNotification(elements.toast, "Chọn direction cho Point A trước.");
  else if (result?.reason === "tunnel-needs-direction-b") showNotification(elements.toast, "Chọn direction cho Point B trước.");
  else if (result?.reason === "one-way-needs-path") showNotification(elements.toast, "One Way chỉ có thể đặt trên Path.");
  else if (result?.reason === "one-way-same-point") showNotification(elements.toast, "Point B không được trùng Point A.");
  else if (result?.reason === "one-way-overlap") showNotification(elements.toast, "Ô này đã thuộc One Way khác.");
  else if (result?.reason === "one-way-needs-direction-a") showNotification(elements.toast, "Chọn direction cho Point A trước.");
  else if (result?.reason === "one-way-needs-direction-b") showNotification(elements.toast, "Chọn direction cho Point B trước.");
  else if (result?.reason === "element-position-occupied") showNotification(elements.toast, "Ô này đã có element khác.");
  else showNotification(elements.toast, `Đã thêm ${assetId === "gate" ? "Gate" : assetId === "count-barrier" ? "Count Barrier" : assetId === "tunnel" ? "Tunnel" : assetId === "one-way" ? "One Way" : "Bridge"}`);
}

elements.trayPanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-deselect-cell]")) {
    editor.data.selectedCell = null;
    editor.notify();
    return;
  }
  const bridgeAxis = event.target.closest("[data-inspector-bridge-axis]");
  if (bridgeAxis && editor.data.selectedCell) {
    mutate((state) => {
      const key = `${state.selectedCell.x},${state.selectedCell.y}`;
      const element = state.sharedCells?.[key]?.element;
      if (!isBridgeElement(element)) return false;
      element.axis = normalizeBridgeAxis(bridgeAxis.dataset.inspectorBridgeAxis);
      state.selectedBridgeAxis = element.axis;
      return true;
    });
    showNotification(elements.toast, `Bridge chuyển sang ${Number(bridgeAxis.dataset.inspectorBridgeAxis) === 1 ? "Vertical" : "Horizontal"}`);
    return;
  }
  const gateDirection = event.target.closest("[data-inspector-gate-direction]");
  if (gateDirection && editor.data.selectedCell) {
    mutate((state) => {
      const key = `${state.selectedCell.x},${state.selectedCell.y}`;
      const element = state.sharedCells?.[key]?.element;
      if (!isGateElement(element)) return false;
      element.direction = normalizeGateDirection(gateDirection.dataset.inspectorGateDirection);
      state.selectedGateDirection = element.direction;
      return true;
    });
    showNotification(elements.toast, `Đã đổi hướng Gate`);
    return;
  }
  const tunnelDraftDirection = event.target.closest("[data-inspector-tunnel-draft-direction]");
  if (tunnelDraftDirection) {
    const result = mutate((state) => setTunnelDraftDirection(state, Number(tunnelDraftDirection.dataset.inspectorTunnelDraftDirection)));
    if (result?.action === "tunnel-created") showNotification(elements.toast, `Tunnel #${result.tunnelId} created`);
    else if (result?.action === "tunnel-direction-a-selected") showNotification(elements.toast, "Point A complete — Select Tunnel Point B");
    else showNotification(elements.toast, "Không thể cập nhật Tunnel Draft.");
    return;
  }
  if (event.target.closest("[data-inspector-tunnel-draft-cancel]")) {
    mutate(cancelTunnelDraft);
    showNotification(elements.toast, "Đã hủy Tunnel Draft.");
    return;
  }
  const tunnelFocus = event.target.closest("[data-inspector-tunnel-focus]");
  if (tunnelFocus) {
    const tunnel = findTunnelById(editor.data, Number(tunnelFocus.dataset.inspectorTunnelFocus));
    const entry = tunnel?.entryPoints?.[Number(tunnelFocus.dataset.tunnelEntry)];
    if (!entry) return;
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    editor.data.activeTunnelId = tunnel.tunnelId;
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  const tunnelMove = event.target.closest("[data-inspector-tunnel-move]");
  if (tunnelMove && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => setTunnelEntryIndex(
      state,
      Number(tunnelMove.dataset.inspectorTunnelMove),
      Number(tunnelMove.dataset.tunnelEntry),
      targetIndex
    ));
    showNotification(elements.toast, changed ? "Đã cập nhật vị trí Tunnel." : "Không thể đặt 2 entryPoint cùng một Index.");
    return;
  }
  const oneWayFocus = event.target.closest("[data-inspector-one-way-focus]");
  if (oneWayFocus) {
    const oneWay = findOneWayById(editor.data, Number(oneWayFocus.dataset.inspectorOneWayFocus));
    const entry = oneWay?.entryPoints?.[Number(oneWayFocus.dataset.oneWayEntry)];
    if (!entry) return;
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    editor.data.activeOneWayId = oneWay.oneWayId;
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  const oneWayMove = event.target.closest("[data-inspector-one-way-move]");
  if (oneWayMove && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => setOneWayEntryIndex(
      state,
      Number(oneWayMove.dataset.inspectorOneWayMove),
      Number(oneWayMove.dataset.oneWayEntry),
      targetIndex
    ));
    showNotification(elements.toast, changed ? "Đã cập nhật vị trí One Way." : "Không thể đặt 2 entryPoint cùng một Index.");
    return;
  }
  if (event.target.closest("[data-inspector-mystery-toggle]") && editor.data.selectedCell) {
    mutate((state) => {
      const layerNumber = selectedLayerNumber(state);
      const { x, y } = state.selectedCell;
      const index = positionToIndex(x, y, state.grid.columns);
      const hidden = !isMysteryFruitAt(state, layerNumber, index);
      setMysteryFruitAt(state, layerNumber, index, hidden);
      return hidden;
    });
    showNotification(elements.toast, "Đã cập nhật Mystery Fruit");
    return;
  }
  const inspectorDelete = event.target.closest("[data-inspector-delete]");
  if (inspectorDelete && editor.data.selectedCell) {
    const mode = inspectorDelete.dataset.inspectorDelete;
    const label = mode === "mystery-fruit" ? "Mystery Fruit" : mode === "item" ? "Item" : mode === "tray" ? "Tray" : mode === "count-barrier" ? "Count Barrier" : mode === "tunnel" ? "Tunnel" : mode === "one-way" ? "One Way" : mode;
    if (mode === "tray" && !confirm("Xóa khay chứa tại ô đang chọn?")) return;
    if (mode === "tunnel") {
      const tunnel = findTunnelAtIndex(editor.data, positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns))
        ?? findTunnelById(editor.data, editor.data.activeTunnelId);
      if (tunnel) mutate((state) => removeTunnelById(state, tunnel.tunnelId));
    } else if (mode === "one-way") {
      const oneWay = findOneWayAtIndex(editor.data, positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns))
        ?? findOneWayById(editor.data, editor.data.activeOneWayId);
      if (oneWay) mutate((state) => removeOneWayById(state, oneWay.oneWayId));
    } else {
      showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, mode)));
    }
    showNotification(elements.toast, `Đã xóa ${label}`);
    return;
  }
  const newBarrier = event.target.closest("[data-inspector-count-barrier-new]");
  if (newBarrier) {
    mutate((state) => {
      createNewActiveCountBarrier(state);
      state.selectedAssetId = "count-barrier";
      state.tool = "item";
    });
    showNotification(elements.toast, `Đã tạo Barrier mới #${editor.data.activeBarrierId}`);
    return;
  }
  const removeBarrierCell = event.target.closest("[data-inspector-count-barrier-remove-cell]");
  if (removeBarrierCell && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => removeCountBarrierCell(state, Number(removeBarrierCell.dataset.inspectorCountBarrierRemoveCell), targetIndex));
    showNotification(elements.toast, changed ? "Đã xóa cell khỏi Barrier." : "Không thể xóa cell khỏi Barrier.");
    return;
  }
  const barrierStart = event.target.closest("[data-inspector-count-barrier-start]");
  const barrierEnd = event.target.closest("[data-inspector-count-barrier-end]");
  if ((barrierStart || barrierEnd) && editor.data.selectedCell) {
    const target = barrierStart ?? barrierEnd;
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    mutate((state) => {
      const barrier = findCountBarrierById(state, Number(target.dataset.inspectorCountBarrierStart ?? target.dataset.inspectorCountBarrierEnd));
      if (!barrier?.index.includes(targetIndex)) return false;
      const current = state.countBarrierElement.find((entry) => entry.barrierId === barrier.barrierId);
      if (!current) return false;
      if (barrierStart) current.startIndex = targetIndex;
      else current.endIndex = targetIndex;
      return true;
    });
    showNotification(elements.toast, barrierStart ? "Đã đặt startIndex cho Barrier." : "Đã đặt endIndex cho Barrier.");
    return;
  }
  const inspectorAdd = event.target.closest("[data-inspector-add]");
  if (inspectorAdd && !inspectorAdd.disabled) {
    placeInspectorElement(inspectorAdd.dataset.inspectorAdd);
    return;
  }
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
  editor.data.activeTrayCell = { x: Number(tray.dataset.trayX), y: Number(tray.dataset.trayY) };
  editor.data.selectedCell = null;
  editor.notify();
});
elements.trayPanel.addEventListener("change", (event) => {
  const activeTunnel = event.target.closest("[data-inspector-active-tunnel]");
  if (activeTunnel) {
    const tunnel = findTunnelById(editor.data, Number(activeTunnel.value));
    if (!tunnel) return;
    mutate((state) => { state.activeTunnelId = tunnel.tunnelId; });
    const entry = tunnel.entryPoints[0];
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    showNotification(elements.toast, `Đã chọn Tunnel #${tunnel.tunnelId}.`);
    return;
  }
  const activeOneWay = event.target.closest("[data-inspector-active-one-way]");
  if (activeOneWay) {
    const oneWay = findOneWayById(editor.data, Number(activeOneWay.value));
    if (!oneWay) return;
    mutate((state) => { state.activeOneWayId = oneWay.oneWayId; });
    const entry = oneWay.entryPoints[0];
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    showNotification(elements.toast, `Đã chọn One Way #${oneWay.oneWayId}.`);
    return;
  }
  const tunnelDirection = event.target.closest("[data-inspector-tunnel-direction]");
  if (tunnelDirection) {
    const changed = mutate((state) => setTunnelEntryDirection(
      state,
      Number(tunnelDirection.dataset.inspectorTunnelDirection),
      Number(tunnelDirection.dataset.tunnelEntry),
      Number(tunnelDirection.value)
    ));
    if (changed) showNotification(elements.toast, "Đã cập nhật direction Tunnel.");
    return;
  }
  const oneWayDirection = event.target.closest("[data-inspector-one-way-direction]");
  if (oneWayDirection) {
    const changed = mutate((state) => setOneWayDirection(
      state,
      Number(oneWayDirection.dataset.inspectorOneWayDirection),
      Number(oneWayDirection.value)
    ));
    if (changed) showNotification(elements.toast, "Đã cập nhật direction One Way.");
    return;
  }
  const barrierCount = event.target.closest("[data-inspector-count-barrier-count]");
  if (barrierCount) {
    mutate((state) => {
      const barrier = state.countBarrierElement.find((entry) => entry.barrierId === Number(barrierCount.dataset.inspectorCountBarrierCount));
      if (!barrier) return false;
      barrier.count = normalizeCountBarrierCount(barrierCount.value);
      state.selectedCountBarrierCount = barrier.count;
      return true;
    });
    showNotification(elements.toast, "Đã cập nhật count của Barrier.");
    return;
  }
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
elements.zoomOutBtn.addEventListener("click", () => editorCamera.zoomOut());
elements.zoomInBtn.addEventListener("click", () => editorCamera.zoomIn());
elements.zoomResetBtn.addEventListener("click", () => editorCamera.reset());
byId("backToLevelBtn").addEventListener("click", () => { switchTab("level"); renderAll(); });
elements.inspectorBody.addEventListener("click", (event) => {
  const capacity = event.target.closest("[data-capacity-step]");
  if (capacity) mutate((state) => changeSelectedTruckCapacity(state, Number(capacity.dataset.capacityStep)));
  else if (event.target.closest("#togglePathBtn")) mutate((state) => togglePathAt(state, state.selectedCell));
  else if (event.target.closest("#deleteCellBtn")) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
});
elements.inspectorBody.addEventListener("change", (event) => {
  const bridgeAxis = event.target.closest("[data-bridge-axis]");
  if (!bridgeAxis || !editor.data.selectedCell) return;
  mutate((state) => {
    const key = `${state.selectedCell.x},${state.selectedCell.y}`;
    const element = state.sharedCells?.[key]?.element;
    if (bridgeAxis && isBridgeElement(element)) {
      element.axis = normalizeBridgeAxis(bridgeAxis.value);
      state.selectedBridgeAxis = element.axis;
    }
  });
});
function canReplaceCurrentLevel() {
  return !fileDirty || confirm("Level hiện tại có thay đổi chưa lưu hoặc chưa tải xuống. Thay toàn bộ level hiện tại?");
}

async function downloadCurrentLevel() {
  const report = validateLevel(editor.data);
  if (!report.exportable) return showNotification(elements.toast, "Chưa thể Export: hãy sửa toàn bộ lỗi level trước.");
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value || editor.data.fileName);
  const documentData = serializeLevel(editor.data);
  if (fileManager.connected && folderFileState.permission === "granted") {
    try {
      await fileManager.write(editor.data.fileName, documentData);
      editor.data.sourceFileName = editor.data.fileName;
      fileDirty = false;
      editor.data.fileDirty = false;
      rememberSelectedDataFileName(editor.data.fileName);
      await scanFolder();
      renderAll();
      showNotification(elements.toast, `Đã lưu ${editor.data.fileName} vào ${folderFileState.directoryName}.`);
      return;
    } catch (error) {
      showNotification(elements.toast, `Không thể lưu vào folder: ${error.message}`);
      return;
    }
  }
  if (fileManager.connected && folderFileState.permission !== "granted") {
    showNotification(elements.toast, "Cần Reconnect folder trước khi lưu vào folder đang mở.");
    return;
  }
  downloadJson(documentData, editor.data.fileName);
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

function openFolderDataEntry(entry) {
  if (!entry || entry.status !== "valid") {
    showNotification(elements.toast, `Không thể mở file: ${entry?.errorMessage ?? "File JSON không hợp lệ."}`);
    return false;
  }
  openImportedData(entry.data, entry.name);
  rememberSelectedDataFileName(entry.name);
  return true;
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

function applyFolderHandle(handle) {
  folderFileState.directoryHandle = handle ?? null;
  folderFileState.directoryName = handle?.name ?? "";
  fileManager.setDirectory(handle);
}

async function restoreSelectedFolderFile({ askBeforeReplace = false } = {}) {
  const selectedName = folderFileState.selectedFileName ?? readSelectedDataFileName();
  if (!selectedName) return false;
  const entry = folderFiles.find((file) => file.name === selectedName);
  if (!entry) {
    rememberSelectedDataFileName(null);
    return false;
  }
  if (entry.status !== "valid") return false;
  if (fileDirty) {
    if (!askBeforeReplace) return false;
    if (!canReplaceCurrentLevel()) return false;
  }
  return openFolderDataEntry(entry);
}

async function scanFolder({ restoreSelected = false, askBeforeReplace = false } = {}) {
  if (!fileManager.connected) return;
  const scanId = folderFileState.scanId + 1;
  folderFileState.scanId = scanId;
  folderFileState.loading = true;
  folderFileState.error = null;
  renderAll();
  try {
    const files = await fileManager.listFiles({ isCurrent: () => folderFileState.scanId === scanId });
    if (files === null || folderFileState.scanId !== scanId) return;
    folderFiles = files;
    folderFileState.files = files;
    folderFileState.permission = "granted";
    folderFileState.loading = false;
    folderFileState.error = null;
    renderAll();
    if (restoreSelected) await restoreSelectedFolderFile({ askBeforeReplace });
  } catch (error) {
    if (folderFileState.scanId !== scanId) return;
    folderFiles = [];
    folderFileState.files = [];
    folderFileState.loading = false;
    if (error.name === "NotAllowedError") {
      folderFileState.permission = "denied";
      folderFileState.error = `${folderFileState.directoryName} · Cần cấp lại quyền để mở folder.`;
    } else if (error.name === "NotFoundError") {
      folderFileState.permission = "denied";
      folderFileState.error = "Không thể truy cập folder đã lưu. Folder có thể đã bị di chuyển, đổi tên hoặc xóa.";
      fileManager.forgetDirectory().catch((storageError) => console.warn("Không thể xóa folder handle đã lưu", storageError));
      applyFolderHandle(null);
    } else {
      folderFileState.error = `Không thể truy cập folder: ${error.message}`;
    }
    renderAll();
  }
}

elements.chooseFolderBtn.addEventListener("click", async () => {
  try {
    const handle = await fileManager.chooseDirectory();
    applyFolderHandle(handle);
    folderFiles = [];
    folderFileState.files = [];
    folderFileState.permission = "granted";
    folderFileState.error = null;
    await scanFolder({ restoreSelected: true, askBeforeReplace: true });
  }
  catch (error) { if (error.name !== "AbortError") showNotification(elements.toast, error.message); }
});
elements.reconnectFolderBtn.addEventListener("click", async () => {
  try {
    folderFileState.loading = true;
    folderFileState.error = null;
    renderAll();
    folderFileState.permission = await fileManager.requestPermission();
    folderFileState.loading = false;
    if (folderFileState.permission === "granted") await scanFolder({ restoreSelected: true, askBeforeReplace: true });
    else {
      folderFileState.error = `${folderFileState.directoryName} · Người dùng chưa cấp quyền truy cập folder.`;
      renderAll();
    }
  } catch (error) {
    folderFileState.loading = false;
    folderFileState.error = `Không thể reconnect folder: ${error.message}`;
    renderAll();
  }
});
elements.refreshFolderBtn.addEventListener("click", () => scanFolder({ restoreSelected: true, askBeforeReplace: false }));

elements.jsonFileList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-file-action]");
  const row = event.target.closest("[data-file-name]");
  if (!button || !row) return;
  const name = row.dataset.fileName;
  try {
    if (button.dataset.fileAction === "open") {
      const entry = folderFiles.find((file) => file.name === name);
      if (entry?.status !== "valid") {
        showNotification(elements.toast, `Không thể mở ${name}: ${entry?.errorMessage ?? "File JSON không hợp lệ."}`);
        return;
      }
      if (!canReplaceCurrentLevel()) return;
      openFolderDataEntry(entry ?? { name, data: await fileManager.read(name), status: "valid" });
    } else if (button.dataset.fileAction === "save") {
      if (!confirm(`Lưu đè toàn bộ nội dung hiện tại vào ${name}?`)) return;
      const report = validateLevel(editor.data);
      if (!report.exportable) return showNotification(elements.toast, "Không thể lưu đè khi level còn lỗi.");
      await fileManager.write(name, serializeLevel(editor.data));
      editor.data.fileName = name; editor.data.sourceFileName = name; fileDirty = false;
      editor.data.fileDirty = false;
      rememberSelectedDataFileName(name);
      await scanFolder(); showNotification(elements.toast, `Đã lưu đè ${name}`);
    } else if (button.dataset.fileAction === "rename") {
      const proposed = prompt("Tên file mới:", name);
      if (!proposed) return;
      const nextName = normalizeFileName(proposed);
      if (!confirm(`Đổi tên ${name} thành ${nextName}?`)) return;
      if (folderFiles.some((file) => file.name === nextName)) return showNotification(elements.toast, `${nextName} đã tồn tại.`);
      await fileManager.rename(name, nextName);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = nextName; editor.data.fileName = nextName; }
      if (folderFileState.selectedFileName === name) rememberSelectedDataFileName(nextName);
      await scanFolder(); showNotification(elements.toast, `Đã đổi tên thành ${nextName}`);
    } else if (button.dataset.fileAction === "delete") {
      if (!confirm(`Xóa vĩnh viễn file ${name} khỏi ổ đĩa?`)) return;
      await fileManager.remove(name);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = null; fileDirty = true; editor.data.fileDirty = true; }
      if (folderFileState.selectedFileName === name) rememberSelectedDataFileName(null);
      await scanFolder(); showNotification(elements.toast, `Đã xóa ${name}`);
    }
  } catch (error) { showNotification(elements.toast, `Không thể thao tác file: ${error.message}`); }
});

async function restoreSavedFolder() {
  if (!fileManager.supported) {
    folderFileState.permission = "unsupported";
    renderAll();
    return;
  }
  try {
    const handle = await fileManager.restoreDirectory();
    if (!handle) return;
    applyFolderHandle(handle);
    folderFileState.permission = await fileManager.queryPermission();
    renderAll();
    if (folderFileState.permission === "granted") await scanFolder({ restoreSelected: true, askBeforeReplace: false });
  } catch (error) {
    folderFileState.permission = fileManager.connected ? "denied" : "unknown";
    folderFileState.error = `Không thể đọc folder đã lưu: ${error.message}`;
    renderAll();
  }
}

editor.events.on("change", renderAll);
new ResizeObserver(fitBoardToCanvas).observe(elements.canvasArea);
renderAll();
updateZoomUi();
switchTab(["playable", "json"].includes(editor.data.tab) ? editor.data.tab : "level");
restoreSavedFolder();
