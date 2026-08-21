"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { TenantInfo } from "@/lib/types";
import ScheduleView from "./schedule/ScheduleView";
import LeaveRequestsView from "./leave/LeaveRequestsView";
import StaffView from "./staff/StaffView";
import ExportView from "./accountant/ExportView";
import TabBar from "./TabBar";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  demoBadge?: boolean;
}

export default function OwnerShell({ repo, tenant, demoBadge }: Props) {
  const [tab, setTab] = useState("schedule");
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    repo
      .listLeaveRequests(tenant.id)
      .then((rs) => setPendingCount(rs.filter((r) => r.status === "pending").length))
      .catch(() => {});
  }, [repo, tenant.id]);

  useEffect(refreshPending, [refreshPending]);

  return (
    <div className="min-h-dvh bg-white pb-14">
      {tab === "schedule" && (
        <ScheduleView repo={repo} tenant={tenant} demoBadge={demoBadge} />
      )}
      {tab === "leave" && (
        <LeaveRequestsView repo={repo} tenant={tenant} onDecided={refreshPending} />
      )}
      {tab === "staff" && <StaffView repo={repo} tenant={tenant} />}
      {tab === "export" && <ExportView repo={repo} tenant={tenant} />}

      <TabBar
        active={tab}
        onChange={(k) => {
          setTab(k);
          if (k === "leave") refreshPending();
        }}
        tabs={[
          { key: "schedule", label: "Πρόγραμμα", icon: "🗓" },
          { key: "leave", label: "Αιτήματα", icon: "✋", badge: pendingCount },
          { key: "staff", label: "Προσωπικό", icon: "👥" },
          { key: "export", label: "Εξαγωγή", icon: "⬇" },
        ]}
      />
    </div>
  );
}
