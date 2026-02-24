"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

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
    await requireAuth();

    return await prisma.driverVehicle.findUnique({
        where: { affiliateId },
    });
}

// Create or update driver vehicle info
export async function upsertDriverVehicle(affiliateId: string, data: DriverVehicleData) {
    const session = await requireAdmin();

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
    return vehicle;
}

// Delete driver vehicle info
export async function deleteDriverVehicle(affiliateId: string) {
    const session = await requireAdmin();

    const vehicle = await prisma.driverVehicle.findUnique({
        where: { affiliateId },
    });

    if (!vehicle) return;

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
    await requireAuth();

    return await prisma.schedulePreferences.findUnique({
        where: { affiliateId },
    });
}

// Create or update schedule preferences
export async function upsertSchedulePreferences(affiliateId: string, data: SchedulePreferencesData) {
    const session = await requireAdmin();

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
    return prefs;
}

// Delete schedule preferences
export async function deleteSchedulePreferences(affiliateId: string) {
    const session = await requireAdmin();

    const prefs = await prisma.schedulePreferences.findUnique({
        where: { affiliateId },
    });

    if (!prefs) return;

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
    await requireAuth();

    return await prisma.vehicleAssignment.findMany({
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
}

// Assign a vehicle to a chauffeur
export async function assignVehicle(affiliateId: string, data: VehicleAssignmentData) {
    const session = await requireAdmin();

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
    return assignment;
}

// Update a vehicle assignment
export async function updateVehicleAssignment(
    assignmentId: string,
    data: Partial<VehicleAssignmentData>
) {
    const session = await requireAdmin();

    const existing = await prisma.vehicleAssignment.findUnique({
        where: { id: assignmentId },
        select: { affiliateId: true },
    });

    if (!existing) throw new Error("Assignment not found");

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
    return assignment;
}

// Remove a vehicle assignment
export async function removeVehicleAssignment(assignmentId: string) {
    const session = await requireAdmin();

    const assignment = await prisma.vehicleAssignment.findUnique({
        where: { id: assignmentId },
        include: {
            vehicle: { select: { name: true } },
            affiliate: { select: { name: true } },
        },
    });

    if (!assignment) throw new Error("Assignment not found");

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
}

// Get available fleet vehicles for assignment
export async function getAvailableFleetVehicles() {
    await requireAuth();

    return await prisma.fleetVehicle.findMany({
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
}

// Get chauffeurs assigned to a specific vehicle
export async function getVehicleChauffeurs(vehicleId: string) {
    await requireAuth();

    return await prisma.vehicleAssignment.findMany({
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
