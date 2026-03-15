"use client";

import { Clock, User, Car, ChevronRight, AlertTriangle } from "lucide-react";
import { Confirmation } from "./types";
import { getTimeUntilDue, isOverdue, isUrgent, formatConfirmationTime } from "./utils";
import styles from "./ConfirmationCard.module.css";

interface ConfirmationCardProps {
  confirmation: Confirmation;
  now: Date;
  onClick: () => void;
}

export default function ConfirmationCard({
  confirmation,
  now,
  onClick,
}: ConfirmationCardProps) {
  const overdue = isOverdue(confirmation.dueAt, now);
  const urgent = isUrgent(confirmation.dueAt, now);
  const timeDisplay = getTimeUntilDue(confirmation.dueAt, now);

  return (
    <button
      className={`${styles.card} ${overdue ? styles.overdue : ""} ${
        urgent && !overdue ? styles.urgent : ""
      }`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={styles.tripNumber}>{confirmation.tripNumber}</span>
        <span
          className={`${styles.timer} ${overdue ? styles.timerOverdue : ""} ${
            urgent ? styles.timerUrgent : ""
          }`}
        >
          {overdue && <AlertTriangle size={12} />}
          <Clock size={12} />
          {timeDisplay}
        </span>
      </div>

      <div className={styles.details}>
        <div className={styles.row}>
          <User size={14} />
          <span>{confirmation.passengerName}</span>
        </div>
        <div className={styles.row}>
          <Car size={14} />
          <span>{confirmation.driverName}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.pickup}>
          Pickup: {formatConfirmationTime(confirmation.pickupAt)}
        </span>
        <ChevronRight size={16} className={styles.chevron} />
      </div>
    </button>
  );
}
