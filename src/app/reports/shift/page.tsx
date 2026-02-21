import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ShiftReportForm from "@/components/ShiftReportForm";
import { getShiftQuotes } from "@/lib/quoteActions";

export default async function ShiftReportPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Find active shift with tasks
    const activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, clockOut: null },
    });

    if (!activeShift) {
        redirect("/dashboard?error=no-active-shift");
    }

    // Fetch tasks for the shift
    const tasks = await prisma.shiftTask.findMany({
        where: { shiftId: activeShift.id },
        orderBy: { id: "asc" },
    });

    // Fetch quotes created during this shift
    const shiftQuotes = await getShiftQuotes(activeShift.id);

    return (
        <ShiftReportForm
            session={session}
            activeShift={activeShift}
            initialTasks={tasks}
            initialQuotes={shiftQuotes}
        />
    );
}
