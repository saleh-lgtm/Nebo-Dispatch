"use client";

import { useState } from "react";
import {
    CalendarDays,
    Plus,
    MapPin,
    Users,
    Trophy,
    Music,
    Briefcase,
    Gift,
    Star,
    X,
    Trash2,
} from "lucide-react";
import { createEvent, deleteEvent } from "@/lib/eventActions";
import { EventType } from "@prisma/client";

interface Event {
    id: string;
    title: string;
    description: string | null;
    eventDate: Date;
    endDate: Date | null;
    eventType: EventType;
    location: string | null;
    notes: string | null;
    expectedVolume: string | null;
    staffingNotes: string | null;
    createdBy: { id: string; name: string | null };
    createdAt: Date;
}

interface Props {
    events: Event[];
    isAdmin: boolean;
}

const eventTypeConfig: Record<EventType, { icon: typeof Trophy; color: string; label: string }> = {
    GAME_DAY: { icon: Trophy, color: "var(--success)", label: "Game Day" },
    CONCERT: { icon: Music, color: "#C3A6FF", label: "Concert" },
    CONFERENCE: { icon: Briefcase, color: "#45B7D1", label: "Conference" },
    HOLIDAY: { icon: Gift, color: "var(--danger)", label: "Holiday" },
    PROMOTION: { icon: Star, color: "var(--warning)", label: "Promotion" },
    GENERAL: { icon: CalendarDays, color: "var(--accent)", label: "Event" },
};

const volumeColors: Record<string, string> = {
    HIGH: "var(--danger)",
    MEDIUM: "var(--warning)",
    LOW: "var(--success)",
};

function AddEventModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (event: Event) => void }) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: "",
        description: "",
        eventDate: "",
        endDate: "",
        eventType: "GENERAL" as EventType,
        location: "",
        expectedVolume: "",
        staffingNotes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.eventDate) return;

        setLoading(true);
        try {
            const event = await createEvent({
                title: form.title,
                description: form.description || undefined,
                eventDate: new Date(form.eventDate),
                endDate: form.endDate ? new Date(form.endDate) : undefined,
                eventType: form.eventType,
                location: form.location || undefined,
                expectedVolume: form.expectedVolume || undefined,
                staffingNotes: form.staffingNotes || undefined,
            });
            onSuccess(event as Event);
            onClose();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "1rem",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="glass-card animate-fade-in" style={{ width: "100%", maxWidth: "500px" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                    <h3 className="font-display" style={{ fontSize: "1.5rem" }}>
                        Add Event
                    </h3>
                    <button onClick={onClose} className="btn-icon">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Event Title *
                        </label>
                        <input
                            className="input"
                            placeholder="e.g., Super Bowl Sunday"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            required
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Event Date *
                            </label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={form.eventDate}
                                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                End Date (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                className="input"
                                value={form.endDate}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Event Type
                            </label>
                            <select
                                className="input"
                                value={form.eventType}
                                onChange={(e) => setForm({ ...form, eventType: e.target.value as EventType })}
                            >
                                <option value="GENERAL">General Event</option>
                                <option value="GAME_DAY">Game Day</option>
                                <option value="CONCERT">Concert</option>
                                <option value="CONFERENCE">Conference</option>
                                <option value="HOLIDAY">Holiday</option>
                                <option value="PROMOTION">Promotion</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                                Expected Volume
                            </label>
                            <select
                                className="input"
                                value={form.expectedVolume}
                                onChange={(e) => setForm({ ...form, expectedVolume: e.target.value })}
                            >
                                <option value="">Select...</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Location
                        </label>
                        <input
                            className="input"
                            placeholder="e.g., Downtown Stadium"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Description
                        </label>
                        <textarea
                            className="input"
                            placeholder="Event details..."
                            style={{ height: "80px", resize: "vertical" }}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                            Staffing Notes
                        </label>
                        <textarea
                            className="input"
                            placeholder="Notes for dispatchers..."
                            style={{ height: "60px", resize: "vertical" }}
                            value={form.staffingNotes}
                            onChange={(e) => setForm({ ...form, staffingNotes: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3" style={{ marginTop: "0.5rem" }}>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Adding..." : "Add Event"}
                        </button>
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function EventsPanel({ events: initialEvents, isAdmin }: Props) {
    const [events, setEvents] = useState<Event[]>(initialEvents);
    const [showAddModal, setShowAddModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleAddEvent = (event: Event) => {
        setEvents((prev) => [...prev, event].sort(
            (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        ));
    };

    const handleDelete = async (eventId: string) => {
        if (!confirm("Are you sure you want to delete this event?")) return;

        setDeletingId(eventId);
        try {
            await deleteEvent(eventId);
            setEvents((prev) => prev.filter((e) => e.id !== eventId));
        } catch (e) {
            console.error(e);
        }
        setDeletingId(null);
    };

    const formatEventDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getDaysUntil = (date: Date) => {
        const now = new Date();
        const eventDate = new Date(date);
        const diffTime = eventDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays < 0) return "Past";
        return `In ${diffDays} days`;
    };

    return (
        <section className="glass-card">
            <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                <div className="flex items-center gap-2">
                    <CalendarDays size={20} className="text-accent" />
                    <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                        Upcoming Events
                    </h2>
                    {events.length > 0 && (
                        <span
                            style={{
                                background: "var(--accent)",
                                color: "var(--bg-primary)",
                                padding: "0.125rem 0.5rem",
                                borderRadius: "9999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                            }}
                        >
                            {events.length}
                        </span>
                    )}
                </div>
                {isAdmin && (
                    <button onClick={() => setShowAddModal(true)} className="btn btn-secondary">
                        <Plus size={16} /> Add Event
                    </button>
                )}
            </div>

            {events.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)" }}>
                    <CalendarDays size={32} style={{ opacity: 0.2, marginBottom: "0.5rem" }} />
                    <p style={{ fontSize: "0.875rem" }}>No upcoming events scheduled.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {events.map((event) => {
                        const config = eventTypeConfig[event.eventType];
                        const IconComponent = config.icon;
                        const daysUntil = getDaysUntil(event.eventDate);

                        return (
                            <div
                                key={event.id}
                                style={{
                                    padding: "1rem",
                                    borderRadius: "0.75rem",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border)",
                                }}
                            >
                                <div className="flex items-start justify-between" style={{ marginBottom: "0.5rem" }}>
                                    <div className="flex items-center gap-2">
                                        <div
                                            style={{
                                                padding: "0.5rem",
                                                borderRadius: "0.5rem",
                                                background: `${config.color}20`,
                                                color: config.color,
                                            }}
                                        >
                                            <IconComponent size={16} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontWeight: 600 }}>{event.title}</h4>
                                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                {formatEventDate(event.eventDate)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            style={{
                                                background: daysUntil === "Today" ? "var(--danger)" : daysUntil === "Tomorrow" ? "var(--warning)" : "var(--bg-primary)",
                                                color: daysUntil === "Today" || daysUntil === "Tomorrow" ? "#fff" : "var(--text-secondary)",
                                                padding: "0.125rem 0.5rem",
                                                borderRadius: "0.25rem",
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {daysUntil}
                                        </span>
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDelete(event.id)}
                                                disabled={deletingId === event.id}
                                                className="btn-icon"
                                                style={{ opacity: deletingId === event.id ? 0.5 : 1 }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center flex-wrap gap-3" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    <span
                                        style={{
                                            background: `${config.color}20`,
                                            color: config.color,
                                            padding: "0.125rem 0.5rem",
                                            borderRadius: "0.25rem",
                                        }}
                                    >
                                        {config.label}
                                    </span>

                                    {event.location && (
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} />
                                            {event.location}
                                        </span>
                                    )}

                                    {event.expectedVolume && (
                                        <span className="flex items-center gap-1">
                                            <Users size={12} />
                                            <span style={{ color: volumeColors[event.expectedVolume] || "var(--text-secondary)" }}>
                                                {event.expectedVolume} Volume
                                            </span>
                                        </span>
                                    )}
                                </div>

                                {event.description && (
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                                        {event.description}
                                    </p>
                                )}

                                {event.staffingNotes && (
                                    <div
                                        style={{
                                            marginTop: "0.5rem",
                                            padding: "0.5rem",
                                            background: "rgba(183, 175, 163, 0.1)",
                                            borderRadius: "0.25rem",
                                            borderLeft: "3px solid var(--accent)",
                                        }}
                                    >
                                        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", marginBottom: "0.25rem" }}>
                                            Staffing Notes
                                        </p>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                            {event.staffingNotes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showAddModal && (
                <AddEventModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={handleAddEvent}
                />
            )}
        </section>
    );
}
