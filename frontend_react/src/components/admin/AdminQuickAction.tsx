import React from 'react';

export function AdminQuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[var(--adm-surface-subtle)] border border-[var(--adm-border)] hover:bg-white hover:border-[var(--adm-primary)] hover:shadow-md transition-all group focus-ring"
      aria-label={label}
    >
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-[var(--adm-primary)] group-hover:text-white transition-all">
        <Icon className="w-5 h-5 text-[var(--adm-text-secondary)] group-hover:text-white transition-colors" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] group-hover:text-[var(--adm-text-main)] transition-colors">
        {label}
      </span>
    </button>
  );
}

