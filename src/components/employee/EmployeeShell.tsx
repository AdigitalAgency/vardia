"use client";

import { useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { TenantInfo } from "@/lib/types";
import TabBar from "../TabBar";
import MyScheduleView from "./MyScheduleView";
import MyLeaveView from "./MyLeaveView";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}

export default function EmployeeShell({ repo, tenant }: Props) {
  const [tab, setTab] = useState("schedule");

  return (
    <div className="min-h-dvh bg-zinc-50 pb-14">
      {tab === "schedule" ? (
        <MyScheduleView repo={repo} tenant={tenant} />
      ) : (
        <MyLeaveView repo={repo} tenant={tenant} />
      )}
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "schedule", label: "Το ωράριό μου", icon: "🗓" },
          { key: "leave", label: "Άδειες", icon: "✋" },
        ]}
      />
    </div>
  );
}
