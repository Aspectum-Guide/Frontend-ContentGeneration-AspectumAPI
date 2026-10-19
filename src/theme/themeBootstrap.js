// Theme switch. The "cs" (ContentStudio) look is the default; the old look stays
// available as an escape hatch. Applied before the first render, so there is no
// flash of the other theme.
//   ?theme=default   old look, remembered in this browser
//   ?theme=cs        new look, remembered (also clears a previous opt-out)
//   ?mode=dark|light dark mode (cs theme only), remembered
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
  if (themeParam === 'default') write(KEY_THEME, 'default')
  else if (themeParam === 'cs') write(KEY_THEME, null)
  if (modeParam === 'dark' || modeParam === 'light') write(KEY_MODE, modeParam)

  const root = document.documentElement
  const useDefaultLook = themeParam === 'default' || (themeParam !== 'cs' && read(KEY_THEME) === 'default')
  if (useDefaultLook) {
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
    return
  }
  root.setAttribute('data-theme', 'cs')
  const mode = modeParam === 'dark' || modeParam === 'light' ? modeParam : read(KEY_MODE)
  root.classList.toggle('dark', mode === 'dark')
}
