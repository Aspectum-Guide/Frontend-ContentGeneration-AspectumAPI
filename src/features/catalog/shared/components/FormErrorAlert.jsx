import { Alert } from '@aspectum/admin-ui-web';

export default function FormErrorAlert({ message }) {
  if (!message) return null;

  return (
    <Alert tone="error">
      {message}
    </Alert>
  );
}
