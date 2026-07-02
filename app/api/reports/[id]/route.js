import { getSessionUser } from '../../../../lib/session';
import { prisma } from '../../../../lib/prisma';
import { check } from '../../../../lib/rate-limit';
import { json, originOk } from '../../../../lib/http';

export const runtime = 'nodejs';

export async function DELETE(req, { params }) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const resolvedParams = await params;
  const id = String(resolvedParams?.id || '');
  if (!/^c[a-z0-9]{20,30}$/i.test(id)) {
    return json({ error: 'bad id' }, { status: 400 });
  }

  const result = await prisma.report.deleteMany({
    where: { id, userId: user.id },
  });
  if (result.count === 0) return json({ error: 'not found' }, { status: 404 });
  return json({ ok: true });
}
