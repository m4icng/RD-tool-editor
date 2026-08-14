export function isWinState(state) {
  return state.remainingFruits === 0 && state.inventoryTotal === 0 && state.pendingTruckCapacity === 0;
}
