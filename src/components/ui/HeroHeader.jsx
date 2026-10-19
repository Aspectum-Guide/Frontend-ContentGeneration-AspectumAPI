const TITLE_CLASSES = {
  lg: 'text-4xl',
  display: 'text-6xl',
};

const TITLE_TONES = {
  default: 'text-aspectum-text',
  faint: 'text-aspectum-text-faint',
};

/** Центрированный заголовок для hero-, welcome- и error-состояний. */
export default function HeroHeader({
  title,
  description,
  actions,
  titleSize = 'lg',
  titleTone = 'default',
  className = '',
}) {
  return (
    <header className={`text-center ${className}`.trim()}>
      <h1 className={`${TITLE_CLASSES[titleSize] || TITLE_CLASSES.lg} font-bold ${TITLE_TONES[titleTone] || TITLE_TONES.default}`}>
        {title}
      </h1>
      {description ? <p className="mt-4 text-xl text-aspectum-text-subtle">{description}</p> : null}
      {actions ? <div className="mt-8 flex flex-wrap justify-center gap-4">{actions}</div> : null}
    </header>
  );
}
