import {buildPushPayload} from '@block65/webcrypto-web-push';

export class PushValidationError extends Error {}
const encodedBytes = (value, length) => {
  try { return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && atob(value.replace(/-/g, '+').replace(/_/g, '/')).length === length; } catch { return false; }
};
export const pushConfigured = env => encodedBytes(env.VAPID_PUBLIC_KEY, 65) && encodedBytes(env.VAPID_PRIVATE_KEY, 32);
export function validateEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new PushValidationError('Ongeldig meldingsadres.'); }
  const host = url.hostname;
  // Push endpoints are supplied by browsers. Never allow this API to fetch
  // arbitrary user URLs, redirects, credentials or internal hosts.
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
    || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
    || host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.href.length > 2048)
    throw new PushValidationError('Dit meldingsadres wordt niet ondersteund.');
  return url.href;
}
export function validateSubscription(value) {
  const endpoint = validateEndpoint(value?.endpoint);
  if (!encodedBytes(value?.keys?.p256dh, 65) || !encodedBytes(value?.keys?.auth, 16)) throw new PushValidationError('Ongeldige meldingssleutels.');
  return {endpoint, keys: {p256dh: value.keys.p256dh, auth: value.keys.auth}};
}
const subscriptionKey = async (reference, endpoint) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `push:${reference}:${hash}`;
};
export async function manageSubscription(store, reference, raw, env) {
  const endpoint = validateEndpoint(raw?.subscription?.endpoint || raw?.endpoint);
  const key = await subscriptionKey(reference, endpoint);
  if (raw.action === 'status') return {subscribed: Boolean(await store.get(key))};
  if (raw.action === 'unsubscribe') { await store.delete(key); return {subscribed: false}; }
  if (raw.action !== 'subscribe') throw new PushValidationError('Ongeldige meldingsactie.');
  if (!pushConfigured(env)) throw new PushValidationError('Telefoonmeldingen zijn nog niet ingesteld.');
  const subscription = validateSubscription(raw.subscription);
  const page = await store.list({prefix: `push:${reference}:`, limit: 6});
  if (page.keys.length >= 5 && !page.keys.some(item => item.name === key)) throw new PushValidationError('Er zijn al vijf toestellen aangemeld.');
  await store.put(key, JSON.stringify(subscription), {expirationTtl: 60 * 60 * 24 * 180});
  return {subscribed: true};
}
export function customerChanged(before, after) {
  return ['currentStep', 'status', 'expectedReady', 'note', 'waxType', 'closedAt', 'paymentRequestedAt', 'paymentPaidAt'].some(key => (before?.[key] || '') !== (after[key] || ''));
}
export async function notifyCustomer(store, record, env) {
  if (!pushConfigured(env)) return {accepted: 0, reason: 'not_configured'};
  const page = await store.list({prefix: `push:${record.reference}:`, limit: 5});
  if (!page.keys.length) return {accepted: 0, reason: 'not_subscribed'};
  const message = {data: JSON.stringify({title: 'Mijn Lattenspecialist', body: 'Er staat een update voor je klaar. Bekijk je onderhoud.', url: `https://lattenspecialist.nl/app.html#klant=${record.customerToken}`}), options: {ttl: 3600}};
  const results = await Promise.all(page.keys.map(async ({name}) => {
    try {
      const subscription = validateSubscription(await store.get(name, 'json'));
      const payload = await buildPushPayload(message, subscription, {subject: 'mailto:info@lattenspecialist.nl', publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY});
      const response = await fetch(subscription.endpoint, {...payload, redirect: 'error', signal: AbortSignal.timeout(8000)});
      if ([404, 410].includes(response.status)) await store.delete(name);
      return response.ok;
    } catch { return false; }
  }));
  const accepted = results.filter(Boolean).length;
  return {accepted, failed: results.length - accepted, reason: accepted ? 'accepted' : 'failed'};
}
