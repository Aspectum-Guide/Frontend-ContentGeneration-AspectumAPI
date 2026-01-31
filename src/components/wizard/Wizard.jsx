import { useState } from 'react';
import { WIZARD_STEP_LABELS } from '../../utils/constants';
import Button from '../ui/Button';

export default function Wizard({ 
  steps, 
  currentStep, 
  onStepChange,
  onNext,
  onPrevious,
  canGoNext = true,
  canGoPrevious = true,
}) {
  return (
    <div className="wizard">
      {/* Индикатор шагов */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            
            return (
              <div key={stepNumber} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  {/* Круг с номером */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNumber}
                  </div>
                  {/* Название шага */}
                  <div className="mt-2 text-sm text-center">
                    <div className={`font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                      {WIZARD_STEP_LABELS[stepNumber] || step}
                    </div>
                  </div>
                </div>
                {/* Линия между шагами */}
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Кнопки навигации */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious || currentStep === 1}
        >
          Назад
        </Button>
        <Button
          onClick={onNext}
          disabled={!canGoNext}
        >
          {currentStep === steps.length ? 'Завершить' : 'Далее'}
        </Button>
      </div>
    </div>
  );
}
