import Modal from './Modal';

export default function RawJsonModal({ open, onClose, title = 'Raw response', data }) {
  const text = data == null
    ? '—'
    : typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <pre className="text-xs bg-aspectum-surface-muted border border-aspectum-border rounded-aspectum-control p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
        {text}
      </pre>
    </Modal>
  );
}
