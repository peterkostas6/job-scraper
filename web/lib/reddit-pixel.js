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
