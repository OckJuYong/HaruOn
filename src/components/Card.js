import React from 'react';

export default function Card({ children, onClick, style }) {
  return (
    <div onClick={onClick} style={{ ...styles.card, ...style }}>
      {children}
    </div>
  );
}

const styles = {
  card: { border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.04)' },
};
