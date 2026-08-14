export const FRUIT_ITEM_IDS = Object.freeze({
  apple: 1,
  banana: 2,
  grape: 3,
  eggplant: 4
});

export function createFruit(fruitType, label, icon) {
  return { id: FRUIT_ITEM_IDS[fruitType] ?? String(fruitType), kind: "fruit", category: "item", fruitType, label, icon };
}
