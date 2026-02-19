interface CategoryFilterProps {
  selected: 'all' | 'movie' | 'series';
  onChange: (category: 'all' | 'movie' | 'series') => void;
}

const CATS = [
  { value: 'all',    label: 'همه',   emoji: '🎬' },
  { value: 'movie',  label: 'فیلم',  emoji: '🎥' },
  { value: 'series', label: 'سریال', emoji: '📺' },
] as const;

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="tab-bar flex-shrink-0">
      {CATS.map(cat => (
        <button key={cat.value} onClick={() => onChange(cat.value)}
                className={`tab-item ${selected === cat.value ? 'active' : ''}`}>
          <span className="mr-1">{cat.emoji}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
