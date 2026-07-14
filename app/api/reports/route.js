import { getSessionUser } from '../../../lib/session';
import { prisma } from '../../../lib/prisma';
import { ReportSchema } from '../../../lib/validation';
import { advanceProgress, reportXp, isPassing, stepInfo } from '../../../lib/ladder';
import { check } from '../../../lib/rate-limit';
import { json, originOk, readJson } from '../../../lib/http';

export const runtime = 'nodejs';

const SELECT = {
  id: true, period: true, kind: true, levelIdx: true, colorIdx: true,
  pbCount: true, score: true, rate: true, passed: true,
  placementColorIdx: true, xp: true, createdAt: true,
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

  const input = parsed.data;
  const passed = isPassing(input.score);
  const xp = reportXp(input);

  // The report is always recorded against the reader's *own* current position —
  // never a level/color the client claims. The submitted level/color are only
  // used for display context and are ignored for progression, so a hostile body
  // can't jump the ladder.
  const progress = { levelIdx: user.levelIdx, colorIdx: user.colorIdx, pbPassed: user.pbPassed };
  const next = advanceProgress(progress, input);

  const ops = [
    prisma.report.create({
      data: {
        userId: user.id,
        period: input.period,
        kind: input.kind,
        // Store where the reader actually was when logging this.
        levelIdx: user.levelIdx,
        colorIdx: user.colorIdx,
        pbCount: input.pbCount,
        score: input.score,
        rate: input.rate,
        passed,
        placementColorIdx: input.kind === 'level_test' ? (input.placementColorIdx ?? null) : null,
        xp,
      },
      select: SELECT,
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { levelIdx: next.levelIdx, colorIdx: next.colorIdx, pbPassed: next.pbPassed },
      select: { levelIdx: true, colorIdx: true, pbPassed: true },
    }),
  ];

  // Real events → real notifications, only when progression actually happened.
  if (next.leveledUp) {
    const reached = stepInfo(next.levelIdx, next.colorIdx);
    ops.push(
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'level',
          title: 'Level up!',
          body: `You passed the level test and moved up to ${reached.levelCode}, starting on ${reached.name}.`,
        },
      }),
    );
  } else if (next.colorAdvanced) {
    const reached = stepInfo(next.levelIdx, next.colorIdx);
    ops.push(
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'level',
          title: 'New color unlocked',
          body: `You cleared the exit test and moved on to ${reached.name} (${reached.levelCode}).`,
        },
      }),
    );
  }

  const [report, updatedUser] = await prisma.$transaction(ops);

  return json(
    { report, user: updatedUser, colorAdvanced: next.colorAdvanced, leveledUp: next.leveledUp },
    { status: 201 },
  );
}

// Clear the current user's entire report history. Scoped to userId so a user
// can only ever wipe their own reports; ladder position is left untouched.
export async function DELETE(req) {
  if (!originOk(req)) return json({ error: 'forbidden' }, { status: 403 });

  const user = await getSessionUser();
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const rl = await check('write', user.id);
  if (!rl.success) return json({ error: 'too many requests' }, { status: 429 });

  const result = await prisma.report.deleteMany({ where: { userId: user.id } });
  return json({ ok: true, deleted: result.count });
}
