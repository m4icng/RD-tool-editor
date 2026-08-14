export function createTruck(fruitType, label, icon, capacity = 3) {
  return { id: `truck-${fruitType}`, kind: "truck", fruitType, label, icon, capacity };
}
