import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';
import { RegisterSchema } from '../../../../lib/validation';
import { check, clientIp } from '../../../../lib/rate-limit';
import { json, originOk, readJson } from '../../../../lib/http';

export const runtime = 'nodejs';

export async function POST(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const rl = await check('auth', clientIp(req));
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const read = await readJson(req);
  if (read.error) return json({ error: read.error }, { status: read.status });

  const parsed = RegisterSchema.safeParse(read.data);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, name, currentRung, pbToNext } = parsed.data;

  // Don't disclose whether the email exists. Always do constant work,
  // and return the same status on either branch.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const passwordHash = await bcrypt.hash(password, 12);
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        currentRung,
        pbToNext,
      },
    });
  }
  return json({ ok: true }, { status: 201 });
}
