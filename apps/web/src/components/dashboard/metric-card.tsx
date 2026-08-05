interface MetricCardProps {
  label: string;
  value: string;
  trend: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber';
}

export function MetricCard({ label, value, trend, tone }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-head">
        <span>{label}</span>
        <span className="metric-dot" />
      </div>
      <strong>{value}</strong>
      <small>{trend}</small>
    </article>
  );
}
