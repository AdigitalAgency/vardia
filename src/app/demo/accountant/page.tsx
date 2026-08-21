"use client";

import RoleRouter from "@/components/RoleRouter";
import { demoRepo } from "@/lib/data/demoRepo";

/** Το shell του λογιστή χωρίς login — για δοκιμή/παρουσίαση. */
export default function DemoAccountantPage() {
  return <RoleRouter repo={demoRepo} forceRole="accountant" />;
}
