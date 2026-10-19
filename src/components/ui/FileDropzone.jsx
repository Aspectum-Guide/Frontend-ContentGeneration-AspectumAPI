import { useRef, useState } from 'react';

export default function FileDropzone({
  children,
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  className = '',
  inputRef: externalInputRef,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setInputRef = (node) => {
    inputRef.current = node;
    if (typeof externalInputRef === 'function') externalInputRef(node);
    else if (externalInputRef) externalInputRef.current = node;
  };

  const handleFiles = (files, event) => {
    if (disabled || !files?.length) return;
    onFiles?.(Array.from(files), event);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files, event);
      }}
      className={`${className} focus-visible:outline-2 focus-visible:outline-aspectum-primary focus-visible:outline-offset-2 ${dragging ? 'border-aspectum-primary bg-aspectum-primary-soft' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`.trim()}
    >
      <input
        ref={setInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files, event);
          event.target.value = '';
        }}
        className="hidden"
      />
      {children}
    </div>
  );
}
