import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    avatarUrl: string | null;
    firstName: string | null;
    lastName: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      avatarUrl: string | null;
      firstName: string | null;
      lastName: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    avatarUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }
}
