"use client";

import { useMemo } from "react";
import RoleRouter from "@/components/RoleRouter";
import { createClient } from "@/lib/supabase/client";
import { createSupabaseRepo } from "@/lib/data/supabaseRepo";

export default function AppPage() {
  const repo = useMemo(() => createSupabaseRepo(createClient()), []);
  return <RoleRouter repo={repo} />;
}
