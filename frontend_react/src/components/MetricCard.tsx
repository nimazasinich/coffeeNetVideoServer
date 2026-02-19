/**
 * Metric Card — KPI display for admin dashboard.
 * Uses design tokens, 4px grid, elevation; RTL-safe.
 */


export function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  loading,
}: {
  label: string;
  value: string | number | undefined;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="glass-card group p-5 flex flex-col justify-between overflow-hidden relative"
      style={{
        border: '1px solid var(--border)',
        minHeight: '120px',
      }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-full h-full" style={{ color }} />
      </div>
      
      <div className="flex items-center gap-3 relative z-10">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-text3 opacity-70">
          {label}
        </span>
      </div>

      <div className="mt-4 flex flex-col relative z-10">
        {loading ? (
          <div className="skeleton h-8 w-20 rounded-lg" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-text tracking-tighter">
              {value ?? '—'}
            </span>
            {suffix && (
              <span className="text-[10px] font-bold text-text3 uppercase">
                {suffix}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Decorative Gradient Line */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1 opacity-40" 
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }} 
      />
    </div>
  );
}
