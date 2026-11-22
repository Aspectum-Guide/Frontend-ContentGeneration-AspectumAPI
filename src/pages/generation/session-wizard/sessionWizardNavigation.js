export async function persistBeforeStepChange({
  fromStep,
  targetStep,
  publishStep,
  activeCityDraftId,
  saveCity,
  saveInteractiveLocation,
  flushEditors,
  reloadSession,
}) {
  if (fromStep === 1 && targetStep !== 1) {
    await saveCity();
  }

  if (fromStep === 4 && targetStep !== 4) {
    await saveInteractiveLocation({ silent: true });
  }

  if (fromStep !== targetStep) {
    await flushEditors();
  }

  if (targetStep === publishStep) {
    await saveCity();
    await flushEditors();
    await reloadSession(activeCityDraftId, {
      silent: true,
      force: true,
      preserveCurrentEditors: true,
    });
  }
}
