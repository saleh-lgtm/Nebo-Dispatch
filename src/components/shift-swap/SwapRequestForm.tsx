"use client";

import { useState, useEffect } from "react";
import { ArrowLeftRight, Clock, Send } from "lucide-react";
import { getSwapableShifts } from "@/lib/shiftSwapActions";
import type { Schedule, SwapFormData } from "./types";
import { formatDate, formatShiftTime } from "./utils";
import styles from "./SwapRequestForm.module.css";

interface Props {
  myShifts: Schedule[];
  onSubmit: (data: SwapFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function SwapRequestForm({
  myShifts,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const [availableShifts, setAvailableShifts] = useState<Schedule[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [form, setForm] = useState<SwapFormData>({
    myShiftId: "",
    targetShiftId: "",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadShifts = async () => {
      setLoadingShifts(true);
      try {
        const now = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        const result = await getSwapableShifts(now, twoWeeksLater);
        if (result.success && result.data) {
          setAvailableShifts(result.data.availableShifts);
        }
      } catch (err) {
        console.error("Failed to load shifts:", err);
      }
      setLoadingShifts(false);
    };
    loadShifts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.myShiftId || !form.targetShiftId) {
      setError("Please select both your shift and the shift you want to swap with");
      return;
    }

    const targetShift = availableShifts.find((s) => s.id === form.targetShiftId);
    if (!targetShift) {
      setError("Target shift not found");
      return;
    }

    try {
      await onSubmit({
        ...form,
        targetUserId: targetShift.userId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit swap request");
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        <div className={styles.header}>
          <ArrowLeftRight size={18} />
          <h3 className={styles.title}>Request Shift Swap</h3>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Your Shift to Swap *</label>
            <select
              className="input"
              value={form.myShiftId}
              onChange={(e) => setForm({ ...form, myShiftId: e.target.value })}
              required
            >
              <option value="">Select your shift...</option>
              {myShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatDate(shift.date)} {formatShiftTime(shift.startHour, shift.endHour)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Shift You Want *</label>
            {loadingShifts ? (
              <div className={styles.loading}>Loading available shifts...</div>
            ) : (
              <select
                className="input"
                value={form.targetShiftId}
                onChange={(e) => setForm({ ...form, targetShiftId: e.target.value })}
                required
              >
                <option value="">Select a shift to swap with...</option>
                {availableShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.user?.name || "Unknown"} - {formatDate(shift.date)} {formatShiftTime(shift.startHour, shift.endHour)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Reason (optional)</label>
            <textarea
              className="input"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Why do you want to swap this shift?"
              rows={3}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Clock size={16} />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Request Swap
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
