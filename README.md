# Aspectum Admin - Content Generation Frontend

Веб-приложение для управления генерацией контента городов и достопримечательностей.

## Технологии

- **Vite** - быстрый dev server и сборщик
- **React 18** - UI библиотека
- **React Router** - роутинг
- **React Hook Form** - управление формами
- **Zod** - валидация
- **Axios** - HTTP клиент
- **Tailwind CSS** - стилизация
- **Zustand** - state management (опционально)

## Установка

```bash
# Установить зависимости
npm install

# Запустить dev server
npm run dev

# Собрать для production
npm run build

# Предпросмотр production сборки
npm run preview
```

## Структура проекта

```
frontend/
├── src/
│   ├── api/              # API клиенты
│   │   ├── client.js     # Axios instance с interceptors
│   │   └── generation.js # API для генерации контента
│   ├── components/       # React компоненты
│   │   ├── ui/          # Базовые UI компоненты
│   │   ├── forms/       # Компоненты форм
│   │   ├── wizard/      # Компоненты wizard
│   │   └── Layout.jsx   # Основной layout
│   ├── pages/           # Страницы приложения
│   │   ├── generation/  # Страницы генерации
│   │   │   ├── SessionsList.jsx
│   │   │   ├── NewSession.jsx
│   │   │   ├── SessionWizard.jsx
│   │   │   └── steps/   # Шаги wizard
│   │   └── Home.jsx
│   ├── utils/           # Утилиты
│   │   ├── constants.js
│   │   └── validation.js
│   ├── hooks/           # Custom hooks (опционально)
│   ├── stores/          # Zustand stores (опционально)
│   ├── App.jsx          # Главный компонент
│   └── main.jsx         # Точка входа
├── public/              # Статические файлы
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## API Интеграция

Приложение использует прокси для API запросов (настроено в `vite.config.js`):

```javascript
// Все запросы к /api/* проксируются на http://localhost:8000
```

### Аутентификация

JWT токен хранится в `localStorage` и автоматически добавляется в заголовки запросов через axios interceptor.

## Основные функции

### ✅ Реализовано

- Список сессий генерации
- Создание новой сессии
- Wizard с шагами
- Шаг 1: Данные города (базовая версия)
- Мультиязычные формы
- API интеграция

### 🚧 В разработке

- Шаг 2: Достопримечательности
- Шаг 3: Контент и аудиогиды
- Шаг 4: Сохранение в основную систему
- Drag & Drop для достопримечательностей
- Загрузка медиафайлов
- Интеграция с ИИ (генерация контента)
- Редактор контента

## Разработка

### Запуск dev server

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

### Настройка API

Убедитесь, что Django backend запущен на `http://localhost:8000` или измените прокси в `vite.config.js`.

### Добавление новых компонентов

1. Создайте компонент в соответствующей директории
2. Импортируйте и используйте в страницах
3. Добавьте стили через Tailwind CSS

### Работа с формами

Используйте `react-hook-form` с `zod` для валидации:

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
});

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
    </form>
  );
}
```

## Сборка для production

```bash
npm run build
```

Собранные файлы будут в директории `dist/`. Их можно развернуть на любом статическом хостинге или через nginx.

## Интеграция с Django

### CORS настройки

Убедитесь, что в Django `settings.py` настроен CORS:

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
]
```

### JWT токены

Токен должен быть сохранен в `localStorage` после авторизации:

```javascript
localStorage.setItem('access_token', token);
```

## Дополнительные библиотеки (опционально)

Для расширенной функциональности можно добавить:

- `@dnd-kit/core` - drag & drop
- `@tiptap/react` - rich text editor
- `react-query` - кеширование API запросов
- `react-dropzone` - загрузка файлов

## Troubleshooting

### Ошибка CORS

Убедитесь, что Django backend разрешает запросы с `http://localhost:3000`.

### Токен не работает

Проверьте, что токен сохранен в `localStorage` и формат правильный (Bearer token).

### API не отвечает

Проверьте, что Django сервер запущен и доступен на порту 8000.
