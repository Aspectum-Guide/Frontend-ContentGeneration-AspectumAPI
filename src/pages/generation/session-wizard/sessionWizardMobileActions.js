export function buildSessionWizardMobileActions({
  session,
  citySaving,
  saveCityForStep1,
  publishing,
  handlePublish,
  setCloseMode,
  setCloseOpen,
}) {
  const actions = [
    {
      id: 'save-city-data',
      label: citySaving ? 'Сохранение...' : 'Сохранить город',
      onClick: () => { if (!citySaving) saveCityForStep1(); },
      disabled: citySaving,
      variant: 'primary',
    },
  ];

  if (!session?.closed_with_save) {
    actions.push({
      id: 'publish-session',
      label: publishing ? 'Публикация...' : 'Опубликовать сессию',
      onClick: () => { if (!publishing) handlePublish(); },
      disabled: publishing,
      variant: '',
    });
  }

  if (session?.status === 'draft' || session?.status === 'in_progress') {
    actions.push({
      id: 'close-session',
      label: 'Закрыть сессию',
      onClick: () => { setCloseMode('save'); setCloseOpen(true); },
      disabled: false,
      variant: 'danger',
    });
  }

  return actions;
}
