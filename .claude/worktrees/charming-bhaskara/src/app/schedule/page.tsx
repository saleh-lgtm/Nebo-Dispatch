import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatcherSchedule } from "@/lib/actions";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const schedule = await getDispatcherSchedule(session.user.id);

    return (
        <ScheduleClient
            initialSchedule={schedule}
            session={session}
        />
    );
}
