import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getGlobalNotes } from "@/lib/notesActions";
import NotesClient from "./NotesClient";

export default async function NotesPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const notes = await getGlobalNotes();

    return (
        <NotesClient
            initialNotes={notes}
            currentUserId={session.user.id}
        />
    );
}
