// The 9 SRA color levels, in order from lowest (rung 1) to highest (rung 9).
export const LADDER = [
  { code: '1C', name: 'Rose',   hex: '#c96d8a' },
  { code: '1B', name: 'Red',    hex: '#c95c5c' },
  { code: '1A', name: 'Orange', hex: '#db8447' },
  { code: '2C', name: 'Gold',   hex: '#d9b850' },
  { code: '2B', name: 'Green',  hex: '#6fac6f' },
  { code: '2A', name: 'Olive',  hex: '#7d8a45' },
  { code: '3C', name: 'Aqua',   hex: '#4fa8a8' },
  { code: '3B', name: 'Blue',   hex: '#5c89c9' },
  { code: '3A', name: 'Purple', hex: '#8c5ca8' },
];

// Rough estimate: number of Power Builders to clear one color level.
// Used only to translate the user's "PBs remaining until next color"
// signup answer into a starting XP value for the home screen.
export const PB_PER_COLOR = 20;
export const XP_PER_LEVEL = 500;

export function xpFromPbToNext(pbToNext) {
  const xpPerPb = XP_PER_LEVEL / PB_PER_COLOR;
  const xp = (PB_PER_COLOR - pbToNext) * xpPerPb;
  return Math.max(0, Math.min(XP_PER_LEVEL, Math.round(xp)));
}
