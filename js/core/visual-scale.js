export const VISUAL_SCALE = Object.freeze({
  fruit: 0.72,
  mysteryFruit: 0.72,
  bridge: 0.9,
  gate: 0.75,
  tunnel: 0.78,
  oneWayArrow: 0.6,
  barrier: 0.85,
  spawn: 0.7,
  priorityPoint: 0.5,
  tray: 0.72,
  deliverPoint: 0.28
});

const CSS_VARIABLES = Object.freeze({
  fruit: "--visual-fruit",
  mysteryFruit: "--visual-mystery-fruit",
  bridge: "--visual-bridge",
  gate: "--visual-gate",
  tunnel: "--visual-tunnel",
  oneWayArrow: "--visual-one-way",
  barrier: "--visual-barrier",
  spawn: "--visual-spawn",
  priorityPoint: "--visual-priority-point",
  tray: "--visual-tray",
  deliverPoint: "--visual-deliver-point"
});

export function applyVisualScaleConfig(container) {
  Object.entries(CSS_VARIABLES).forEach(([key, variable]) => {
    container.style.setProperty(variable, `${VISUAL_SCALE[key] * 100}%`);
  });
}
