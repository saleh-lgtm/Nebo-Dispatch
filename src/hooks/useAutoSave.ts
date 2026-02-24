"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AutoSaveOptions<T> {
    /** Unique key for localStorage */
    storageKey: string;
    /** Data to save */
    data: T;
    /** Debounce delay in ms (default: 1500) */
    debounceMs?: number;
    /** Server save interval in ms (default: 30000) */
    serverSaveIntervalMs?: number;
    /** Server save function (optional) */
    onServerSave?: (data: T) => Promise<void>;
    /** Called when draft is restored */
    onRestore?: (data: T) => void;
    /** Whether auto-save is enabled */
    enabled?: boolean;
}

interface AutoSaveState {
    status: "idle" | "saving" | "saved" | "error";
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    hasDraft: boolean;
}

interface AutoSaveReturn<T> {
    state: AutoSaveState;
    restoreDraft: () => T | null;
    clearDraft: () => void;
    forceSave: () => void;
}

export function useAutoSave<T>({
    storageKey,
    data,
    debounceMs = 1500,
    serverSaveIntervalMs = 30000,
    onServerSave,
    onRestore,
    enabled = true,
}: AutoSaveOptions<T>): AutoSaveReturn<T> {
    const [state, setState] = useState<AutoSaveState>({
        status: "idle",
        lastSaved: null,
        hasUnsavedChanges: false,
        hasDraft: false,
    });

    const dataRef = useRef(data);
    const initialDataRef = useRef<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const serverSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastServerSaveRef = useRef<string>("");

    // Check for existing draft on mount
    useEffect(() => {
        if (typeof window === "undefined") return;

        const savedDraft = localStorage.getItem(storageKey);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.data && parsed.timestamp) {
                    setState((prev) => ({ ...prev, hasDraft: true }));
                }
            } catch {
                // Invalid draft, clear it
                localStorage.removeItem(storageKey);
            }
        }

        // Store initial data for comparison
        initialDataRef.current = JSON.stringify(data);
    }, [storageKey]);

    // Update dataRef when data changes
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Debounced localStorage save
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        // Check if data has actually changed from initial
        const currentDataStr = JSON.stringify(data);
        const hasChanges = currentDataStr !== initialDataRef.current;

        setState((prev) => ({ ...prev, hasUnsavedChanges: hasChanges }));

        if (!hasChanges) return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for debounced save
        saveTimeoutRef.current = setTimeout(() => {
            try {
                const draftData = {
                    data,
                    timestamp: new Date().toISOString(),
                    version: 1,
                };
                localStorage.setItem(storageKey, JSON.stringify(draftData));
                setState((prev) => ({
                    ...prev,
                    status: "saved",
                    lastSaved: new Date(),
                    hasDraft: true,
                }));

                // Reset status after 3 seconds
                setTimeout(() => {
                    setState((prev) =>
                        prev.status === "saved" ? { ...prev, status: "idle" } : prev
                    );
                }, 3000);
            } catch (error) {
                console.error("Failed to save draft to localStorage:", error);
                setState((prev) => ({ ...prev, status: "error" }));
            }
        }, debounceMs);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, storageKey, debounceMs, enabled]);

    // Server save interval
    useEffect(() => {
        if (!enabled || !onServerSave || typeof window === "undefined") return;

        const serverSave = async () => {
            const currentDataStr = JSON.stringify(dataRef.current);

            // Only save if data has changed since last server save
            if (currentDataStr === lastServerSaveRef.current) return;
            if (currentDataStr === initialDataRef.current) return;

            setState((prev) => ({ ...prev, status: "saving" }));

            try {
                await onServerSave(dataRef.current);
                lastServerSaveRef.current = currentDataStr;
                setState((prev) => ({
                    ...prev,
                    status: "saved",
                    lastSaved: new Date(),
                }));

                // Reset status after 3 seconds
                setTimeout(() => {
                    setState((prev) =>
                        prev.status === "saved" ? { ...prev, status: "idle" } : prev
                    );
                }, 3000);
            } catch (error) {
                console.error("Failed to save draft to server:", error);
                setState((prev) => ({ ...prev, status: "error" }));
            }
        };

        // Initial save after a short delay
        const initialTimeout = setTimeout(serverSave, 5000);

        // Set up interval for periodic saves
        serverSaveIntervalRef.current = setInterval(serverSave, serverSaveIntervalMs);

        return () => {
            clearTimeout(initialTimeout);
            if (serverSaveIntervalRef.current) {
                clearInterval(serverSaveIntervalRef.current);
            }
        };
    }, [onServerSave, serverSaveIntervalMs, enabled]);

    // beforeunload warning
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const currentDataStr = JSON.stringify(dataRef.current);
            if (currentDataStr !== initialDataRef.current) {
                e.preventDefault();
                e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [enabled]);

    const restoreDraft = useCallback((): T | null => {
        if (typeof window === "undefined") return null;

        const savedDraft = localStorage.getItem(storageKey);
        if (!savedDraft) return null;

        try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.data) {
                if (onRestore) {
                    onRestore(parsed.data);
                }
                setState((prev) => ({ ...prev, hasDraft: false }));
                return parsed.data as T;
            }
        } catch {
            console.error("Failed to parse draft");
        }

        return null;
    }, [storageKey, onRestore]);

    const clearDraft = useCallback(() => {
        if (typeof window === "undefined") return;

        localStorage.removeItem(storageKey);
        setState((prev) => ({
            ...prev,
            hasDraft: false,
            hasUnsavedChanges: false,
        }));
        initialDataRef.current = JSON.stringify(dataRef.current);
    }, [storageKey]);

    const forceSave = useCallback(() => {
        if (typeof window === "undefined") return;

        try {
            const draftData = {
                data: dataRef.current,
                timestamp: new Date().toISOString(),
                version: 1,
            };
            localStorage.setItem(storageKey, JSON.stringify(draftData));
            setState((prev) => ({
                ...prev,
                status: "saved",
                lastSaved: new Date(),
                hasDraft: true,
            }));
        } catch (error) {
            console.error("Failed to force save:", error);
        }
    }, [storageKey]);

    return {
        state,
        restoreDraft,
        clearDraft,
        forceSave,
    };
}
