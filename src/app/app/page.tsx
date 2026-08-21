"use client";

import { useMemo } from "react";
import OwnerShell from "@/components/OwnerShell";
import { createClient } from "@/lib/supabase/client";
import { createSupabaseRepo } from "@/lib/data/supabaseRepo";

export default function AppPage() {
  const repo = useMemo(() => createSupabaseRepo(createClient()), []);
  return <OwnerShell repo={repo} />;
}
