import { citiesAPI, eventFiltersAPI, eventsAPI } from '../../../api/generation';

export const eventsCatalogAPI = {
  list: (params) => eventsAPI.list(params),
  get: (id) => eventsAPI.get(id),
  create: (data) => eventsAPI.create(data),
  update: (id, data) => eventsAPI.update(id, data),
  remove: (id) => eventsAPI.delete(id),
  setMedia: (id, data) => eventsAPI.setMedia(id, data),
  listCities: (params) => citiesAPI.list(params),
  listFilters: () => eventFiltersAPI.list(),
};

