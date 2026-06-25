import { auth } from '../../../auth';
import { prisma } from '../../../lib/prisma';
import { check } from '../../../lib/rate-limit';
import { json } from '../../../lib/http';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('read', session.user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      currentRung: true,
      pbToNext: true,
    },
  });
  if (!user) return json({ error: 'not found' }, { status: 404 });
  return json({ user });
}
