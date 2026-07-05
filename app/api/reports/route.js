import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { ReportSchema, computeReportXp } from '../../../lib/validation';
import { LADDER, PB_PER_COLOR } from '../../../lib/ladder';
import { check } from '../../../lib/rate-limit';
import { json, originOk, readJson } from '../../../lib/http';

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

  const read = await readJson(req);
  if (read.error) return json({ error: read.error }, { status: read.status });

  const parsed = ReportSchema.safeParse(read.data);
  if (!parsed.success) {
    return json({ error: 'validation', issues: parsed.error.flatten() }, { status: 400 });
  }

  const xp = computeReportXp(parsed.data);

  // Persist the report and advance the user's ladder progress together, so a
  // submitted report actually moves the account's level in the database.
  const next = advanceLadder(user.currentRung, user.pbToNext, parsed.data.pb);
  const leveledUp = next.currentRung > user.currentRung;

  const ops = [
    prisma.report.create({
      data: { ...parsed.data, xp, userId: user.id },
      select: SELECT,
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { currentRung: next.currentRung, pbToNext: next.pbToNext },
      select: { currentRung: true, pbToNext: true },
    }),
  ];

  // Real event → real notification: only when this report actually advanced a
  // color, so the panel reflects genuine progress rather than canned entries.
  if (leveledUp) {
    const reached = LADDER[next.currentRung - 1];
    ops.push(
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'level',
          title: 'Level up!',
          body: `You reached ${reached.name} (${reached.code}).`,
        },
      }),
    );
  }

  const [report, updatedUser] = await prisma.$transaction(ops);

  return json({ report, user: updatedUser }, { status: 201 });
}

// Clear the current user's entire report history. Scoped to userId so a user
// can only ever wipe their own reports; ladder level/XP are left untouched.
export async function DELETE(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const result = await prisma.report.deleteMany({ where: { userId: user.id } });
  return json({ ok: true, deleted: result.count });
}
