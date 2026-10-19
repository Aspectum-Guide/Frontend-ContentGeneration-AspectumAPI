import { useRef } from 'react';
import Button from './Button';

/** Единый визуальный trigger для нативного выбора файлов. */
export default function FileButton({
  children = 'Выбрать файл',
  onChange,
  onTrigger,
  accept,
  multiple = false,
  disabled = false,
  variant = 'secondary',
  size = 'md',
  className = '',
  inputRef: externalInputRef,
  ...props
}) {
  const inputRef = useRef(null);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={() => {
          onTrigger?.();
          inputRef.current?.click();
        }}
        {...props}
      >
        {children}
      </Button>
      <input
        ref={(node) => {
          inputRef.current = node;
          if (typeof externalInputRef === 'function') externalInputRef(node);
          else if (externalInputRef) externalInputRef.current = node;
        }}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        className="hidden"
      />
    </>
  );
}
