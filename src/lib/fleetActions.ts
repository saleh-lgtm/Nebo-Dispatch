"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { VehicleType, VehicleStatus } from "@prisma/client";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";
import {
    createVehicleSchema,
    updateVehicleSchema,
    updateVehicleStatusSchema,
    createPermitSchema,
    updatePermitSchema,
    createInsuranceSchema,
    updateInsuranceSchema,
    createRegistrationSchema,
    updateRegistrationSchema,
    createVehicleDocumentSchema,
    getVehicleFiltersSchema,
    daysAheadSchema,
    idParamSchema,
} from "./schemas";

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
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createVehicleSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: vehicle };
    } catch (error) {
        console.error("createVehicle error:", error);
        return { success: false, error: "Failed to create vehicle" };
    }
}

export async function updateVehicle(id: string, data: Partial<CreateVehicleData>) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid vehicle ID" };
        }

        // Validate input
        const parseResult = updateVehicleSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: vehicle };
    } catch (error) {
        console.error("updateVehicle error:", error);
        return { success: false, error: "Failed to update vehicle" };
    }
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = updateVehicleStatusSchema.safeParse({ id, status });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: vehicle };
    } catch (error) {
        console.error("updateVehicleStatus error:", error);
        return { success: false, error: "Failed to update vehicle status" };
    }
}

export async function deleteVehicle(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid vehicle ID" };
        }

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
            return { success: false, error: "Vehicle not found" };
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
        return { success: true };
    } catch (error) {
        console.error("deleteVehicle error:", error);
        return { success: false, error: "Failed to delete vehicle" };
    }
}

export async function getVehicles(filters?: {
    status?: VehicleStatus;
    type?: VehicleType;
    search?: string;
}) {
    try {
        await requireAuth();

        // Validate filters if provided
        if (filters) {
            const parseResult = getVehicleFiltersSchema.safeParse(filters);
            if (!parseResult.success) {
                return { success: false, error: "Invalid filters", data: [] };
            }
        }

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

        const vehicles = await prisma.fleetVehicle.findMany({
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

        return { success: true, data: vehicles };
    } catch (error) {
        console.error("getVehicles error:", error);
        return { success: false, error: "Failed to get vehicles", data: [] };
    }
}

export async function getVehicleById(id: string) {
    try {
        await requireAuth();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid vehicle ID", data: null };
        }

        const vehicle = await prisma.fleetVehicle.findUnique({
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

        return { success: true, data: vehicle };
    } catch (error) {
        console.error("getVehicleById error:", error);
        return { success: false, error: "Failed to get vehicle", data: null };
    }
}

// ============================================
// PERMIT CRUD
// ============================================

export async function createPermit(data: CreatePermitData) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createPermitSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: permit };
    } catch (error) {
        console.error("createPermit error:", error);
        return { success: false, error: "Failed to create permit" };
    }
}

export async function updatePermit(id: string, data: Partial<CreatePermitData>) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid permit ID" };
        }

        // Validate input
        const parseResult = updatePermitSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: permit };
    } catch (error) {
        console.error("updatePermit error:", error);
        return { success: false, error: "Failed to update permit" };
    }
}

export async function deletePermit(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid permit ID" };
        }

        const permit = await prisma.vehiclePermit.findUnique({
            where: { id },
        });

        if (!permit) {
            return { success: false, error: "Permit not found" };
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
        return { success: true };
    } catch (error) {
        console.error("deletePermit error:", error);
        return { success: false, error: "Failed to delete permit" };
    }
}

// ============================================
// INSURANCE CRUD
// ============================================

export async function createInsurance(data: CreateInsuranceData) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createInsuranceSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: insurance };
    } catch (error) {
        console.error("createInsurance error:", error);
        return { success: false, error: "Failed to create insurance record" };
    }
}

export async function updateInsurance(id: string, data: Partial<CreateInsuranceData>) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid insurance ID" };
        }

        // Validate input
        const parseResult = updateInsuranceSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: insurance };
    } catch (error) {
        console.error("updateInsurance error:", error);
        return { success: false, error: "Failed to update insurance record" };
    }
}

export async function deleteInsurance(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid insurance ID" };
        }

        const insurance = await prisma.vehicleInsurance.findUnique({
            where: { id },
        });

        if (!insurance) {
            return { success: false, error: "Insurance record not found" };
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
        return { success: true };
    } catch (error) {
        console.error("deleteInsurance error:", error);
        return { success: false, error: "Failed to delete insurance record" };
    }
}

// ============================================
// REGISTRATION CRUD
// ============================================

export async function createRegistration(data: CreateRegistrationData) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createRegistrationSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: registration };
    } catch (error) {
        console.error("createRegistration error:", error);
        return { success: false, error: "Failed to create registration record" };
    }
}

export async function updateRegistration(id: string, data: Partial<CreateRegistrationData>) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid registration ID" };
        }

        // Validate input
        const parseResult = updateRegistrationSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: registration };
    } catch (error) {
        console.error("updateRegistration error:", error);
        return { success: false, error: "Failed to update registration record" };
    }
}

export async function deleteRegistration(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid registration ID" };
        }

        const registration = await prisma.vehicleRegistration.findUnique({
            where: { id },
        });

        if (!registration) {
            return { success: false, error: "Registration record not found" };
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
        return { success: true };
    } catch (error) {
        console.error("deleteRegistration error:", error);
        return { success: false, error: "Failed to delete registration record" };
    }
}

// ============================================
// GENERAL DOCUMENTS CRUD
// ============================================

export async function createVehicleDocument(data: CreateDocumentData) {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createVehicleDocumentSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: document };
    } catch (error) {
        console.error("createVehicleDocument error:", error);
        return { success: false, error: "Failed to create document" };
    }
}

export async function deleteVehicleDocument(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid document ID" };
        }

        const document = await prisma.vehicleDocument.findUnique({
            where: { id },
        });

        if (!document) {
            return { success: false, error: "Document not found" };
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
        return { success: true };
    } catch (error) {
        console.error("deleteVehicleDocument error:", error);
        return { success: false, error: "Failed to delete document" };
    }
}

// ============================================
// EXPIRATION TRACKING
// ============================================

export async function getExpiringDocuments(daysAhead: number = 30) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = daysAheadSchema.safeParse({ daysAhead });
        if (!parseResult.success) {
            return { success: false, error: "Invalid days ahead value", data: { permits: [], insurance: [], registrations: [] } };
        }

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

        return { success: true, data: { permits, insurance, registrations } };
    } catch (error) {
        console.error("getExpiringDocuments error:", error);
        return { success: false, error: "Failed to get expiring documents", data: { permits: [], insurance: [], registrations: [] } };
    }
}

export async function getExpiredDocuments() {
    try {
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

        return { success: true, data: { permits, insurance, registrations } };
    } catch (error) {
        console.error("getExpiredDocuments error:", error);
        return { success: false, error: "Failed to get expired documents", data: { permits: [], insurance: [], registrations: [] } };
    }
}

export async function getFleetStats() {
    try {
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
            success: true,
            data: {
                totalVehicles,
                activeVehicles,
                expiringDocuments: expiringPermits + expiringInsurance + expiringRegistration,
                expiredDocuments: expiredPermits + expiredInsurance + expiredRegistration,
            },
        };
    } catch (error) {
        console.error("getFleetStats error:", error);
        return {
            success: false,
            error: "Failed to get fleet stats",
            data: { totalVehicles: 0, activeVehicles: 0, expiringDocuments: 0, expiredDocuments: 0 },
        };
    }
}
