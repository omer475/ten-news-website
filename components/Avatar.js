// components/Avatar.js
// Playful, self-contained SVG avatar engine for Today+.
// No external services — every avatar is drawn inline from a small config:
//   { color, face, accessory }  (all integer indices)
// Used on the landing page, in signup ("pick your reader"), and the account menu.

// Bright, friendly palette. Each entry is a 2-stop gradient for the avatar's "head".
export const AVATAR_COLORS = [
  { id: 'rose',   from: '#FF6B8A', to: '#F43F5E' },
  { id: 'amber',  from: '#FFB14E', to: '#F97316' },
  { id: 'sun',    from: '#FFD75E', to: '#EAB308' },
  { id: 'mint',   from: '#5BE5A0', to: '#16A34A' },
  { id: 'teal',   from: '#4FD7D2', to: '#0D9488' },
  { id: 'sky',    from: '#5BB8FF', to: '#0EA5E9' },
  { id: 'indigo', from: '#8B9CFF', to: '#6366F1' },
  { id: 'violet', from: '#B98BFF', to: '#8B5CF6' },
  { id: 'pink',   from: '#FF8BD3', to: '#EC4899' },
  { id: 'slate',  from: '#9CA8BD', to: '#475569' },
];

// Face = a pair of (eyes, mouth) expressions. Index picks one personality.
export const FACE_COUNT = 6;
// Accessory = optional flair drawn on top. 0 = none.
export const ACCESSORY_COUNT = 6;

const clamp = (n, len) => ((n % len) + len) % len;

// Deterministic avatar from any string seed (e.g. an email or name).
export function avatarFromSeed(seed = '') {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  return {
    color: h % AVATAR_COLORS.length,
    face: Math.floor(h / 7) % FACE_COUNT,
    accessory: Math.floor(h / 53) % ACCESSORY_COUNT,
  };
}

export function normalizeAvatar(a) {
  if (!a || typeof a !== 'object') return { color: 0, face: 0, accessory: 0 };
  return {
    color: clamp(a.color | 0, AVATAR_COLORS.length),
    face: clamp(a.face | 0, FACE_COUNT),
    accessory: clamp(a.accessory | 0, ACCESSORY_COUNT),
  };
}

// ---- Face drawings (eyes + mouth) ----
function Eyes({ face, ink }) {
  switch (face) {
    case 0: // round, friendly
      return (
        <g fill={ink}>
          <circle cx="40" cy="52" r="6" />
          <circle cx="60" cy="52" r="6" />
        </g>
      );
    case 1: // happy squint
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
          <path d="M34 54 Q40 47 46 54" />
          <path d="M54 54 Q60 47 66 54" />
        </g>
      );
    case 2: // wink
      return (
        <g>
          <circle cx="40" cy="52" r="6" fill={ink} />
          <path d="M54 53 Q60 47 66 53" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case 3: // sparkle / curious
      return (
        <g fill={ink}>
          <circle cx="40" cy="52" r="6.5" />
          <circle cx="60" cy="52" r="6.5" />
          <circle cx="42.5" cy="49.5" r="1.8" fill="#fff" />
          <circle cx="62.5" cy="49.5" r="1.8" fill="#fff" />
        </g>
      );
    case 4: // chill, half-closed
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
          <path d="M33 52 L47 52" />
          <path d="M53 52 L67 52" />
        </g>
      );
    default: // 5: wide-awake
      return (
        <g>
          <circle cx="40" cy="52" r="7" fill="#fff" />
          <circle cx="60" cy="52" r="7" fill="#fff" />
          <circle cx="41" cy="53" r="3.4" fill={ink} />
          <circle cx="61" cy="53" r="3.4" fill={ink} />
        </g>
      );
  }
}

function Mouth({ face, ink }) {
  switch (face) {
    case 0: return <path d="M40 66 Q50 74 60 66" fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />;
    case 1: return <path d="M38 66 Q50 80 62 66" fill={ink} />;
    case 2: return <path d="M42 67 Q50 73 58 67" fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />;
    case 3: return <circle cx="50" cy="69" r="5" fill={ink} />;
    case 4: return <path d="M42 68 L58 68" fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />;
    default: return <path d="M40 65 Q50 77 60 65" fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />;
  }
}

// ---- Accessories (drawn over the face) ----
function Accessory({ accessory, ink, accent }) {
  switch (accessory) {
    case 1: // round glasses
      return (
        <g fill="none" stroke={ink} strokeWidth="3.5">
          <circle cx="40" cy="52" r="10" />
          <circle cx="60" cy="52" r="10" />
          <path d="M48 49 Q50 47 52 49" strokeLinecap="round" />
          <path d="M30 50 L24 47" strokeLinecap="round" />
          <path d="M70 50 L76 47" strokeLinecap="round" />
        </g>
      );
    case 2: // headphones
      return (
        <g>
          <path d="M26 50 Q50 22 74 50" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <rect x="20" y="48" width="11" height="20" rx="5" fill={ink} />
          <rect x="69" y="48" width="11" height="20" rx="5" fill={ink} />
        </g>
      );
    case 3: // little cap brim
      return (
        <g>
          <path d="M24 36 Q50 16 76 36 L76 40 L24 40 Z" fill={ink} />
          <rect x="20" y="38" width="36" height="6" rx="3" fill={ink} />
        </g>
      );
    case 4: // sunglasses (filled)
      return (
        <g fill={ink}>
          <rect x="28" y="46" width="18" height="12" rx="5" />
          <rect x="54" y="46" width="18" height="12" rx="5" />
          <rect x="46" y="50" width="8" height="3" />
        </g>
      );
    case 5: // bolt / spark above head
      return (
        <path d="M52 18 L44 32 L51 32 L47 44 L60 28 L52 28 Z" fill={accent} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      );
    default:
      return null;
  }
}

// Main avatar renderer. `config` = { color, face, accessory }.
export default function Avatar({ config, size = 64, ring = false, style }) {
  const a = normalizeAvatar(config);
  const c = AVATAR_COLORS[a.color];
  const gid = `av-${a.color}-${a.face}-${a.accessory}`;
  const ink = 'rgba(20,16,30,0.82)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block', borderRadius: '50%', flexShrink: 0, ...style }}
      role="img"
      aria-label="avatar"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
        <radialGradient id={`${gid}-sheen`} cx="0.35" cy="0.28" r="0.8">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gid})`} />
      <circle cx="50" cy="50" r="50" fill={`url(#${gid}-sheen)`} />
      <Eyes face={a.face} ink={ink} />
      <Mouth face={a.face} ink={ink} />
      <Accessory accessory={a.accessory} ink={ink} accent="#FFD75E" />
      {ring && <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />}
    </svg>
  );
}
