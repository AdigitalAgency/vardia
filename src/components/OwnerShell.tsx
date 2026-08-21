"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { TenantInfo } from "@/lib/types";
import ScheduleView from "./schedule/ScheduleView";
import LeaveRequestsView from "./leave/LeaveRequestsView";

interface Props {
  repo: ScheduleRepo;
  demoBadge?: boolean;
}

type Tab = "schedule" | "leave";

export default function OwnerShell({ repo, demoBadge }: Props) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [noTenant, setNoTenant] = useState(false);
  const [tab, setTab] = useState<Tab>("schedule");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    repo
      .getTenants()
      .then((ts) => (ts.length ? setTenant(ts[0]) : setNoTenant(true)))
      .catch(() => setNoTenant(true));
  }, [repo]);

  const refreshPending = useCallback(() => {
    if (!tenant) return;
    repo
      .listLeaveRequests(tenant.id)
      .then((rs) => setPendingCount(rs.filter((r) => r.status === "pending").length))
      .catch(() => {});
  }, [repo, tenant]);

  useEffect(refreshPending, [refreshPending]);

  if (noTenant) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-zinc-600">
        <h1 className="mb-2 text-lg font-bold">Δεν βρέθηκε κατάστημα</h1>
        <p className="text-sm">
          Ο λογαριασμός σου δεν είναι συνδεδεμένος με κάποιο κατάστημα. Μίλησε με τον
          διαχειριστή σου.
        </p>
      </div>
    );
  }

  if (!tenant) {
    return <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>;
  }

  return (
    <div className="min-h-dvh bg-white pb-14">
      {tab === "schedule" ? (
        <ScheduleView repo={repo} tenant={tenant} demoBadge={demoBadge} />
      ) : (
        <LeaveRequestsView repo={repo} tenant={tenant} onDecided={refreshPending} />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          <TabButton
            active={tab === "schedule"}
            onClick={() => setTab("schedule")}
            label="Πρόγραμμα"
            icon="🗓"
          />
          <TabButton
            active={tab === "leave"}
            onClick={() => {
              setTab("leave");
              refreshPending();
            }}
            label="Αιτήματα"
            icon="✋"
            badge={pendingCount}
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
        active ? "text-indigo-700" : "text-zinc-400"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
      {!!badge && (
        <span className="absolute right-[calc(50%-1.9rem)] top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
