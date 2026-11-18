// Деньги в реестре хранятся в копейках/центах.
export function formatMoney(minor, currency) {
  if (minor === null || minor === undefined) return '—';
  const value = Number(minor) / 100;
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'RUB',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  return withTime
    ? date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU');
}

export function downloadTextFile(filename, text, type = 'text/csv;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PARTNER_STATUSES = [
  { value: 'active', label: 'Активен' },
  { value: 'suspended', label: 'Приостановлен' },
];

export const MEMBER_STATUS_LABELS = {
  invited: 'Приглашён',
  active: 'Есть доступ',
  revoked: 'Доступ отозван',
};

// Роль в кабинете партнёра: администратор — весь кабинет, контролёр — проверка билетов и отметка гостей.
export const MEMBER_ROLES = [
  { value: 'manager', label: 'Администратор', hint: 'полный доступ к кабинету: продажи, коды, бронирования и сотрудники' },
  { value: 'staff', label: 'Контролёр', hint: 'проверка билетов и отметка прибытия гостей по экскурсиям партнёра' },
];

export const MEMBER_ROLE_LABELS = Object.fromEntries(MEMBER_ROLES.map((role) => [role.value, role.label]));

// Название из мультиязычного словаря (как в каталоге: сначала русский).
export function pickTitle(value) {
  if (!value || typeof value !== 'object') return String(value || '');
  return value.ru || value.en || Object.values(value).find(Boolean) || '';
}
