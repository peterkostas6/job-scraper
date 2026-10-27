// Reddit Pixel helpers. The base code loads in app/layout.js. Calls made before the
// pixel script finishes loading wait for it (up to ~10s) instead of being dropped.
export const REDDIT_PIXEL_ID = "a2_jqnjxwxcx03w";

export function trackReddit(event, params) {
  if (typeof window === "undefined") return;
  let tries = 0;
  const send = () => {
    if (window.rdt) window.rdt("track", event, params);
    else if (tries++ < 20) setTimeout(send, 500);
  };
  send();
}

// Advanced matching: tells the pixel who a signed-in visitor is, so Reddit can tie their
// events to a Reddit account. Sent as SHA-256 hashes, the same ones the Conversions API sends.
export async function setRedditMatchKeys({ email, externalId }) {
  if (typeof window === "undefined" || !window.crypto?.subtle) return;
  const hash = async (v) => {
    const bytes = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(v).trim().toLowerCase()));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  };
  const keys = {};
  if (email) keys.email = await hash(email);
  if (externalId) keys.externalId = await hash(externalId);
  if (window.rdt && Object.keys(keys).length) window.rdt("init", REDDIT_PIXEL_ID, keys);
}
