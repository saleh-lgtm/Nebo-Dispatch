import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = session.user.role === "ADMIN";

    const userCount = isAdmin ? await prisma.user.count() : 0;
    const activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, clockOut: null }
    });

    const stats = {
        userCount,
        activeShift: activeShift ? { id: activeShift.id } : null
    };

    return <DashboardClient initialStats={stats} />;
}
