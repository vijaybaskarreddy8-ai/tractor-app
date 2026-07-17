import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 1 year
  },
  callbacks: {
    async signIn({ user }) {
      return user.email === process.env.AUTHORIZED_OWNER_EMAIL;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Sanitize stale /pin callbackUrls from old browser cookies
      if (url.includes('/pin')) {
        return baseUrl + '/';
      }
      // Allow relative URLs on the same origin
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allow same-origin absolute URLs
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {}
      return baseUrl + '/';
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
