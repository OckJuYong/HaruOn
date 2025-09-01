import React from 'react';
import { useApp } from '../context/AppProvider';
import { signOut } from '../services/supabaseApi';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ title = '하루온' }) {
  const { user } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header style={styles.wrap}>
      <h1 style={styles.title}>{title}</h1>
      {user && (
        <div style={styles.userSection}>
          <span style={styles.nickname}>
            {user.user_metadata?.nickname || '사용자님'}, 환영합니다!
          </span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            로그아웃
          </button>
        </div>
      )}
    </header>
  );
}

const styles = {
  wrap: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#fff',
    borderBottom: '1px solid #eee',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  nickname: {
    fontSize: '14px',
    fontWeight: 500,
  },
  logoutButton: {
    background: '#f0f0f0',
    border: '1px solid #ddd',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};
