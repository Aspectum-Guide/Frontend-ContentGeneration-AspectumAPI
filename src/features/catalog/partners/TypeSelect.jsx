import { ANY_CITY, isAnyCityType } from './codeTypes';

// «Что открывает» для форм кодов: первым пунктом — любой один город на выбор.
export default function TypeSelect({ value, onChange, types, className, required = false, placeholder = '' }) {
  const others = types.filter((type) => !isAnyCityType(type));
  return (
    <select className={className} value={value} onChange={onChange} required={required}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      <option value={ANY_CITY}>Любой город на выбор — один, где вводят код</option>
      {others.length ? (
        <optgroup label="Конкретные города и наборы">
          {others.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
              {type.access_mode === 'choose_city' ? ' (один город из списка)' : ''}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
