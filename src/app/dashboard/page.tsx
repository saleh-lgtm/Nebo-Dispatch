import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGlobalNotes } from "@/lib/notesActions";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    const [userCount, activeShift, globalNotes] = await Promise.all([
        isAdmin ? prisma.user.count() : Promise.resolve(0),
        prisma.shift.findFirst({
            where: { userId: session.user.id, clockOut: null }
        }),
        getGlobalNotes(),
    ]);

    const stats = {
        userCount,
        activeShift: activeShift ? { id: activeShift.id } : null
    };

    return <DashboardClient initialStats={stats} globalNotes={globalNotes} />;
}
