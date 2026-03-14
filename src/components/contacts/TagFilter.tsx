"use client";

import { Tag } from "lucide-react";
import styles from "./Contacts.module.css";

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface TagFilterProps {
    tags: TagData[];
    selectedTags: string[];
    onTagToggle: (tagId: string) => void;
    onClearAll?: () => void;
}

export default function TagFilter({
    tags,
    selectedTags,
    onTagToggle,
    onClearAll,
}: TagFilterProps) {
    if (tags.length === 0) {
        return null;
    }

    return (
        <div className={styles.tagFilter}>
            <Tag size={14} style={{ color: "var(--text-secondary)" }} />
            {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                    <button
                        key={tag.id}
                        type="button"
                        onClick={() => onTagToggle(tag.id)}
                        className={`${styles.tagFilterBtn} ${isSelected ? styles.tagFilterBtnActive : ""}`}
                        style={
                            isSelected
                                ? {
                                      backgroundColor: `${tag.color}20`,
                                      borderColor: tag.color,
                                      color: tag.color,
                                  }
                                : undefined
                        }
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: tag.color,
                            }}
                        />
                        {tag.name}
                    </button>
                );
            })}
            {selectedTags.length > 0 && onClearAll && (
                <button
                    type="button"
                    onClick={onClearAll}
                    className={styles.tagFilterClear}
                >
                    Clear
                </button>
            )}
        </div>
    );
}
