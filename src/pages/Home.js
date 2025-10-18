// 📁 src/pages/Home.jsx
import React, { useEffect, useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { createConversation, listConversations, getConversationSummary } from '../api/api';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppProvider';
import { supabase } from '../services/supabaseApi';

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
  const [title, setTitle] = useState('');
  const [recentConversations, setRecentConversations] = useState([]);
  const [summariesMap, setSummariesMap] = useState({});
  const [todayQuest, setTodayQuest] = useState(null);
  const [questLoading, setQuestLoading] = useState(false);

  useEffect(() => {
    // Load recent conversations and today's quest from Supabase
    if (user?.id) {
      loadRecentConversations();
      loadTodayQuest();
    }
  }, [user]);

  const loadTodayQuest = useCallback(async () => {
    if (!user?.id) return;
    setQuestLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_today_quest_for_user', {
        target_user_id: user.id,
      });

      if (error) {
        console.error('RPC Error:', error);
        // 함수가 없는 경우 대체 방법: 직접 테이블에서 랜덤 질문 가져오기
        const { data: templates, error: templateError } = await supabase
          .from('daily_quest_templates')
          .select('*')
          .limit(1);

        if (templateError) {
          console.error('Template Error:', templateError);
          throw templateError;
        }

        if (templates && templates.length > 0) {
          setTodayQuest({
            quest_id: templates[0].id,
            question: templates[0].question_text,
            category: templates[0].category,
            already_completed: false
          });
        }
        return;
      }

      if (data && data.length > 0) {
        setTodayQuest(data[0]);
      }
    } catch (error) {
      console.error('Failed to load today quest:', error);
    } finally {
      setQuestLoading(false);
    }
  }, [user?.id]);

  const loadRecentConversations = useCallback(async () => {
    if (!user?.id) return;
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
  }, [user?.id]);

  const onCreate = useCallback(async () => {
    if (!title.trim()) return alert('대화방 제목을 입력해주세요.');
    const conv = await createConversation({ user_id: user?.id, title: title.trim() });
    // 백엔드 응답: { id, user_id, title }
    navigate(`/chat?cid=${encodeURIComponent(conv.id)}&t=${encodeURIComponent(conv.title)}`);
  }, [title, navigate, user?.id]);

  const handleQuestClick = async () => {
    if (!todayQuest || todayQuest.already_completed) return;

    // 퀘스트 주제로 새 대화방 생성 (AI가 먼저 질문을 던지도록)
    const conv = await createConversation({
      user_id: user?.id,
      title: `오늘의 질문`
    });

    // AI가 먼저 질문을 하도록 초기 메시지 설정과 함께 이동
    navigate(`/chat?cid=${encodeURIComponent(conv.id)}&t=${encodeURIComponent(conv.title)}&quest=${encodeURIComponent(todayQuest.question)}`);
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="하루온 — 홈" />
      <main style={{ padding: 16, display: 'grid', gap: 16 }}>
        {/* 오늘의 퀘스트 카드 */}
        <Card style={{
          background: todayQuest?.already_completed ? '#f3f4f6' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          cursor: todayQuest?.already_completed ? 'default' : 'pointer'
        }}
        onClick={handleQuestClick}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>📝 오늘의 질문</div>
              {todayQuest?.already_completed && (
                <div style={{
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: 12,
                  fontSize: 12
                }}>
                  완료됨 ✓
                </div>
              )}
            </div>
            {questLoading ? (
              <div>로딩 중...</div>
            ) : todayQuest ? (
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
                {todayQuest.question}
              </div>
            ) : (
              <div style={{ fontSize: 16 }}>오늘의 질문을 불러오는 중...</div>
            )}
            {!todayQuest?.already_completed && (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                탭하여 대화 시작하기 →
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>사용자 피드백</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>의견을 들려주세요</div>
            </div>
            <a
              href="https://forms.gle/WNfa3jhCcyTQP5yv7"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 16px',
                backgroundColor: '#4285f4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#3367d6'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#4285f4'}
            >
              설문 작성
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
