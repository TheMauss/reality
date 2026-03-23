import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { getDB } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: number } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const db = getDB();
        await db.prepare(
          "INSERT OR IGNORE INTO users (email, created_at) VALUES (?, datetime('now'))"
        ).run(user.email);
      } catch (e) {
        console.error("[AUTH] signIn DB error:", e);
      }
      return true;
    },
    async jwt({ token }) {
      if (!token.userId && token.email) {
        try {
          const db = getDB();
          const row = await db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(token.email) as unknown as { id: number } | undefined;
          if (row) token.userId = row.id;
        } catch { /* ignore */ }
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (token.userId) (session.user as any).id = token.userId;
      return session;
    },
  },
});
