"use client";

import { useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { TenantInfo } from "@/lib/types";
import OwnerShell from "./OwnerShell";
import EmployeeShell from "./employee/EmployeeShell";
import AccountantShell from "./accountant/AccountantShell";
import SetupWizard from "./setup/SetupWizard";

interface Props {
  repo: ScheduleRepo;
  demoBadge?: boolean;
  /** Παράκαμψη ρόλου — το χρησιμοποιεί μόνο το /demo/employee. */
  forceRole?: TenantInfo["role"];
}

/** Φορτώνει το tenant του συνδεδεμένου χρήστη και δείχνει το shell του ρόλου του. */
export default function RoleRouter({ repo, demoBadge, forceRole }: Props) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [noTenant, setNoTenant] = useState(false);

  useEffect(() => {
    repo
      .getTenants()
      .then((ts) => (ts.length ? setTenant(ts[0]) : setNoTenant(true)))
      .catch(() => setNoTenant(true));
  }, [repo]);

  // Χωρίς κατάστημα, το πρώτο πράγμα που βλέπει ο χρήστης είναι το στήσιμο.
  if (noTenant) return <SetupWizard repo={repo} firstTime />;

  if (!tenant) {
    return <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>;
  }

  const role = forceRole ?? tenant.role;
  const scoped = forceRole ? { ...tenant, role: forceRole } : tenant;

  if (role === "employee") return <EmployeeShell repo={repo} tenant={scoped} />;
  if (role === "accountant") return <AccountantShell repo={repo} tenant={scoped} />;
  return <OwnerShell repo={repo} tenant={scoped} demoBadge={demoBadge} />;
}
