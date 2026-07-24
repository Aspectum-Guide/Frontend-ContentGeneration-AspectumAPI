# Catalog Refactor Blueprint

## Goal
Make catalog pages simpler, consistent, and easier to maintain by introducing a shared architecture for:
- data loading and normalization
- CRUD flows
- filtering and pagination
- modal and error handling patterns

## Current Problems
- Large page-level components mix data, UI, form logic, and side effects.
- Repeated logic in cities, events, tags, ticket types, photos.
- UI layer normalizes inconsistent API responses in every page.
- Error and confirmation UX is inconsistent (`alert`, native confirm, custom modals).

## Target Architecture

### 1. Feature-first structure

```text
src/
  features/
    catalog/
      core/
        useCatalogResource.js
        useCatalogFilters.js
      shared/
        i18n.js
        normalize.js
      cities/
        api.js
        adapters.js
        useCitiesCatalog.js
        CitiesCatalogPage.jsx
        CityEditorModal.jsx
      events/
        api.js
        adapters.js
        useEventsCatalog.js
        EventsCatalogPage.jsx
        EventEditorModal.jsx
      tags/
      ticketTypes/
      photos/
```

### 2. Domain API split
Replace monolithic `src/api/generation.js` usage in catalogs with domain wrappers:
- `features/catalog/cities/api.js`
- `features/catalog/events/api.js`
- `features/catalog/tags/api.js`
- `features/catalog/photos/api.js`

### 3. Shared contracts
- All list loaders return `{ items, total }`.
- All entities mapped to UI-safe shape in adapters (`fromApi*`, `toApi*`).
- All page components consume normalized data only.

## Refactor Phases

### Phase 1: Foundation (this commit)
- Add shared helpers and core hooks.
- Add blueprint and migration checklist.

### Phase 2: Cities migration
- Extract city adapters.
- Extract city editor modal and map field.
- Move all city list/save/delete behavior into `useCitiesCatalog`.

### Phase 3: Events migration
- Apply same pattern as cities.
- Remove duplicated language/tab/form logic into shared pieces where possible.

### Phase 4: Remaining catalogs
- Tags, ticket types, photos moved to same catalog core.

### Phase 5: Cleanup
- Remove duplicate helpers from pages.
- Reduce direct imports from `src/api/generation.js` in catalog pages.

## Rules for New Catalog Code
- No `Array.isArray(data?.results)` checks inside page component.
- No direct `alert` or `window.confirm` in page components.
- No more than one data-fetching effect per page-level resource.
- Keep page component mostly declarative (wiring only).

## Definition of Done
- All catalog pages use shared core hooks.
- API response normalization is moved to adapters only.
- Consistent modal and error UX across catalogs.
- Large page files reduced significantly (target: each page < 300-350 LOC, editor modals separate).

## Migration Checklist
- [x] Cities migrated (`features/catalog/cities/`)
- [x] Events migrated (`features/catalog/events/`)
- [x] Tags migrated (`features/catalog/tags/`)
- [x] Ticket types / prices / booking migrated (`features/catalog/booking/`)
- [x] Photos migrated (`features/catalog/photos/`)
- [x] Audioguides, interactive locations, subscriptions, LLM keys also migrated (`features/catalog/{audioguides,il,subscriptions,llm}/`) — beyond original scope, same pattern
- [x] `pages/catalog/*.jsx` are now thin re-export wrappers only (2-15 LOC each) pointing at `features/catalog/*`
- [x] Catalog pages no longer import `src/api/generation.js` directly — added `api.js` wrappers for `tags`, `audioguides`, `photos`, `il` (matching the existing `cities/api.js`/`events/api.js` pattern); only the domain `api.js` files and the shared `bookingOptions.js` helper still import from `generation.js`, which is the intended one level of indirection
- [x] `alert`/`window.confirm` removed from catalog pages — last two holdouts (`EventEditorModal.jsx`'s unsaved-changes-on-close prompt, `PhotosCatalogPage.jsx`'s delete confirmation) now use the shared `ConfirmModal`
- [ ] Duplicate helpers removed (still open — no further audit done on cross-catalog code duplication beyond the above)
- [x] Catalog docs updated (this checklist, 2026-07-24)

Remaining catalog `alert()`/`window.confirm()` usage lives outside this blueprint's original scope (in the session-generation wizard: `SessionSidebar.jsx`, `CommonsImagePicker.jsx`, `GenerationList.jsx`, `Step1City.tsx`) — not covered here.

## Caching: three mechanisms, one decision (2026-07-24)

The app had three ways of caching/fetching data at once: an axios-level GET
response cache in `src/api/client.js` (2s TTL), the manual
`useCatalogResource`/`useCatalogPagedReload` hooks above (used by all 9
catalog pages), and TanStack Query (used only by `SessionsList.jsx`). They
didn't actually conflict — the axios cache was cleared on every mutation, so
catalog pages never saw stale data — but it was a second, uncoordinated
caching layer doing a job `useCatalogResource` already does correctly
(reload right after `onAfterSave`/`onAfterDelete`).

**Decision: removed the axios response cache, kept in-flight GET dedupe +
429 retry** (both are still load-bearing — dedupe protects against React 18
double-effects firing the same request twice, retry protects against rate
limiting). Did **not** migrate the 9 catalog pages onto `useQuery`/
`useMutation` — `useCatalogResource.load(params)` is called imperatively
(page/filter changes drive it via `useCatalogPagedReload`), while `useQuery`
is declarative (keyed, auto-refetch-on-key-change); reconciling that is a
real architecture change touching every catalog page, not a safe cleanup,
and was deliberately left alone.

**Convention going forward:**
- Catalog CRUD pages (load-on-mount-or-filter-change, reload-after-mutation)
  → `useCatalogResource` + `useCatalogCrud` + `useCatalogPagedReload`.
- Anything needing background refetch, polling, or cross-component cache
  sharing → TanStack Query (`useQuery`/`useMutation`), as `SessionsList.jsx`
  already does.
- Don't add a third pattern without updating this section.
