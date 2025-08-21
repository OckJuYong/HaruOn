import React, { useState } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Profile() {
  const [name, setName] = useState(() => localStorage.getItem('name') || 'Guest');
  const [email, setEmail] = useState(() => localStorage.getItem('email') || 'guest@example.com');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('avatar') || '');

  function save() {
    localStorage.setItem('name', name);
    localStorage.setItem('email', email);
    localStorage.setItem('avatar', avatar);
    alert('저장되었습니다.');
  }

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="프로필" />
      <main style={{ padding: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>사용자 정보</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={styles.row}><span style={styles.label}>이름</span><input className="input" style={styles.input} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label style={styles.row}><span style={styles.label}>이메일</span><input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label style={styles.row}><span style={styles.label}>아바타URL</span><input style={styles.input} value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." /></label>
            <Button onClick={save}>저장</Button>
          </div>
        </Card>
      </main>
      <NavBar />
    </div>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  label: { width: 80 },
  input: { flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', outline: 'none' },
};
