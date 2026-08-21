"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { AppNotification, TenantInfo } from "@/lib/types";
import { weekRangeLabel } from "@/lib/domain/week";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  /** Πήγαινε στην εβδομάδα που αφορά η ειδοποίηση. */
  onOpenWeek?: (weekStart: string) => void;
}

function text(n: AppNotification): string {
  const week = n.payload.week_start ? weekRangeLabel(n.payload.week_start) : "";
  return n.kind === "schedule_changed"
    ? `Άλλαξε το ωράριό σου για ${week}`
    : `Βγήκε το πρόγραμμα για ${week}`;
}

/**
 * Το in-app κανάλι ειδοποίησης. Δουλεύει πάντα, ακόμα κι όταν το push δεν φτάνει
 * (iOS χωρίς Add-to-Home-Screen) — γι' αυτό το push μένει enhancement.
 */
export default function NotificationBanner({ repo, tenant, onOpenWeek }: Props) {
  const [unread, setUnread] = useState<AppNotification[]>([]);

  const load = useCallback(() => {
    repo
      .listNotifications(tenant.id)
      .then((ns) => setUnread(ns.filter((n) => !n.readAt)))
      .catch(() => {});
  }, [repo, tenant.id]);

  useEffect(load, [load]);

  if (unread.length === 0) return null;

  const latest = unread[0];

  async function dismiss() {
    const ids = unread.map((n) => n.id);
    setUnread([]);
    repo.markNotificationsRead(tenant.id, ids).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-lg px-3 pt-3">
      <div className="flex items-start justify-between gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-white">
        <button
          onClick={() => {
            if (latest.payload.week_start) onOpenWeek?.(latest.payload.week_start);
            dismiss();
          }}
          className="flex-1 text-left"
        >
          <p className="text-sm font-bold">{text(latest)}</p>
          {unread.length > 1 && (
            <p className="text-xs text-indigo-100">
              και {unread.length - 1} ακόμα {unread.length - 1 === 1 ? "ειδοποίηση" : "ειδοποιήσεις"}
            </p>
          )}
        </button>
        <button onClick={dismiss} className="shrink-0 px-1 text-sm font-bold text-indigo-100">
          ✕
        </button>
      </div>
    </div>
  );
}
