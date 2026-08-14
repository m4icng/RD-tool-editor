export function createEmptyTray() {
  return {
    id: "tray-empty",
    kind: "tray",
    category: "item",
    label: "Khay chứa",
    icon: "🧺",
    capacity: 9,
    trayPosition: null,
    trayLayers: []
  };
}
