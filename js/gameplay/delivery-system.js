export function collectFruit(inventory, fruitType) {
  return { ...inventory, [fruitType]: (inventory[fruitType] ?? 0) + 1 };
}

export function deliverToTruck(inventory, truck) {
  const available = inventory[truck.fruitType] ?? 0;
  const delivered = Math.min(available, Number(truck.capacity) || 0);
  return {
    delivered,
    inventory: { ...inventory, [truck.fruitType]: available - delivered },
    complete: delivered === Number(truck.capacity)
  };
}
