import React from 'react';

export default function Button({ children, onClick, type = 'button', disabled, style }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...styles.btn, ...style }}>
      {children}
    </button>
  );
}

const styles = {
  btn: { padding: '10px 14px', borderRadius: 10, border: '1px solid #111', background: '#111', color: '#fff', fontWeight: 600, cursor: 'pointer' },
};
