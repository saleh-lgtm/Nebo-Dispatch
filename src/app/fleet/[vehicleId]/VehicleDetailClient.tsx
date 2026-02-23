"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Car,
    FileText,
    Shield,
    CreditCard,
    ClipboardList,
    Plus,
    Edit,
    Trash2,
    Download,
    X,
    Upload,
} from "lucide-react";
import { VehicleType, VehicleStatus } from "@prisma/client";
import {
    createPermit,
    updatePermit,
    deletePermit,
    createInsurance,
    updateInsurance,
    deleteInsurance,
    createRegistration,
    updateRegistration,
    deleteRegistration,
    createVehicleDocument,
    deleteVehicleDocument,
} from "@/lib/fleetActions";
import { uploadFileFromFormData } from "@/lib/storageActions";
import { STORAGE_BUCKETS } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastProvider";
import ExpirationBadge from "@/components/fleet/ExpirationBadge";
import FileUpload from "@/components/ui/FileUpload";

interface VehicleDetail {
    id: string;
    name: string;
    type: VehicleType;
    status: VehicleStatus;
    make: string;
    model: string;
    year: number;
    color: string | null;
    licensePlate: string;
    vin: string;
    passengerCapacity: number | null;
    luggageCapacity: number | null;
    notes: string | null;
    createdAt: Date;
    permits: Array<{
        id: string;
        permitType: string;
        permitNumber: string | null;
        issuingAuthority: string | null;
        issueDate: Date | null;
        expirationDate: Date;
        fileUrl: string | null;
        fileName: string | null;
        notes: string | null;
    }>;
    insurance: Array<{
        id: string;
        insuranceType: string;
        provider: string;
        policyNumber: string | null;
        coverageAmount: number | null;
        issueDate: Date | null;
        expirationDate: Date;
        fileUrl: string | null;
        fileName: string | null;
        notes: string | null;
    }>;
    registration: Array<{
        id: string;
        state: string;
        registrationNumber: string | null;
        issueDate: Date | null;
        expirationDate: Date;
        fileUrl: string | null;
        fileName: string | null;
        notes: string | null;
    }>;
    documents: Array<{
        id: string;
        documentType: string;
        title: string;
        description: string | null;
        fileUrl: string;
        fileName: string;
        createdAt: Date;
        uploadedBy: { id: string; name: string | null };
    }>;
    createdBy: { id: string; name: string | null };
}

interface Props {
    vehicle: VehicleDetail;
}

type Tab = "permits" | "insurance" | "registration" | "documents";

const VEHICLE_TYPES: Record<VehicleType, string> = {
    SEDAN: "Sedan",
    SUV: "SUV",
    VAN: "Van",
    BUS: "Bus",
    LIMOUSINE: "Limousine",
    STRETCH_LIMO: "Stretch Limo",
    SPRINTER: "Sprinter",
    MINI_BUS: "Mini Bus",
    COACH: "Coach",
    OTHER: "Other",
};

const STATUS_COLORS: Record<VehicleStatus, string> = {
    ACTIVE: "var(--success)",
    INACTIVE: "var(--text-muted)",
    MAINTENANCE: "var(--warning)",
    RETIRED: "var(--danger)",
};

export default function VehicleDetailClient({ vehicle }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>("permits");
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<"permit" | "insurance" | "registration" | "document" | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Form states
    const [permitForm, setPermitForm] = useState({
        permitType: "",
        permitNumber: "",
        issuingAuthority: "",
        issueDate: "",
        expirationDate: "",
        notes: "",
    });

    const [insuranceForm, setInsuranceForm] = useState({
        insuranceType: "",
        provider: "",
        policyNumber: "",
        coverageAmount: "",
        issueDate: "",
        expirationDate: "",
        notes: "",
    });

    const [registrationForm, setRegistrationForm] = useState({
        state: "",
        registrationNumber: "",
        issueDate: "",
        expirationDate: "",
        notes: "",
    });

    const [documentForm, setDocumentForm] = useState({
        documentType: "",
        title: "",
        description: "",
    });

    const resetForms = () => {
        setPermitForm({ permitType: "", permitNumber: "", issuingAuthority: "", issueDate: "", expirationDate: "", notes: "" });
        setInsuranceForm({ insuranceType: "", provider: "", policyNumber: "", coverageAmount: "", issueDate: "", expirationDate: "", notes: "" });
        setRegistrationForm({ state: "", registrationNumber: "", issueDate: "", expirationDate: "", notes: "" });
        setDocumentForm({ documentType: "", title: "", description: "" });
        setSelectedFile(null);
        setEditingId(null);
    };

    const openModal = (type: "permit" | "insurance" | "registration" | "document", editData?: unknown) => {
        setModalType(type);
        resetForms();

        if (editData && type === "permit") {
            const p = editData as typeof vehicle.permits[0];
            setEditingId(p.id);
            setPermitForm({
                permitType: p.permitType,
                permitNumber: p.permitNumber || "",
                issuingAuthority: p.issuingAuthority || "",
                issueDate: p.issueDate ? new Date(p.issueDate).toISOString().split("T")[0] : "",
                expirationDate: new Date(p.expirationDate).toISOString().split("T")[0],
                notes: p.notes || "",
            });
        } else if (editData && type === "insurance") {
            const i = editData as typeof vehicle.insurance[0];
            setEditingId(i.id);
            setInsuranceForm({
                insuranceType: i.insuranceType,
                provider: i.provider,
                policyNumber: i.policyNumber || "",
                coverageAmount: i.coverageAmount?.toString() || "",
                issueDate: i.issueDate ? new Date(i.issueDate).toISOString().split("T")[0] : "",
                expirationDate: new Date(i.expirationDate).toISOString().split("T")[0],
                notes: i.notes || "",
            });
        } else if (editData && type === "registration") {
            const r = editData as typeof vehicle.registration[0];
            setEditingId(r.id);
            setRegistrationForm({
                state: r.state,
                registrationNumber: r.registrationNumber || "",
                issueDate: r.issueDate ? new Date(r.issueDate).toISOString().split("T")[0] : "",
                expirationDate: new Date(r.expirationDate).toISOString().split("T")[0],
                notes: r.notes || "",
            });
        }

        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalType(null);
        resetForms();
    };

    const uploadFile = async (): Promise<{ url: string; name: string; size: number } | null> => {
        if (!selectedFile) return null;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const result = await uploadFileFromFormData(
                STORAGE_BUCKETS.FLEET_DOCUMENTS,
                formData,
                `vehicles/${vehicle.id}`
            );

            return { url: result.url, name: result.fileName, size: result.fileSize };
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to upload file", "error");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handlePermitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!permitForm.permitType || !permitForm.expirationDate) {
            addToast("Please fill in required fields", "error");
            return;
        }

        setLoading(true);
        try {
            const fileData = await uploadFile();

            const data = {
                vehicleId: vehicle.id,
                permitType: permitForm.permitType,
                permitNumber: permitForm.permitNumber || undefined,
                issuingAuthority: permitForm.issuingAuthority || undefined,
                issueDate: permitForm.issueDate ? new Date(permitForm.issueDate) : undefined,
                expirationDate: new Date(permitForm.expirationDate),
                notes: permitForm.notes || undefined,
                fileUrl: fileData?.url,
                fileName: fileData?.name,
                fileSize: fileData?.size,
            };

            if (editingId) {
                await updatePermit(editingId, data);
                addToast("Permit updated successfully", "success");
            } else {
                await createPermit(data);
                addToast("Permit added successfully", "success");
            }

            closeModal();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to save permit", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleInsuranceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!insuranceForm.insuranceType || !insuranceForm.provider || !insuranceForm.expirationDate) {
            addToast("Please fill in required fields", "error");
            return;
        }

        setLoading(true);
        try {
            const fileData = await uploadFile();

            const data = {
                vehicleId: vehicle.id,
                insuranceType: insuranceForm.insuranceType,
                provider: insuranceForm.provider,
                policyNumber: insuranceForm.policyNumber || undefined,
                coverageAmount: insuranceForm.coverageAmount ? parseFloat(insuranceForm.coverageAmount) : undefined,
                issueDate: insuranceForm.issueDate ? new Date(insuranceForm.issueDate) : undefined,
                expirationDate: new Date(insuranceForm.expirationDate),
                notes: insuranceForm.notes || undefined,
                fileUrl: fileData?.url,
                fileName: fileData?.name,
                fileSize: fileData?.size,
            };

            if (editingId) {
                await updateInsurance(editingId, data);
                addToast("Insurance updated successfully", "success");
            } else {
                await createInsurance(data);
                addToast("Insurance added successfully", "success");
            }

            closeModal();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to save insurance", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registrationForm.state || !registrationForm.expirationDate) {
            addToast("Please fill in required fields", "error");
            return;
        }

        setLoading(true);
        try {
            const fileData = await uploadFile();

            const data = {
                vehicleId: vehicle.id,
                state: registrationForm.state,
                registrationNumber: registrationForm.registrationNumber || undefined,
                issueDate: registrationForm.issueDate ? new Date(registrationForm.issueDate) : undefined,
                expirationDate: new Date(registrationForm.expirationDate),
                notes: registrationForm.notes || undefined,
                fileUrl: fileData?.url,
                fileName: fileData?.name,
                fileSize: fileData?.size,
            };

            if (editingId) {
                await updateRegistration(editingId, data);
                addToast("Registration updated successfully", "success");
            } else {
                await createRegistration(data);
                addToast("Registration added successfully", "success");
            }

            closeModal();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to save registration", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!documentForm.title || !documentForm.documentType || !selectedFile) {
            addToast("Please fill in required fields and select a file", "error");
            return;
        }

        setLoading(true);
        try {
            const fileData = await uploadFile();
            if (!fileData) throw new Error("File upload failed");

            await createVehicleDocument({
                vehicleId: vehicle.id,
                documentType: documentForm.documentType,
                title: documentForm.title,
                description: documentForm.description || undefined,
                fileUrl: fileData.url,
                fileName: fileData.name,
                fileSize: fileData.size,
                mimeType: selectedFile.type,
            });

            addToast("Document uploaded successfully", "success");
            closeModal();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to upload document", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (type: "permit" | "insurance" | "registration" | "document", id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            switch (type) {
                case "permit":
                    await deletePermit(id);
                    break;
                case "insurance":
                    await deleteInsurance(id);
                    break;
                case "registration":
                    await deleteRegistration(id);
                    break;
                case "document":
                    await deleteVehicleDocument(id);
                    break;
            }
            addToast("Deleted successfully", "success");
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to delete", "error");
        }
    };

    const formatDate = (date: Date | string | null) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatCurrency = (amount: number | null) => {
        if (!amount) return "-";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <div className="vehicle-detail-page">
            {/* Header */}
            <div className="page-header">
                <Link href="/fleet" className="back-link">
                    <ArrowLeft size={18} />
                    Back to Fleet
                </Link>
                <div className="header-content">
                    <div className="header-info">
                        <div className="vehicle-icon">
                            <Car size={32} />
                        </div>
                        <div>
                            <h1>{vehicle.name}</h1>
                            <div className="header-meta">
                                <span className="vehicle-type">{VEHICLE_TYPES[vehicle.type]}</span>
                                <span className="status-badge" style={{ color: STATUS_COLORS[vehicle.status] }}>
                                    {vehicle.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vehicle Info Card */}
            <div className="info-card glass-card">
                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">Make / Model</span>
                        <span className="info-value">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">License Plate</span>
                        <span className="info-value license">{vehicle.licensePlate}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">VIN</span>
                        <span className="info-value mono">{vehicle.vin}</span>
                    </div>
                    {vehicle.color && (
                        <div className="info-item">
                            <span className="info-label">Color</span>
                            <span className="info-value">{vehicle.color}</span>
                        </div>
                    )}
                    {vehicle.passengerCapacity && (
                        <div className="info-item">
                            <span className="info-label">Passengers</span>
                            <span className="info-value">{vehicle.passengerCapacity}</span>
                        </div>
                    )}
                    {vehicle.luggageCapacity && (
                        <div className="info-item">
                            <span className="info-label">Luggage</span>
                            <span className="info-value">{vehicle.luggageCapacity}</span>
                        </div>
                    )}
                </div>
                {vehicle.notes && (
                    <div className="notes-section">
                        <span className="info-label">Notes</span>
                        <p>{vehicle.notes}</p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === "permits" ? "active" : ""}`}
                        onClick={() => setActiveTab("permits")}
                    >
                        <Shield size={18} />
                        Permits ({vehicle.permits.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "insurance" ? "active" : ""}`}
                        onClick={() => setActiveTab("insurance")}
                    >
                        <CreditCard size={18} />
                        Insurance ({vehicle.insurance.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "registration" ? "active" : ""}`}
                        onClick={() => setActiveTab("registration")}
                    >
                        <ClipboardList size={18} />
                        Registration ({vehicle.registration.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "documents" ? "active" : ""}`}
                        onClick={() => setActiveTab("documents")}
                    >
                        <FileText size={18} />
                        Documents ({vehicle.documents.length})
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content glass-card">
                    {activeTab === "permits" && (
                        <div className="tab-panel">
                            <div className="panel-header">
                                <h3>Vehicle Permits</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => openModal("permit")}>
                                    <Plus size={16} /> Add Permit
                                </button>
                            </div>
                            {vehicle.permits.length === 0 ? (
                                <div className="empty-state">
                                    <Shield size={32} />
                                    <p>No permits added yet</p>
                                </div>
                            ) : (
                                <div className="items-list">
                                    {vehicle.permits.map((permit) => (
                                        <div key={permit.id} className="item-card">
                                            <div className="item-main">
                                                <div className="item-info">
                                                    <span className="item-title">{permit.permitType}</span>
                                                    {permit.permitNumber && (
                                                        <span className="item-subtitle">#{permit.permitNumber}</span>
                                                    )}
                                                </div>
                                                <ExpirationBadge expirationDate={permit.expirationDate} />
                                            </div>
                                            <div className="item-details">
                                                {permit.issuingAuthority && (
                                                    <span>Issued by: {permit.issuingAuthority}</span>
                                                )}
                                                <span>Expires: {formatDate(permit.expirationDate)}</span>
                                            </div>
                                            <div className="item-actions">
                                                {permit.fileUrl && (
                                                    <a
                                                        href={permit.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm"
                                                    >
                                                        <Download size={14} /> View
                                                    </a>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openModal("permit", permit)}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm danger"
                                                    onClick={() => handleDelete("permit", permit.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "insurance" && (
                        <div className="tab-panel">
                            <div className="panel-header">
                                <h3>Insurance Records</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => openModal("insurance")}>
                                    <Plus size={16} /> Add Insurance
                                </button>
                            </div>
                            {vehicle.insurance.length === 0 ? (
                                <div className="empty-state">
                                    <CreditCard size={32} />
                                    <p>No insurance records added yet</p>
                                </div>
                            ) : (
                                <div className="items-list">
                                    {vehicle.insurance.map((ins) => (
                                        <div key={ins.id} className="item-card">
                                            <div className="item-main">
                                                <div className="item-info">
                                                    <span className="item-title">{ins.insuranceType}</span>
                                                    <span className="item-subtitle">{ins.provider}</span>
                                                </div>
                                                <ExpirationBadge expirationDate={ins.expirationDate} />
                                            </div>
                                            <div className="item-details">
                                                {ins.policyNumber && <span>Policy: {ins.policyNumber}</span>}
                                                {ins.coverageAmount && <span>Coverage: {formatCurrency(ins.coverageAmount)}</span>}
                                                <span>Expires: {formatDate(ins.expirationDate)}</span>
                                            </div>
                                            <div className="item-actions">
                                                {ins.fileUrl && (
                                                    <a
                                                        href={ins.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm"
                                                    >
                                                        <Download size={14} /> View
                                                    </a>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openModal("insurance", ins)}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm danger"
                                                    onClick={() => handleDelete("insurance", ins.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "registration" && (
                        <div className="tab-panel">
                            <div className="panel-header">
                                <h3>Registration Records</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => openModal("registration")}>
                                    <Plus size={16} /> Add Registration
                                </button>
                            </div>
                            {vehicle.registration.length === 0 ? (
                                <div className="empty-state">
                                    <ClipboardList size={32} />
                                    <p>No registration records added yet</p>
                                </div>
                            ) : (
                                <div className="items-list">
                                    {vehicle.registration.map((reg) => (
                                        <div key={reg.id} className="item-card">
                                            <div className="item-main">
                                                <div className="item-info">
                                                    <span className="item-title">{reg.state} Registration</span>
                                                    {reg.registrationNumber && (
                                                        <span className="item-subtitle">#{reg.registrationNumber}</span>
                                                    )}
                                                </div>
                                                <ExpirationBadge expirationDate={reg.expirationDate} />
                                            </div>
                                            <div className="item-details">
                                                <span>Expires: {formatDate(reg.expirationDate)}</span>
                                            </div>
                                            <div className="item-actions">
                                                {reg.fileUrl && (
                                                    <a
                                                        href={reg.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm"
                                                    >
                                                        <Download size={14} /> View
                                                    </a>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => openModal("registration", reg)}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm danger"
                                                    onClick={() => handleDelete("registration", reg.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "documents" && (
                        <div className="tab-panel">
                            <div className="panel-header">
                                <h3>General Documents</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => openModal("document")}>
                                    <Upload size={16} /> Upload Document
                                </button>
                            </div>
                            {vehicle.documents.length === 0 ? (
                                <div className="empty-state">
                                    <FileText size={32} />
                                    <p>No documents uploaded yet</p>
                                </div>
                            ) : (
                                <div className="items-list">
                                    {vehicle.documents.map((doc) => (
                                        <div key={doc.id} className="item-card">
                                            <div className="item-main">
                                                <div className="item-info">
                                                    <span className="item-title">{doc.title}</span>
                                                    <span className="item-subtitle">{doc.documentType}</span>
                                                </div>
                                            </div>
                                            <div className="item-details">
                                                <span>Uploaded: {formatDate(doc.createdAt)}</span>
                                                <span>By: {doc.uploadedBy.name || "Unknown"}</span>
                                            </div>
                                            <div className="item-actions">
                                                <a
                                                    href={doc.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost btn-sm"
                                                >
                                                    <Download size={14} /> Download
                                                </a>
                                                <button
                                                    className="btn btn-ghost btn-sm danger"
                                                    onClick={() => handleDelete("document", doc.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {editingId ? "Edit" : "Add"}{" "}
                                {modalType === "permit" && "Permit"}
                                {modalType === "insurance" && "Insurance"}
                                {modalType === "registration" && "Registration"}
                                {modalType === "document" && "Document"}
                            </h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        {modalType === "permit" && (
                            <form onSubmit={handlePermitSubmit}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Permit Type *</label>
                                        <input
                                            type="text"
                                            value={permitForm.permitType}
                                            onChange={(e) => setPermitForm({ ...permitForm, permitType: e.target.value })}
                                            placeholder="e.g., TCP, Airport Permit"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Permit Number</label>
                                        <input
                                            type="text"
                                            value={permitForm.permitNumber}
                                            onChange={(e) => setPermitForm({ ...permitForm, permitNumber: e.target.value })}
                                            placeholder="e.g., TCP-12345"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Issuing Authority</label>
                                        <input
                                            type="text"
                                            value={permitForm.issuingAuthority}
                                            onChange={(e) => setPermitForm({ ...permitForm, issuingAuthority: e.target.value })}
                                            placeholder="e.g., CPUC, Airport Authority"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Issue Date</label>
                                        <input
                                            type="date"
                                            value={permitForm.issueDate}
                                            onChange={(e) => setPermitForm({ ...permitForm, issueDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Expiration Date *</label>
                                        <input
                                            type="date"
                                            value={permitForm.expirationDate}
                                            onChange={(e) => setPermitForm({ ...permitForm, expirationDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={permitForm.notes}
                                        onChange={(e) => setPermitForm({ ...permitForm, notes: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                                <div className="form-group">
                                    <FileUpload
                                        label="Permit Document (Optional)"
                                        onFileSelect={setSelectedFile}
                                        isUploading={uploading}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
                                        {loading ? "Saving..." : editingId ? "Update" : "Add"} Permit
                                    </button>
                                </div>
                            </form>
                        )}

                        {modalType === "insurance" && (
                            <form onSubmit={handleInsuranceSubmit}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Insurance Type *</label>
                                        <input
                                            type="text"
                                            value={insuranceForm.insuranceType}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceType: e.target.value })}
                                            placeholder="e.g., Liability, Comprehensive"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Provider *</label>
                                        <input
                                            type="text"
                                            value={insuranceForm.provider}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, provider: e.target.value })}
                                            placeholder="e.g., State Farm"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Policy Number</label>
                                        <input
                                            type="text"
                                            value={insuranceForm.policyNumber}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, policyNumber: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Coverage Amount</label>
                                        <input
                                            type="number"
                                            value={insuranceForm.coverageAmount}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, coverageAmount: e.target.value })}
                                            placeholder="e.g., 1000000"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Issue Date</label>
                                        <input
                                            type="date"
                                            value={insuranceForm.issueDate}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, issueDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Expiration Date *</label>
                                        <input
                                            type="date"
                                            value={insuranceForm.expirationDate}
                                            onChange={(e) => setInsuranceForm({ ...insuranceForm, expirationDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={insuranceForm.notes}
                                        onChange={(e) => setInsuranceForm({ ...insuranceForm, notes: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                                <div className="form-group">
                                    <FileUpload
                                        label="Insurance Card (Optional)"
                                        onFileSelect={setSelectedFile}
                                        isUploading={uploading}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
                                        {loading ? "Saving..." : editingId ? "Update" : "Add"} Insurance
                                    </button>
                                </div>
                            </form>
                        )}

                        {modalType === "registration" && (
                            <form onSubmit={handleRegistrationSubmit}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>State *</label>
                                        <input
                                            type="text"
                                            value={registrationForm.state}
                                            onChange={(e) => setRegistrationForm({ ...registrationForm, state: e.target.value.toUpperCase() })}
                                            placeholder="e.g., CA, TX"
                                            maxLength={2}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Registration Number</label>
                                        <input
                                            type="text"
                                            value={registrationForm.registrationNumber}
                                            onChange={(e) => setRegistrationForm({ ...registrationForm, registrationNumber: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Issue Date</label>
                                        <input
                                            type="date"
                                            value={registrationForm.issueDate}
                                            onChange={(e) => setRegistrationForm({ ...registrationForm, issueDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Expiration Date *</label>
                                        <input
                                            type="date"
                                            value={registrationForm.expirationDate}
                                            onChange={(e) => setRegistrationForm({ ...registrationForm, expirationDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={registrationForm.notes}
                                        onChange={(e) => setRegistrationForm({ ...registrationForm, notes: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                                <div className="form-group">
                                    <FileUpload
                                        label="Registration Document (Optional)"
                                        onFileSelect={setSelectedFile}
                                        isUploading={uploading}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
                                        {loading ? "Saving..." : editingId ? "Update" : "Add"} Registration
                                    </button>
                                </div>
                            </form>
                        )}

                        {modalType === "document" && (
                            <form onSubmit={handleDocumentSubmit}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Document Type *</label>
                                        <select
                                            value={documentForm.documentType}
                                            onChange={(e) => setDocumentForm({ ...documentForm, documentType: e.target.value })}
                                            required
                                        >
                                            <option value="">Select type...</option>
                                            <option value="Maintenance Record">Maintenance Record</option>
                                            <option value="Inspection Report">Inspection Report</option>
                                            <option value="Repair Invoice">Repair Invoice</option>
                                            <option value="Title">Title</option>
                                            <option value="Bill of Sale">Bill of Sale</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            value={documentForm.title}
                                            onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                                            placeholder="e.g., Oil Change - Jan 2024"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={documentForm.description}
                                        onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                                        rows={2}
                                        placeholder="Optional description..."
                                    />
                                </div>
                                <div className="form-group">
                                    <FileUpload
                                        label="Document File *"
                                        onFileSelect={setSelectedFile}
                                        isUploading={uploading}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={loading || uploading || !selectedFile}>
                                        {loading ? "Uploading..." : "Upload Document"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .vehicle-detail-page {
                    padding: 1.5rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                }

                .back-link:hover {
                    color: var(--text-primary);
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1.5rem;
                }

                .header-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .vehicle-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 64px;
                    height: 64px;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: var(--radius-lg);
                }

                .header-info h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--text-primary);
                }

                .header-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 0.25rem;
                }

                .vehicle-type {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .status-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .info-card {
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 1.5rem;
                }

                .info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .info-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .info-value {
                    font-size: 1rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .info-value.license {
                    font-family: monospace;
                    background: var(--bg-secondary);
                    padding: 0.25rem 0.5rem;
                    border-radius: var(--radius-sm);
                    display: inline-block;
                }

                .info-value.mono {
                    font-family: monospace;
                    font-size: 0.875rem;
                }

                .notes-section {
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border);
                }

                .notes-section p {
                    margin: 0.5rem 0 0;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }

                .tabs-container {
                    margin-top: 1.5rem;
                }

                .tabs {
                    display: flex;
                    gap: 0.25rem;
                    margin-bottom: -1px;
                    overflow-x: auto;
                }

                .tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s ease;
                }

                .tab:hover {
                    color: var(--text-primary);
                }

                .tab.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }

                .tab-content {
                    padding: 1.5rem;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .panel-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin: 0;
                    color: var(--text-primary);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text-muted);
                    text-align: center;
                }

                .empty-state p {
                    margin: 1rem 0 0;
                }

                .items-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .item-card {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .item-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                .item-title {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .item-subtitle {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .item-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .item-actions {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .item-actions .danger {
                    color: var(--danger);
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 200;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .modal-header h2 {
                    font-size: 1.25rem;
                    margin: 0;
                    color: var(--text-primary);
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    margin-bottom: 1rem;
                }

                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                }

                @media (max-width: 640px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }

                    .tabs {
                        flex-wrap: nowrap;
                    }

                    .tab {
                        padding: 0.5rem 0.75rem;
                        font-size: 0.8125rem;
                    }
                }
            `}</style>
        </div>
    );
}
