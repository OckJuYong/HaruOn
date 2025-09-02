import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { useApp } from '../context/AppProvider';
import { getUserProfile, upsertUserProfile, signOut } from '../api/api';

export default function Profile() {
  const { user } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile(user.id);
      if (profile?.profile_data) {
        setName(profile.profile_data.name || '');
        setAvatar(profile.profile_data.avatar || '');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [user.id]);

  // Load profile data from Supabase
  useEffect(() => {
    if (user?.id) {
      loadProfile();
      setEmail(user.email || ''); // Set email from auth user
    }
  }, [user, loadProfile]);

  const save = async () => {
    if (!user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    setLoading(true);
    try {
      await upsertUserProfile(user.id, {
        name,
        avatar
      });
      alert('프로필이 저장되었습니다!');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // AppProvider will handle the state update
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="프로필" />
      <main style={{ padding: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>사용자 정보</div>
          {user ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={styles.row}>
                <span style={styles.label}>이름</span>
                <input 
                  style={styles.input} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </label>
              <label style={styles.row}>
                <span style={styles.label}>이메일</span>
                <input 
                  style={{ ...styles.input, backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  value={email} 
                  readOnly
                />
              </label>
              <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 88 }}>이메일은 수정할 수 없습니다</div>
              <label style={styles.row}>
                <span style={styles.label}>아바타URL</span>
                <input 
                  style={styles.input} 
                  value={avatar} 
                  onChange={(e) => setAvatar(e.target.value)} 
                  placeholder="https://..."
                />
              </label>
              <Button onClick={save} disabled={loading}>
                {loading ? '저장 중...' : '저장'}
              </Button>
              <Button 
                onClick={handleSignOut}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                로그아웃
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ marginBottom: 16 }}>로그인이 필요합니다</div>
              <Button onClick={() => window.location.href = '/login'}>
                로그인
              </Button>
            </div>
          )}
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
