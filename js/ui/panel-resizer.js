import { clamp } from "../utils/math-utils.js";

const PANEL_LAYOUT_STORAGE_KEY = "snacky-editor-panel-layout-v1";

function loadPanelLayout() {
  try { return JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function savePanelLayout(layout) {
  try { localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); }
  catch { /* Layout persistence is optional. */ }
}

function setupPanelResizer(config, savedLayout, onLayoutChange) {
  const { handle, target, variable, storageKey, axis, direction, measure, bounds } = config;
  if (!handle || !target) return null;
  let current = Number(savedLayout[storageKey]);
  let drag = null;

  const getBounds = () => {
    const result = bounds();
    return { min: Math.round(result.min), max: Math.max(Math.round(result.min), Math.round(result.max)) };
  };
  const apply = (value, { persist = false } = {}) => {
    const limits = getBounds();
    current = clamp(Math.round(Number(value) || measure()), limits.min, limits.max);
    target.style.setProperty(variable, `${current}px`);
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(current));
    if (persist) onLayoutChange(storageKey, current);
    return current;
  };
  const reset = () => {
    current = measure();
    target.style.removeProperty(variable);
    handle.removeAttribute("aria-valuenow");
    onLayoutChange(storageKey, null);
  };

  if (Number.isFinite(current) && window.innerWidth > 760) apply(current);

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || window.innerWidth <= 760) return;
    event.preventDefault();
    current = measure();
    drag = { pointerId: event.pointerId, start: axis === "x" ? event.clientX : event.clientY, value: current };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointer = axis === "x" ? event.clientX : event.clientY;
    apply(drag.value + ((pointer - drag.start) * direction));
  });
  const finish = (event) => {
    if (!drag || (event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
    if (handle.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
    drag = null;
    handle.classList.remove("dragging");
    apply(current, { persist: true });
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("dblclick", reset);
  handle.addEventListener("keydown", (event) => {
    const negativeKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
    const positiveKey = axis === "x" ? "ArrowRight" : "ArrowDown";
    if (![negativeKey, positiveKey, "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      reset();
      return;
    }
    const delta = event.key === negativeKey ? -20 : 20;
    apply((Number.isFinite(current) ? current : measure()) + (delta * direction), { persist: true });
  });

  return { refresh: () => window.innerWidth > 760 && apply(Number.isFinite(current) ? current : measure()) };
}

export function initPanelResizers() {
  const app = document.querySelector(".app");
  const sidebar = document.querySelector(".sidebar");
  const workspace = document.getElementById("levelWorkspace");
  const rightRail = workspace?.querySelector(".right-rail");
  const trayCard = rightRail?.querySelector(".tray-card");
  const playableWorkspace = document.getElementById("playableWorkspace");
  const playableHud = playableWorkspace?.querySelector(".playable-hud");
  const savedLayout = loadPanelLayout();
  const updateSavedLayout = (key, value) => {
    if (value === null) delete savedLayout[key];
    else savedLayout[key] = value;
    savePanelLayout(savedLayout);
  };

  const resizers = [
    setupPanelResizer({
      handle: document.getElementById("sidebarResizeHandle"), target: app, variable: "--sidebar-width", storageKey: "sidebar", axis: "x", direction: 1,
      measure: () => sidebar.getBoundingClientRect().width,
      bounds: () => ({ min: 210, max: Math.min(420, window.innerWidth * .38) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("workspaceResizeHandle"), target: workspace, variable: "--right-rail-width", storageKey: "editorRail", axis: "x", direction: -1,
      measure: () => rightRail.getBoundingClientRect().width,
      bounds: () => ({ min: 250, max: Math.min(560, workspace.getBoundingClientRect().width * .52) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("rightRailResizeHandle"), target: rightRail, variable: "--tray-pane-height", storageKey: "trayHeight", axis: "y", direction: 1,
      measure: () => trayCard.getBoundingClientRect().height,
      bounds: () => ({ min: 150, max: Math.max(150, rightRail.getBoundingClientRect().height - 137) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("playableResizeHandle"), target: playableWorkspace, variable: "--playable-hud-width", storageKey: "playableHud", axis: "x", direction: -1,
      measure: () => playableHud.getBoundingClientRect().width,
      bounds: () => ({ min: 250, max: Math.min(560, playableWorkspace.getBoundingClientRect().width * .52) })
    }, savedLayout, updateSavedLayout)
  ].filter(Boolean);

  window.addEventListener("resize", () => resizers.forEach((resizer) => resizer.refresh()));
  return resizers;
}
