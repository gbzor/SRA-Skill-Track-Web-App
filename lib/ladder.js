// ---------------------------------------------------------------------------
// SRA color-leveling model
// ---------------------------------------------------------------------------
// The SRA is organised into LEVELS (1C, 2A, 2B, 2C, 3A, 3B). Every level is a
// fixed, ordered list of COLORS the reader works through one at a time, from
// the first color to the last.
//
// Rules of the ladder:
//   - Each color has 12 Power Builder sets available (PB_SETS_PER_COLOR).
//   - Only 6 sets with a passing/perfect score are needed (PB_SETS_TO_PASS)
//     before a color's exit test unlocks.
//   - After the 6 passing sets, an "exit color test" advances the reader to the
//     next color in the same level.
//   - At the last color of a level, a "level test" is taken instead. Passing it
//     moves the reader up to the next level; the test's placement result decides
//     which color they start on there.
//
// Everything here is plain data + pure helpers so both the server (authoritative
// progression) and the client (display) share one source of truth.
// ---------------------------------------------------------------------------

// Every color used anywhere in the ladder, with its display hex.
export const COLORS = {
  orange: '#db8447',
  gold:   '#d9b850',
  brown:  '#9c6b4a',
  tan:    '#cbb187',
  lime:   '#a3c644',
  green:  '#6fac6f',
  aqua:   '#4fa8a8',
  blue:   '#5c89c9',
  purple: '#8c5ca8',
  violet: '#9b6fc9',
  rose:   '#c96d8a',
  red:    '#c95c5c',
};

// The levels in climb order. `colors` is the exact working order for that level.
export const LEVELS = [
  { code: '1C', colors: ['orange', 'gold', 'brown', 'tan', 'lime', 'green', 'aqua', 'blue', 'purple', 'violet', 'rose', 'red'] },
  { code: '2A', colors: ['brown', 'lime', 'aqua', 'blue', 'purple', 'violet', 'rose', 'red', 'orange', 'gold'] },
  { code: '2B', colors: ['lime', 'aqua', 'blue', 'purple', 'violet', 'rose', 'red', 'orange', 'gold', 'brown'] },
  { code: '2C', colors: ['aqua', 'blue', 'purple', 'violet', 'rose', 'red', 'orange', 'gold', 'brown', 'tan'] },
  { code: '3A', colors: ['blue', 'purple', 'violet', 'rose', 'red', 'orange', 'gold', 'brown', 'tan', 'lime', 'green'] },
  { code: '3B', colors: ['violet', 'rose', 'red', 'orange', 'gold', 'brown', 'tan', 'lime', 'green', 'purple'] },
];

// Ladder rules.
export const PB_SETS_PER_COLOR = 12; // Power Builder sets available per color
export const PB_SETS_TO_PASS = 6;    // default passing sets needed to unlock the exit test
export const PASS_SCORE = 6;         // a report score (1–10) of 6+ counts as passing/perfect

// SRA programs differ in how many passing Power Builder sets a reader must
// clear before the exit/level test — some require none (test-only). Each reader
// records their own rule at signup; `setsToPass` of 0 means "only a test is
// needed". Normalise any stored/submitted value into the valid range.
export function normalizeSetsToPass(n) {
  const x = Number.isFinite(n) ? Math.trunc(n) : PB_SETS_TO_PASS;
  return Math.max(0, Math.min(PB_SETS_PER_COLOR, x));
}

// The kinds of activity a progress report can record.
export const REPORT_KINDS = ['powerbuilder', 'exit_test', 'level_test'];

export const KIND_LABEL = {
  powerbuilder: 'Power Builder set',
  exit_test: 'Exit color test',
  level_test: 'Level test',
};

const cap = (s) => (typeof s === 'string' && s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function colorName(key) {
  return cap(key) || 'Color';
}

export function colorHex(key) {
  return COLORS[key] || '#8a8175';
}

// Clamp helper shared by the progression math so hostile indexes can never
// point outside a real level/color.
function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

// True/normalised info about one (level, color) position, or null if invalid.
export function stepInfo(levelIdx, colorIdx) {
  const level = LEVELS[levelIdx];
  if (!level) return null;
  const key = level.colors[colorIdx];
  if (!key) return null;
  return {
    levelIdx,
    levelCode: level.code,
    colorIdx,
    colorKey: key,
    name: colorName(key),
    hex: colorHex(key),
    colorsInLevel: level.colors.length,
    isLastColor: colorIdx === level.colors.length - 1,
    isLastLevel: levelIdx === LEVELS.length - 1,
  };
}

// Flattened list of every (level, color) step in climb order. Used by the
// ladder and history views.
export function buildSteps() {
  const steps = [];
  LEVELS.forEach((level, levelIdx) => {
    level.colors.forEach((_key, colorIdx) => {
      steps.push(stepInfo(levelIdx, colorIdx));
    });
  });
  return steps;
}

// How many colors the reader has fully cleared before their current position —
// used for honest "colors cleared" stats and achievements.
export function colorsCleared(levelIdx, colorIdx) {
  const li = clampInt(levelIdx, 0, LEVELS.length - 1);
  let total = 0;
  for (let i = 0; i < li; i += 1) total += LEVELS[i].colors.length;
  return total + clampInt(colorIdx, 0, LEVELS[li].colors.length - 1);
}

// A score at or above the passing threshold.
export function isPassing(score) {
  return Number.isFinite(score) && score >= PASS_SCORE;
}

// ---------------------------------------------------------------------------
// Authoritative progression
// ---------------------------------------------------------------------------
// Given the reader's current position and a *validated* report, return the new
// position plus flags describing what happened. Pure and total: any state that
// doesn't warrant advancement simply returns the position unchanged, so a
// hostile or ill-timed report can never skip the rules.
//
//   progress = { levelIdx, colorIdx, pbPassed }
//   report   = { kind, score, pbCount, placementColorIdx? }
//   setsToPass = the reader's own rule for passing sets needed before a test
//                (0 = test-only). Defaults to the standard 6.
export function advanceProgress(progress, report, setsToPass = PB_SETS_TO_PASS) {
  const needed = normalizeSetsToPass(setsToPass);
  const levelIdx = clampInt(progress.levelIdx, 0, LEVELS.length - 1);
  const level = LEVELS[levelIdx];
  const colorIdx = clampInt(progress.colorIdx, 0, level.colors.length - 1);
  let pbPassed = clampInt(progress.pbPassed, 0, needed);

  const atLastColor = colorIdx === level.colors.length - 1;
  const atLastLevel = levelIdx === LEVELS.length - 1;
  const passed = isPassing(report.score);

  const unchanged = {
    levelIdx, colorIdx, pbPassed,
    passed, colorAdvanced: false, leveledUp: false,
  };

  if (report.kind === 'powerbuilder') {
    // Only passing sets count toward the number needed; cap so it never overruns.
    const gained = passed ? clampInt(report.pbCount, 0, PB_SETS_PER_COLOR) : 0;
    pbPassed = clampInt(pbPassed + gained, 0, needed);
    return { ...unchanged, pbPassed };
  }

  if (report.kind === 'exit_test') {
    // Exit test only advances a color when the required passing sets are done
    // (none, if the reader's rule is test-only), the test is passed, and there's
    // another color left in this level.
    const eligible = pbPassed >= needed && passed && !atLastColor;
    if (!eligible) return unchanged;
    return {
      levelIdx,
      colorIdx: colorIdx + 1,
      pbPassed: 0,
      passed,
      colorAdvanced: true,
      leveledUp: false,
    };
  }

  if (report.kind === 'level_test') {
    // Level test belongs at the last color of a level. Passing it moves the
    // reader up; the placement result picks their starting color.
    const eligible = atLastColor && !atLastLevel && pbPassed >= needed && passed;
    if (!eligible) return unchanged;
    const nextLevel = LEVELS[levelIdx + 1];
    const placeIdx = clampInt(report.placementColorIdx, 0, nextLevel.colors.length - 1);
    return {
      levelIdx: levelIdx + 1,
      colorIdx: placeIdx,
      pbPassed: 0,
      passed,
      colorAdvanced: true,
      leveledUp: true,
    };
  }

  return unchanged;
}

// XP is display-only flavour, recomputed server-side from the report so the
// client can never inflate it.
export function reportXp({ kind, pbCount, score }) {
  if (kind === 'powerbuilder') {
    return Math.round(clampInt(pbCount, 0, PB_SETS_PER_COLOR) * (clampInt(score, 1, 10) / 10) * 15);
  }
  // Tests: a flat reward, larger when passed.
  return isPassing(score) ? 100 : 20;
}
