let sequence = 0;

export function createId(prefix = "id") {
  sequence += 1;
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${sequence}`;
  return `${prefix}-${randomPart}`;
}
