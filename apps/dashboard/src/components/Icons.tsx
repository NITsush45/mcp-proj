/**
 * Hand-drawn icon set — stroke-based, rounded caps, slightly imperfect curves.
 * Deliberately NOT geometric-perfect: a touch of wobble reads as "made by a person",
 * not churned out by a machine. All icons share a 24×24 viewBox and 1.7 stroke.
 */

type P = { size?: number; className?: string; strokeWidth?: number };

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* Overview — four soft tiles, not a rigid grid */
export const IconGrid = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M3.6 4.2c0-.5.3-.7.8-.7h4c.4 0 .7.3.7.8v4.2c0 .5-.3.8-.8.8H4.3c-.4 0-.7-.3-.7-.8Z" />
    <path d="M14.9 3.7c.4 0 .7.3.7.8v4.1c0 .5-.3.8-.8.8h-4c-.5 0-.8-.3-.8-.8V4.4c0-.4.3-.8.8-.8Z" />
    <path d="M3.7 14.6c0-.4.3-.7.8-.7h4c.4 0 .7.3.7.8v4c0 .4-.3.7-.8.7h-4c-.4 0-.7-.3-.7-.8Z" />
    <path d="M14.6 13.9c.4 0 .8.3.8.8v4.1c0 .4-.3.7-.8.7h-4c-.4 0-.7-.3-.7-.8v-4c0-.4.3-.8.8-.8Z" />
  </svg>
);

/* MCP Servers — stacked plates, gently off-kilter */
export const IconStack = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M12 3.4 21 8l-9 4.6L3 8Z" />
    <path d="M3.4 12.2 12 16.6l8.6-4.4" />
    <path d="M3.4 16.3 12 20.7l8.6-4.4" />
  </svg>
);

/* Team — two people, one a little smaller */
export const IconPeople = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M8.8 11.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M3.5 19.4c0-2.6 2.4-4.3 5.3-4.3s5.3 1.7 5.3 4.3" />
    <path d="M16.4 5.3a2.4 2.4 0 0 1 0 4.7" />
    <path d="M17.6 15.4c2 .5 3.2 1.8 3.2 3.6" />
  </svg>
);

/* API Keys — a little skeleton key */
export const IconKey = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="7.7" cy="8.2" r="3.7" />
    <path d="M10.4 10.8 20 20" />
    <path d="M16.6 15.7l2-2" />
    <path d="M18.8 18l1.7-1.7" />
  </svg>
);

/* Audit — a page with ruled lines and a folded corner */
export const IconScroll = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M6 3.7h8.2L19 8.4V20a.6.6 0 0 1-.6.6H6a.6.6 0 0 1-.6-.6V4.3A.6.6 0 0 1 6 3.7Z" />
    <path d="M13.9 3.9v4.3h4.4" />
    <path d="M8.3 12.5h7" />
    <path d="M8.3 15.6h4.7" />
  </svg>
);

/* Chat Agent — a bubble with a little spark inside */
export const IconChat = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M20.4 11.3c0 4-3.8 7.2-8.4 7.2-.9 0-1.8-.1-2.6-.35L4.6 19.6l1-3.5C4.2 14.8 3.6 13.1 3.6 11.3 3.6 7.3 7.4 4.1 12 4.1s8.4 3.2 8.4 7.2Z" />
    <path d="M9.4 10.6h.01" />
    <path d="M12 10.6h.01" />
    <path d="M14.6 10.6h.01" />
  </svg>
);

/* Settings — a gear, but softer and less robotic */
export const IconCog = ({ size = 20, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.9v2.3M12 18.8v2.3M4.6 7.2l2 1.2M17.4 15.6l2 1.2M4.6 16.8l2-1.2M17.4 8.4l2-1.2" />
  </svg>
);

/* The Urumi mark — an anchor/quill-ish monogram, drawn once, reused */
export const UrumiMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2.5c-3.6 2.3-5.6 5.3-5.6 8.6 0 3 1.7 5.4 4.2 6.4-.3-1.6-.1-3.2.7-4.6 1 1.7 2.6 2.7 4.4 2.9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M4 20.2c1.6-1.2 3.2-1.7 4.8-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12.5 20.2c1.6.2 3.2-.2 4.7-1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
