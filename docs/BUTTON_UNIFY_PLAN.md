# План: общие кнопки вместо сырых `<button>`

Глава общего плана визуала: `docs/VISUAL_UNIFY_PLAN.md`. Здесь только кнопки.

## Зачем

В `src/` около **480** тегов `<button>` в **87** файлах. Общий `src/components/ui/Button.jsx` подключён примерно в **9** файлах (логин, главная, настройки AI, старый визард). Каталог и мастер генерации рисуют кнопки классами на месте.

Пока цвет, радиус и высота живут в каждом файле, переверстать кнопки целиком нельзя: правка `Button.jsx` почти ничего не меняет.

Расклад по зонам:

| Зона | Кнопок | Где |
|---|---|---|
| Каталог | ~201 | `src/features/catalog/**` |
| Мастер генерации | ~191 | `src/pages/generation/**` |
| Прочие страницы | ~27 | `src/pages/ai`, `tasks`, `import`, `export` |
| Оболочка | ~21 | `Layout.jsx` |
| Общие компоненты | ~20 | `components/ui`, `components/generation` |

Повторяющиеся виды (по статическим `className`, без учёта шаблонных строк):

- синяя заливка `bg-blue-600` — основное действие, ~50+
- мягкая синяя `bg-blue-50 text-blue-600` — «Ред.», вторичные действия в таблице
- мягкая красная `bg-red-50 text-red-600` — «Удалить»
- серая заливка `bg-gray-100` — «Отмена», второстепенное
- обводка `border-gray-300` / `border-gray-200`
- сплошная красная `bg-red-600` — опасное подтверждение
- текстовая ссылка `hover:underline` — редкие действия в тексте

Отдельно и **не кнопки для этого плана**: переключатели `w-9 h-5 rounded-full`, крестики модалок, чипы тегов, пункты сайдбара. У них другой жест и другой размер.

## Почему текущий `Button` нельзя просто подставить

Сейчас у него одна база на все случаи:

- `min-h-[44px]`, `rounded-md`, `text-base sm:text-sm`
- варианты только `primary | secondary | danger | outline`
- `className` дописывается в конец строки

В каталоге основные кнопки другие: `text-sm`, `rounded-lg`, без минимальной высоты 44px. Кнопки строки ещё меньше: `text-xs`, `px-2 py-1` или `px-3 py-1.5`. Если заменить их текущим `Button`, таблицы и шапки разъедутся.

В Tailwind побеждает порядок в сгенерированном CSS, а не порядок классов в строке. Дописать `px-2` поверх `px-4` ненадёжно. Размер и цвет должны собираться из `size` и `variant`, а `className` — только для раскладки (`w-full`, `ml-auto`), не для перекраса.

## Целевой компонент

Один `Button` в `src/components/ui/Button.jsx`. Цвет живёт в варианте, отступы и радиус — в размере. Варианты не пересекаются по утилитам.

```jsx
<Button variant="primary" size="md" onClick={onCreate}>Создать</Button>
<Button variant="soft" size="sm" onClick={onEdit}>Ред.</Button>
<Button variant="softDanger" size="sm" onClick={onDelete}>Удалить</Button>
<Button variant="secondary" size="md" onClick={onClose}>Отмена</Button>
```

| `variant` | Как выглядит сейчас | Где |
|---|---|---|
| `primary` | белый текст, `bg-blue-600`, hover `bg-blue-700` | создать, сохранить, опубликовать |
| `secondary` | `bg-gray-100 text-gray-700`, hover `bg-gray-200` | отмена, загрузка файла |
| `outline` | белый фон, `border-gray-300` | второстепенное рядом с primary |
| `danger` | белый текст, `bg-red-600` | подтверждение удаления |
| `soft` | `bg-blue-50 text-blue-600` | «Ред.» и мелкие действия |
| `softDanger` | `bg-red-50 text-red-600` | «Удалить» в строке |
| `ghost` | без фона, серый текст, hover-фон | тихие действия, «закрыть» текстом |
| `link` | цвет текста и `hover:underline`, без рамки и заливки | ссылки-кнопки |

| `size` | Отступы | Где |
|---|---|---|
| `sm` | `text-xs`, плотный padding, `rounded-md` | строки таблиц, чипы-действия |
| `md` | `text-sm`, `px-4 py-2`, `rounded-lg` | шапки каталога, тулбары |
| `lg` | `min-h-[44px]`, `rounded-lg` | низ формы, мобильные пары Save/Cancel |

`type` по умолчанию `button`. `disabled` гасит клик и даёт `disabled:opacity-50` (как в каталоге), а не серую заливку на всех вариантах. Проп `className` остаётся для раскладки.

Цвета вроде `violet`, `purple`, `amber`, `green`, `indigo` в общий набор не входят. Таких кнопок единицы (`UserSubscriptionsWorkbenchPage`, публикация, импорт). Их либо оставляем локальными, либо заводим вариант только после второго такого же экрана.

## Фазы

Менять вид по ходу замены не нужно: каждый шаг повторяет текущие классы через `size` + `variant`.

### Фаза 0. Починить `Button`, не трогая экраны

- Разнести базу на `size` и `variant` по таблицам выше.
- Дефолт для уже подключённых 9 файлов оставить визуально как сейчас (`size="lg"` или явный размер на этих вызовах), чтобы логин и главная не подпрыгнули.
- Не подключать `tailwind-merge` и новые пакеты.

Готово, когда новые пропы покрывают семь вариантов и три размера, а старые вызовы `variant="primary|secondary|danger|outline"` выглядят как до правки.

### Фаза 1. Три узких места, через которые уже ходят десятки экранов

Эти файлы сами рисуют `<button>`, хотя ими пользуются страницы:

- `src/features/catalog/shared/components/CatalogPageHeader.jsx` — primary `md` и outline `md`
- `src/features/catalog/shared/components/TableRowActions.jsx` — soft `sm` и softDanger `sm`
- `src/components/ui/FormField.jsx`, функция `FormActions` — primary/danger/success `lg` и secondary `lg`

`success` у `FormActions` встречается как зелёная кнопка сохранения. На фазе 1 оставить её локальным классом внутри `FormActions` или пропом `className`, не плодя вариант `success` в общий набор, пока вторая такая кнопка не появится.

После этой фазы шапки каталога и кнопки «Ред.» / «Удалить», которые идут через `TableRowActions`, меняются в двух файлах.

### Фаза 2. Каталог, где кнопки ещё написаны вручную

Сначала страницы с пачкой однотипных действий, потом модалки.

- `features/catalog/booking/BookingSetupWorkbenchPage.jsx` (~30)
- `features/catalog/il/InteractiveLocationsCatalogPage.jsx` (~12)
- `features/catalog/booking/ExternalProductsLinkingPage.jsx` (~10)
- `features/catalog/booking/SlotAvailabilitiesCatalogPage.jsx` (~9)
- `features/catalog/photos/PhotosCatalogPage.jsx` (~9)
- `features/catalog/events/EventItineraryTab.jsx`, `EventInclusionsTab.jsx` (~9 каждая)
- `features/catalog/cities/CityEditorModal.jsx` (~8)
- `features/catalog/booking/ExternalProductsCatalogPage.jsx` (~8)
- `features/catalog/audioguides/AudioGuidesCatalogPage.jsx` (~8)
- `features/catalog/subscriptions/UserSubscriptionsWorkbenchPage.jsx` (~7) — фиолетовые кнопки не перекрашивать в синий
- `features/catalog/events/OrphanEventsPage.jsx`, `EventsCatalogPage.jsx`, `tags/TagsFiltersCatalogPage.jsx`

Переключатели видимости (`w-9 h-5`) и чипы тегов не заменять на `Button`.

### Фаза 3. Мастер генерации

Самые плотные файлы:

- `pages/generation/session-wizard/SessionWizardAttractionAudioGuidesBlock.jsx` (~31)
- `pages/generation/session-wizard/SessionWizardTagsCatalogStep.jsx` (~27)
- `pages/generation/session-wizard/SessionWizardAttractionsStep.jsx` (~23)
- `SessionWizardAttractionInfoStep.jsx`, `SessionWizardInteractiveLocationsStep.jsx`, `SessionWizardAttractionFeedStep.jsx` (~15–16)
- `SessionWizardCityInfoStep.jsx`, `SessionWizardCityStep.jsx`
- `pages/generation/SessionsList.jsx`, `SessionWizard.jsx`

Здесь много кнопок внутри карточек. Имеет смысл заменять только те, что совпадают с таблицей вариантов. Уникальные бейджи поверх картинки и иконки закрытия оставить как есть.

### Фаза 4. Оболочка и остальные страницы

- `components/Layout.jsx` — кнопки тулбара и шапки. Пункты меню сайдбара не обязан становиться `Button`: это навигация на всю ширину.
- `pages/ai/*`, `pages/tasks/*`, `pages/import/*`, `pages/export/*`
- `components/generation/SessionCloseDialog.jsx`, `SessionDeleteDialog.jsx`, `CommonsImagePicker.jsx`
- `components/ui/Modal.jsx`, `DataTable.jsx` — кнопки внутри каркаса

### Фаза 5. Замок

- Поиск по `src`: сырой `<button` остаётся только у переключателей, иконок, чипов и сайдбара.
- В `Button.jsx` нет второго набора классов «на всякий случай».
- Короткий комментарий над вариантами: какой размер для таблицы, какой для шапки.

## Как делать один файл

1. Найти `<button` и выписать, на какой `variant` + `size` он садится.
2. Заменить разметку, сохранить `type`, `disabled`, `onClick`, `aria-*`.
3. Не переносить в `className` цвет и padding. Если кнопка не из таблицы — оставить сырой `<button>` и пометить в этом файле в списке исключений.
4. Глянуть экран: высота строки таблицы, шапка, футер модалки.

## Чего не делать

- Не менять все 480 кнопок одним коммитом. Фаза 1 уже даёт общий вид каталога, фазы 2–3 можно резать по домену.
- Не подгонять редкие фиолетовые, зелёные и янтарные кнопки под `primary`.
- Не тащить библиотеку вариантов, пока хватает объекта классов в `Button.jsx`.
