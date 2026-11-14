import { Button } from '@aspectum/admin-ui-web';

export default function TableRowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="xs"
        variant="soft"
        onClick={onEdit}
      >
        Ред.
      </Button>
      <Button
        type="button"
        size="xs"
        variant="softDanger"
        onClick={onDelete}
      >
        Удалить
      </Button>
    </div>
  );
}
