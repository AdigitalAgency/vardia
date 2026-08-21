"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Μπάρα εναλλαγής ρόλου στο /demo — ώστε να φαίνονται και τα δύο shells χωρίς login. */
const ROLES = [
  { href: "/demo", label: "Υπεύθυνος" },
  { href: "/demo/employee", label: "Εργαζόμενος" },
  { href: "/demo/accountant", label: "Λογιστής" },
  { href: "/demo/setup", label: "Στήσιμο" },
];

export default function DemoSwitcher() {
  const path = usePathname();
  return (
    <div className="flex items-center justify-center gap-1 bg-zinc-900 px-2 py-1.5 text-[11px] font-semibold text-white">
      <span className="mr-1 text-zinc-400">DEMO:</span>
      {ROLES.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          className={`rounded-md px-2 py-0.5 ${
            path === r.href ? "bg-white/15" : "text-zinc-400"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
