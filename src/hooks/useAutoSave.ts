"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Schema version for localStorage data migration
const DRAFT_SCHEMA_VERSION = 2;

interface AutoSaveOptions<T> {
    /** Unique key for localStorage */
    storageKey: string;
    /** Data to save */
    data: T;
    /** Debounce delay in ms (default: 3000 - less frequent saves) */
    debounceMs?: number;
    /** Server save interval in ms (default: 60000 - once per minute) */
    serverSaveIntervalMs?: number;
    /** Server save function (optional) */
    onServerSave?: (data: T) => Promise<void>;
    /** Called when draft is restored */
    onRestore?: (data: T) => void;
    /** Whether auto-save is enabled */
    enabled?: boolean;
    /** Silent mode - only show errors, not saving/saved states (default: true) */
    silentMode?: boolean;
}

interface AutoSaveState {
    status: "idle" | "saving" | "saved" | "error";
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    hasDraft: boolean;
    /** Whether user has dismissed draft recovery this session */
    draftDismissed: boolean;
}

interface AutoSaveReturn<T> {
    state: AutoSaveState;
    restoreDraft: () => T | null;
    clearDraft: () => void;
    forceSave: () => void;
    dismissDraft: () => void;
}

// Session storage key to track dismissed drafts
const getDismissedKey = (storageKey: string) => `${storageKey}-dismissed`;

export function useAutoSave<T>({
    storageKey,
    data,
    debounceMs = 3000,
    serverSaveIntervalMs = 60000,
    onServerSave,
    onRestore,
    enabled = true,
    silentMode = true,
}: AutoSaveOptions<T>): AutoSaveReturn<T> {
    const [state, setState] = useState<AutoSaveState>({
        status: "idle",
        lastSaved: null,
        hasUnsavedChanges: false,
        hasDraft: false,
        draftDismissed: false,
    });

    const dataRef = useRef(data);
    const initialDataRef = useRef<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const serverSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastServerSaveRef = useRef<string>("");

    // Check for existing draft on mount
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if user dismissed draft this session
        const wasDismissed = sessionStorage.getItem(getDismissedKey(storageKey)) === "true";

        const savedDraft = localStorage.getItem(storageKey);
        if (savedDraft && !wasDismissed) {
            try {
                const parsed = JSON.parse(savedDraft);
                // Validate draft structure and version
                if (parsed.data && parsed.timestamp && parsed.version === DRAFT_SCHEMA_VERSION) {
                    // Check if draft is not too old (24 hours)
                    const draftAge = Date.now() - new Date(parsed.timestamp).getTime();
                    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                    if (draftAge < maxAge) {
                        setState((prev) => ({ ...prev, hasDraft: true, draftDismissed: false }));
                    } else {
                        // Draft too old, clean it up
                        localStorage.removeItem(storageKey);
                    }
                } else if (parsed.version !== DRAFT_SCHEMA_VERSION) {
                    // Old schema version, remove it
                    localStorage.removeItem(storageKey);
                }
            } catch {
                // Invalid draft, clear it
                localStorage.removeItem(storageKey);
            }
        } else if (wasDismissed) {
            setState((prev) => ({ ...prev, draftDismissed: true }));
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
                    version: DRAFT_SCHEMA_VERSION,
                };
                localStorage.setItem(storageKey, JSON.stringify(draftData));

                // In silent mode, don't update status for successful saves
                if (!silentMode) {
                    setState((prev) => ({
                        ...prev,
                        status: "saved",
                        lastSaved: new Date(),
                        hasDraft: true,
                    }));

                    // Reset status after 2 seconds (shorter delay)
                    setTimeout(() => {
                        setState((prev) =>
                            prev.status === "saved" ? { ...prev, status: "idle" } : prev
                        );
                    }, 2000);
                } else {
                    // Silent mode: just update lastSaved and hasDraft, keep status idle
                    setState((prev) => ({
                        ...prev,
                        lastSaved: new Date(),
                        hasDraft: true,
                    }));
                }
            } catch (error) {
                console.error("Failed to save draft to localStorage:", error);
                // Always show errors even in silent mode
                setState((prev) => ({ ...prev, status: "error" }));
            }
        }, debounceMs);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, storageKey, debounceMs, enabled, silentMode]);

    // Server save interval
    useEffect(() => {
        if (!enabled || !onServerSave || typeof window === "undefined") return;

        const serverSave = async () => {
            const currentDataStr = JSON.stringify(dataRef.current);

            // Only save if data has changed since last server save
            if (currentDataStr === lastServerSaveRef.current) return;
            if (currentDataStr === initialDataRef.current) return;

            // In silent mode, don't show "saving" status
            if (!silentMode) {
                setState((prev) => ({ ...prev, status: "saving" }));
            }

            try {
                await onServerSave(dataRef.current);
                lastServerSaveRef.current = currentDataStr;

                if (!silentMode) {
                    setState((prev) => ({
                        ...prev,
                        status: "saved",
                        lastSaved: new Date(),
                    }));

                    // Reset status after 2 seconds
                    setTimeout(() => {
                        setState((prev) =>
                            prev.status === "saved" ? { ...prev, status: "idle" } : prev
                        );
                    }, 2000);
                } else {
                    // Silent mode: just update lastSaved
                    setState((prev) => ({
                        ...prev,
                        lastSaved: new Date(),
                    }));
                }
            } catch (error) {
                console.error("Failed to save draft to server:", error);
                // Always show errors
                setState((prev) => ({ ...prev, status: "error" }));
            }
        };

        // Initial save after a longer delay (10 seconds instead of 5)
        const initialTimeout = setTimeout(serverSave, 10000);

        // Set up interval for periodic saves
        serverSaveIntervalRef.current = setInterval(serverSave, serverSaveIntervalMs);

        return () => {
            clearTimeout(initialTimeout);
            if (serverSaveIntervalRef.current) {
                clearInterval(serverSaveIntervalRef.current);
            }
        };
    }, [onServerSave, serverSaveIntervalMs, enabled, silentMode]);

    // beforeunload warning - only if there are actual unsaved changes
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const currentDataStr = JSON.stringify(dataRef.current);
            if (currentDataStr !== initialDataRef.current) {
                e.preventDefault();
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
                // Clear the dismissed flag when restoring
                sessionStorage.removeItem(getDismissedKey(storageKey));
                setState((prev) => ({ ...prev, hasDraft: false, draftDismissed: false }));
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
        sessionStorage.removeItem(getDismissedKey(storageKey));
        setState((prev) => ({
            ...prev,
            hasDraft: false,
            hasUnsavedChanges: false,
            draftDismissed: false,
        }));
        initialDataRef.current = JSON.stringify(dataRef.current);
    }, [storageKey]);

    const dismissDraft = useCallback(() => {
        if (typeof window === "undefined") return;

        // Mark as dismissed for this session only
        sessionStorage.setItem(getDismissedKey(storageKey), "true");
        // Clear the draft from localStorage
        localStorage.removeItem(storageKey);
        setState((prev) => ({
            ...prev,
            hasDraft: false,
            draftDismissed: true,
        }));
    }, [storageKey]);

    const forceSave = useCallback(() => {
        if (typeof window === "undefined") return;

        try {
            const draftData = {
                data: dataRef.current,
                timestamp: new Date().toISOString(),
                version: DRAFT_SCHEMA_VERSION,
            };
            localStorage.setItem(storageKey, JSON.stringify(draftData));
            setState((prev) => ({
                ...prev,
                status: silentMode ? "idle" : "saved",
                lastSaved: new Date(),
                hasDraft: true,
            }));
        } catch (error) {
            console.error("Failed to force save:", error);
            setState((prev) => ({ ...prev, status: "error" }));
        }
    }, [storageKey, silentMode]);

    return {
        state,
        restoreDraft,
        clearDraft,
        forceSave,
        dismissDraft,
    };
}
