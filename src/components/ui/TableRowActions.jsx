import Button from './Button';

export default function TableRowActions({ onEdit, onDelete, editLabel = 'Ред.', deleteLabel = 'Удалить' }) {
  return (
    <>
      {onEdit ? (
        <Button type="button" onClick={onEdit} variant="soft" size="sm">
          {editLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button type="button" onClick={onDelete} variant="softDanger" size="sm">
          {deleteLabel}
        </Button>
      ) : null}
    </>
  );
}
