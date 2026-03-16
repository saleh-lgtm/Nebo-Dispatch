"use client";

import { useState } from "react";
import { User, Calendar, ChevronDown, ChevronUp, ArrowLeftRight } from "lucide-react";
import { SwapRequest, STATUS_CONFIG } from "./types";
import { formatDate, formatShiftTime, formatShortDateTime } from "./utils";
import styles from "./SwapRequestCard.module.css";

interface SwapRequestCardProps {
  request: SwapRequest;
  currentUserId: string;
  isAdmin?: boolean;
  onExpand?: (id: string | null) => void;
  expanded?: boolean;
  children?: React.ReactNode; // For action buttons
}

export default function SwapRequestCard({
  request,
  currentUserId,
  isAdmin = false,
  onExpand,
  expanded = false,
  children,
}: SwapRequestCardProps) {
  const config = STATUS_CONFIG[request.status];
  const StatusIcon = config.icon;

  const isRequester = request.requesterId === currentUserId;
  const isTarget = request.targetUserId === currentUserId;

  const toggleExpand = () => {
    onExpand?.(expanded ? null : request.id);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header} onClick={toggleExpand}>
        <div className={styles.headerLeft}>
          <div
            className={styles.status}
            style={{ background: config.bg, color: config.color }}
          >
            <StatusIcon size={14} />
            <span>{config.label}</span>
          </div>
          <span className={styles.date}>
            {formatShortDateTime(request.createdAt)}
          </span>
        </div>
        <button className={styles.expandBtn} type="button">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      <div className={styles.shifts}>
        <div className={styles.shiftInfo}>
          <div className={styles.userLabel}>
            <User size={14} />
            <span>
              {isRequester ? "Your shift" : request.requester?.name || "Unknown"}
            </span>
          </div>
          <div className={styles.shiftTime}>
            <Calendar size={12} />
            <span>{formatDate(request.requesterShift.date)} {formatShiftTime(request.requesterShift.startHour, request.requesterShift.endHour)}</span>
          </div>
        </div>

        <div className={styles.swapIcon}>
          <ArrowLeftRight size={16} />
        </div>

        <div className={styles.shiftInfo}>
          <div className={styles.userLabel}>
            <User size={14} />
            <span>
              {isTarget ? "Your shift" : request.targetUser?.name || "Unknown"}
            </span>
          </div>
          <div className={styles.shiftTime}>
            <Calendar size={12} />
            <span>{formatDate(request.targetShift.date)} {formatShiftTime(request.targetShift.startHour, request.targetShift.endHour)}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          {request.reason && (
            <div className={styles.field}>
              <span className={styles.label}>Reason:</span>
              <p className={styles.value}>{request.reason}</p>
            </div>
          )}

          {request.targetResponse && (
            <div className={styles.field}>
              <span className={styles.label}>Response:</span>
              <p className={styles.value}>{request.targetResponse}</p>
            </div>
          )}

          {request.adminNotes && (
            <div className={styles.field}>
              <span className={styles.label}>Admin Notes:</span>
              <p className={styles.value}>{request.adminNotes}</p>
            </div>
          )}

          {request.reviewedBy && (
            <div className={styles.field}>
              <span className={styles.label}>Reviewed by:</span>
              <p className={styles.value}>{request.reviewedBy.name}</p>
            </div>
          )}

          {children && <div className={styles.actions}>{children}</div>}
        </div>
      )}
    </div>
  );
}
