import FileDropzone from './FileDropzone';

export default function DropzoneField({ children, draggingTone = 'info', className = '', ...props }) {
  const toneClass = draggingTone === 'info' ? 'border-aspectum-primary bg-aspectum-primary-soft' : '';
  return (
    <FileDropzone
      className={`border-2 border-dashed border-aspectum-border rounded-aspectum-card bg-aspectum-surface-muted transition-colors ${toneClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </FileDropzone>
  );
}
