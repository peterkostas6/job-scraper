"use client";

import { useState, useEffect, useRef } from "react";

// Homepage "How it works": the 45-second product video. It plays (muted) as soon as it
// scrolls into view and pauses when it leaves; the button turns the sound on and off.
// People who prefer reduced motion get the poster and a play button instead of autoplay.

export default function HowItWorksDemo() {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduceMotion(reduce);
    if (reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.5 }
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) video.play().catch(() => {});
  }

  return (
    <section className="hiw" aria-labelledby="hiw-title">
      <p className="hiw-eyebrow">How it works</p>
      <h2 className="hiw-title" id="hiw-title">From the bank&rsquo;s API to your phone.</h2>
      <p className="hiw-intro">
        Every analyst and intern posting in one place, pulled straight from the banks&rsquo; own career
        APIs, and a text the second a role that matches you goes live.
      </p>

      <div className="hiw-video-wrap">
        <video
          ref={videoRef}
          className="hiw-video"
          src="/how-it-works.mp4"
          poster="/how-it-works-poster.jpg"
          width={1920}
          height={1080}
          muted
          loop
          playsInline
          preload="metadata"
          controls={reduceMotion}
        >
          Your browser can&rsquo;t play this video.
        </video>
        <button
          type="button"
          className="hiw-sound"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
          <span>{muted ? "Sound off" : "Sound on"}</span>
        </button>
      </div>
    </section>
  );
}
