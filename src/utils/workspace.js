/**
 * Текущее рабочее пространство админки (Россия / Европа / Америка…).
 *
 * Выбирается переключателем в боковой панели и хранится в localStorage.
 * Слой API (src/api/generation.js) сам подставляет его в запросы списка
 * сессий и тегов, поэтому экраны (мастер сессии, каталог тегов, редактор
 * событий) сужаются без правок в каждом. Пустая строка — «все пространства».
 */

const STORAGE_KEY = 'cg.workspace';

export function getWorkspace() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setWorkspace(code) {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* приватный режим — пространство просто не запомнится */
  }
}

/** Параметры запроса с текущим пространством (если оно выбрано). */
export function withWorkspaceParams(params = {}) {
  const code = getWorkspace();
  return code ? { ...params, workspace: code } : params;
}

/** Название пространства на нужном языке. */
export function workspaceTitle(workspace, lang = 'ru') {
  if (!workspace) return '';
  const title = workspace.title || {};
  return title[lang] || title.ru || title.en || workspace.code;
}
