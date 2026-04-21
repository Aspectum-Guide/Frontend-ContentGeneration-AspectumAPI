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
- [ ] Cities migrated
- [ ] Events migrated
- [ ] Tags migrated
- [ ] Ticket types migrated
- [ ] Photos migrated
- [ ] Duplicate helpers removed
- [ ] Catalog docs updated
