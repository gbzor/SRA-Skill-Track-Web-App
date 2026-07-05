import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { check } from '../../../lib/rate-limit';
import { json, originOk } from '../../../lib/http';

export const runtime = 'nodejs';

const SELECT = {
  id: true, type: true, title: true, body: true, read: true, createdAt: true,
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('read', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: SELECT,
  });
  const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  return json({ notifications, unreadCount });
}

// Mark this user's notifications as read. Persisting read state server-side is
// the whole point: it stops the same items re-appearing unread on every visit.
export async function PATCH(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  return json({ ok: true, unreadCount: 0 });
}
