import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import Wizard from '../../components/wizard/Wizard';
import { sessionsAPI } from '../../api/generation';
import Step1City from './steps/Step1City';
import Step2Attractions from './steps/Step2Attractions';
import Step3Content from './steps/Step3Content';
import Step4Commit from './steps/Step4Commit';
import { WIZARD_STEPS } from '../../utils/constants';

const STEPS = [
  WIZARD_STEPS.CITY,
  WIZARD_STEPS.ATTRACTIONS,
  WIZARD_STEPS.CONTENT,
  WIZARD_STEPS.COMMIT,
];

export default function SessionWizard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await sessionsAPI.get(sessionId);
      setSession(response.data);
    } catch (err) {
      console.error('Ошибка загрузки сессии:', err);
      navigate('/generation');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepChange = (step) => {
    setCurrentStep(step);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Загрузка сессии...</p>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Сессия не найдена</p>
        </div>
      </Layout>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case WIZARD_STEPS.CITY:
        return <Step1City session={session} onComplete={loadSession} />;
      case WIZARD_STEPS.ATTRACTIONS:
        return <Step2Attractions session={session} onComplete={loadSession} />;
      case WIZARD_STEPS.CONTENT:
        return <Step3Content session={session} onComplete={loadSession} />;
      case WIZARD_STEPS.COMMIT:
        return <Step4Commit session={session} onComplete={loadSession} />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <button
          onClick={() => navigate('/generation')}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Назад к списку сессий
        </button>
      </div>

      <Wizard
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={handleStepChange}
        onNext={handleNext}
        onPrevious={handlePrevious}
        canGoNext={currentStep < STEPS.length}
        canGoPrevious={currentStep > 1}
      />

      <div className="mt-8">
        {renderStep()}
      </div>
    </Layout>
  );
}
