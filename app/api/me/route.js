import { getSessionUser } from '../../../lib/session';
import { check } from '../../../lib/rate-limit';
import { json } from '../../../lib/http';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('read', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  return json({ user });
}
