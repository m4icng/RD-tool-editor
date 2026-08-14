import { DIRECTIONS } from "../core/constants.js";

export function nextPosition(position, direction) {
  const vector = DIRECTIONS[direction];
  if (!vector) throw new Error(`Hướng không hợp lệ: ${direction}`);
  return { x: position.x + vector.x, y: position.y + vector.y };
}

export function moveSnake(snake, direction) {
  const head = nextPosition(snake.body[0], direction);
  return { ...snake, direction, body: [head, ...snake.body.slice(0, -1)] };
}

export function growSnake(snake, position) {
  return { ...snake, body: [...snake.body, structuredClone(position)] };
}
