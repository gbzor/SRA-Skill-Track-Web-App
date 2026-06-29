import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { ReportSchema, computeReportXp } from '../../../lib/validation';
import { LADDER, PB_PER_COLOR } from '../../../lib/ladder';
import { check } from '../../../lib/rate-limit';
import { json, originOk } from '../../../lib/http';

const MAX_RUNG = LADDER.length;

// Apply a report's Power Builders to the user's ladder position.
// Each Power Builder is one step toward the next color; clearing
// PB_PER_COLOR steps advances a rung. Returns the new {currentRung, pbToNext}.
function advanceLadder(currentRung, pbToNext, pb) {
  let rung = currentRung;
  let remaining = pbToNext;

  if (rung >= MAX_RUNG) {
    // Already at the top color — nothing left to climb.
    return { currentRung: MAX_RUNG, pbToNext: 0 };
  }

  remaining -= pb;
  while (remaining <= 0 && rung < MAX_RUNG) {
    rung += 1;
    remaining += PB_PER_COLOR;
  }

  if (rung >= MAX_RUNG) return { currentRung: MAX_RUNG, pbToNext: 0 };
  return { currentRung: rung, pbToNext: Math.max(0, Math.min(PB_PER_COLOR, remaining)) };
}

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

  // Persist the report and advance the user's ladder progress together, so a
  // submitted report actually moves the account's level in the database.
  const next = advanceLadder(user.currentRung, user.pbToNext, parsed.data.pb);
  const [report, updatedUser] = await prisma.$transaction([
    prisma.report.create({
      data: { ...parsed.data, xp, userId: user.id },
      select: SELECT,
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { currentRung: next.currentRung, pbToNext: next.pbToNext },
      select: { currentRung: true, pbToNext: true },
    }),
  ]);

  return json({ report, user: updatedUser }, { status: 201 });
}
