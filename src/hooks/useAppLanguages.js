import { useEffect, useState } from 'react';
import { appLanguagesAPI } from '../api/generation';
import {
  DEFAULT_APP_LANGUAGES,
  parseAppLanguagesResponse,
} from '../features/catalog/shared/normalize';

let cachedLanguages = null;
let languagesRequest = null;

export function useAppLanguages() {
  const [languages, setLanguages] = useState(cachedLanguages || DEFAULT_APP_LANGUAGES);
  const [loading, setLoading] = useState(!cachedLanguages);

  useEffect(() => {
    let active = true;
    if (!languagesRequest) {
      languagesRequest = appLanguagesAPI.list()
        .then(parseAppLanguagesResponse)
        .then((next) => {
          cachedLanguages = next;
          return next;
        })
        .catch(() => cachedLanguages || DEFAULT_APP_LANGUAGES)
        .finally(() => {
          languagesRequest = null;
        });
    }

    languagesRequest.then((next) => {
      if (!active) return;
      setLanguages(next);
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  return { languages, loading };
}

export function clearAppLanguagesCache() {
  cachedLanguages = null;
  languagesRequest = null;
}
