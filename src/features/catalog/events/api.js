import { citiesAPI, eventFiltersAPI, eventsAPI } from '../../../api/generation';
import { flattenEventFilterTree, unwrapEnvelope } from '../shared/normalize';
import { mapEventTagForEventEditor } from '../shared/tagCatalog';

export const eventsCatalogAPI = {
  list: (params) => eventsAPI.list(params),
  get: (id) => eventsAPI.get(id),
  create: (data) => eventsAPI.create(data),
  update: (id, data) => eventsAPI.update(id, data),
  remove: (id) => eventsAPI.delete(id),
  setMedia: (id, data) => eventsAPI.setMedia(id, data),
  listCities: (params) => citiesAPI.list(params),
  /** Event editor tag chips: only `type === 'tag'` rows from EventsAPI tree. */
  listFilters: async () => {
    const r = await eventFiltersAPI.getTree();
    const raw = unwrapEnvelope(r?.data);
    const tree = Array.isArray(raw) ? raw : [];
    const flat = flattenEventFilterTree(tree).filter((n) => n.type === 'tag');
    return { data: flat.map(mapEventTagForEventEditor) };
  },
};

