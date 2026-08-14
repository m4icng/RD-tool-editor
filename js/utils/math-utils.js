export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function samePosition(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}
