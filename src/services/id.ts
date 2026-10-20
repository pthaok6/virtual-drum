let fallbackCounter = 0;

/** Generate an ID even in mobile browsers without crypto.randomUUID support. */
export function createId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);

  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `id-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${randomPart}`;
}
