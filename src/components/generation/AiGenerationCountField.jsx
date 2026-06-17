const COUNT_LIMITS = {
  cities: { min: 1, max: 50, default: 5 },
  attractions: { min: 1, max: 50, default: 5 },
  interactive_locations: { min: 1, max: 50, default: 5 },
  city_info: { min: 1, max: 20, default: 5 },
  attraction_info: { min: 1, max: 20, default: 5 },
};

export function clampGenerationCount(value, generationType = 'cities') {
  const limits = COUNT_LIMITS[generationType] || COUNT_LIMITS.cities;
  let count = parseInt(String(value), 10);
  if (Number.isNaN(count)) count = limits.default;
  return Math.max(limits.min, Math.min(limits.max, count));
}

export default function AiGenerationCountField({
  id,
  label,
  value,
  onChange,
  generationType = 'cities',
  disabled = false,
  helperText = 'Количество задаётся отдельным полем, не нужно писать число в запросе.',
}) {
  const limits = COUNT_LIMITS[generationType] || COUNT_LIMITS.cities;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={limits.min}
        max={limits.max}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
      {helperText ? (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
}
