// Opt-in theme switch for the "cs" (ContentStudio) look. Imported before the first
// render so there is no flash of the default theme.
//   ?theme=cs        enable and remember
//   ?theme=default   disable and forget
//   ?mode=dark|light dark mode (only meaningful with the cs theme)
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

export function applyTheme() {
  const params = new URLSearchParams(window.location.search)
  const themeParam = params.get('theme')
  const modeParam = params.get('mode')
  if (themeParam === 'cs') write(KEY_THEME, 'cs')
  else if (themeParam === 'default') write(KEY_THEME, null)
  if (modeParam === 'dark' || modeParam === 'light') write(KEY_MODE, modeParam)

  const root = document.documentElement
  const theme = themeParam === 'cs' ? 'cs' : themeParam === 'default' ? null : read(KEY_THEME)
  if (theme === 'cs') {
    root.setAttribute('data-theme', 'cs')
    const mode = modeParam === 'dark' || modeParam === 'light' ? modeParam : read(KEY_MODE)
    root.classList.toggle('dark', mode === 'dark')
  } else {
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
  }
}
