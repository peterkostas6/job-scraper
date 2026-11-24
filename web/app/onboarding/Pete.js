// Pete, the app's mascot: a coral resume page. mood: "smile" (default), "happy" (eyes closed,
// open mouth, arms up) or "lock" (holding a padlock, for the paywall).
export default function Pete({ size = 64, mood = "smile", wave = false }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 170 190" aria-hidden="true" className="ob-pete">
      <path d="M30 18 Q30 8 40 8 H112 L142 38 V158 Q142 168 132 168 H40 Q30 168 30 158 Z" fill="#FF6B5B" />
      <path d="M112 8 V30 Q112 38 120 38 H142 Z" fill="#D9483A" />
      {mood === "happy" ? (
        <>
          <path d="M56 70 Q66 58 76 70" stroke="#14213D" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M94 70 Q104 58 114 70" stroke="#14213D" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M66 86 Q85 112 104 86 Z" fill="#14213D" />
          <path d="M30 104 Q8 84 14 56" stroke="#FF6B5B" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M142 104 Q162 84 156 56" stroke="#FF6B5B" strokeWidth="10" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="66" cy="68" rx="9" ry="11" fill="#14213D" />
          <ellipse cx="104" cy="68" rx="9" ry="11" fill="#14213D" />
          <circle cx="69" cy="64" r="3" fill="#fff" />
          <circle cx="107" cy="64" r="3" fill="#fff" />
          <path d="M72 88 Q85 100 98 88" stroke="#14213D" strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="52" cy="88" rx="7" ry="4" fill="#ffb3a9" />
          <ellipse cx="118" cy="88" rx="7" ry="4" fill="#ffb3a9" />
        </>
      )}
      {mood === "lock" && (
        <>
          <rect x="58" y="112" width="56" height="44" rx="8" fill="#14213D" />
          <path d="M70 112 V100 Q70 88 86 88 Q102 88 102 100 V112" stroke="#14213D" strokeWidth="8" fill="none" />
          <circle cx="86" cy="132" r="6" fill="#FF6B5B" />
        </>
      )}
      {mood === "smile" && (
        <>
          <rect x="48" y="112" width="76" height="7" rx="3.5" fill="#F4EDE0" opacity="0.55" />
          <rect x="48" y="126" width="56" height="7" rx="3.5" fill="#F4EDE0" opacity="0.55" />
          <rect x="48" y="140" width="66" height="7" rx="3.5" fill="#F4EDE0" opacity="0.55" />
        </>
      )}
      {wave && <path className="ob-wave" d="M30 110 Q12 96 18 78" stroke="#FF6B5B" strokeWidth="10" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
