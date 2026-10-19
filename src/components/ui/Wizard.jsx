import Button from './Button';

/** Универсальная навигация по шагам мастера. */
export default function Wizard({
  steps,
  currentStep,
  onNext,
  onPrevious,
  canGoNext = true,
  canGoPrevious = true,
}) {
  return (
    <div className="wizard">
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious || currentStep === 1}
        >
          Назад
        </Button>
        <Button onClick={onNext} disabled={!canGoNext}>
          {currentStep === steps.length ? 'Завершить' : 'Далее'}
        </Button>
      </div>
    </div>
  );
}
