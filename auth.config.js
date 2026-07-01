// Edge-safe Auth.js config: no DB, no bcrypt. Imported by middleware and full config.
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.uid) session.user.id = token.uid;
      if (typeof token?.tokenVersion === 'number') session.user.tokenVersion = token.tokenVersion;
      return session;
    },
  },
};
