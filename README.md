# Aspectum Admin — Content Generation

Админ-панель для AspectumAPI: генерация контента городов/достопримечательностей через AI-визард, справочники (каталог) и настройки AI-провайдеров.

## Два продукта из одного репозитория

Кодовая база одна, но разворачивается как **два отдельных проекта** — сборка выбирается переменной `VITE_NAV_SCOPE` (см. `src/config/scope.js`, `src/config/nav.js`):

| Сборка | Команда | Что это |
|---|---|---|
| **Студия** (`studio`) | `npm run build:studio` | Работа с сессиями генерации и их миграцией на прод («Отправить в…»): `/generation`, `/ai`, `/tasks`. Живёт на студийной ноде |
| **Админка** (`catalog`) | `npm run build:catalog` | Живой каталог: `/catalog` (города, события, букинг, подписки). Живёт на прод-ноде |
| Всё вместе (`all`) | `npm run build` | Полное меню — dev-режим и текущая сборка new.studio |

Скоуп срезает не только меню, но и роуты: чужие разделы не регистрируются и недоступны по прямой ссылке. Общие страницы (логин, аккаунт, импорт/экспорт, 404) входят в обе сборки.

**Направление: репозиторий будет разделён на два проекта** — Студия и каталог-админка станут отдельными приложениями на общем пакете `@aspectum/admin-ui-web` (`apps/studio` + `apps/catalog`). До разделения весь новый код пишем так, чтобы он принадлежал одному скоупу: студийное — в `pages/generation`, `pages/ai`, `pages/tasks`; каталожное — в `features/catalog`; общее — в `components/`, `config/`, `api/`. Не добавляйте кросс-ссылки из одного скоупа в другой — они заблокируют разделение.


## Стек

- **Vite 5** + **React 18** + **React Router 6**
- **Tailwind CSS** — стилизация
- **Axios** — HTTP-клиент (`src/api/client.js`, JWT в заголовке, дедуп GET-запросов + retry на 429)
- **React Hook Form** + **Zod** — формы и валидация (используются частично, не во всех страницах — см. `docs/CATALOG_REFACTOR_BLUEPRINT.md`)
- **TanStack Query** — используется точечно (`SessionsList.jsx`); большинство страниц каталога используют собственные хуки `useCatalog*` (`src/features/catalog/core/`)
- **TypeScript** — частично, только в отдельных файлах (`.ts`/`.tsx`), остальное — `.jsx`/`.js`
- **Vitest** — тесты
- **Sentry** (`@sentry/react`) — опциональный crash reporting, no-op пока не задан `VITE_SENTRY_DSN`

## Быстрый старт

```bash
npm install
# Для локальной разработки можно задать VITE_API_URL в .env.local.
# Production-сборка использует same-origin /api/v1 и не должна получать VITE_API_URL.
npm run dev             # http://localhost:17000, проксирует /api на бэкенд из VITE_API_PROXY_TARGET
```

Другие команды:

```bash
npm run build          # полная сборка (оба скоупа) в dist/
npm run build:studio   # сборка Студии (VITE_NAV_SCOPE=studio)
npm run build:catalog  # сборка каталог-админки (VITE_NAV_SCOPE=catalog)
npm run preview   # предпросмотр прод-сборки локально
npm run lint       # eslint . --ext js,jsx,ts,tsx
npm test           # vitest run
npm run test:watch
```

### Переменные окружения (`.env`)

| Переменная | Обязательна | Назначение |
|---|---|---|
| `VITE_NAV_SCOPE` | нет | `studio` \| `catalog` — скоуп сборки (см. «Два продукта»); пусто = всё меню. Выставляется скриптами `build:studio`/`build:catalog` |
| `VITE_API_URL` | нет | Адрес backend API для локальной разработки. В production оставлять пустым: запросы идут на same-origin `/api/v1`. |
| `VITE_API_PROXY_TARGET` | нет (только dev) | Куда проксирует Vite dev-сервер `/api/*`; по умолчанию `http://localhost:8443` |
| `VITE_SENTRY_DSN` | нет | DSN проекта Sentry; если не задан — crash reporting не инициализируется |

`.env` в `.gitignore` — не коммитить реальные значения, ориентир — `.env.example`.

## Структура проекта

```
src/
├── api/
│   ├── client.js         # axios-инстанс: JWT-заголовок, refresh на 401/302, GET-дедуп, retry на 429
│   ├── auth.ts           # логин/токены
│   └── generation.js     # монолитный API-клиент генерации контента (используется по всему pages/generation)
├── features/
│   └── catalog/          # справочники — по одному поддиректорию на сущность
│       ├── core/         # useCatalogResource / useCatalogCrud / useCatalogFilters / useCatalogPagedReload
│       ├── shared/       # общие адаптеры, i18n-хелперы, лейблы
│       ├── cities/ events/ tags/ photos/ booking/ subscriptions/ audioguides/ il/ llm/
│       │   ├── api.js               # доменная обёртка над api/generation.js
│       │   ├── *CatalogPage.jsx     # страница списка
│       │   └── *EditorModal.jsx     # модалка создания/редактирования
├── pages/
│   ├── catalog/          # тонкие ре-экспорты (`export default from features/catalog/...`), исторический путь роутов
│   ├── generation/        # сессии генерации контента + визард (session-wizard/, steps/)
│   ├── ai/                # настройки AI-провайдеров, промпты, TTS, плейграунд, генерация картинок
│   ├── export/            # экспорт городов/событий в ZIP
│   ├── import/             # импорт из Google Sheets
│   ├── tasks/              # мои фоновые задачи
│   ├── TokenAuth.jsx        # единственный реальный способ логина (см. "Аутентификация")
│   └── Home.jsx
├── components/
│   ├── ui/                # Modal/ConfirmModal, FormField, DataTable, Toast — общий дизайн-кит
│   │                      # визуал ещё разъехался по className — план: docs/VISUAL_UNIFY_PLAN.md
│   ├── generation/         # CommonsImagePicker и др., специфичные для визарда
│   ├── ErrorBoundary.jsx
│   ├── ProtectedRoute.jsx  # staff-гейт через /auth/me
│   └── Layout.jsx
└── utils/
    ├── TokenManager.js     # хранение/рефреш JWT (localStorage, ключ `jwt_tokens`)
    └── errorReporting.js   # обёртка над Sentry (no-op без VITE_SENTRY_DSN)
```

## Аутентификация

- JWT (access + refresh) хранятся в `localStorage` под ключом `jwt_tokens` (`TokenManager.js`) — известный компромисс SPA без httpOnly-cookie, подробности и митигации в `docs/SECURITY.md`.
- Реальная точка входа — `/token-auth` (`TokenAuth.jsx`). Страница `/login` существовала, но была отключена (`ENABLE_LOGIN=false`) и удалена как мёртвый код.
- `ProtectedRoute.jsx` проверяет `is_staff` через `/auth/me` с кэшем на уровне модуля; `api/client.js` сам обновляет access-токен на 401/302 и один раз повторяет запрос.
- `useTokenValidation` в `Layout.jsx` периодически (раз в 5 минут) перепроверяет валидность токена.

## Каталог (справочники)

Все страницы `/catalog/*` построены по одному паттерну (`docs/CATALOG_REFACTOR_BLUEPRINT.md` — полное описание архитектуры и её история):

- `useCatalogResource` — загрузка списка + пагинация.
- `useCatalogCrud` — состояние create/edit/delete модалок.
- `useCatalogPagedReload` — синхронизация перезагрузки при смене страницы/фильтров.
- Ошибки/подтверждения — только через `ConfirmModal`/`Toast`, без `alert()`/`window.confirm()`.

Добавляя новую сущность в каталог — копируйте структуру уже мигрированной (`features/catalog/cities/` как образец), не пишите с нуля.

## Backend

Приложение — фронтенд к `AspectumAPI` (Django). Через `docker-compose.dev.yml` бэкенд не поднимается — предполагается, что он уже запущен отдельно (см. репозиторий `AspectumAPI`), а этот проект только проксирует `/api` на него.

## Docker / прод

```bash
docker build -t aspectum-admin .
```

Собирает статику и раздаёт её через nginx (`nginx.conf` в корне репозитория). `.dockerignore` исключает локальные env-файлы и `node_modules`, поэтому machine-specific `VITE_API_URL` не попадает в production Docker build: security-заголовки (CSP, X-Frame-Options и т.д.), SPA `try_files`-фоллбэк, запрет прямого доступа к `*.map`. Для локальной разработки в контейнере — `Dockerfile.dev` + `docker-compose.dev.yml`.

## Тесты

`npm test` — Vitest. На момент написания покрыты `TokenManager` (JWT-валидация, single-flight refresh, cooldown — 26 тестов) и часть `useCatalog*` хуков; остальной код тестами не покрыт — это известный технический долг, а не то, что стоит принимать за полноту.

## Связанная документация

- `docs/SECURITY.md` — модель угроз фронтенда, что уже смитигировано и что нет.
- `docs/CATALOG_REFACTOR_BLUEPRINT.md` — архитектура каталога, статус миграции по сущностям, конвенция по кэшированию данных (когда использовать `useCatalogResource`, когда — TanStack Query).
