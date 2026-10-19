// Theme switch. The "cs" (ContentStudio) look is the default; the old look stays
// available as an escape hatch. Applied before the first render, so there is no
// flash of the other theme.
//   ?theme=default   old look, remembered in this browser
//   ?theme=cs        new look, remembered (also clears a previous opt-out)
//   ?mode=dark|light|auto color mode, remembered
const KEY_THEME = 'aspectum-theme'
const KEY_MODE = 'aspectum-mode'

function read(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // storage unavailable (private window); the choice then lasts for this load only
  }
}

const isMode = (mode) => ['light', 'dark', 'auto'].includes(mode)
let currentMode
let systemTheme

export function getThemeMode() {
  return currentMode ?? (isMode(read(KEY_MODE)) ? read(KEY_MODE) : 'auto')
}

function renderMode() {
  const mode = getThemeMode()
  document.documentElement.classList.toggle('dark',
    document.documentElement.dataset.theme === 'cs' &&
    (mode === 'dark' || (mode === 'auto' && systemTheme?.matches)))
}

export function setThemeMode(mode) {
  if (!isMode(mode)) return
  currentMode = mode
  write(KEY_MODE, mode)
  write(KEY_THEME, null)
  document.documentElement.setAttribute('data-theme', 'cs')
  renderMode()
}

export function applyTheme() {
  const params = new URLSearchParams(window.location.search)
  const themeParam = params.get('theme')
  const modeParam = params.get('mode')
  if (themeParam === 'default') write(KEY_THEME, 'default')
  else if (themeParam === 'cs') write(KEY_THEME, null)
  currentMode = isMode(modeParam) ? modeParam : undefined
  if (isMode(modeParam)) write(KEY_MODE, modeParam)
  if (!systemTheme && typeof window.matchMedia === 'function') {
    systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    systemTheme.addEventListener('change', renderMode)
  }

  const root = document.documentElement
  const useDefaultLook = themeParam === 'default' || (themeParam !== 'cs' && read(KEY_THEME) === 'default')
  if (useDefaultLook) {
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
    return
  }
  root.setAttribute('data-theme', 'cs')
  renderMode()
}
