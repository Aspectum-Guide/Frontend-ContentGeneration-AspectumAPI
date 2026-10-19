const colorMap = {
  success: 'bg-aspectum-success',
  error: 'bg-aspectum-danger',
  info: 'bg-aspectum-primary',
  warning: 'bg-aspectum-warning',
};

export default function Toast({ note, className = '' }) {
  if (!note) return null;

  return (
    <div
      role="status"
      className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-aspectum-control text-aspectum-on-accent text-sm shadow-aspectum-elevated transition-all ${colorMap[note.type] || colorMap.info} ${className}`.trim()}
    >
      {note.msg}
    </div>
  );
}
