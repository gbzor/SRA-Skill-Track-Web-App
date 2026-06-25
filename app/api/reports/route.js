import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { ReportSchema, computeReportXp } from '../../../lib/validation';
import { check } from '../../../lib/rate-limit';
import { json, originOk } from '../../../lib/http';

export const runtime = 'nodejs';

const SELECT = {
  id: true, period: true, pb: true, score: true, rate: true,
  colorIdx: true, xp: true, createdAt: true,
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('read', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: SELECT,
  });
  return json({ reports });
}

export async function POST(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, { status: 400 }); }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.flatten() }, { status: 400 });
  }

  const xp = computeReportXp(parsed.data);
  const report = await prisma.report.create({
    data: { ...parsed.data, xp, userId: user.id },
    select: SELECT,
  });
  return json({ report }, { status: 201 });
}
