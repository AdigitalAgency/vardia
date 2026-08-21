"use client";

import type { CellValue, Department, Employee } from "@/lib/types";
import { LEAVE_TYPES } from "@/lib/types";
import { formatInterval } from "@/lib/domain/time";
import { DAY_NAMES_SHORT, addDaysISO, shortDate } from "@/lib/domain/week";

interface Props {
  weekStart: string;
  departments: Department[];
  employees: Employee[];
  cells: Record<string, CellValue[]>;
  selected: { employeeId: string; dayIndex: number } | null;
  onSelect: (employeeId: string, dayIndex: number) => void;
}

function cellLabel(c: CellValue): string {
  switch (c.kind) {
    case "empty":
      return "";
    case "repo":
      return "ΡΕΠΟ";
    case "adeia":
      return LEAVE_TYPES.find((lt) => lt.key === c.leaveType)?.label ?? "ΑΔΕΙΑ";
    case "work":
      return c.start != null && c.end != null
        ? formatInterval({ start: c.start, end: c.end })
        : "—";
  }
}

function cellClasses(c: CellValue, isSelected: boolean): string {
  const base =
    "h-11 min-w-[5.5rem] cursor-pointer select-none border-b border-r border-zinc-100 px-1 text-center text-[13px] font-medium leading-[2.75rem] whitespace-nowrap ";
  const tone =
    c.kind === "work"
      ? "bg-indigo-50 text-indigo-900"
      : c.kind === "repo"
        ? "bg-zinc-100 text-zinc-500"
        : c.kind === "adeia"
          ? "bg-amber-50 text-amber-800"
          : "bg-white text-zinc-300";
  const sel = isSelected ? " ring-2 ring-inset ring-indigo-500 " : "";
  return base + tone + sel;
}

export default function WeekGrid({
  weekStart,
  departments,
  employees,
  cells,
  selected,
  onSelect,
}: Props) {
  const byDept = departments
    .map((d) => ({
      dept: d,
      emps: employees
        .filter((e) => e.departmentId === d.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((g) => g.emps.length > 0);
  const orphans = employees.filter((e) => !departments.some((d) => d.id === e.departmentId));
  if (orphans.length) byDept.push({ dept: { id: "_", name: "ΧΩΡΙΣ ΤΜΗΜΑ", sortOrder: 99 }, emps: orphans });

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-28 min-w-[7rem] border-b border-r border-zinc-200 bg-white px-2 text-left text-xs font-semibold text-zinc-400">
              Vardia
            </th>
            {DAY_NAMES_SHORT.map((name, i) => (
              <th
                key={name}
                className="border-b border-r border-zinc-200 bg-white px-1 py-2 text-center text-xs font-semibold text-zinc-600"
              >
                {name} <span className="font-normal text-zinc-400">{shortDate(addDaysISO(weekStart, i))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {byDept.map(({ dept, emps }) => (
            <FragmentRows
              key={dept.id}
              deptName={dept.name}
              emps={emps}
              cells={cells}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRows({
  deptName,
  emps,
  cells,
  selected,
  onSelect,
}: {
  deptName: string;
  emps: Employee[];
  cells: Record<string, CellValue[]>;
  selected: Props["selected"];
  onSelect: Props["onSelect"];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={8}
          className="sticky left-0 z-10 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-bold tracking-wider text-zinc-500"
        >
          {deptName}
        </td>
      </tr>
      {emps.map((e) => (
        <tr key={e.id}>
          <td className="sticky left-0 z-10 w-28 min-w-[7rem] border-b border-r border-zinc-200 bg-white px-2 text-[13px] font-semibold text-zinc-800 whitespace-nowrap overflow-hidden text-ellipsis">
            {e.fullName}
          </td>
          {(cells[e.id] ?? []).map((c, day) => (
            <td
              key={day}
              onClick={() => onSelect(e.id, day)}
              className={cellClasses(
                c,
                selected?.employeeId === e.id && selected?.dayIndex === day
              )}
            >
              {cellLabel(c)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
