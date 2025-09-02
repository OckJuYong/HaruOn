import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppProvider';

export default function Intro() {
  const navigate = useNavigate();
  const { user, loading } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) return; // 아직 인증 상태 확인 중이면 기다림
      
      if (user) {
        // 자동 로그인된 상태: 홈으로 이동
        navigate('/home', { replace: true });
      } else {
        // 로그인 필요: 로그인 페이지로 이동
        navigate('/login', { replace: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, user, loading]);

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
