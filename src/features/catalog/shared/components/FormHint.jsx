export default function FormHint({ children }) {
  if (!children) return null;

  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
      {children}
    </div>
  );
}
