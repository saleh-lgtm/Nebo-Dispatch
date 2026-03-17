import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: Role;
        } & DefaultSession["user"];
    }

    interface User {
        id: string;
        role: Role;
        tokenVersion: number;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: Role;
        tokenVersion: number;
        tokenVersionCheckedAt: number;
    }
}
