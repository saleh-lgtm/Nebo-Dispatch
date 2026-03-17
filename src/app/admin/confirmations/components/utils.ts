export const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
    });
};

export const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago",
    });
};

export const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
    });
};

export const isOverdue = (dueAt: Date | string, now: number) => {
    return new Date(dueAt).getTime() < now;
};

export const getTimeDiff = (target: Date | string, now: number) => {
    const diff = new Date(target).getTime() - now;
    const mins = Math.abs(Math.round(diff / 60000));
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
};
