export function resolveNotificationActivation({
  permissionGranted,
  pushRegistered = false,
  fallbackAvailable = false,
}) {
  if (!permissionGranted) return { ok: false, push: false, fallback: false, reason: 'permission' };
  if (pushRegistered) return { ok: true, push: true, fallback: false, reason: null };
  if (fallbackAvailable) return { ok: true, push: false, fallback: true, reason: 'push_unavailable' };
  return { ok: false, push: false, fallback: false, reason: 'delivery_unavailable' };
}

export async function registerPushSubscription(subscription, { getSession, fetchImpl }) {
  let session;
  try {
    ({ data: { session } } = await getSession());
  } catch {
    return { ok: false, reason: 'network', status: null };
  }
  if (!session?.access_token) return { ok: false, reason: 'session', status: null };

  try {
    const response = await fetchImpl('/api/push?action=subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription }),
    });
    return response.ok
      ? { ok: true, reason: null }
      : { ok: false, reason: 'server', status: response.status };
  } catch {
    return { ok: false, reason: 'network', status: null };
  }
}
