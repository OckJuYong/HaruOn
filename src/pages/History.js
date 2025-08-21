import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import Button from '../components/Button';
import { getConversation, deleteConversationApi } from '../api/api';

// ===== localStorage helpers =====
function getSummariesMap() {
  try { return JSON.parse(localStorage.getItem('summariesByCid') || '{}'); } catch { return {}; }
}
function getRecentCids() {
  try { return JSON.parse(localStorage.getItem('recentCids') || '[]'); } catch { return []; }
}

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
  const [ids, setIds] = useState(() => getRecentCids());
  const [items, setItems] = useState([]); // [{ id, title?, created_at?, updated_at? }]
  const [loading, setLoading] = useState(false);

  // modal state
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // { id, summary, image_url, period }

  const summariesMap = useMemo(() => getSummariesMap(), [ids]);

  const refresh = useCallback(async () => {
    if (!ids.length) { setItems([]); return; }
    setLoading(true);
    try {
      const results = await Promise.all(ids.map((id) => getConversation(id).catch(() => null)));
      const list = results.flatMap((res) => {
        if (!res) return [];
        if (res.items) return res.items; // { items: [{ id, title, created_at, updated_at? }] }
        if (res.id) return [{ id: res.id, title: res.title, created_at: res.created_at, updated_at: res.updated_at }];
        return [];
      });
      // 유지되는 순서: ids와 동일한 순서로 재정렬
      const byId = Object.fromEntries(list.map(x => [x.id, x]));
      const ordered = ids.map(id => byId[id]).filter(Boolean);
      setItems(ordered);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => { refresh(); }, [refresh]);

  const onRemove = async (id) => {
    const ok = window.confirm('이 대화방을 삭제할까요?');
    if (!ok) return;
    await deleteConversationApi(id);
    const next = ids.filter((x) => x !== id);
    setIds(next);
    localStorage.setItem('recentCids', JSON.stringify(next));
    // 요약도 제거
    const map = getSummariesMap();
    if (map[id]) {
      delete map[id];
      localStorage.setItem('summariesByCid', JSON.stringify(map));
    }
    refresh();
    // 모달이 해당 cid를 보고 있다면 닫기
    if (active?.id === id) setOpen(false);
  };

  const handleOpenModal = (item) => {
    const meta = summariesMap[item.id]; // { summary, image_url, ts }
    const period = fmtPeriod(item.created_at, item.updated_at, meta?.ts);
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
          const meta = summariesMap[it.id]; // { summary, image_url, ts }
          const period = fmtPeriod(it.created_at, it.updated_at, meta?.ts);

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
