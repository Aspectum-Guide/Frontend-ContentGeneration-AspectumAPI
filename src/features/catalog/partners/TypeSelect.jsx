import { Select } from '../../../components/ui/FormField';
import { ANY_CITY, isAnyCityType } from './codeTypes';

// «2 ч», «1 дн.» — срок временного кода рядом с названием типа.
const hoursLabel = (hours) => (hours % 24 === 0 ? `${hours / 24} дн.` : `${hours} ч`);

// «Что открывает» для форм кодов: первым пунктом — любой один город на выбор.
export default function TypeSelect({ value, onChange, types, className, required = false, placeholder = '' }) {
  const others = types.filter((type) => !isAnyCityType(type));
  return (
    <Select className={className} value={value} onChange={onChange} required={required}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      <option value={ANY_CITY}>Любой город на выбор — один, где вводят код</option>
      {others.length ? (
        <optgroup label="Конкретные города и наборы">
          {others.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
              {type.access_mode === 'choose_city'
                ? type.cities?.length ? ' (один город из списка)' : ' (любой город на выбор)'
                : ''}
              {type.access_hours ? ` · доступ на ${hoursLabel(type.access_hours)}` : ''}
            </option>
          ))}
        </optgroup>
      ) : null}
    </Select>
  );
}
