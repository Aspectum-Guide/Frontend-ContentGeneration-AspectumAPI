import { subscriptionTypesAPI } from '../../../api/subscription';

// Пункт «Любой город на выбор» в формах кодов. Отдельный тип подписки для
// него заводить не нужно: админка берёт готовый или создаёт его один раз.
export const ANY_CITY = '__any_city__';

const ANY_CITY_NAME = 'Любой город на выбор';

/** Тип «один любой город»: режим «на выбор» без списка — любой опубликованный город. */
export const isAnyCityType = (type) =>
  type?.access_mode === 'choose_city' && !(type.cities || []).length;

/** Значение формы → id типа подписки. */
export async function resolveTypeId(value, types) {
  if (value !== ANY_CITY) return value;
  const existing = types.find(isAnyCityType);
  if (existing) return existing.id;
  // Список на странице мог устареть (тип создали в другой вкладке) — сверяемся
  // с сервером, чтобы не завести второй такой же тип.
  const fresh = await subscriptionTypesAPI.list({ page_size: 500 });
  const freshList = Array.isArray(fresh?.data?.results) ? fresh.data.results : Array.isArray(fresh?.data) ? fresh.data : [];
  const found = freshList.find(isAnyCityType);
  if (found) return found.id;
  const response = await subscriptionTypesAPI.create({
    name: ANY_CITY_NAME,
    description:
      'Код открывает один любой опубликованный город — тот, в котором его вводят. Перед активацией приложение спрашивает подтверждение.',
    access_mode: 'choose_city',
    ai_prompts: 0,
    is_active: true,
    cities: [],
    events: [],
  });
  return response.data.id;
}

/** id типа → значение формы (готовый «любой город» показываем общим пунктом). */
export const typeToFormValue = (typeId, types) => {
  const type = types.find((item) => item.id === typeId);
  return isAnyCityType(type) ? ANY_CITY : typeId || '';
};
