export function renderObjectPalette(container, objects, selectedId, { emptyLabel = "Chưa có object trong nhóm này.", unavailableIds = [] } = {}) {
  container.innerHTML = "";
  if (objects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = emptyLabel;
    container.appendChild(empty);
    return;
  }
  const unavailable = new Set(unavailableIds);
  objects.forEach((object) => {
    const button = document.createElement("button");
    button.type = "button";
    const isUnavailable = unavailable.has(object.id);
    button.className = `asset-btn${String(object.id) === String(selectedId) ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    button.dataset.asset = object.id;
    button.dataset.tooltip = `ID: ${object.id}${isUnavailable ? " · Đã có trên map" : ""}`;
    button.title = button.dataset.tooltip;
    button.setAttribute("aria-label", `${object.label}. ID: ${object.id}${isUnavailable ? ". Đã có trên map" : ""}`);
    if (isUnavailable) button.setAttribute("aria-disabled", "true");
    button.innerHTML = `<span class="asset-icon"></span><span></span>`;
    button.firstElementChild.textContent = object.icon;
    button.lastElementChild.textContent = object.label;
    container.appendChild(button);
  });
}
