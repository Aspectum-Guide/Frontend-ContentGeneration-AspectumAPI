import { beforeEach, expect, it, vi } from 'vitest'

let media
let theme

beforeEach(async () => {
  vi.resetModules()
  const stored = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  })
  window.history.replaceState({}, '', '/')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  media = { matches: true, addEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  theme = await import('./themeBootstrap')
})

it('uses the system theme by default and follows changes', () => {
  theme.applyTheme()
  expect(theme.getThemeMode()).toBe('auto')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  media.matches = false
  media.addEventListener.mock.calls[0][1]()
  expect(document.documentElement.classList.contains('dark')).toBe(false)
})

it('persists explicit choices and ignores system changes until auto is selected', () => {
  theme.applyTheme()
  theme.setThemeMode('light')
  media.addEventListener.mock.calls[0][1]()
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(localStorage.getItem('aspectum-mode')).toBe('light')
  theme.setThemeMode('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  media.matches = false
  theme.setThemeMode('auto')
  expect(document.documentElement.classList.contains('dark')).toBe(false)
})

it('restores a stored choice and supports URL overrides', () => {
  localStorage.setItem('aspectum-mode', 'light')
  theme.applyTheme()
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  window.history.replaceState({}, '', '/?mode=dark')
  theme.applyTheme()
  expect(theme.getThemeMode()).toBe('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})

it('enables the themed appearance when choosing a mode from the legacy look', () => {
  localStorage.setItem('aspectum-theme', 'default')
  theme.applyTheme()
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  theme.setThemeMode('dark')
  expect(document.documentElement.dataset.theme).toBe('cs')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})
