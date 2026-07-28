import { citiesAPI, cityFiltersAPI, iapAdminAPI, imagesAPI } from '../../../api/generation';
import { unwrapEnvelope } from '../shared/normalize';
import { mapCityTagForCityEditor } from '../shared/tagCatalog';

export const citiesCatalogAPI = {
  list: (params) => citiesAPI.list(params),
  create: (data) => citiesAPI.create(data),
  get: (id) => citiesAPI.get(id),
  update: (id, data) => citiesAPI.update(id, data),
  remove: (id) => citiesAPI.delete(id),
  listUsefulInformation: (id) => citiesAPI.listUsefulInformation(id),
  createUsefulInformation: (id, data) => citiesAPI.createUsefulInformation(id, data),
  updateUsefulInformation: (id, infoId, data) => citiesAPI.updateUsefulInformation(id, infoId, data),
  deleteUsefulInformation: (id, infoId) => citiesAPI.deleteUsefulInformation(id, infoId),
  listFilters: async () => {
    const r = await cityFiltersAPI.getTags({ type: 'tag' });
    const raw = unwrapEnvelope(r?.data);
    const arr = Array.isArray(raw) ? raw : [];
    return { data: arr.map(mapCityTagForCityEditor) };
  },
  uploadImage: (formData) => imagesAPI.upload(formData),
  syncIap: (id) => iapAdminAPI.syncCity(id),
};

