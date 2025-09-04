// 📁 src/pages/Home.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { healthz, createConversation, listConversations, getConversationSummary } from '../api/api';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppProvider';

// ===== UI helpers =====
const fmtDate = (isoOrTs) => {
  if (!isoOrTs) return '';
  try {
    const d = typeof isoOrTs === 'number' ? new Date(isoOrTs) : new Date(isoOrTs);
    if (Number.isNaN(d.getTime())) return '';
    // 지역 포맷(한국): YYYY.MM.DD HH:mm
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch {
    return '';
  }
};
const fmtPeriod = (created, updated, fallbackTs) => {
  const start = created || fallbackTs;
  const end = updated || created || fallbackTs;
  if (!start && !end) return '';
  const startStr = fmtDate(start);
  const endStr = fmtDate(end);
  return startStr && endStr && startStr !== endStr ? `${startStr} ~ ${endStr}` : (endStr || startStr);
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [ok, setOk] = useState('checking...');
  const [title, setTitle] = useState('');
  const [recentConversations, setRecentConversations] = useState([]);
  const [summariesMap, setSummariesMap] = useState({});

  useEffect(() => {
    healthz().then(() => setOk('온라인')).catch(() => setOk('오프라인'));
    
    // Load recent conversations from Supabase
    if (user?.id) {
      loadRecentConversations();
    }
  }, [user]);

  const loadRecentConversations = async () => {
    try {
      // Get user's conversations (최근 2개만)
      const conversations = await listConversations(user.id);
      const recent = (conversations || []).slice(0, 2);
      setRecentConversations(recent);
      
      // Load summaries for each conversation
      const summaries = {};
      await Promise.all(
        recent.map(async (conv) => {
          try {
            const summary = await getConversationSummary(conv.id);
            if (summary) {
              summaries[conv.id] = summary;
            }
          } catch (error) {
            console.error(`Failed to load summary for ${conv.id}:`, error);
          }
        })
      );
      setSummariesMap(summaries);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const onCreate = useCallback(async () => {
    if (!title.trim()) return alert('대화방 제목을 입력해주세요.');
    const conv = await createConversation({ user_id: user?.id, title: title.trim() });
    // 백엔드 응답: { id, user_id, title }
    navigate(`/chat?cid=${encodeURIComponent(conv.id)}&t=${encodeURIComponent(conv.title)}`);
  }, [title, navigate, user?.id]);

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
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Supabase 연동
            </div>
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

        {/* 최근 대화 히스토리 (히스토리와 같은 형식) */}
        <Card>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>최근 대화</div>
            {recentConversations.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {recentConversations.map((item) => {
                  const meta = summariesMap[item.id];
                  const period = fmtPeriod(item.created_at, item.updated_at, meta?.created_at);

                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/chat?cid=${encodeURIComponent(item.id)}&t=${encodeURIComponent(item.title || '')}`)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr',
                        gap: 12,
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid #eee',
                        background: '#fafafa'
                      }}
                    >
                      {/* 썸네일 (없으면 플레이스홀더) */}
                      <div style={{ width: 120, height: 80, borderRadius: 8, border: '1px solid #eee', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {meta?.image_url ? (
                          <img
                            src={meta.image_url}
                            alt="요약 이미지"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ fontSize: 12, color: '#999' }}>이미지 없음</div>
                        )}
                      </div>

                      {/* 기간과 요약 표시 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                          {period || '기간 정보 없음'}
                        </div>
                        {meta?.summary && (
                          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {meta.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                아직 대화가 없습니다. 새 대화를 시작해보세요.
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
