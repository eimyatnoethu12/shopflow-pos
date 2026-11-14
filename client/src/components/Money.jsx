import React from 'react';

export function Money({ value }) {
  const num = Number(value || 0);
  return (
    <span>
      {num.toLocaleString()} <small style={{ fontSize: '0.85em', opacity: 0.8, fontWeight: 500 }}>MMK</small>
    </span>
  );
}
