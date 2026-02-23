"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, AlertCircle } from "lucide-react";

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number; // in MB
    label?: string;
    hint?: string;
    disabled?: boolean;
    existingFile?: { name: string; url: string } | null;
    onRemove?: () => void;
    isUploading?: boolean;
}

export default function FileUpload({
    onFileSelect,
    accept = ".pdf,.jpg,.jpeg,.png,.gif,.webp",
    maxSize = 10,
    label = "Upload File",
    hint,
    disabled = false,
    existingFile,
    onRemove,
    isUploading = false,
}: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): boolean => {
        setError(null);

        // Check file size
        const maxBytes = maxSize * 1024 * 1024;
        if (file.size > maxBytes) {
            setError(`File size exceeds ${maxSize}MB limit`);
            return false;
        }

        // Check file type
        const allowedTypes = accept.split(",").map(t => t.trim().toLowerCase());
        const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
        const mimeType = file.type.toLowerCase();

        const isValidExt = allowedTypes.some(type => {
            if (type.startsWith(".")) {
                return fileExt === type;
            }
            return mimeType.includes(type.replace("*", ""));
        });

        if (!isValidExt) {
            setError(`Invalid file type. Allowed: ${accept}`);
            return false;
        }

        return true;
    }, [accept, maxSize]);

    const handleFile = useCallback((file: File) => {
        if (validateFile(file)) {
            setSelectedFile(file);
            onFileSelect(file);
        }
    }, [validateFile, onFileSelect]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (disabled || isUploading) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    }, [disabled, isUploading, handleFile]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleClick = () => {
        if (!disabled && !isUploading) {
            inputRef.current?.click();
        }
    };

    const handleRemove = () => {
        setSelectedFile(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
        onRemove?.();
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase();
        if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
            return <Image size={20} />;
        }
        return <FileText size={20} />;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    // Show existing file
    if (existingFile && !selectedFile) {
        return (
            <div className="file-upload-container">
                {label && <label className="file-upload-label">{label}</label>}
                <div className="file-preview">
                    <div className="file-info">
                        {getFileIcon(existingFile.name)}
                        <span className="file-name">{existingFile.name}</span>
                    </div>
                    <div className="file-actions">
                        <a
                            href={existingFile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-ghost"
                        >
                            View
                        </a>
                        {onRemove && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="btn btn-sm btn-ghost"
                                disabled={disabled}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
                <style jsx>{styles}</style>
            </div>
        );
    }

    // Show selected file (pending upload)
    if (selectedFile) {
        return (
            <div className="file-upload-container">
                {label && <label className="file-upload-label">{label}</label>}
                <div className={`file-preview ${isUploading ? "uploading" : ""}`}>
                    <div className="file-info">
                        {getFileIcon(selectedFile.name)}
                        <div className="file-details">
                            <span className="file-name">{selectedFile.name}</span>
                            <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                        </div>
                    </div>
                    {isUploading ? (
                        <div className="upload-progress">
                            <div className="spinner" />
                            <span>Uploading...</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="btn btn-sm btn-ghost"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                <style jsx>{styles}</style>
            </div>
        );
    }

    // Show drop zone
    return (
        <div className="file-upload-container">
            {label && <label className="file-upload-label">{label}</label>}
            <div
                className={`drop-zone ${dragActive ? "active" : ""} ${disabled || isUploading ? "disabled" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleChange}
                    disabled={disabled || isUploading}
                    style={{ display: "none" }}
                />
                <Upload size={24} className="drop-icon" />
                <p className="drop-text">
                    <span className="drop-link">Click to upload</span> or drag and drop
                </p>
                <p className="drop-hint">
                    {accept.split(",").map(t => t.trim().toUpperCase().replace(".", "")).join(", ")} up to {maxSize}MB
                </p>
            </div>
            {hint && <p className="file-upload-hint">{hint}</p>}
            {error && (
                <div className="file-upload-error">
                    <AlertCircle size={14} />
                    <span>{error}</span>
                </div>
            )}
            <style jsx>{styles}</style>
        </div>
    );
}

const styles = `
    .file-upload-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .file-upload-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-primary);
    }

    .drop-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 2rem;
        border: 2px dashed var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .drop-zone:hover:not(.disabled) {
        border-color: var(--primary);
        background: var(--primary-soft);
    }

    .drop-zone.active {
        border-color: var(--primary);
        background: var(--primary-soft);
    }

    .drop-zone.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .drop-icon {
        color: var(--text-muted);
    }

    .drop-text {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin: 0;
    }

    .drop-link {
        color: var(--primary);
        font-weight: 500;
    }

    .drop-hint {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin: 0;
    }

    .file-upload-hint {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin: 0;
    }

    .file-upload-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--danger-bg);
        border-radius: var(--radius-md);
        font-size: 0.75rem;
        color: var(--danger);
    }

    .file-preview {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
    }

    .file-preview.uploading {
        opacity: 0.7;
    }

    .file-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-secondary);
    }

    .file-details {
        display: flex;
        flex-direction: column;
    }

    .file-name {
        font-size: 0.875rem;
        color: var(--text-primary);
        font-weight: 500;
    }

    .file-size {
        font-size: 0.75rem;
        color: var(--text-muted);
    }

    .file-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .upload-progress {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
