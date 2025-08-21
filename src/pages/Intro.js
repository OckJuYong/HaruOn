import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Intro() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/home', { replace: true }), 3000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <main style={styles.wrap}>
      <div style={styles.logo}>하루온</div>
      <div style={styles.sub}>모바일 웹 MVP</div>
    </main>
  );
}

const styles = {
  wrap: { height: '100svh', display: 'grid', placeItems: 'center', gap: 8, background: '#111', color: '#fff' },
  logo: { fontSize: 42, fontWeight: 800, letterSpacing: 2 },
  sub: { opacity: .8 },
};
