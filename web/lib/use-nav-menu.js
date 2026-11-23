import { useEffect } from "react";

// Phone menu sheet: while open, the page behind can't scroll and Escape closes it.
export function useNavMenuLock(open, close) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Phones: pull down at the top of the page to refresh (the gesture every feed app uses).
// Shows a small "Release to refresh" pill while pulling; calls onRefresh past 70px.
export function usePullToRefresh(enabled, onRefresh) {
  useEffect(() => {
    if (!enabled || !window.matchMedia("(max-width: 900px)").matches) return;
    let startY = null, pull = 0;
    const pill = document.createElement("div");
    pill.className = "ptr";
    document.body.appendChild(pill);
    const show = () => {
      pill.style.transform = `translate(-50%, ${Math.min(pull, 90) - 50}px)`;
      pill.style.opacity = String(Math.min(pull / 70, 1));
      pill.textContent = pull > 70 ? "Release to refresh" : "Pull to refresh";
    };
    const start = (e) => { startY = window.scrollY <= 0 && !document.querySelector(".mfs-wrap, .acct-wrap, .modal-overlay") ? e.touches[0].clientY : null; pull = 0; };
    const move = (e) => { if (startY === null) return; pull = Math.max(0, (e.touches[0].clientY - startY) * 0.5); show(); };
    const end = () => {
      if (startY !== null && pull > 70) {
        pill.textContent = "Refreshing…";
        onRefresh();
        setTimeout(() => { pill.style.opacity = "0"; pill.style.transform = "translate(-50%, -50px)"; }, 900);
      } else { pill.style.opacity = "0"; pill.style.transform = "translate(-50%, -50px)"; }
      startY = null; pull = 0;
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      pill.remove();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
