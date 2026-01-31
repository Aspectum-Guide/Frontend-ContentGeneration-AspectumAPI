// Статусы сессии
export const SESSION_STATUSES = {
  DRAFT: 'draft',
  VALIDATING: 'validating',
  READY: 'ready',
  COMMITTED: 'committed',
  FAILED: 'failed',
};

export const SESSION_STATUS_LABELS = {
  [SESSION_STATUSES.DRAFT]: 'Черновик',
  [SESSION_STATUSES.VALIDATING]: 'Валидация',
  [SESSION_STATUSES.READY]: 'Готово к сохранению',
  [SESSION_STATUSES.COMMITTED]: 'Сохранено',
  [SESSION_STATUSES.FAILED]: 'Ошибка',
};

// Шаги wizard
export const WIZARD_STEPS = {
  CITY: 1,
  ATTRACTIONS: 2,
  CONTENT: 3,
  COMMIT: 4,
};

export const WIZARD_STEP_LABELS = {
  [WIZARD_STEPS.CITY]: 'Город',
  [WIZARD_STEPS.ATTRACTIONS]: 'Достопримечательности',
  [WIZARD_STEPS.CONTENT]: 'Контент и аудиогиды',
  [WIZARD_STEPS.COMMIT]: 'Сохранение',
};

// Поддерживаемые языки
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
];

export const LANGUAGE_CODES = LANGUAGES.map(lang => lang.code);
