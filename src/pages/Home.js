// 📁 src/pages/Home.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { healthz, createConversation } from '../api/api';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [ok, setOk] = useState('checking...');
  const [title, setTitle] = useState('');
  const [recentImages, setRecentImages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recentImages') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    healthz().then(() => setOk('온라인')).catch(() => setOk('오프라인'));
  }, []);

  const onCreate = useCallback(async () => {
    if (!title.trim()) return alert('대화방 제목을 입력해주세요.');
    // 로그인 전: user_id는 null로 보냄
    const conv = await createConversation({ user_id: null, title: title.trim() });
    // 백엔드 응답: { id, user_id, title }
    navigate(`/chat?cid=${encodeURIComponent(conv.id)}&t=${encodeURIComponent(conv.title)}`);
  }, [title, navigate]);

  const latest = useMemo(() => recentImages.slice(0, 6), [recentImages]);

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="하루온 — 홈" />
      <main style={{ padding: 16, display: 'grid', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>백엔드 상태</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ok}</div>
            </div>
            <a
              href="/docs" /* 프록시 기준으로 접근하려면 /docs (개발시) */
              onClick={(e) => { e.preventDefault(); window.open('http://54.180.8.10/docs', '_blank', 'noreferrer'); }}
              rel="noreferrer"
              style={{ fontSize: 13, textDecoration: 'none' }}
              title="백엔드 문서 열기"
            >
              API 문서 열기 ↗
            </a>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>새 대화 시작</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="대화방 제목"
              style={styles.input}
            />
            <Button onClick={onCreate}>대화방 생성</Button>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>최근 이미지 (읽기 전용)</div>
            {latest.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {latest.map((im) => (
                  <a key={im.id} href={im.url} target="_blank" rel="noreferrer" title={im.prompt || 'image'}>
                    <img src={im.url} alt={im.prompt || 'image'} style={{ width: '100%', borderRadius: 8 }} />
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                아직 생성된 이미지가 없습니다. 채팅에서 대화를 종료하면 요약 이미지가 만들어져요.
              </div>
            )}
          </div>
        </Card>
      </main>
      <NavBar />
    </div>
  );
}

const styles = {
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', outline: 'none' }
};
