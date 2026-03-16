"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import {
    driverVehicleSchema,
    schedulePreferencesSchema,
    vehicleAssignmentSchema,
    updateVehicleAssignmentSchema,
    affiliateIdParamSchema,
    idParamSchema,
} from "./schemas";

// ============================================
// IOS DRIVER VEHICLE MANAGEMENT
// ============================================

export interface DriverVehicleData {
    vehicleType?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    passengerCapacity?: number;
    insuranceExpiry?: Date;
    notes?: string;
}

// Get driver vehicle info
export async function getDriverVehicle(affiliateId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID", data: null };
        }

        const vehicle = await prisma.driverVehicle.findUnique({
            where: { affiliateId },
        });

        return { success: true, data: vehicle };
    } catch (error) {
        console.error("getDriverVehicle error:", error);
        return { success: false, error: "Failed to get driver vehicle", data: null };
    }
}

// Create or update driver vehicle info
export async function upsertDriverVehicle(affiliateId: string, data: DriverVehicleData) {
    try {
        const session = await requireAdmin();

        // Validate affiliate ID
        const affiliateResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!affiliateResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        // Validate input
        const parseResult = driverVehicleSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const vehicle = await prisma.driverVehicle.upsert({
            where: { affiliateId },
            create: {
                affiliateId,
                ...data,
            },
            update: data,
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "DriverVehicle",
            vehicle.id,
            { affiliateId, ...data }
        );

        revalidatePath("/network");
        return { success: true, data: vehicle };
    } catch (error) {
        console.error("upsertDriverVehicle error:", error);
        return { success: false, error: "Failed to update driver vehicle" };
    }
}

// Delete driver vehicle info
export async function deleteDriverVehicle(affiliateId: string) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const vehicle = await prisma.driverVehicle.findUnique({
            where: { affiliateId },
        });

        if (!vehicle) {
            return { success: true }; // Already deleted
        }

        await prisma.driverVehicle.delete({
            where: { affiliateId },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "DriverVehicle",
            vehicle.id,
            { affiliateId }
        );

        revalidatePath("/network");
        return { success: true };
    } catch (error) {
        console.error("deleteDriverVehicle error:", error);
        return { success: false, error: "Failed to delete driver vehicle" };
    }
}

// ============================================
// HOUSE CHAUFFEUR SCHEDULE PREFERENCES
// ============================================

export interface SchedulePreferencesData {
    preferredDays?: string[];
    preferredShifts?: string[];
    maxHoursWeek?: number;
    timezone?: string;
    notes?: string;
}

// Get schedule preferences
export async function getSchedulePreferences(affiliateId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID", data: null };
        }

        const prefs = await prisma.schedulePreferences.findUnique({
            where: { affiliateId },
        });

        return { success: true, data: prefs };
    } catch (error) {
        console.error("getSchedulePreferences error:", error);
        return { success: false, error: "Failed to get schedule preferences", data: null };
    }
}

// Create or update schedule preferences
export async function upsertSchedulePreferences(affiliateId: string, data: SchedulePreferencesData) {
    try {
        const session = await requireAdmin();

        // Validate affiliate ID
        const affiliateResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!affiliateResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        // Validate input
        const parseResult = schedulePreferencesSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const prefs = await prisma.schedulePreferences.upsert({
            where: { affiliateId },
            create: {
                affiliateId,
                ...data,
            },
            update: data,
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "SchedulePreferences",
            prefs.id,
            { affiliateId, ...data }
        );

        revalidatePath("/network");
        return { success: true, data: prefs };
    } catch (error) {
        console.error("upsertSchedulePreferences error:", error);
        return { success: false, error: "Failed to update schedule preferences" };
    }
}

// Delete schedule preferences
export async function deleteSchedulePreferences(affiliateId: string) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const prefs = await prisma.schedulePreferences.findUnique({
            where: { affiliateId },
        });

        if (!prefs) {
            return { success: true }; // Already deleted
        }

        await prisma.schedulePreferences.delete({
            where: { affiliateId },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "SchedulePreferences",
            prefs.id,
            { affiliateId }
        );

        revalidatePath("/network");
        return { success: true };
    } catch (error) {
        console.error("deleteSchedulePreferences error:", error);
        return { success: false, error: "Failed to delete schedule preferences" };
    }
}

// ============================================
// HOUSE CHAUFFEUR VEHICLE ASSIGNMENTS
// ============================================

export interface VehicleAssignmentData {
    vehicleId: string;
    startDate: Date;
    endDate?: Date;
    isPrimary?: boolean;
    notes?: string;
}

// Get vehicle assignments for a chauffeur
export async function getVehicleAssignments(affiliateId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID", data: [] };
        }

        const assignments = await prisma.vehicleAssignment.findMany({
            where: { affiliateId },
            include: {
                vehicle: {
                    select: {
                        id: true,
                        name: true,
                        make: true,
                        model: true,
                        year: true,
                        licensePlate: true,
                        type: true,
                        status: true,
                    },
                },
            },
            orderBy: [
                { isPrimary: "desc" },
                { startDate: "desc" },
            ],
        });

        return { success: true, data: assignments };
    } catch (error) {
        console.error("getVehicleAssignments error:", error);
        return { success: false, error: "Failed to get vehicle assignments", data: [] };
    }
}

// Assign a vehicle to a chauffeur
export async function assignVehicle(affiliateId: string, data: VehicleAssignmentData) {
    try {
        const session = await requireAdmin();

        // Validate affiliate ID
        const affiliateResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!affiliateResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        // Validate input
        const parseResult = vehicleAssignmentSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // If setting as primary, unset other primary assignments
        if (data.isPrimary) {
            await prisma.vehicleAssignment.updateMany({
                where: { affiliateId, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        const assignment = await prisma.vehicleAssignment.create({
            data: {
                affiliateId,
                vehicleId: data.vehicleId,
                startDate: data.startDate,
                endDate: data.endDate,
                isPrimary: data.isPrimary || false,
                notes: data.notes,
            },
            include: {
                vehicle: { select: { name: true, licensePlate: true } },
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "VehicleAssignment",
            assignment.id,
            {
                affiliateId,
                vehicleName: assignment.vehicle.name,
                licensePlate: assignment.vehicle.licensePlate,
                isPrimary: data.isPrimary,
            }
        );

        revalidatePath("/network");
        return { success: true, data: assignment };
    } catch (error) {
        console.error("assignVehicle error:", error);
        return { success: false, error: "Failed to assign vehicle" };
    }
}

// Update a vehicle assignment
export async function updateVehicleAssignment(
    assignmentId: string,
    data: Partial<VehicleAssignmentData>
) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id: assignmentId });
        if (!idResult.success) {
            return { success: false, error: "Invalid assignment ID" };
        }

        // Validate input
        const parseResult = updateVehicleAssignmentSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const existing = await prisma.vehicleAssignment.findUnique({
            where: { id: assignmentId },
            select: { affiliateId: true },
        });

        if (!existing) {
            return { success: false, error: "Assignment not found" };
        }

        // If setting as primary, unset other primary assignments
        if (data.isPrimary) {
            await prisma.vehicleAssignment.updateMany({
                where: {
                    affiliateId: existing.affiliateId,
                    isPrimary: true,
                    id: { not: assignmentId },
                },
                data: { isPrimary: false },
            });
        }

        const assignment = await prisma.vehicleAssignment.update({
            where: { id: assignmentId },
            data: {
                endDate: data.endDate,
                isPrimary: data.isPrimary,
                notes: data.notes,
            },
            include: {
                vehicle: { select: { name: true } },
            },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "VehicleAssignment",
            assignmentId,
            data
        );

        revalidatePath("/network");
        return { success: true, data: assignment };
    } catch (error) {
        console.error("updateVehicleAssignment error:", error);
        return { success: false, error: "Failed to update vehicle assignment" };
    }
}

// Remove a vehicle assignment
export async function removeVehicleAssignment(assignmentId: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id: assignmentId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid assignment ID" };
        }

        const assignment = await prisma.vehicleAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                vehicle: { select: { name: true } },
                affiliate: { select: { name: true } },
            },
        });

        if (!assignment) {
            return { success: false, error: "Assignment not found" };
        }

        await prisma.vehicleAssignment.delete({
            where: { id: assignmentId },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "VehicleAssignment",
            assignmentId,
            {
                affiliateName: assignment.affiliate.name,
                vehicleName: assignment.vehicle.name,
            }
        );

        revalidatePath("/network");
        return { success: true };
    } catch (error) {
        console.error("removeVehicleAssignment error:", error);
        return { success: false, error: "Failed to remove vehicle assignment" };
    }
}

// Get available fleet vehicles for assignment
export async function getAvailableFleetVehicles() {
    try {
        await requireAuth();

        const vehicles = await prisma.fleetVehicle.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                name: true,
                make: true,
                model: true,
                year: true,
                licensePlate: true,
                type: true,
                passengerCapacity: true,
            },
            orderBy: { name: "asc" },
        });

        return { success: true, data: vehicles };
    } catch (error) {
        console.error("getAvailableFleetVehicles error:", error);
        return { success: false, error: "Failed to get available vehicles", data: [] };
    }
}

// Get chauffeurs assigned to a specific vehicle
export async function getVehicleChauffeurs(vehicleId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: vehicleId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid vehicle ID", data: [] };
        }

        const chauffeurs = await prisma.vehicleAssignment.findMany({
            where: { vehicleId },
            include: {
                affiliate: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        employeeId: true,
                    },
                },
            },
            orderBy: [
                { isPrimary: "desc" },
                { startDate: "desc" },
            ],
        });

        return { success: true, data: chauffeurs };
    } catch (error) {
        console.error("getVehicleChauffeurs error:", error);
        return { success: false, error: "Failed to get vehicle chauffeurs", data: [] };
    }
}

// ============================================
// HELPER: VEHICLE TYPES FOR IOS
// ============================================

export const VEHICLE_TYPES = [
    "Sedan",
    "SUV",
    "Van",
    "Limousine",
    "Stretch Limo",
    "Sprinter",
    "Mini Bus",
    "Coach",
    "Other",
] as const;

export const SHIFT_OPTIONS = [
    "Morning",
    "Afternoon",
    "Evening",
    "Night",
    "Overnight",
] as const;

export const DAY_OPTIONS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const;
