import {
  normalizeId,
  normalizeTagIds,
  stripLegacyImageFields,
  resolveSessionEntityImageId,
  resolveSessionEntityImageUrl,
  resolveSessionEntityImageOriginalUrl,
  resolveSessionEntityImageCopyright,
  DEFAULT_LOCALE_DEFS,
  getLocaleInfo,
} from './sessionWizardShared.jsx';
import { interactiveLocationsAPI } from '../../../api/generation';

export const normalizeServerCityDraftsFromSessionData = (sessionData) => {
  if (!sessionData) return [];
  const drafts = sessionData.city_drafts || [];
  return drafts.map((d) => ({
    ...d,
    id: normalizeDraftId(d.id),
    tags: normalizeTagIds(d.tags ?? d.city_tags ?? []),
  }));
};

export const normalizeInteractiveLocation = (loc = {}) => {
  const index = Number(loc.index ?? loc.order ?? 0);
  const cityId = normalizeId(loc.city_id ?? loc.city) || null;
  const sessionCityId = normalizeId(loc.session_city_id ?? loc.session_city) || null;
  let assignedCityType = loc.assigned_city_type ?? 'none';
  if (!loc.assigned_city_type) {
    if (cityId) assignedCityType = 'database';
    else if (sessionCityId) assignedCityType = 'draft';
  }

  const image_id = resolveSessionEntityImageId(loc) || null;
  const image_url = resolveSessionEntityImageUrl(loc);
  const image_original_url = resolveSessionEntityImageOriginalUrl(loc);
  const image_copyright = resolveSessionEntityImageCopyright(loc);

  return {
    ...stripLegacyImageFields(loc),
    id: loc.id ?? null,
    name: loc.name ?? {},
    description: loc.description ?? {},
    lat: loc.lat ?? null,
    lon: loc.lon ?? null,
    index,
    order: index,
    rank: Number(loc.rank ?? 0),
    city: cityId,
    city_id: cityId,
    session_city: sessionCityId,
    session_city_id: sessionCityId,
    assigned_city_type: assignedCityType,
    assigned_city_name: loc.assigned_city_name ?? null,
    image_id,
    image_url,
    imagePreview: image_url,
    image_original_url,
    imageOriginalUrl: image_original_url,
    image_copyright,
    imageCopyright: image_copyright,
    image: null,
    tags: normalizeTagIds(loc.tags ?? []),
    published_interactive_location_id:
      loc.published_interactive_location_id ?? null,
  };
};

export const normalizeDraftId = (value) => {
  if (value == null || value === '') return null;
  return String(value);
};

export const buildInteractiveLocationPayload = (loc, name, description) => {
  const assignedType = loc.assigned_city_type ?? 'none';
  let city = null;
  let sessionCity = null;

  if (assignedType === 'database') {
    city = normalizeId(loc.city_id ?? loc.city) || null;
  } else if (assignedType === 'draft') {
    sessionCity = normalizeDraftId(loc.session_city_id ?? loc.session_city) || null;
  }

  const index = Number(loc.index ?? loc.order ?? 0);

  return {
    name: name ?? loc.name ?? {},
    description: description ?? loc.description ?? {},
    lat: loc.lat === '' ? null : loc.lat,
    lon: loc.lon === '' ? null : loc.lon,
    index,
    rank: Number(loc.rank ?? 0),
    assigned_city_type: assignedType,
    city: null,
    city_id: city,
    session_city: null,
    session_city_id: sessionCity,
    image_id: loc.image_id ?? null,
    image_original_url: loc.image_original_url ?? loc.imageOriginalUrl ?? '',
    image_copyright: loc.image_copyright ?? loc.imageCopyright ?? '',
    order: index,
    tags: normalizeTagIds(loc.tags ?? []),
  };
};

export function collectIlLocaleTexts(ilLocaleData) {
  const name = {};
  const description = {};

  Object.values(ilLocaleData || {}).forEach((d) => {
    if (!d?.lang) return;

    if (d.name || d.description) {
      name[d.lang] = d.name || '';
      description[d.lang] = d.description || '';
    }
  });

  return { name, description };
}

export function buildIlPersistSnapshot(il, ilLocaleData) {
  if (!il?.id) return null;

  const { name, description } = collectIlLocaleTexts(ilLocaleData);

  return JSON.stringify(
    buildInteractiveLocationPayload(
      normalizeInteractiveLocation(il),
      name,
      description,
    ),
  );
}

function mergeInteractiveLocationFromApiResponse(currentIl, responseIl, name, description) {
  return normalizeInteractiveLocation({
    ...currentIl,
    ...responseIl,

    assigned_city_type:
      responseIl.assigned_city_type ?? currentIl.assigned_city_type,
    city_id: responseIl.city_id ?? responseIl.city ?? currentIl.city_id,
    city: responseIl.city_id ?? responseIl.city ?? currentIl.city,
    session_city_id:
      responseIl.session_city_id ??
      responseIl.session_city ??
      currentIl.session_city_id,
    session_city:
      responseIl.session_city_id ??
      responseIl.session_city ??
      currentIl.session_city,

    name: responseIl.name ?? name,
    description: responseIl.description ?? description,

    image_id:
      responseIl.image_id ??
      responseIl.image?.id ??
      currentIl.image_id ??
      null,

    image_url:
      responseIl.image_url ??
      responseIl.image?.url ??
      responseIl.image?.file ??
      currentIl.image_url ??
      currentIl.imagePreview ??
      null,

    image_original_url:
      responseIl.image_original_url ??
      responseIl.imageOriginalUrl ??
      currentIl.image_original_url ??
      currentIl.imageOriginalUrl ??
      '',

    image_copyright:
      responseIl.image_copyright ??
      responseIl.imageCopyright ??
      currentIl.image_copyright ??
      currentIl.imageCopyright ??
      '',

    tags: normalizeTagIds(responseIl.tags ?? currentIl.tags ?? []),
  });
}

export async function persistInteractiveLocationRecord(sessionId, il, ilLocaleData) {
  if (!il?.id) return null;

  const { name, description } = collectIlLocaleTexts(ilLocaleData);
  const updated = await interactiveLocationsAPI.update(
    sessionId,
    il.id,
    buildInteractiveLocationPayload(normalizeInteractiveLocation(il), name, description),
  );
  const responseIl = updated?.data?.interactive_location || updated?.data || {};

  return mergeInteractiveLocationFromApiResponse(il, responseIl, name, description);
}

export function getMultilangKeys(...objects) {
  const keys = new Set();

  objects.forEach((obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

    Object.keys(obj).forEach((key) => {
      const lang = String(key || '').trim().toLowerCase();

      if (lang) {
        keys.add(lang);
      }
    });
  });

  return Array.from(keys);
}

function sortLocaleSourceEntries(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return entries;

  const defaultLangOrder = DEFAULT_LOCALE_DEFS.map((locale) =>
    locale.lang || locale.key?.split('-')?.[0]
  ).filter(Boolean);

  const langToPair = new Map();
  for (const [key, loc] of entries) {
    const lang = String(loc?.lang || key?.split('-')?.[0] || '')
      .trim()
      .toLowerCase();
    if (!lang) continue;
    if (!langToPair.has(lang)) {
      langToPair.set(lang, [key, loc]);
    }
  }

  const normalizedLangKeys = [...langToPair.keys()];

  const orderedLangKeys = [
    ...defaultLangOrder.filter((lang) => normalizedLangKeys.includes(lang)),
    ...normalizedLangKeys.filter((lang) => !defaultLangOrder.includes(lang)),
  ];

  return orderedLangKeys.map((lang) => langToPair.get(lang));
}

function makeLocaleEntriesFromLangKeys(langKeys = []) {
  const normalizedLangKeys = [
    ...new Set(
      langKeys
        .map((lang) => String(lang || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const defaultLangOrder = DEFAULT_LOCALE_DEFS.map((locale) =>
    locale.lang || locale.key?.split('-')?.[0]
  ).filter(Boolean);

  const orderedLangKeys = [
    ...defaultLangOrder.filter((lang) => normalizedLangKeys.includes(lang)),
    ...normalizedLangKeys.filter((lang) => !defaultLangOrder.includes(lang)),
  ];

  return orderedLangKeys.map((lang) => {
    const matchedDef = DEFAULT_LOCALE_DEFS.find((locale) => locale.lang === lang);

    if (matchedDef) {
      return [
        matchedDef.key,
        {
          lang: matchedDef.lang,
          code: matchedDef.code,
          langName: matchedDef.langName,
          isDefault: Boolean(matchedDef.isDefault),
        },
      ];
    }

    const info = getLocaleInfo(lang);
    const key = `${lang}-${info.code}`;

    return [
      key,
      {
        lang,
        code: info.code,
        langName: info.name,
        isDefault: false,
        isCustom: true,
      },
    ];
  });
}

export function getAttractionLocaleSourceEntries(
  attr = {},
  { localeData, cityDrafts, referenceCities, activeCityDraftIdRef }
) {
  const assignedType = attr.assigned_city_type || 'none';

  let sourceEntries = [];

  if (assignedType === 'draft') {
    const attrDraftCityId = normalizeDraftId(
      attr.session_city_id ?? attr.session_city
    );

    const activeDraftId = normalizeDraftId(activeCityDraftIdRef?.current);

    if (
      attrDraftCityId &&
      activeDraftId &&
      attrDraftCityId === activeDraftId
    ) {
      sourceEntries = sortLocaleSourceEntries(
        Object.entries(localeData || {}).filter(([, loc]) => loc?.lang)
      );
    } else if (attrDraftCityId) {
      const draft = cityDrafts.find(
        (item) => normalizeDraftId(item.id) === attrDraftCityId
      );

      const draftLangKeys = getMultilangKeys(
        draft?.name,
        draft?.description,
        draft?.country
      );

      sourceEntries = makeLocaleEntriesFromLangKeys(draftLangKeys);
    }
  }

  if (assignedType === 'database') {
    const cityId = normalizeId(attr.city_id ?? attr.city);

    const city = referenceCities.find(
      (item) => normalizeId(item.id) === cityId
    );

    const cityLangKeys = getMultilangKeys(
      city?.name,
      city?.description,
      city?.country
    );

    sourceEntries = makeLocaleEntriesFromLangKeys(cityLangKeys);
  }

  if (assignedType === 'none') {
    const ownLangKeys = getMultilangKeys(
      attr.name,
      attr.description,
      attr.contents
    );

    sourceEntries = makeLocaleEntriesFromLangKeys(ownLangKeys);
  }

  if (sourceEntries.length === 0) {
    sourceEntries = DEFAULT_LOCALE_DEFS.map((locale) => [locale.key, locale]);
  }

  return sourceEntries;
}

export function buildAttrLocaleData(attr = {}, { localeData, cityDrafts, referenceCities, activeCityDraftIdRef }) {
  const sourceEntries = getAttractionLocaleSourceEntries(attr, {
    localeData,
    cityDrafts,
    referenceCities,
    activeCityDraftIdRef,
  });

  return sourceEntries.reduce((acc, [key, locale]) => {
    const lang =
      locale.lang ||
      key?.split('-')?.[0] ||
      'ru';

    acc[key] = {
      lang,
      code: locale.code || key?.split('-')?.[1] || '',
      langName: locale.langName || locale.name || lang.toUpperCase(),
      isDefault: Boolean(locale.isDefault),
      isCustom: Boolean(locale.isCustom),

      name: attr.name?.[lang] ?? '',
      description: attr.description?.[lang] ?? '',
      contentText: attr.contents?.[lang] ?? '',
    };

    return acc;
  }, {});
}

export function buildAttrLocaleDataWithPrevious(attr = {}, previousData = null, { localeData, cityDrafts, referenceCities, activeCityDraftIdRef }) {
  const sourceEntries = getAttractionLocaleSourceEntries(attr, {
    localeData,
    cityDrafts,
    referenceCities,
    activeCityDraftIdRef,
  });

  return sourceEntries.reduce((acc, [key, locale]) => {
    const lang =
      locale.lang ||
      key?.split('-')?.[0] ||
      'ru';

    const previousLocaleData = previousData?.[key];

    acc[key] = {
      lang,
      code: locale.code || key?.split('-')?.[1] || '',
      langName: locale.langName || locale.name || lang.toUpperCase(),
      isDefault: Boolean(locale.isDefault),
      isCustom: Boolean(locale.isCustom),

      name:
        previousLocaleData?.name ??
        attr.name?.[lang] ??
        '',

      description:
        previousLocaleData?.description ??
        attr.description?.[lang] ??
        '',

      contentText:
        previousLocaleData?.contentText ??
        attr.contents?.[lang] ??
        '',
    };

    return acc;
  }, {});
}
