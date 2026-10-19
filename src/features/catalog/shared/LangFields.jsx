import { LocaleField, LocaleTabs } from '@aspectum/admin-ui-web';
import { getFilledLangCodes } from './i18n';
import { useAppLanguages } from '../../../hooks/useAppLanguages';

export function LangTabs({
  active,
  onSwitch,
  value = {},
  onChangeValue,
  onAddLang,
  onRemoveLang,
  langOptions = [],
  availableLangs,
  allowManage = true,
}) {
  const { languages: appLanguages } = useAppLanguages();
  const resolvedAvailableLangs = Array.isArray(availableLangs)
    ? availableLangs
    : appLanguages.map((language) => language.code);
  return <LocaleTabs {...{ active, onSwitch, value, onChangeValue, onAddLang, onRemoveLang, langOptions, allowManage, availableLangs: resolvedAvailableLangs, getFilledCodes: getFilledLangCodes }} />;
}

export function LangBlock({
  label,
  value = {},
  onChange,
  activeLang,
  multiline = false,
  rows = 3,
  required,
}) {
  return <LocaleField label={label} value={value} onChange={onChange} activeLocale={activeLang} multiline={multiline} rows={rows} required={required} />;
}
