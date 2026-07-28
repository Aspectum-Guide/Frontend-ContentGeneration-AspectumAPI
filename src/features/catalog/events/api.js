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
  listInformation: (id) => eventsAPI.listInformation(id),
  createInformation: (id, data) => eventsAPI.createInformation(id, data),
  updateInformation: (id, infoId, data) => eventsAPI.updateInformation(id, infoId, data),
  deleteInformation: (id, infoId) => eventsAPI.deleteInformation(id, infoId),
  listFeed: (id) => eventsAPI.listFeed(id),
  createFeedItem: (id, data) => eventsAPI.createFeedItem(id, data),
  updateFeedItem: (id, feedId, data) => eventsAPI.updateFeedItem(id, feedId, data),
  deleteFeedItem: (id, feedId) => eventsAPI.deleteFeedItem(id, feedId),
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

