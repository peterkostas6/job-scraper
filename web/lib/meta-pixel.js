// Meta Pixel helpers. The base code loads in app/layout.js; these send the events
// Meta optimizes ads toward. Calls made before the pixel script finishes loading
// wait for it (up to ~10s) instead of being dropped.
export const META_PIXEL_ID = "1637006874440767";

export function trackMeta(event, params) {
  if (typeof window === "undefined") return;
  let tries = 0;
  const send = () => {
    if (window.fbq) window.fbq("track", event, params);
    else if (tries++ < 20) setTimeout(send, 500);
  };
  send();
}
