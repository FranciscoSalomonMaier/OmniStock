import{movementLabels}from'./movement-types';
export function MovementTypeBadge({ type }: { type: string }) {
  return (
    <span className={`status-badge movement-${type.toLowerCase()}`}>
      {movementLabels[type] ?? type}
    </span>
  );
}
