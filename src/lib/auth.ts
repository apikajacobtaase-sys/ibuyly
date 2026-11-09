// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Your account is inactive. Please contact support.");
        }

        if (user.accountStatus !== "ACTIVE") {
          throw new Error("Your account is unavailable. Please contact support.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: user.role,
          avatarUrl: user.avatarUrl,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.id;

      if (typeof userId !== "string" || !userId) {
        token.id = "";
        token.role = "";
        token.avatarUrl = null;
        token.firstName = null;
        token.lastName = null;
        return token;
      }

      const currentUser = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          accountStatus: true,
          avatarUrl: true,
          firstName: true,
          lastName: true,
        },
      });

      if (
        !currentUser ||
        !currentUser.isActive ||
        currentUser.accountStatus !== "ACTIVE"
      ) {
        token.id = "";
        token.role = "";
        token.avatarUrl = null;
        token.firstName = null;
        token.lastName = null;
        return token;
      }

      token.id = currentUser.id;
      token.role = currentUser.role;
      token.avatarUrl = currentUser.avatarUrl;
      token.firstName = currentUser.firstName;
      token.lastName = currentUser.lastName;
      token.name =
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim();

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.id === "string" ? token.id : "";

        session.user.role =
          typeof token.role === "string" ? token.role : "";

        session.user.avatarUrl =
          typeof token.avatarUrl === "string" ? token.avatarUrl : null;

        session.user.firstName =
          typeof token.firstName === "string" ? token.firstName : null;

        session.user.lastName =
          typeof token.lastName === "string" ? token.lastName : null;

        session.user.name =
          typeof token.name === "string" ? token.name : null;

        session.user.image = session.user.avatarUrl;
      }

      return session;
    },
  },
};
