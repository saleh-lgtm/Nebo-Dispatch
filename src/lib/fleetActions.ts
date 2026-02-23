"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { VehicleType, VehicleStatus } from "@prisma/client";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";

// ============================================
// TYPES
// ============================================

export interface CreateVehicleData {
    name: string;
    type: VehicleType;
    make: string;
    model: string;
    year: number;
    color?: string;
    licensePlate: string;
    vin: string;
    passengerCapacity?: number;
    luggageCapacity?: number;
    notes?: string;
}

export interface CreatePermitData {
    vehicleId: string;
    permitType: string;
    permitNumber?: string;
    issuingAuthority?: string;
    issueDate?: Date;
    expirationDate: Date;
    notes?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
}

export interface CreateInsuranceData {
    vehicleId: string;
    insuranceType: string;
    provider: string;
    policyNumber?: string;
    coverageAmount?: number;
    issueDate?: Date;
    expirationDate: Date;
    notes?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
}

export interface CreateRegistrationData {
    vehicleId: string;
    state: string;
    registrationNumber?: string;
    issueDate?: Date;
    expirationDate: Date;
    notes?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
}

export interface CreateDocumentData {
    vehicleId: string;
    documentType: string;
    title: string;
    description?: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
}

// ============================================
// VEHICLE CRUD
// ============================================

export async function createVehicle(data: CreateVehicleData) {
    const session = await requireAdmin();

    const vehicle = await prisma.fleetVehicle.create({
        data: {
            ...data,
            createdById: session.user.id,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "FleetVehicle",
        vehicle.id,
        { name: vehicle.name, type: vehicle.type, licensePlate: vehicle.licensePlate }
    );

    revalidatePath("/fleet");
    return vehicle;
}

export async function updateVehicle(id: string, data: Partial<CreateVehicleData>) {
    const session = await requireAdmin();

    const vehicle = await prisma.fleetVehicle.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "FleetVehicle",
        vehicle.id,
        { name: vehicle.name, ...data }
    );

    revalidatePath("/fleet");
    revalidatePath(`/fleet/${id}`);
    return vehicle;
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
    const session = await requireAdmin();

    const vehicle = await prisma.fleetVehicle.update({
        where: { id },
        data: { status },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE_STATUS",
        "FleetVehicle",
        vehicle.id,
        { name: vehicle.name, status }
    );

    revalidatePath("/fleet");
    revalidatePath(`/fleet/${id}`);
    return vehicle;
}

export async function deleteVehicle(id: string) {
    const session = await requireAdmin();

    // Get vehicle with all documents to delete files
    const vehicle = await prisma.fleetVehicle.findUnique({
        where: { id },
        include: {
            permits: true,
            insurance: true,
            registration: true,
            documents: true,
        },
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    // Delete all associated files from storage
    const filesToDelete: string[] = [];
    vehicle.permits.forEach(p => p.fileUrl && filesToDelete.push(p.fileUrl));
    vehicle.insurance.forEach(i => i.fileUrl && filesToDelete.push(i.fileUrl));
    vehicle.registration.forEach(r => r.fileUrl && filesToDelete.push(r.fileUrl));
    vehicle.documents.forEach(d => filesToDelete.push(d.fileUrl));

    // Delete files (don't throw on failure, just log)
    for (const fileUrl of filesToDelete) {
        try {
            await deleteFile(STORAGE_BUCKETS.FLEET_DOCUMENTS, fileUrl);
        } catch (error) {
            console.error(`Failed to delete file: ${fileUrl}`, error);
        }
    }

    // Delete vehicle (cascades to all related records)
    await prisma.fleetVehicle.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "FleetVehicle",
        id,
        { name: vehicle.name, licensePlate: vehicle.licensePlate }
    );

    revalidatePath("/fleet");
}

export async function getVehicles(filters?: {
    status?: VehicleStatus;
    type?: VehicleType;
    search?: string;
}) {
    await requireAuth();

    const where: Record<string, unknown> = {};

    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.type) {
        where.type = filters.type;
    }
    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { licensePlate: { contains: filters.search, mode: "insensitive" } },
            { make: { contains: filters.search, mode: "insensitive" } },
            { model: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    return await prisma.fleetVehicle.findMany({
        where,
        include: {
            permits: {
                select: { id: true, permitType: true, expirationDate: true },
            },
            insurance: {
                select: { id: true, insuranceType: true, expirationDate: true },
            },
            registration: {
                select: { id: true, state: true, expirationDate: true },
            },
            createdBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function getVehicleById(id: string) {
    await requireAuth();

    return await prisma.fleetVehicle.findUnique({
        where: { id },
        include: {
            permits: {
                orderBy: { expirationDate: "asc" },
            },
            insurance: {
                orderBy: { expirationDate: "asc" },
            },
            registration: {
                orderBy: { expirationDate: "asc" },
            },
            documents: {
                include: {
                    uploadedBy: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
            createdBy: {
                select: { id: true, name: true },
            },
        },
    });
}

// ============================================
// PERMIT CRUD
// ============================================

export async function createPermit(data: CreatePermitData) {
    const session = await requireAdmin();

    const permit = await prisma.vehiclePermit.create({
        data,
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "VehiclePermit",
        permit.id,
        { vehicleId: data.vehicleId, permitType: data.permitType }
    );

    revalidatePath(`/fleet/${data.vehicleId}`);
    return permit;
}

export async function updatePermit(id: string, data: Partial<CreatePermitData>) {
    const session = await requireAdmin();

    const permit = await prisma.vehiclePermit.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "VehiclePermit",
        permit.id,
        { permitType: permit.permitType }
    );

    revalidatePath(`/fleet/${permit.vehicleId}`);
    return permit;
}

export async function deletePermit(id: string) {
    const session = await requireAdmin();

    const permit = await prisma.vehiclePermit.findUnique({
        where: { id },
    });

    if (!permit) {
        throw new Error("Permit not found");
    }

    // Delete file if exists
    if (permit.fileUrl) {
        try {
            await deleteFile(STORAGE_BUCKETS.FLEET_DOCUMENTS, permit.fileUrl);
        } catch (error) {
            console.error("Failed to delete permit file:", error);
        }
    }

    await prisma.vehiclePermit.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "VehiclePermit",
        id,
        { vehicleId: permit.vehicleId, permitType: permit.permitType }
    );

    revalidatePath(`/fleet/${permit.vehicleId}`);
}

// ============================================
// INSURANCE CRUD
// ============================================

export async function createInsurance(data: CreateInsuranceData) {
    const session = await requireAdmin();

    const insurance = await prisma.vehicleInsurance.create({
        data,
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "VehicleInsurance",
        insurance.id,
        { vehicleId: data.vehicleId, insuranceType: data.insuranceType, provider: data.provider }
    );

    revalidatePath(`/fleet/${data.vehicleId}`);
    return insurance;
}

export async function updateInsurance(id: string, data: Partial<CreateInsuranceData>) {
    const session = await requireAdmin();

    const insurance = await prisma.vehicleInsurance.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "VehicleInsurance",
        insurance.id,
        { insuranceType: insurance.insuranceType }
    );

    revalidatePath(`/fleet/${insurance.vehicleId}`);
    return insurance;
}

export async function deleteInsurance(id: string) {
    const session = await requireAdmin();

    const insurance = await prisma.vehicleInsurance.findUnique({
        where: { id },
    });

    if (!insurance) {
        throw new Error("Insurance record not found");
    }

    // Delete file if exists
    if (insurance.fileUrl) {
        try {
            await deleteFile(STORAGE_BUCKETS.FLEET_DOCUMENTS, insurance.fileUrl);
        } catch (error) {
            console.error("Failed to delete insurance file:", error);
        }
    }

    await prisma.vehicleInsurance.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "VehicleInsurance",
        id,
        { vehicleId: insurance.vehicleId, insuranceType: insurance.insuranceType }
    );

    revalidatePath(`/fleet/${insurance.vehicleId}`);
}

// ============================================
// REGISTRATION CRUD
// ============================================

export async function createRegistration(data: CreateRegistrationData) {
    const session = await requireAdmin();

    const registration = await prisma.vehicleRegistration.create({
        data,
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "VehicleRegistration",
        registration.id,
        { vehicleId: data.vehicleId, state: data.state }
    );

    revalidatePath(`/fleet/${data.vehicleId}`);
    return registration;
}

export async function updateRegistration(id: string, data: Partial<CreateRegistrationData>) {
    const session = await requireAdmin();

    const registration = await prisma.vehicleRegistration.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "VehicleRegistration",
        registration.id,
        { state: registration.state }
    );

    revalidatePath(`/fleet/${registration.vehicleId}`);
    return registration;
}

export async function deleteRegistration(id: string) {
    const session = await requireAdmin();

    const registration = await prisma.vehicleRegistration.findUnique({
        where: { id },
    });

    if (!registration) {
        throw new Error("Registration record not found");
    }

    // Delete file if exists
    if (registration.fileUrl) {
        try {
            await deleteFile(STORAGE_BUCKETS.FLEET_DOCUMENTS, registration.fileUrl);
        } catch (error) {
            console.error("Failed to delete registration file:", error);
        }
    }

    await prisma.vehicleRegistration.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "VehicleRegistration",
        id,
        { vehicleId: registration.vehicleId, state: registration.state }
    );

    revalidatePath(`/fleet/${registration.vehicleId}`);
}

// ============================================
// GENERAL DOCUMENTS CRUD
// ============================================

export async function createVehicleDocument(data: CreateDocumentData) {
    const session = await requireAdmin();

    const document = await prisma.vehicleDocument.create({
        data: {
            ...data,
            uploadedById: session.user.id,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "VehicleDocument",
        document.id,
        { vehicleId: data.vehicleId, title: data.title, documentType: data.documentType }
    );

    revalidatePath(`/fleet/${data.vehicleId}`);
    return document;
}

export async function deleteVehicleDocument(id: string) {
    const session = await requireAdmin();

    const document = await prisma.vehicleDocument.findUnique({
        where: { id },
    });

    if (!document) {
        throw new Error("Document not found");
    }

    // Delete file from storage
    try {
        await deleteFile(STORAGE_BUCKETS.FLEET_DOCUMENTS, document.fileUrl);
    } catch (error) {
        console.error("Failed to delete document file:", error);
    }

    await prisma.vehicleDocument.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "VehicleDocument",
        id,
        { vehicleId: document.vehicleId, title: document.title }
    );

    revalidatePath(`/fleet/${document.vehicleId}`);
}

// ============================================
// EXPIRATION TRACKING
// ============================================

export async function getExpiringDocuments(daysAhead: number = 30) {
    await requireAuth();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const now = new Date();

    const [permits, insurance, registrations] = await Promise.all([
        prisma.vehiclePermit.findMany({
            where: {
                expirationDate: {
                    gte: now,
                    lte: futureDate,
                },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "asc" },
        }),
        prisma.vehicleInsurance.findMany({
            where: {
                expirationDate: {
                    gte: now,
                    lte: futureDate,
                },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "asc" },
        }),
        prisma.vehicleRegistration.findMany({
            where: {
                expirationDate: {
                    gte: now,
                    lte: futureDate,
                },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "asc" },
        }),
    ]);

    return { permits, insurance, registrations };
}

export async function getExpiredDocuments() {
    await requireAuth();

    const now = new Date();

    const [permits, insurance, registrations] = await Promise.all([
        prisma.vehiclePermit.findMany({
            where: {
                expirationDate: { lt: now },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "desc" },
        }),
        prisma.vehicleInsurance.findMany({
            where: {
                expirationDate: { lt: now },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "desc" },
        }),
        prisma.vehicleRegistration.findMany({
            where: {
                expirationDate: { lt: now },
            },
            include: {
                vehicle: {
                    select: { id: true, name: true, licensePlate: true },
                },
            },
            orderBy: { expirationDate: "desc" },
        }),
    ]);

    return { permits, insurance, registrations };
}

export async function getFleetStats() {
    await requireAuth();

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
        totalVehicles,
        activeVehicles,
        expiringPermits,
        expiringInsurance,
        expiringRegistration,
        expiredPermits,
        expiredInsurance,
        expiredRegistration,
    ] = await Promise.all([
        prisma.fleetVehicle.count(),
        prisma.fleetVehicle.count({ where: { status: "ACTIVE" } }),
        prisma.vehiclePermit.count({
            where: { expirationDate: { gte: now, lte: thirtyDaysFromNow } },
        }),
        prisma.vehicleInsurance.count({
            where: { expirationDate: { gte: now, lte: thirtyDaysFromNow } },
        }),
        prisma.vehicleRegistration.count({
            where: { expirationDate: { gte: now, lte: thirtyDaysFromNow } },
        }),
        prisma.vehiclePermit.count({
            where: { expirationDate: { lt: now } },
        }),
        prisma.vehicleInsurance.count({
            where: { expirationDate: { lt: now } },
        }),
        prisma.vehicleRegistration.count({
            where: { expirationDate: { lt: now } },
        }),
    ]);

    return {
        totalVehicles,
        activeVehicles,
        expiringDocuments: expiringPermits + expiringInsurance + expiringRegistration,
        expiredDocuments: expiredPermits + expiredInsurance + expiredRegistration,
    };
}
