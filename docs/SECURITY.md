# Безопасность фронтенда (админка)

## JWT в `localStorage`

Access и refresh токены хранятся в `localStorage` (`jwt_tokens` в `TokenManager`).

**Риск:** при XSS злоумышленник может прочитать токены и выдать себя за пользователя.

**Почему так:** SPA без cookie-based auth; httpOnly cookies требуют согласованной настройки бэкенда (CORS, CSRF, SameSite).

**Митигации на фронте:**

- Не использовать `dangerouslySetInnerHTML` для пользовательского контента.
- Не логировать тела ответов с токенами в production (`api/client.js` — только DEV).
- Регулярно обновлять зависимости; ESLint на React.

**Рекомендация для продакшена:** перейти на httpOnly refresh cookie + короткоживущий access (отдельная задача бэкенд + фронт).

## Сессия и logout

- Разлогин: `redirectToAuth()` — по возможности через `react-router` без `window.location.reload`.
- Refresh токена: очередь в `TokenManager`, повтор запроса в axios interceptor при 401.
