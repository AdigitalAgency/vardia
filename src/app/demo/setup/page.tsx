"use client";

import SetupWizard from "@/components/setup/SetupWizard";
import { demoRepo } from "@/lib/data/demoRepo";

/** Ο wizard χωρίς login — για δοκιμή/παρουσίαση. */
export default function DemoSetupPage() {
  return <SetupWizard repo={demoRepo} firstTime demoMode />;
}
