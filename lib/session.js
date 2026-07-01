import { auth } from '../auth';
import { prisma } from './prisma';

/**
 * Returns the live User row for the current session, or null if any of:
 *   - there is no session,
 *   - the JWT references a userId that no longer exists in the DB
 *     (user was deleted after the JWT was issued), or
 *   - the JWT's tokenVersion is stale (password was changed after the JWT
 *     was issued, so this token — including a stolen one — is revoked).
 *
 * Always treat a null return as 401 in route handlers. Performing this
 * check on every API request closes the "JWT still valid but credentials
 * rotated" window: changing a password or deleting a User row immediately
 * invalidates all of that user's sessions on the next request, regardless
 * of the JWT's 7-day cookie expiry.
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
      tokenVersion: true,
    },
  });
  if (!user) return null; // row is gone
  if (user.tokenVersion !== session.user.tokenVersion) return null; // password rotated since this token was issued

  const { tokenVersion, ...publicUser } = user;
  return publicUser;
}
