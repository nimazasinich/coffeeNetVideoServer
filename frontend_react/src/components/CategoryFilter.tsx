import { useSmartCopy } from '../context/SmartCopyContext';

const CATEGORIES = [
  { value: '',        label: 'All' },
  { value: 'movie',   label: 'Movie' },
  { value: 'series',  label: 'Series' },
];

export function CategoryFilter() {
  const { category, setCategory } = useSmartCopy();

  return (
    <div className="toggle-group" style={{ width: 'fit-content', flexShrink: 0 }}>
      {CATEGORIES.map(c => (
        <button
          key={c.value}
          className={`toggle-option${category === c.value ? ' active' : ''}`}
          onClick={() => setCategory(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
