import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDispatcherHours, getActiveShifts, getTeamTotals } from "@/lib/hoursActions";
import HoursClient from "./HoursClient";

export default async function AdminHoursPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    // Get date range for current week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Date range for current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get initial data
    const [weeklyHours, monthlyHours, activeShifts, weeklyTotals, monthlyTotals, dispatchers] = await Promise.all([
        getDispatcherHours(startOfWeek, endOfWeek),
        getDispatcherHours(startOfMonth, endOfMonth),
        getActiveShifts(),
        getTeamTotals(startOfWeek, endOfWeek),
        getTeamTotals(startOfMonth, endOfMonth),
        prisma.user.findMany({
            where: { role: "DISPATCHER", isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <HoursClient
            weeklyHours={weeklyHours}
            monthlyHours={monthlyHours}
            activeShifts={activeShifts}
            weeklyTotals={weeklyTotals}
            monthlyTotals={monthlyTotals}
            dispatchers={dispatchers}
        />
    );
}
