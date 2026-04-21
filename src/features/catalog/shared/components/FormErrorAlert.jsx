export default function FormErrorAlert({ message }) {
  if (!message) return null;

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      {message}
    </div>
  );
}
