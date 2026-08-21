"use client";

import { useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { TenantInfo } from "@/lib/types";
import TabBar from "../TabBar";
import ExportView from "./ExportView";
import StaffView from "../staff/StaffView";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}

export default function AccountantShell({ repo, tenant }: Props) {
  const [tab, setTab] = useState("export");

  return (
    <div className="min-h-dvh bg-white pb-14">
      {tab === "export" ? (
        <ExportView repo={repo} tenant={tenant} />
      ) : (
        <StaffView repo={repo} tenant={tenant} payrollOnly />
      )}
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "export", label: "Εξαγωγή", icon: "⬇" },
          { key: "staff", label: "Στοιχεία", icon: "👥" },
        ]}
      />
    </div>
  );
}
