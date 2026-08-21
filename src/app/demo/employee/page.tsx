"use client";

import RoleRouter from "@/components/RoleRouter";
import { demoRepo } from "@/lib/data/demoRepo";

/** Το employee shell χωρίς login — για δοκιμή/παρουσίαση. */
export default function DemoEmployeePage() {
  return <RoleRouter repo={demoRepo} forceRole="employee" />;
}
