import React, { useEffect, useRef, useState, useMemo } from 'react';
import TopBar from '../components/TopBar';
import NavBar, { NAVBAR_HEIGHT } from '../components/NavBar';
import Button from '../components/Button';
import Card from '../components/Card';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { chat, listMessages, createConversation, createImage } from '../api/api';

// ===== Debug helpers =====
const DEBUG = true; // 필요 시 끄기
const MAX_LOG_LEN = 400; // 콘솔에 찍을 텍스트 최대 길이
const TYPE_SPEED_MS = 18; // 타이핑 속도 (ms/char)

function now() { return new Date().toISOString(); }
function safeText(text, { max = MAX_LOG_LEN } = {}) {
  if (typeof text !== 'string') return text;
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}
function logGroup(title, fn) {
  if (!DEBUG) return fn?.();
  try { console.groupCollapsed(`[${now()}] ${title}`); const r = fn?.(); console.groupEnd(); return r; }
  catch (e) { console.groupEnd?.(); throw e; }
}
function logReq(label, payload) { if (!DEBUG) return; console.log('REQ ▶', label, payload); }
function logRes(label, data, t0) { if (!DEBUG) return; const ms = t0 ? (performance.now() - t0).toFixed(1) + 'ms' : ''; console.log('RES ◀', label, { data, latency: ms }); }
function logErr(label, error, t0) { if (!DEBUG) return; const ms = t0 ? (performance.now() - t0).toFixed(1) + 'ms' : ''; console.error('ERR ✖', label, { error, latency: ms }); }

// ===== 로컬 스토리지 유틸 =====
function getRecentImages() {
  try { return JSON.parse(localStorage.getItem('recentImages') || '[]'); } catch { return []; }
}
function setRecentImages(arr) { localStorage.setItem('recentImages', JSON.stringify(arr)); }

function getRecentCids() {
  try { return JSON.parse(localStorage.getItem('recentCids') || '[]'); } catch { return []; }
}
function getSummariesMap() {
  try { return JSON.parse(localStorage.getItem('summariesByCid') || '{}'); } catch { return {}; }
}
function setSummariesMap(map) { localStorage.setItem('summariesByCid', JSON.stringify(map)); }
function setSummaryForCid(cid, partial) {
  const map = getSummariesMap();
  const prev = map[cid] || {};
  map[cid] = { ...prev, ...partial }; // merge update { summary?, image_url?, ts? }
  setSummariesMap(map);
}

// 로그인 연동 전: user_id는 null로 전송
export default function Chat() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const initialCid = sp.get('cid') || '';
  const initialTitle = sp.get('t') || '';

  const [cid, setCid] = useState(initialCid);
  const [title] = useState(initialTitle);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const listRef = useRef(null);

  // ====== 음성 입력(STT) 상태 ======
  const [sttSupported] = useState(
    typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  );
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  // ====== UX 상태 (생각중/타이핑/이미지오버레이) ======
  const [isThinking, setIsThinking] = useState(false);     // 채팅 응답 대기: "생각중..."
  const [typingText, setTypingText] = useState('');        // 타이핑 중인 텍스트
  const [imgOverlay, setImgOverlay] = useState(false);     // 이미지 생성 오버레이
  const [imgDots, setImgDots] = useState(1);               // "..." 도트 애니메이션

  // 사용자 메시지 개수 카운트
  const userMsgCount = useMemo(
    () => msgs.filter((m) => m.role === 'user').length,
    [msgs]
  );

  // 스크롤 맨 아래로
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [msgs]);

  // 타이핑 중에도 스크롤 유지
  useEffect(() => {
    if (typingText && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [typingText]);

  // 이미지 오버레이 텍스트 "…"(무한) 애니메이션
  useEffect(() => {
    if (!imgOverlay) return;
    const id = setInterval(() => {
      setImgDots((d) => (d % 3) + 1);
    }, 500);
    return () => clearInterval(id);
  }, [imgOverlay]);

  // 채팅방 메시지 초기 로딩
  useEffect(() => {
    if (!cid) return;
    (async () => {
      const label = 'listMessages';
      const t0 = performance.now();
      try {
        logGroup(label, () => {
          logReq(label, { conversation_id: cid });
        });
        const data = await listMessages(cid);
        logRes(label, { count: data?.items?.length ?? 0, itemsSample: data?.items?.slice(0, 1) }, t0);
        setMsgs(data?.items || []);
      } catch (error) {
        logErr(label, error, t0);
      }
    })();
  }, [cid]);

  // ====== STT 초기화 ======
  useEffect(() => {
    if (!sttSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';       // 한국어 인식
    rec.interimResults = true;
    rec.continuous = true;

    rec.onstart = () => DEBUG && console.log('[STT] onstart');
    rec.onend = () => { DEBUG && console.log('[STT] onend'); setIsListening(false); };
    rec.onerror = (e) => { DEBUG && console.error('[STT] onerror', e); setIsListening(false); };
    rec.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        finalText += res[0].transcript;
      }
      DEBUG && console.log('[STT] onresult', safeText(finalText));
      setInput(() => finalText); // 실시간 덮어쓰기
    };

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [sttSupported]);

  // 대화방 보장
  async function ensureConversation() {
    if (cid) return cid;
    const label = 'createConversation';
    const t0 = performance.now();
    setCreating(true);
    try {
      const payload = { user_id: null, title: title || `대화 ${new Date().toLocaleString()}` };
      logGroup(label, () => logReq(label, payload));
      const res = await createConversation(payload);
      logRes(label, res, t0);
      setCid(res.id);
      // 히스토리에서 최근 접근 CID 저장
      const ids = getRecentCids();
      const next = [res.id, ...ids.filter((x) => x !== res.id)].slice(0, 20);
      localStorage.setItem('recentCids', JSON.stringify(next));
      return res.id;
    } catch (error) {
      logErr(label, error, t0);
      throw error;
    } finally {
      setCreating(false);
    }
  }

  // 메시지 전송
  async function send() {
    const text = input.trim();
    if (!text) return;
    const id = await ensureConversation();
    const userMsg = { role: 'user', content: text, created_at: new Date().toISOString() };

    logGroup('UI:addUserMsg', () => console.log('▶ add message', { ...userMsg, content: safeText(userMsg.content) }));
    setMsgs((p) => [...p, userMsg]);
    setInput('');
    setLoading(true);
    setIsThinking(true);          // ✅ 생각중 표시 시작
    setTypingText('');            // 이전 타이핑 클리어

    const label = 'chat:send';
    const t0 = performance.now();
    try {
      // 듣는 중이면 멈춰서 잔상 입력 방지
      if (isListening) toggleListen(false);

      const payload = { conversation_id: id, user_id: null, content: text };
      logGroup(label, () => logReq(label, { ...payload, content: safeText(payload.content) }));

      const res = await chat(payload);
      logRes(label, { assistant: safeText(res?.assistant) }, t0);

      // ✅ 생각중 종료 후 타이핑 시작
      setIsThinking(false);
      const full = res?.assistant ?? '';
      await animateTyping(full);
    } catch (error) {
      logErr(label, error, t0);
      setIsThinking(false);
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: '메시지 처리 중 오류가 발생했습니다.', created_at: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  }

  // 타이핑 애니메이션
  async function animateTyping(text) {
    setTypingText('');
    for (let i = 0; i < text.length; i++) {
      setTypingText((prev) => prev + text[i]);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, TYPE_SPEED_MS));
    }
    // 최종 메시지로 고정
    setMsgs((p) => [...p, { role: 'assistant', content: text, created_at: new Date().toISOString() }]);
    setTypingText('');
  }

  // 요약 텍스트를 서버 제약에 안전하도록 단일 라인 + 길이 제한
  function sanitizeSummary(s) {
    if (!s) return '';
    const oneLine = s.replace(/\s+/g, ' ').trim();
    const MAX = 240;
    return oneLine.length > MAX ? oneLine.slice(0, MAX) + '…' : oneLine;
  }

  // 대화 종료 → 요약(임시 저장) → 이미지 생성(오버레이 + 성공 시 image_url 업데이트)
  async function summarizeAndDraw() {
    const id = await ensureConversation();

    const summaryPrompt =
      'Context: "자 너는 10년 경력의 심리상담사야 단 너는 우울증 환자들을 대상으로 대답을 하는것이 아닌 일반인을 대상으로 진행하는거야", Propt: "지금까지의 대화를 200자 이내 한국어로 요약해주고 내용의 핵심이 되는 부분들로 다음에 다시 확인했을 때 가독성이 좋아야해" 그리고 니가 작성한 글의 내용을 제외하고 사용자가 입력한 내용으로만 요약을 진행해줘';

    let summaryText = '';
    setLoading(true);

    // 1) 요약 호출 (먼저 localStorage에 임시 저장)
    const labelSumm = 'chat:summarize';
    const tSumm = performance.now();
    try {
      logGroup(labelSumm, () => logReq(labelSumm, { conversation_id: id, user_id: null, content: '[REDACTED: summaryPrompt]' }));
      const res = await chat({ conversation_id: id, user_id: null, content: summaryPrompt });
      summaryText = (res.assistant || '').trim();
      const concise = sanitizeSummary(summaryText);
      // ✅ 요약 임시 저장 (image_url 없이)
      setSummaryForCid(id, { summary: concise, ts: Date.now() });
      logRes(labelSumm, { length: concise.length, preview: safeText(concise, { max: 60 }) }, tSumm);
    } catch (error) {
      logErr(labelSumm, error, tSumm);
      setLoading(false);
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: '요약 중 오류가 발생했습니다.', created_at: new Date().toISOString() }
      ]);
      return;
    }

    // 2) 이미지 생성 + 저장 (오버레이 표시)
    const labelImg = 'createImage';
    const tImg = performance.now();
    try {
      const concise = sanitizeSummary(summaryText);
      const imagePrompt = '다음 3줄 요약본을 분석하고 상황을 사람이아닌 귀여운 캐릭터로 그려주고 그림을 그릴때는 이전에 그렸던 그림과 너무 유사하지않은 방향으로 그려줘 그림은 가로형식으로 그려주고 그림은 니가 답변한 내용말고 사용자가 입력한 내용만 분석해서 그려줘';
      logGroup(labelImg, () => logReq(labelImg, {
        conversation_id: `[REDACTED summary: len=${concise.length}]`,
        prompt: '[REDACTED imagePrompt]'
      }));

      // ✅ 오버레이 켜기
      setImgOverlay(true);

      const img = await createImage({ conversation_id: concise, prompt: imagePrompt });
      logRes(labelImg, img, tImg);

      // UI 알림 (채팅창에도 간단히)
      const line = `[요약 이미지 생성 완료] ${img.image_url}`;
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: line, created_at: new Date().toISOString() }
      ]);

      // 대화별 요약/이미지 저장 (image_url 업데이트)
      setSummaryForCid(id, { image_url: img.image_url });

      // recentImages에도 cid 포함 (Home/History 연동)
      const nowTs = Date.now();
      const imgs = getRecentImages();
      const next = [
        { id: img.id, url: img.image_url, path: img.image_path, cid: id, ts: nowTs },
        ...imgs
      ].slice(0, 12);
      setRecentImages(next);
    } catch (error) {
      logErr(labelImg, error, tImg);
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: '요약 이미지 생성 중 오류가 발생했습니다.', created_at: new Date().toISOString() }
      ]);
    } finally {
      // ✅ 오버레이 끄기
      setImgOverlay(false);
      setLoading(false);
      logGroup('navigate', () => console.log('→ navigate to /home'));
      navigate('/home'); // 요약 후 홈/히스토리로 이동
    }
  }

  // 메시지 리스트가 입력창/탭바와 겹치지 않도록 하단 패딩 확보
  const INPUT_BOX_EST = 110;
  const listPaddingBottom = INPUT_BOX_EST + NAVBAR_HEIGHT + 16;

  // ====== 음성 컨트롤 ======
  function toggleListen(next) {
    if (!sttSupported || !recognitionRef.current) return;
    const rec = recognitionRef.current;
    const label = 'STT:toggle';
    logGroup(label, () => console.log('toggleListen', { next, isListening }));

    if (typeof next === 'boolean') {
      if (next && !isListening) {
        try { rec.start(); setIsListening(true); DEBUG && console.log('[STT] start'); } catch (e) { DEBUG && console.error('[STT] start error', e); }
      } else if (!next && isListening) {
        try { rec.stop(); setIsListening(false); DEBUG && console.log('[STT] stop'); } catch (e) { DEBUG && console.error('[STT] stop error', e); }
      }
      return;
    }
    if (isListening) {
      try { rec.stop(); } catch {}
      setIsListening(false);
      DEBUG && console.log('[STT] stop (toggle)');
    } else {
      try { rec.start(); } catch {}
      setIsListening(true);
      DEBUG && console.log('[STT] start (toggle)');
    }
  }

  return (
    <div>
      {/* 인라인 스타일 키프레임 (스피너) */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
      `}</style>

      <TopBar title="채팅" />
      <main style={{ padding: 16, paddingBottom: listPaddingBottom }}>
        {!cid && !creating && (
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>채팅방이 없습니다</div>
            <Button onClick={ensureConversation}>새 채팅 시작</Button>
          </Card>
        )}

        {/* 메시지 목록 */}
        <div
          ref={listRef}
          style={{
            marginTop: 8,
            height: '52vh',
            overflowY: 'auto',
            paddingRight: 4,
            display: 'grid',
            gap: 6
          }}
        >
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  background: m.role === 'user' ? '#111' : '#f1f5f9',
                  color: m.role === 'user' ? '#fff' : '#111',
                  padding: '6px 8px',
                  borderRadius: 10,
                  fontSize: 14,
                  display: 'inline-flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: 6,
                  maxWidth: '76%',
                  wordBreak: 'break-word',
                  lineHeight: 1.35,
                }}
              >
                <span style={{ flex: '1 1 auto', minWidth: 0, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </span>
                <span
                  style={{
                    flex: '0 0 auto',
                    fontSize: 11,
                    opacity: 0.65,
                    alignSelf: 'flex-end',
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {/* 생각중... 말풍선 */}
          {isThinking && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  background: '#f1f5f9',
                  color: '#111',
                  padding: '6px 8px',
                  borderRadius: 10,
                  fontSize: 14,
                  maxWidth: '76%',
                }}
              >
                생각중...
              </div>
            </div>
          )}

          {/* 타이핑 애니메이션 말풍선 */}
          {typingText && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  background: '#f1f5f9',
                  color: '#111',
                  padding: '6px 8px',
                  borderRadius: 10,
                  fontSize: 14,
                  maxWidth: '76%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.35,
                }}
              >
                {typingText}
              </div>
            </div>
          )}

          {loading && !isThinking && !typingText && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>처리 중…</div>
          )}
        </div>
      </main>

      {/* 하단 고정 입력/음성 컨트롤 영역 */}
      <div style={styles.inputBar}>
        <div style={styles.row}>
          {/* STT 버튼 */}
          <Button
            onClick={() => toggleListen()}
            disabled={!sttSupported || loading || creating}
            style={styles.smallBtn}
            title={sttSupported ? '음성 인식 시작/정지' : '브라우저가 STT를 지원하지 않습니다.'}
          >
            {isListening ? '🎤 듣는 중' : '🎤'}
          </Button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder={sttSupported ? '말하거나 입력하세요' : '메시지를 입력하세요'}
            style={styles.input}
          />

          <Button onClick={send} disabled={loading || creating} style={styles.sendBtn}>
            전송
          </Button>
        </div>

        {/* 사용자 메시지가 N개 이상일 때만 표시 (요청에 맞춰 3으로 낮춤) */}
        {userMsgCount >= 3 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Button
              style={{ background: '#fff', color: '#111' }}
              onClick={summarizeAndDraw}
              disabled={loading || creating}
              title="대화를 요약하고 요약 이미지 한 장을 생성합니다"
            >
              대화 종료 & 요약 이미지
            </Button>
          </div>
        )}
      </div>

      {/* 이미지 생성 오버레이 */}
      {imgOverlay && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(255,255,255,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            aria-label="loading"
            style={{
              width: 72, height: 72,
              borderRadius: '50%',
              border: '6px solid #e5e7eb',
              borderTopColor: '#111',
              animation: 'spin 1s linear infinite',
              marginBottom: 18
            }}
          />
          <div style={{ fontSize: 14, color: '#111', fontWeight: 600 }}>
            오늘 하루를 표현하는 중{'.'.repeat(imgDots)}
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}

const styles = {
  inputBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: NAVBAR_HEIGHT,
    background: '#fff',
    paddingTop: 10,
    paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
    paddingLeft: 'max(10px, env(safe-area-inset-left))',
    paddingRight: 'max(10px, env(safe-area-inset-right))',
    boxShadow: '0 -2px 6px rgba(0,0,0,0.05)',
    zIndex: 999,
    boxSizing: 'border-box',
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #ddd',
    outline: 'none',
    boxSizing: 'border-box',
  },
  sendBtn: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  smallBtn: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    padding: '0 10px',
    height: 40,
    background: '#fff',
    color: '#111',
    border: '1px solid #ddd',
    borderRadius: 8,
  },
};
