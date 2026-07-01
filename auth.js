import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { LoginSchema } from './lib/validation';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (raw) => {
        try {
          const parsed = LoginSchema.safeParse(raw);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;
          const user = await prisma.user.findUnique({ where: { email } });
          // Constant placeholder bcrypt hash so the compare always runs and the
          // user-exists/missing branches take the same time — no enumeration.
          const placeholder = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8.fOkP6OpO5dY7s7Du5e1A1zCqXh7e';
          const ok = await bcrypt.compare(password, user?.passwordHash ?? placeholder);
          if (!user || !ok) return null;
          return { id: user.id, email: user.email, name: user.name ?? undefined, tokenVersion: user.tokenVersion };
        } catch {
          // Never leak DB/runtime errors to the credentials response.
          return null;
        }
      },
    }),
  ],
});
