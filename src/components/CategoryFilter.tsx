interface CategoryFilterProps {
  selected: 'all' | 'movie' | 'series';
  onChange: (category: 'all' | 'movie' | 'series') => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const categories: Array<{ value: 'all' | 'movie' | 'series'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'movie', label: 'Movies' },
    { value: 'series', label: 'Series' },
  ];

  return (
    <div className="flex gap-2">
      {categories.map((category) => (
        <button
          key={category.value}
          onClick={() => onChange(category.value)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selected === category.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}
