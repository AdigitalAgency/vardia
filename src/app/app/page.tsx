"use client";

import { useMemo } from "react";
import ScheduleView from "@/components/schedule/ScheduleView";
import { createClient } from "@/lib/supabase/client";
import { createSupabaseRepo } from "@/lib/data/supabaseRepo";

export default function AppPage() {
  const repo = useMemo(() => createSupabaseRepo(createClient()), []);
  return <ScheduleView repo={repo} />;
}
