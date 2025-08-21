import React from 'react';

export default function TopBar({ title = '하루온' }) {
  return (
    <header style={styles.wrap}>
      <h1 style={styles.title}>{title}</h1>
    </header>
  );
}

const styles = {
  wrap: { position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px' },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
};
