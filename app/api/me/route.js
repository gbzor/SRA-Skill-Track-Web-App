import bcrypt from 'bcryptjs';
import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { check } from '../../../lib/rate-limit';
import { json, originOk } from '../../../lib/http';
import { UpdateProfileSchema, DeleteAccountSchema } from '../../../lib/validation';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('read', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  return json({ user });
}

export async function PATCH(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;
  const data = {};

  if (newPassword) {
    // Verify the current password before allowing a credential change.
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!row) return json({ error: 'not found' }, { status: 404 });
    const ok = await bcrypt.compare(currentPassword, row.passwordHash);
    if (!ok) return json({ error: 'current password is incorrect' }, { status: 400 });
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (name !== undefined && name !== user.name) {
    data.name = name;
  }

  if (Object.keys(data).length === 0) {
    return json({ error: 'nothing to update' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true, email: true, name: true, currentRung: true, pbToNext: true,
    },
  });
  return json({ user: updated });
}

export async function DELETE(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = DeleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.flatten() }, { status: 400 });
  }

  // Require the current password before destroying the account.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return json({ error: 'not found' }, { status: 404 });
  const ok = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return json({ error: 'current password is incorrect' }, { status: 400 });

  // Reports are removed automatically via the onDelete: Cascade relation.
  await prisma.user.delete({ where: { id: user.id } });

  return json({ ok: true });
}
