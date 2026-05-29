import "next-auth";
import "next-auth/jwt";

type RoleValue = "MEMBER" | "DEACON" | "PASTOR" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: RoleValue;
      team: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleValue;
    team: string | null;
  }
}
