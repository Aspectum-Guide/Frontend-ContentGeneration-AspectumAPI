import Button from './Button';
import FileButton from './FileButton';

export default function MediaUploadField({
  label,
  previewUrl,
  alt = '',
  placeholder = 'Изображение не выбрано',
  inputRef,
  accept = 'image/*',
  onChange,
  onTrigger,
  onRemove,
  uploading = false,
  disabled = false,
  uploadLabel = 'Загрузить изображение',
  uploadVariant = 'softStrong',
  uploadSize = 'sm',
  uploadClassName = '',
  previewClassName = 'max-h-32 rounded-aspectum-control border border-aspectum-border',
  previewContainerClassName = 'relative inline-flex',
  previewProps = {},
  previewOverlay,
  previewActions,
  renderPreview,
  className = '',
}) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {label && <p className="text-sm font-medium text-aspectum-text">{label}</p>}
      {previewUrl ? (
        <div className={previewContainerClassName} {...previewProps}>
          {renderPreview ? renderPreview(previewUrl) : <img src={previewUrl} alt={alt} className={previewClassName} />}
          {previewOverlay}
          {previewActions && <div className="absolute right-2 top-2">{previewActions}</div>}
        </div>
      ) : (
        <div className={previewContainerClassName} {...previewProps}>
          <p className="text-sm text-aspectum-text-muted">{placeholder}</p>
          {previewActions && <div className="absolute right-2 top-2">{previewActions}</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <FileButton
          inputRef={inputRef}
          accept={accept}
          disabled={disabled || uploading}
          onChange={onChange}
          onTrigger={onTrigger}
          variant={uploadVariant}
          size={uploadSize}
          className={uploadClassName}
        >
          {uploading ? 'Загрузка...' : uploadLabel}
        </FileButton>
        {previewUrl && onRemove && (
          <Button type="button" disabled={disabled} onClick={onRemove} variant="softDanger" size="sm">
            Убрать
          </Button>
        )}
      </div>
    </div>
  );
}
