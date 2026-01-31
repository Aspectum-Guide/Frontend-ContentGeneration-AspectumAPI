import AISettingsForm from '../components/forms/AISettingsForm';
import { useNavigate } from 'react-router-dom';

export default function AISettings() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Назад
        </button>
      </div>
      <AISettingsForm />
    </div>
  );
}
