import { z } from 'zod';

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
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

// XP is recomputed server-side from pb + score, so we don't accept it from the client.
export const ReportSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  pb: z.number().int().min(1).max(40),
  score: z.number().int().min(0).max(100),
  rate: z.number().int().min(50).max(800),
  colorIdx: z.number().int().min(0).max(8),
}).strict();

export function computeReportXp({ pb, score }) {
  return Math.round(pb * (score / 100) * 18);
}
