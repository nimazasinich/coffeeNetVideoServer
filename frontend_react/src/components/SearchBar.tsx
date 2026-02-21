import { Search, X } from 'lucide-react';
import { useSmartCopy } from '../context/SmartCopyContext';

export function SearchBar() {
  const { search, setSearch } = useSmartCopy();

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: 440 }}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: 13, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text3)',
          pointerEvents: 'none',
        }}
      />
      <input
        className="input-field"
        type="text"
        placeholder="Search movies & series..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ paddingLeft: 36, paddingRight: search ? 36 : 14 }}
      />
      {search && (
        <button
          onClick={() => setSearch('')}
          style={{
            position: 'absolute',
            right: 10, top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            cursor: 'pointer',
            display: 'flex',
            padding: 2,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
