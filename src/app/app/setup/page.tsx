"use client";

import { useMemo } from "react";
import SetupWizard from "@/components/setup/SetupWizard";
import { createClient } from "@/lib/supabase/client";
import { createSupabaseRepo } from "@/lib/data/supabaseRepo";

/** Προσθήκη επιπλέον καταστήματος (το πρώτο στήνεται αυτόματα από το /app). */
export default function SetupPage() {
  const repo = useMemo(() => createSupabaseRepo(createClient()), []);
  return <SetupWizard repo={repo} />;
}
