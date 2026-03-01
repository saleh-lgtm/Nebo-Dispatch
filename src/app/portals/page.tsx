"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PortalsClient from "./PortalsClient";

export default async function PortalsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    return <PortalsClient />;
}
