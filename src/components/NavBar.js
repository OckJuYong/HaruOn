import React from 'react';
import { NavLink } from 'react-router-dom';

export default function NavBar() {
  return (
    <nav style={styles.nav}>
      <Tab to="/home" label="Home" />
      <Tab to="/history" label="History" />
      <Tab to="/chat" label="Chat" />
      <Tab to="/profile" label="Profile" />
    </nav>
  );
}

function Tab({ to, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.link,
        fontWeight: isActive ? 700 : 500,
        borderTop: isActive ? '2px solid #111' : '2px solid transparent',
      })}
    >
      {label}
    </NavLink>
  );
}

const NAVBAR_HEIGHT = 56; // 입력창 배치 시 참고하려고 높이를 상수로 관리(디자인에 맞게 조절 가능)

const styles = {
  nav: {
    position: 'fixed', // 화면 하단 고정
    bottom: 0,
    left: 0,
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 4,
    borderTop: '1px solid #eee',
    background: '#fff',
    zIndex: 1000 // 다른 요소 위에 보이도록
  },
  link: {
    display: 'block',
    padding: '12px 8px',
    textAlign: 'center',
    color: '#111',
    textDecoration: 'none'
  },
};

export { NAVBAR_HEIGHT };
