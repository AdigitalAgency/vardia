"use client";

import RoleRouter from "@/components/RoleRouter";
import { demoRepo } from "@/lib/data/demoRepo";

export default function DemoPage() {
  return <RoleRouter repo={demoRepo} demoBadge />;
}
