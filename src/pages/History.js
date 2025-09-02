import React, { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { deleteConversationApi, listConversations, getConversationSummary } from '../api/api';
import { useApp } from '../context/AppProvider';

// Note: Removed localStorage helpers - now using Supabase directly

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

// ===== Simple Modal (no portal) =====
function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(880px, 96vw)',
          maxHeight: '86vh',
          background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 0
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>요약 보기</div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer' }} aria-label="close">×</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { user } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summariesMap, setSummariesMap] = useState({});

  // modal state
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // { id, summary, image_url, period }

  const refresh = useCallback(async () => {
    if (!user?.id) { setItems([]); return; }
    setLoading(true);
    try {
      // Get user's conversations from Supabase
      const conversations = await listConversations(user.id);
      setItems(conversations || []);
      
      // Load summaries for each conversation
      const summaries = {};
      await Promise.all(
        (conversations || []).map(async (conv) => {
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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const onRemove = async (id) => {
    const ok = window.confirm('이 대화방을 삭제할까요?');
    if (!ok) return;
    try {
      await deleteConversationApi(id);
      refresh(); // Reload from database
      // 모달이 해당 cid를 보고 있다면 닫기
      if (active?.id === id) setOpen(false);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenModal = (item) => {
    const meta = summariesMap[item.id]; // { summary, image_url, created_at }
    const period = fmtPeriod(item.created_at, item.updated_at, meta?.created_at);
    setActive({
      id: item.id,
      summary: meta?.summary || '(요약 없음)',
      image_url: meta?.image_url,
      period,
    });
    setOpen(true);
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="히스토리" />
      <main style={{ padding: 16, display: 'grid', gap: 12 }}>
        {loading && <div>불러오는 중…</div>}
        {!loading && items.length === 0 && <div>최근 항목이 없습니다.</div>}

        {items.map((it) => {
          const meta = summariesMap[it.id]; // { summary, image_url, created_at }
          const period = fmtPeriod(it.created_at, it.updated_at, meta?.created_at);

          // 화면 요구사항: "그림, 기간만" 노출
          return (
            <Card
              key={it.id}
              onClick={() => handleOpenModal(it)}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr auto',
                gap: 12,
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              {/* 썸네일 (없으면 플레이스홀더) */}
              <div style={{ width: 120, height: 80, borderRadius: 8, border: '1px solid #eee', overflow: 'hidden', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

              {/* 기간만 표시 */}
              <div style={{ fontSize: 13, color: '#111' }}>
                {period || '기간 정보 없음'}
              </div>

              {/* 우측 조작(삭제만 보이게) */}
              <div style={{ display: 'flex', gap: 8 }}>
                {/* 채팅 열기 버튼을 히스토리 목록에 굳이 노출하지 않음(모달에서 제공) */}
                <Button
                  style={{ background: '#fff', color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
                >
                  삭제
                </Button>
              </div>
            </Card>
          );
        })}
      </main>

      <NavBar />

      {/* 상세 모달: 큰 이미지 + 요약 */}
      <Modal open={open} onClose={() => setOpen(false)}>
        {active && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#666' }}>{active.period}</div>
            {active.image_url ? (
              <img
                src={active.image_url}
                alt="요약 이미지 크게 보기"
                style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }}
              />
            ) : (
              <div style={{ fontSize: 12, color: '#999' }}>이미지 없음</div>
            )}
            <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {active.summary}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <a
                href={`/chat?cid=${encodeURIComponent(active.id)}`}
                style={{ textDecoration: 'none', alignSelf: 'center' }}
              >
                열기
              </a>
              <Button
                onClick={() => { onRemove(active.id); }}
                style={{ background: '#fff', color: '#ef4444', borderColor: '#ef4444' }}
              >
                삭제
              </Button>
              <Button onClick={() => setOpen(false)}>닫기</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
