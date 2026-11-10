import { Link } from 'react-router';

export default function EmptyState({ text, back = false }: { text: string; back?: boolean }) {
  return (
    <div className="page">
      <div className="empty-state">{text}</div>
      {back ? (
        <p style={{ marginTop: 16 }}>
          <Link className="btn btn--ghost btn--sm" to="/">返回总览</Link>
        </p>
      ) : null}
    </div>
  );
}
