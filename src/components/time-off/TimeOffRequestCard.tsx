"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  User,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { TimeOffRequest } from "./types";
import { STATUS_CONFIG, getTypeLabel } from "./types";
import { formatDate, formatShortDate } from "./utils";
import styles from "./TimeOffRequestCard.module.css";

interface Props {
  request: TimeOffRequest;
  /** Show user name (for admin view) */
  showUser?: boolean;
  /** Show approve/reject actions (for admin) */
  showActions?: boolean;
  /** Show cancel button (for own requests) */
  canCancel?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Admin notes value */
  adminNotes?: string;
  /** Admin notes change handler */
  onAdminNotesChange?: (notes: string) => void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Approve handler */
  onApprove?: () => void;
  /** Reject handler */
  onReject?: () => void;
}

export default function TimeOffRequestCard({
  request,
  showUser = false,
  showActions = false,
  canCancel = false,
  loading = false,
  adminNotes = "",
  onAdminNotesChange,
  onCancel,
  onApprove,
  onReject,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = STATUS_CONFIG[request.status];
  const StatusIcon = config.icon;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.info}>
          <div className={styles.badges}>
            {showUser && request.user && (
              <span className={styles.userName}>
                <User size={14} />
                {request.user.name || request.user.email}
              </span>
            )}
            <span
              className={styles.badge}
              style={{ background: config.bg, color: config.color }}
            >
              <StatusIcon size={12} />
              {config.label}
            </span>
            <span className={`${styles.badge} ${styles.typeBadge}`}>
              {getTypeLabel(request.type)}
            </span>
          </div>

          <div className={styles.dateRange}>
            <span className={styles.dateRangeText}>
              {formatShortDate(request.startDate)} -{" "}
              {formatShortDate(request.endDate)}
            </span>
          </div>

          <button
            type="button"
            className={styles.expandToggle}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isExpanded ? "Hide details" : "Show details"}
          </button>
        </div>

        {canCancel && request.status === "PENDING" && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={styles.cancelBtn}
          >
            <Trash2 size={14} />
            Cancel
          </button>
        )}
      </div>

      {isExpanded && (
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <strong>Reason:</strong> {request.reason}
          </div>
          <div className={styles.detailMeta}>
            <strong>Submitted:</strong> {formatDate(request.createdAt)}
          </div>
          {request.reviewedBy && (
            <div className={styles.detailMeta}>
              <strong>Reviewed by:</strong> {request.reviewedBy.name || "Admin"}{" "}
              on {request.reviewedAt ? formatDate(request.reviewedAt) : "N/A"}
            </div>
          )}
          {request.adminNotes && (
            <div className={styles.adminNotesBox}>
              <strong>Admin Notes:</strong> {request.adminNotes}
            </div>
          )}
        </div>
      )}

      {showActions && request.status === "PENDING" && (
        <div className={styles.actions}>
          <div>
            <label className={styles.notesLabel}>Admin Notes (optional)</label>
            <textarea
              className={`input ${styles.notesInput}`}
              value={adminNotes}
              onChange={(e) => onAdminNotesChange?.(e.target.value)}
              placeholder="Add notes for the employee..."
            />
          </div>
          <div className={styles.actionBtns}>
            <button
              type="button"
              onClick={onApprove}
              disabled={loading}
              className={styles.approveBtn}
            >
              <CheckCircle size={16} />
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={loading}
              className={styles.rejectBtn}
            >
              <XCircle size={16} />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
