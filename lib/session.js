import { auth } from '../auth';
import { prisma } from './prisma';

/**
 * Returns the live User row for the current session, or null if either:
 *   - there is no session, or
 *   - the JWT references a userId that no longer exists in the DB
 *     (user was deleted by an operator after the JWT was issued).
 *
 * Always treat a null return as 401 in route handlers. Performing this
 * check on every API request closes the JWT-still-valid-but-user-gone
 * window: deleting a User row immediately invalidates all of their
 * sessions on the next request, regardless of cookie expiry.
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
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
  return user; // null when the row is gone
}
