"use client";

import OwnerShell from "@/components/OwnerShell";
import { demoRepo } from "@/lib/data/demoRepo";

export default function DemoPage() {
  return <OwnerShell repo={demoRepo} demoBadge />;
}
