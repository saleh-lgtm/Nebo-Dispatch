"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Lazy load components for optimal code splitting
const CommandSchedulerClient = dynamic(() => import("./CommandSchedulerClient"), {
    ssr: false,
});

const MobileSchedulerClient = dynamic(() => import("./MobileSchedulerClient"), {
    ssr: false,
});

interface ScheduleData {
    id: string;
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    user: { id: string; name: string | null };
}

interface Dispatcher {
    id: string;
    name: string | null;
    email: string | null;
}

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleData[];
    initialWeekStart: string;
}

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768;

function SchedulerLoading() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            background: '#05070a',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(0, 240, 255, 0.1)',
                borderTopColor: '#00f0ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <span style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#6b7a8f',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
            }}>
                Loading Scheduler...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default function SchedulerWrapper({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        // Initial check
        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        checkMobile();

        // Listen for resize
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Show loading while determining viewport
    if (isMobile === null) {
        return <SchedulerLoading />;
    }

    // Render appropriate component based on viewport
    if (isMobile) {
        return (
            <MobileSchedulerClient
                dispatchers={dispatchers}
                initialSchedules={initialSchedules}
                initialWeekStart={initialWeekStart}
            />
        );
    }

    return (
        <CommandSchedulerClient
            dispatchers={dispatchers}
            initialSchedules={initialSchedules}
            initialWeekStart={initialWeekStart}
        />
    );
}
