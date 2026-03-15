"use client";

import { Trophy, ChevronDown, ChevronUp, Zap } from "lucide-react";
import styles from "./LeaderboardEntry.module.css";

interface ActionBreakdown {
  [action: string]: number;
}

interface LeaderboardEntryProps {
  rank: number;
  userName: string;
  totalActions: number;
  totalPoints: number;
  breakdown: ActionBreakdown;
  pointsConfig?: Record<string, number>;
  expanded?: boolean;
  onToggle?: () => void;
}

export default function LeaderboardEntry({
  rank,
  userName,
  totalActions,
  totalPoints,
  breakdown,
  pointsConfig = {},
  expanded = false,
  onToggle,
}: LeaderboardEntryProps) {
  const getRankStyle = () => {
    switch (rank) {
      case 1:
        return styles.gold;
      case 2:
        return styles.silver;
      case 3:
        return styles.bronze;
      default:
        return "";
    }
  };

  return (
    <div className={`${styles.entry} ${getRankStyle()}`}>
      <button className={styles.header} onClick={onToggle} type="button">
        <div className={styles.rank}>
          {rank <= 3 ? (
            <Trophy size={16} className={styles.trophy} />
          ) : (
            <span className={styles.rankNumber}>{rank}</span>
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.name}>{userName}</span>
          <span className={styles.actions}>{totalActions} actions</span>
        </div>

        <div className={styles.points}>
          <Zap size={14} />
          <span>{totalPoints}</span>
        </div>

        {onToggle && (
          <div className={styles.chevron}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {expanded && (
        <div className={styles.breakdown}>
          {Object.entries(breakdown)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([action, count]) => (
              <div key={action} className={styles.breakdownItem}>
                <span className={styles.actionName}>
                  {formatActionName(action)}
                </span>
                <span className={styles.actionCount}>
                  {count} × {pointsConfig[action] || 1}pts
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function formatActionName(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
