import {
  LayoutDashboard, BarChart3, HardDrive, Film, Tag, ShoppingCart, Settings,
  Database, ChevronRight, X, Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview',  label: 'خلاصه وضعیت',       icon: LayoutDashboard, group: 'اصلی' },
  { id: 'queue',     label: 'مدیریت صف',          icon: BarChart3,       group: 'مدیریت' },
  { id: 'drives',    label: 'درایوها و ترمینال', icon: HardDrive,       group: 'مدیریت' },
  { id: 'media',     label: 'کتابخانه رسانه',     icon: Film,            group: 'محتوا' },
  { id: 'pricing',   label: 'قیمت‌گذاری',         icon: Tag,             group: 'سیستم' },
  { id: 'sales',     label: 'فروش و گزارشات',     icon: ShoppingCart,    group: 'سیستم' },
  { id: 'settings',  label: 'تنظیمات سیستم',     icon: Settings,        group: 'سیستم' },
];

export function AdminSidebar({
  open,
  onClose,
  activeId,
  onNavigate,
  onBack,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  activeId: string;
  onNavigate: (id: string) => void;
  onBack?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const groups = Array.from(new Set(NAV_ITEMS.map(i => i.group)));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`adm-sidebar fixed top-0 bottom-0 right-0 z-[70] flex flex-col transition-all md:relative md:right-0 ${
          collapsed ? 'collapsed' : ''
        } ${
          open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-[var(--adm-border)] min-h-[64px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--adm-primary)] text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate text-[var(--adm-text-main)]">SmartCopy</h2>
                <span className="text-[10px] font-bold text-[var(--adm-primary)] uppercase tracking-wider">Pro Admin</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)] hover:bg-[var(--adm-surface-muted)] transition-all focus-ring"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
              </button>
            )}
            <button onClick={onClose} className="md:hidden p-2 text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)] focus-ring">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          {groups.map(group => (
            <div key={group}>
              {!collapsed && (
                <div className="adm-sidebar-group-label">{group}</div>
              )}
              {NAV_ITEMS.filter(i => i.group === group).map((item) => {
                const active = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`adm-sidebar-item ${active ? 'active' : ''} ${collapsed ? 'justify-center !px-0 !mx-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[var(--adm-primary)]' : 'text-[var(--adm-text-secondary)]'}`} />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="pt-4 mt-4 border-t border-[var(--adm-border)]">
            {onBack && (
              <button
                onClick={onBack}
                className={`adm-sidebar-item ${collapsed ? 'justify-center !px-0 !mx-2' : ''}`}
              >
                <ChevronRight className="w-5 h-5 flex-shrink-0 rotate-180" />
                {!collapsed && <span>بازگشت به برنامه</span>}
              </button>
            )}
          </div>
        </nav>

        <div className="p-4 mt-auto border-t border-[var(--adm-border)] bg-[var(--adm-surface-subtle)]">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-white border border-[var(--adm-border)] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Shield className="w-5 h-5 text-[var(--adm-primary)]" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--adm-text-main)] truncate">مدیریت سیستم</p>
                <p className="text-[10px] text-[var(--adm-text-muted)] font-medium">Administrator</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

