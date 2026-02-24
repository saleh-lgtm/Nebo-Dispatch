import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getShiftQuotes } from "@/lib/quoteActions";
import { getShiftReportDraft } from "@/lib/actions";
import dynamic from "next/dynamic";

const ShiftReportForm = dynamic(() => import("@/components/ShiftReportForm"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Shift Report</h1>
            </div>
            <div className="skeleton-card" style={{ height: "500px" }} />
        </div>
    ),
});

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

    // Fetch tasks, quotes, and draft in parallel
    const [tasks, shiftQuotes, serverDraft] = await Promise.all([
        prisma.shiftTask.findMany({
            where: { shiftId: activeShift.id },
            orderBy: { id: "asc" },
        }),
        getShiftQuotes(activeShift.id),
        getShiftReportDraft(activeShift.id).catch(() => null),
    ]);

    return (
        <ShiftReportForm
            session={session}
            activeShift={activeShift}
            initialTasks={tasks}
            initialQuotes={shiftQuotes}
            initialDraft={serverDraft}
        />
    );
}
