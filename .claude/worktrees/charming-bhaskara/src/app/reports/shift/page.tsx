import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ShiftReportForm from "@/components/ShiftReportForm";

export default async function ShiftReportPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Find or create active shift
    let activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, clockOut: null },
        include: { tasks: { orderBy: { id: "asc" } } },
    });

    if (!activeShift) {
        // If no active shift, redirect to dashboard to clock in
        redirect("/dashboard?error=no-active-shift");
    }

    return (
        <ShiftReportForm
            session={session}
            activeShift={activeShift}
            initialTasks={activeShift.tasks}
        />
    );
}
