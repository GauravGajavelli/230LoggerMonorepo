/**
 * Category badge showing highlight type for a test
 *
 * @param {Object} props
 * @param {'stillFailing' | 'regression' | 'costlyDetour' | null} props.category
 * @param {'compact' | 'normal'} [props.size='normal']
 */
export function CategoryBadge({ category, size = 'normal' }) {
  if (!category) return null;

  const config = {
    stillFailing: {
      label: 'still failing',
      bgColor: 'bg-red-800',
      textColor: 'text-red-200'
    },
    regression: {
      label: 'recurring',
      bgColor: 'bg-orange-800',
      textColor: 'text-orange-200'
    },
    costlyDetour: {
      label: 'detour',
      bgColor: 'bg-yellow-800',
      textColor: 'text-yellow-200'
    }
  }[category];

  if (!config) return null;

  const sizeClasses = size === 'compact'
    ? 'text-[10px] px-1 py-0'
    : 'text-xs px-1.5 py-0.5';

  return (
    <span className={`${sizeClasses} rounded ${config.bgColor} ${config.textColor} font-medium`}>
      {config.label}
    </span>
  );
}

export default CategoryBadge;
