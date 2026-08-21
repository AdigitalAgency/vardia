"use client";

import ScheduleView from "@/components/schedule/ScheduleView";
import { demoRepo } from "@/lib/data/demoRepo";

export default function DemoPage() {
  return <ScheduleView repo={demoRepo} demoBadge />;
}
