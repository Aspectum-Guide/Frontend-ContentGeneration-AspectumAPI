import { citiesAPI, cityFiltersAPI, imagesAPI } from '../../../api/generation';
import { unwrapEnvelope } from '../shared/normalize';
import { mapCityTagForCityEditor } from '../shared/tagCatalog';

export const citiesCatalogAPI = {
  list: (params) => citiesAPI.list(params),
  get: (id) => citiesAPI.get(id),
  update: (id, data) => citiesAPI.update(id, data),
  remove: (id) => citiesAPI.delete(id),
  listFilters: async () => {
    const r = await cityFiltersAPI.getTags({ type: 'tag' });
    const raw = unwrapEnvelope(r?.data);
    const arr = Array.isArray(raw) ? raw : [];
    return { data: arr.map(mapCityTagForCityEditor) };
  },
  uploadImage: (formData) => imagesAPI.upload(formData),
};

