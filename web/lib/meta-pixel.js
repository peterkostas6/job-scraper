// Meta Pixel helpers. The base code loads in app/layout.js; these send the events
// Meta optimizes ads toward. Calls made before the pixel script finishes loading
// wait for it (up to ~10s) instead of being dropped.
export const META_PIXEL_ID = "1637006874440767";

// eventId matches the server copy (lib/meta-capi.js) so Meta counts the event once.
export function trackMeta(event, params, eventId) {
  if (typeof window === "undefined") return;
  let tries = 0;
  const send = () => {
    if (window.fbq) window.fbq("track", event, params, eventId ? { eventID: eventId } : undefined);
    else if (tries++ < 20) setTimeout(send, 500);
  };
  send();
}
