import { Search, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { sanitizeSearch } from '../lib/utils';

interface SearchBarProps { value: string; onChange: (value: string) => void; }

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(sanitizeSearch(local)), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [local, onChange]);

  useEffect(() => { if (!value) setLocal(''); }, [value]);

  return (
    <div className="relative group">
      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors"
              style={{ color: local ? 'var(--accent)' : 'var(--text3)' }} />
      <input
        type="search" value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder="جستجوی فیلم یا سریال…"
        autoComplete="off" spellCheck={false}
        className="w-full h-12 premium-glass rounded-2xl pr-10 pl-9 text-sm text-text focus:border-accent/30 focus:shadow-[0_0_20px_var(--accent-glow)] transition-all outline-none"
      />
      {local && (
        <button onClick={() => { setLocal(''); onChange(''); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: 'var(--text3)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
