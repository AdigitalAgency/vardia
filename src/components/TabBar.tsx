"use client";

export interface TabDef {
  key: string;
  label: string;
  icon: string;
  badge?: number;
}

interface Props {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

export default function TabBar({ tabs, active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
              active === t.key ? "text-indigo-700" : "text-zinc-400"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
            {!!t.badge && (
              <span className="absolute right-[calc(50%-1.9rem)] top-1 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
