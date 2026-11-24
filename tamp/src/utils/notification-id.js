const MAX_NOTIFICATION_ID = 2_147_483_647;

/** Crea IDs consecutivos para que avisos simultáneos no se reemplacen. */
export function createNotificationIdGenerator(seed = Date.now()) {
  let current = Math.max(0, Math.trunc(Number(seed) || 0)) % MAX_NOTIFICATION_ID;

  return () => {
    current = current >= MAX_NOTIFICATION_ID ? 1 : current + 1;
    return current;
  };
}
