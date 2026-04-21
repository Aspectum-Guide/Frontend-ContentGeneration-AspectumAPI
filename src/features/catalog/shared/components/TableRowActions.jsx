export default function TableRowActions({ onEdit, onDelete }) {
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
      >
        Ред.
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
      >
        Удалить
      </button>
    </>
  );
}
