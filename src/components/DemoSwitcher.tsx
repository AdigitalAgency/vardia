"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Μπάρα εναλλαγής ρόλου στο /demo — ώστε να φαίνονται και τα δύο shells χωρίς login. */
export default function DemoSwitcher() {
  const path = usePathname();
  const isEmployee = path.startsWith("/demo/employee");
  return (
    <div className="flex items-center justify-center gap-1 bg-zinc-900 px-2 py-1.5 text-[11px] font-semibold text-white">
      <span className="mr-1 text-zinc-400">DEMO:</span>
      <Link
        href="/demo"
        className={`rounded-md px-2 py-0.5 ${isEmployee ? "text-zinc-400" : "bg-white/15"}`}
      >
        Υπεύθυνος
      </Link>
      <Link
        href="/demo/employee"
        className={`rounded-md px-2 py-0.5 ${isEmployee ? "bg-white/15" : "text-zinc-400"}`}
      >
        Εργαζόμενος
      </Link>
    </div>
  );
}
