import { citiesAPI, cityFiltersAPI, imagesAPI } from '../../../api/generation';

export const citiesCatalogAPI = {
  list: (params) => citiesAPI.list(params),
  get: (id) => citiesAPI.get(id),
  update: (id, data) => citiesAPI.update(id, data),
  remove: (id) => citiesAPI.delete(id),
  listFilters: () => cityFiltersAPI.list(),
  uploadImage: (formData) => imagesAPI.upload(formData),
};

