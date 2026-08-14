export function createObstacle(type = "rock", label = "Chướng ngại", icon = "🪨") {
  return { id: `obstacle-${type}`, kind: "obstacle", obstacleType: type, label, icon };
}
