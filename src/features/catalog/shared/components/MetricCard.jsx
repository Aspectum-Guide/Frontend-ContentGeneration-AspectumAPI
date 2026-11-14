import { Card } from '@aspectum/admin-ui-web';

export default function MetricCard({ label, value, sub }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-aspectum-text-subtle uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-aspectum-text">{value}</p>
      {sub && <p className="text-xs text-aspectum-text-disabled mt-0.5">{sub}</p>}
    </Card>
  );
}
