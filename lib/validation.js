import { z } from 'zod';
import { LEVELS, PB_SETS_PER_COLOR, REPORT_KINDS } from './ladder';

// Widest color list across all levels — the outer bound for any color index.
// Per-level bounds are enforced against the real level in the API/refinements.
const MAX_COLORS = Math.max(...LEVELS.map((l) => l.colors.length));

// Number of colors in a level, or 0 for an out-of-range level index. Refinements
// run even when a prior field check only marked the value "dirty" (e.g. an
// out-of-range levelIdx), so indexing LEVELS directly could throw and turn a
// clean 400 into an unhandled 500 — this keeps the lookup total and safe.
const colorsInLevel = (levelIdx) => LEVELS[levelIdx]?.colors.length ?? 0;

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .refine(
      (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s),
      'Password must include upper, lower, and a digit',
    ),
  name: z.string().trim().min(1).max(80).optional(),
  // Starting ladder position. Defaults to 1C, first color, zero passing sets,
  // but a returning reader can record where they actually are.
  levelIdx: z.number().int().min(0).max(LEVELS.length - 1),
  colorIdx: z.number().int().min(0).max(MAX_COLORS - 1),
  // The reader's advancement rule: passing sets needed before a test
  // (0 = test-only), and how many they've already cleared in the current color.
  setsToPass: z.number().int().min(0).max(PB_SETS_PER_COLOR),
  pbPassed: z.number().int().min(0).max(PB_SETS_PER_COLOR),
})
  .strict()
  // colorIdx must be valid for the chosen level — reject anything pointing past
  // that level's real color list.
  .refine((d) => d.colorIdx < colorsInLevel(d.levelIdx), {
    message: 'Color is not valid for that level',
    path: ['colorIdx'],
  })
  // Can't have already cleared more sets than the rule requires.
  .refine((d) => d.pbPassed <= d.setsToPass, {
    message: 'Passing sets cannot exceed the sets required',
    path: ['pbPassed'],
  });

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

// Every field the client sends for a report. XP and pass/fail are recomputed
// server-side, so they are not accepted here.
//   score = "how well did you understand it?" (1–10; 6+ is passing/perfect)
//   rate  = "how fast could you read and answer?" (1–10)
//   kind  = powerbuilder | exit_test | level_test
//   pbCount           = # of Power Builder sets in this report (tests send 0)
//   placementColorIdx = for a level test, the color placed at in the next level
export const ReportSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  kind: z.enum(REPORT_KINDS),
  levelIdx: z.number().int().min(0).max(LEVELS.length - 1),
  colorIdx: z.number().int().min(0).max(MAX_COLORS - 1),
  pbCount: z.number().int().min(0).max(PB_SETS_PER_COLOR),
  score: z.number().int().min(1).max(10),
  rate: z.number().int().min(1).max(10),
  placementColorIdx: z.number().int().min(0).max(MAX_COLORS - 1).optional(),
})
  .strict()
  .refine((d) => d.colorIdx < colorsInLevel(d.levelIdx), {
    message: 'Color is not valid for that level',
    path: ['colorIdx'],
  })
  // A Power Builder report logs at least one set; a test logs none.
  .refine((d) => (d.kind === 'powerbuilder' ? d.pbCount >= 1 : d.pbCount === 0), {
    message: 'Power Builder count does not match the report kind',
    path: ['pbCount'],
  })
  // A level test must name a valid placement color in the *next* level.
  .refine(
    (d) =>
      d.kind !== 'level_test' ||
      (d.levelIdx < LEVELS.length - 1 &&
        d.placementColorIdx !== undefined &&
        d.placementColorIdx < colorsInLevel(d.levelIdx + 1)),
    { message: 'A valid next-level placement is required', path: ['placementColorIdx'] },
  );

const STRONG_PASSWORD = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .refine(
    (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s),
    'Password must include upper, lower, and a digit',
  );

export const DeleteAccountSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
  })
  .strict();

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: STRONG_PASSWORD.optional(),
  })
  .strict()
  .refine(
    (d) => d.name !== undefined || d.newPassword !== undefined,
    { message: 'Nothing to update' },
  )
  .refine(
    (d) => !d.newPassword || (d.currentPassword && d.currentPassword.length > 0),
    { message: 'Current password is required to change password', path: ['currentPassword'] },
  );
