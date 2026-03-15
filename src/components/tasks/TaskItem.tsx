"use client";

import { useState } from "react";
import {
  CheckSquare,
  Square,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Task, formatDueDate, getPriorityInfo } from "./types";
import styles from "./TaskItem.module.css";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task, notes?: string) => Promise<void>;
  loading?: boolean;
  showPriority?: boolean;
}

export default function TaskItem({
  task,
  onToggleComplete,
  loading = false,
  showPriority = true,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  const priorityInfo = getPriorityInfo(task.priority);

  const handleComplete = async () => {
    await onToggleComplete(task, notes || undefined);
    setNotes("");
    setExpanded(false);
  };

  return (
    <div
      className={`${styles.item} ${task.isCompleted ? styles.completed : ""} ${
        dueInfo?.isOverdue && !task.isCompleted ? styles.overdue : ""
      }`}
    >
      <div className={styles.main}>
        <button
          className={styles.checkbox}
          onClick={handleComplete}
          disabled={loading}
          type="button"
        >
          {loading ? (
            <Loader2 size={18} className={styles.spinner} />
          ) : task.isCompleted ? (
            <CheckSquare size={18} className={styles.checked} />
          ) : (
            <Square size={18} />
          )}
        </button>

        <div className={styles.content}>
          <div className={styles.header}>
            <span className={`${styles.title} ${task.isCompleted ? styles.titleCompleted : ""}`}>
              {task.title}
            </span>
            {showPriority && !task.isCompleted && task.priority > 0 && (
              <span className={`${styles.priority} ${styles[priorityInfo.level]}`}>
                {priorityInfo.label}
              </span>
            )}
          </div>

          {task.description && (
            <p className={styles.description}>{task.description}</p>
          )}

          <div className={styles.meta}>
            {dueInfo && !task.isCompleted && (
              <span className={`${styles.due} ${dueInfo.isOverdue ? styles.dueOverdue : ""}`}>
                {dueInfo.isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                {dueInfo.text}
              </span>
            )}
            {task.isCompleted && task.completedAt && (
              <span className={styles.completedBadge}>
                <CheckCircle2 size={12} />
                Completed {new Date(task.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {task.createdBy && (
              <span className={styles.from}>From: {task.createdBy.name || "Admin"}</span>
            )}
          </div>
        </div>

        {!task.isCompleted && (
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {expanded && !task.isCompleted && (
        <div className={styles.expand}>
          <div className={styles.notesWrapper}>
            <MessageSquare size={14} />
            <input
              type="text"
              placeholder="Add completion notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={styles.notesInput}
            />
          </div>
          <button
            className={styles.completeBtn}
            onClick={handleComplete}
            disabled={loading}
            type="button"
          >
            {loading ? <Loader2 size={14} className={styles.spinner} /> : <CheckCircle2 size={14} />}
            Mark Complete
          </button>
        </div>
      )}

      {task.isCompleted && task.completionNotes && (
        <div className={styles.completionNotes}>
          <MessageSquare size={12} />
          <span>{task.completionNotes}</span>
        </div>
      )}
    </div>
  );
}
