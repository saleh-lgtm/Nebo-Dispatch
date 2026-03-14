"use client";

import { useState } from "react";
import { Check, Tag } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { assignTagsToContact } from "@/lib/tagActions";
import styles from "./Contacts.module.css";

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface TagAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string;
    contactName: string;
    availableTags: TagData[];
    currentTagIds: string[];
    onSuccess: () => void;
}

export default function TagAssignmentModal({
    isOpen,
    onClose,
    contactId,
    contactName,
    availableTags,
    currentTagIds,
    onSuccess,
}: TagAssignmentModalProps) {
    const [selectedTags, setSelectedTags] = useState<string[]>(currentTagIds);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleToggle = (tagId: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagId)
                ? prev.filter((id) => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleSave = async () => {
        setLoading(true);
        setError("");

        try {
            await assignTagsToContact(contactId, selectedTags);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update tags");
        } finally {
            setLoading(false);
        }
    };

    const hasChanges =
        selectedTags.length !== currentTagIds.length ||
        selectedTags.some((id) => !currentTagIds.includes(id));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assign Tags to ${contactName}`}>
            <div className={styles.tagAssignment}>
                {availableTags.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Tag size={32} />
                        <p className={styles.emptyStateTitle}>No tags available</p>
                        <p className={styles.emptyStateText}>
                            Create tags in the Tag Manager first.
                        </p>
                    </div>
                ) : (
                    <div className={styles.tagCheckboxList}>
                        {availableTags.map((tag) => {
                            const isSelected = selectedTags.includes(tag.id);
                            return (
                                <label
                                    key={tag.id}
                                    className={`${styles.tagCheckboxItem} ${isSelected ? styles.tagCheckboxItemSelected : ""}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggle(tag.id)}
                                        className={styles.tagCheckbox}
                                    />
                                    <div className={styles.tagCheckboxLabel}>
                                        <span
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: "50%",
                                                backgroundColor: tag.color,
                                            }}
                                        />
                                        <span>{tag.name}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}

                {error && (
                    <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>
                        {error}
                    </p>
                )}

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="btn btn-primary"
                        disabled={loading || !hasChanges}
                    >
                        <Check size={16} />
                        {loading ? "Saving..." : "Save Tags"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
