import Button from '../../../components/ui/Button.jsx';

const STEP_LABELS = [
  'Город',
  'Теги',
  'Достопримечательности',
  'Интерактивные локации',
  'Публикация',
];

export default function SessionWizardStepNavigation({ currentStep, onGoToStep }) {
  return (
    <div className="mb-5">
      <div className="relative h-1.5 bg-gray-200 rounded-full mb-3">
        <div
          className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="flex">
        {STEP_LABELS.map((label, index) => {
          const step = index + 1;
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;

          return (
            <Button
              key={step}
              type="button"
              variant="secondary"
              onClick={() => onGoToStep(step)}
              className={`flex-1 min-h-0 rounded-none bg-transparent px-1 py-1 text-center text-xs font-normal hover:bg-transparent border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-700 font-semibold'
                  : isCompleted
                    ? 'border-blue-300 text-blue-500 hover:text-blue-700 cursor-pointer'
                    : 'border-transparent text-gray-400 hover:text-gray-600 cursor-pointer'
              }`}
            >
              {step}. {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
