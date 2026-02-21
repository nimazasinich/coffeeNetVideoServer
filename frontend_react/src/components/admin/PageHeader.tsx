/**
 * PageHeader — Reusable enterprise-grade section header for admin panels.
 * Consistent layout: icon + title + subtitle + right-side actions slot.
 * RTL-safe. Non-destructive addition.
 */
import type { ReactNode } from 'react';

export function PageHeader({
  icon: Icon,
  iconColor = 'var(--accent)',
  title,
  subtitle,
  actions,
}: {
  icon?: React.FC<{ className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}30` }}
          >
            <Icon className="w-5 h-5" style={{ color: iconColor }} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
