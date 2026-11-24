/**
 * Run both sides of an explicit refresh independently: failure to read this
 * device must not prevent asking the partner's device for a fresh location.
 */
export async function performLocationRefresh({ updateOwn, requestPartner }) {
  const ownPromise = Promise.resolve().then(updateOwn).catch(error => ({
    updated: false,
    reason: error?.message || 'location-unavailable',
  }));
  const partnerPromise = requestPartner
    ? Promise.resolve().then(requestPartner).then(response => ({
      requested: Number(response?.data?.sent ?? response?.sent) > 0,
      requestError: '',
    })).catch(error => ({
      requested: false,
      requestError: error?.message || 'request-failed',
    }))
    : Promise.resolve({ requested: false, requestError: '' });
  const [ownResult, partnerResult] = await Promise.all([ownPromise, partnerPromise]);

  const ownUpdated = ownResult?.updated === true;
  return {
    ok: ownUpdated || partnerResult.requested,
    requested: partnerResult.requested,
    ownUpdated,
    location: ownUpdated ? ownResult.location || null : null,
    reason: ownUpdated ? '' : ownResult?.reason || 'location-unavailable',
    requestError: partnerResult.requestError,
  };
}
