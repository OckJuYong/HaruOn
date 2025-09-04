import React, { useEffect, useRef, useState, useMemo } from 'react';
import TopBar from '../components/TopBar';
import NavBar, { NAVBAR_HEIGHT } from '../components/NavBar';
import Button from '../components/Button';
import Card from '../components/Card';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { chat, listMessages, createConversation, createImage, saveImageToDb, saveConversationSummary, getUserPersonalization, updateUserPersonalization, analyzeUserPatterns } from '../api/api';
import { useApp } from '../context/AppProvider';

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

// Note: Removed localStorage functions - now using Supabase directly

export default function Chat() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const initialCid = sp.get('cid') || '';
  const initialTitle = sp.get('t') || '';

  const [cid, setCid] = useState(initialCid);
  const [title] = useState(initialTitle);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const listRef = useRef(null);
  
  // 개인화 관련 상태
  const [userPersonalization, setUserPersonalization] = useState(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  const [showPersonalizationSettings, setShowPersonalizationSettings] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [testResults, setTestResults] = useState(null);

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

  // 사용자 개인화 정보 로드
  useEffect(() => {
    if (user?.id) {
      loadUserPersonalization();
    }
  }, [user]);

  const loadUserPersonalization = async () => {
    if (!user?.id) return;
    
    try {
      setPersonalizationLoading(true);
      const personalization = await getUserPersonalization(user.id);
      setUserPersonalization(personalization);
      
      // 패턴 분석 수행 (백그라운드에서)
      analyzeAndUpdatePatterns();
    } catch (error) {
      console.error('Failed to load personalization:', error);
    } finally {
      setPersonalizationLoading(false);
    }
  };

  const analyzeAndUpdatePatterns = async () => {
    if (!user?.id) return;

    try {
      const patterns = await analyzeUserPatterns(user.id);
      if (patterns) {
        // 분석된 패턴으로 개인화 설정 업데이트
        const updatedPersonalization = {
          conversation_style: patterns.conversation_style,
          response_length: patterns.preferred_response_length,
          topics_of_interest: patterns.topics_of_interest,
          interaction_patterns: patterns.interaction_patterns,
          recent_conversations_examples: patterns.recent_conversations
        };
        
        await updateUserPersonalization(user.id, updatedPersonalization);
        setUserPersonalization(prev => ({ ...prev, ...updatedPersonalization }));
        
        logGroup('personalization:update', () => {
          console.log('Updated user personalization:', updatedPersonalization);
        });
      }
    } catch (error) {
      console.error('Failed to analyze user patterns:', error);
    }
  };

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
    
    // 사용자 인증 상태 필수 확인
    if (!user || !user.id) {
      throw new Error('로그인이 필요한 기능입니다.');
    }
    
    const label = 'createConversation';
    const t0 = performance.now();
    setCreating(true);
    try {
      const payload = { user_id: user.id, title: title || `대화 ${new Date().toLocaleString()}` };
      logGroup(label, () => logReq(label, payload));
      const res = await createConversation(payload);
      logRes(label, res, t0);
      setCid(res.id);
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

      if (!user || !user.id) {
        throw new Error('로그인이 필요한 기능입니다.');
      }

      // 개인화된 메시지 생성 (임시로 간단한 형태 사용)
      const simpleMessages = {
        items: [...msgs, userMsg]
      };
      
      const payload = { 
        conversation_id: id, 
        user_id: user.id, 
        content: text,
        messages: simpleMessages 
      };
      logGroup(label, () => logReq(label, { ...payload, content: safeText(payload.content) }));

      const res = await chat(payload);
      logRes(label, { assistant: safeText(res?.assistant) }, t0);

      // ✅ 생각중 종료 후 타이핑 시작
      setIsThinking(false);
      const full = res?.assistant ?? '';
      await animateTyping(full);
      
      // 테스트 모드일 때 개인화 테스트 수행
      if (testingMode) {
        testPersonalization(full);
      }
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

  // 요약 텍스트를 크레딧 절약을 위해 짧게 제한
  function sanitizeSummary(s) {
    if (!s) return '';
    const oneLine = s.replace(/\s+/g, ' ').trim();
    const MAX = 120; // 240자 → 120자로 절반 단축 (크레딧 절약)
    return oneLine.length > MAX ? oneLine.slice(0, MAX) + '…' : oneLine;
  }

  // 사용자 감정 분석 함수
  function analyzeUserEmotion(userMessages) {
    const recentMessages = userMessages.slice(-3).join(' ').toLowerCase();
    
    const emotionPatterns = {
      angry: ['화나', '짜증', '열받', '빡쳐', '분해', '진짜', '미치겠', '너무해', '억울'],
      sad: ['슬퍼', '우울', '힘들', '눈물', '속상', '기분이', '우울해', '외로', '허전'],
      frustrated: ['답답', '막막', '스트레스', '짜증', '어려워', '모르겠', '안돼'],
      happy: ['좋아', '행복', '기뻐', '신나', '최고', '완전', '대박', '성공', '즐거'],
      excited: ['설레', '기대', '두근', '와', '대박', '완전', '진짜', '신기'],
      worried: ['걱정', '불안', '무서', '떨려', '어떡하지', '망하면', '큰일'],
      neutral: []
    };

    for (const [emotion, keywords] of Object.entries(emotionPatterns)) {
      if (emotion === 'neutral') continue;
      const matchCount = keywords.filter(keyword => recentMessages.includes(keyword)).length;
      if (matchCount >= 1) return emotion;
    }
    
    return 'neutral';
  }

  // 사용자 맞춤형 시스템 프롬프트 생성
  function generatePersonalizedSystemPrompt(userPersonalization) {
    if (!userPersonalization) return getDefaultSystemPrompt();

    const lengthMap = {
      short: '1-2문장',
      medium: '2-3문장', 
      long: '최대 5문장'
    };

    let systemPrompt = `너는 사용자의 진짜 친한 친구야.

기본 규칙:
- 답변은 ${lengthMap[userPersonalization.response_length] || '2-3문장'}으로 짧게 해줘
- 딱딱한 존댓말 금지 ("해드리겠습니다", "말씀해주세요" 등 쓰지마)
- 반말은 안되고, 친근한 존댓말 사용 ("~해요", "~예요", "~네요")
- 실제 친구처럼 자연스럽게 반응해줘
- 상황에 따라 감정을 진짜처럼 표현해줘 (화나면 같이 화내고, 슬프면 위로하고)
- 과도하게 긍정적이거나 상담사처럼 말하지마

대화 예시:
❌ 힘든 일이 있으셨군요. 어떤 일이 있었는지 자세히 말씀해주시면 도움을 드리겠습니다.
✅ 어? 뭔일 있었어요? 누가 뭐라고 했나요?

❌ 정말 기쁜 소식이시네요! 축하드립니다!
✅ 와 진짜요?? 대박이네요! 축하해요!`;

    if (userPersonalization.topics_of_interest?.length > 0) {
      systemPrompt += `\n\n관심사: ${userPersonalization.topics_of_interest.slice(0, 3).join(', ')} 얘기를 좋아해요.`;
    }

    systemPrompt += `\n\n친구처럼 자연스럽게 대화하되, 너무 길게 말하지마!`;

    return systemPrompt;
  }

  // 기본 시스템 프롬프트
  function getDefaultSystemPrompt() {
    return `너는 사용자의 친한 친구야.

기본 규칙:
- 2-3문장으로 짧게 답변해줘
- 친근한 존댓말 사용 ("~해요", "~예요")
- 실제 친구처럼 자연스럽게 반응
- 상황에 맞게 감정 표현 (화나면 같이 화내고, 슬프면 위로)
- 과도하게 긍정적이지 말고 자연스럽게

예시:
"어떤 일 있었어요?" "와 진짜요?" "그럼 어떡해요?" "완전 짜증나겠다"

친구처럼 자연스럽게 대화해줘!`;
  }

  // 개인화된 메시지 배열 생성
  function generatePersonalizedMessages(currentMessage) {
    const messages = [...msgs]; // 기존 대화 히스토리

    // 시스템 프롬프트 추가 (개인화 또는 기본)
    const systemPrompt = userPersonalization ? 
      generatePersonalizedSystemPrompt(userPersonalization) : 
      getDefaultSystemPrompt();
      
    if (systemPrompt) {
      messages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }

    return {
      items: messages
    };
  }

  // 개인화 설정 업데이트
  const updatePersonalizationSetting = (key, value) => {
    setUserPersonalization(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 개인화 설정 저장
  const savePersonalizationSettings = async () => {
    if (!user?.id || !userPersonalization) return;
    
    try {
      await updateUserPersonalization(user.id, userPersonalization);
      setShowPersonalizationSettings(false);
      
      // 성공 메시지 추가
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '개인화 설정이 저장되었습니다. 이제 대화가 더 맞춤형으로 진행됩니다!',
        created_at: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to save personalization:', error);
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '설정 저장 중 오류가 발생했습니다.',
        created_at: new Date().toISOString()
      }]);
    }
  };

  // 개인화 테스트 함수
  const testPersonalization = async (assistantResponse) => {
    if (!testingMode || !userPersonalization || !assistantResponse) return;

    try {
      const testPrompt = `다음 AI 응답이 사용자 개인화 설정에 얼마나 잘 맞는지 평가해주세요:

사용자 개인화 설정:
- 대화 스타일: ${userPersonalization.conversation_style}
- 응답 길이: ${userPersonalization.response_length}
- 감정 톤: ${userPersonalization.emotional_tone}

AI 응답: "${assistantResponse}"

평가 기준:
1. 스타일 일치도 (0-100): 요청된 대화 스타일과 얼마나 일치하는가?
2. 길이 적합성 (0-100): 요청된 응답 길이와 얼마나 일치하는가?
3. 전체 점수 (0-100): 전반적인 개인화 만족도

다음 형식으로 답변해주세요:
스타일일치도: [숫자]
길이적합성: [숫자]
전체점수: [숫자]`;

      const testResult = await chat({
        conversation_id: cid,
        user_id: user.id,
        content: testPrompt
      });

      const response = testResult.assistant || '';
      const styleMatch = extractScore(response, '스타일일치도');
      const lengthMatch = extractScore(response, '길이적합성');
      const overallScore = extractScore(response, '전체점수');

      setTestResults({
        styleMatch: styleMatch || 0,
        lengthMatch: lengthMatch || 0,
        overallScore: overallScore || 0
      });
    } catch (error) {
      console.error('Failed to test personalization:', error);
    }
  };

  // 점수 추출 헬퍼 함수
  const extractScore = (text, label) => {
    const regex = new RegExp(`${label}[:\s]*(\d+)`, 'i');
    const match = text.match(regex);
    return match ? parseInt(match[1]) : null;
  };

  // 감정 기반 이미지 프롬프트 생성
  function createEmotionBasedImagePrompt(koreanSummary, userMessages) {
    // 사용자 감정 분석
    const emotion = analyzeUserEmotion(userMessages);
    
    // 한국어 요약을 영어로 번역
    const translateToEnglish = (text) => {
      const keywordMap = {
        '기분': 'feeling', '감정': 'emotion', '행복': 'joy', '즐거운': 'delightful',
        '시원': 'refreshing', '즐겁': 'cheerful', '좋은': 'wonderful', '편안': 'peaceful',
        '따뜻': 'warm', '포근': 'cozy', '상쾌': 'fresh', '든든': 'comforting',
        '고민': 'thoughtful', '어려움': 'difficult', '스트레스': 'stressful',
        '힘든': 'tough', '아쉬운': 'regretful', '슬픈': 'sad', '우울한': 'melancholy',
        '화나': 'angry', '짜증': 'annoyed', '열받': 'frustrated', '억울': 'unfair',
        '일상': 'daily life', '대화': 'conversation', '친구': 'friend', 
        '가족': 'family', '일': 'work', '공부': 'study', '학습': 'learning',
        '휴식': 'rest', '음식': 'food', '요리': 'cooking',
        '운동': 'exercise', '산책': 'walk', '여행': 'travel', 
        '집': 'home', '독서': 'reading', '영화': 'movie',
        '아침': 'morning', '점심': 'lunch', '오후': 'afternoon',
        '저녁': 'evening', '밤': 'night', '새벽': 'dawn',
        '날씨': 'weather', '비': 'rain', '눈': 'snow', 
        '바람': 'wind', '햇살': 'sunlight',
        '봄': 'spring', '여름': 'summer', '가을': 'autumn', '겨울': 'winter',
        '공원': 'park', '카페': 'cafe', '도서관': 'library'
      };
      
      let translated = text;
      Object.entries(keywordMap).forEach(([kr, en]) => {
        const regex = new RegExp(kr, 'gi');
        translated = translated.replace(regex, en);
      });
      return translated;
    };

    const englishSummary = translateToEnglish(koreanSummary);
    
    // 감정별 이미지 스타일 설정
    const emotionStyles = {
      angry: {
        style: 'Bold, dynamic illustration with strong contrasts',
        colors: 'Deep reds, oranges, and dramatic shadows with lightning or storm elements',
        mood: 'Powerful, intense, like a thunderstorm - raw and honest emotions',
        elements: 'Storm clouds, lightning, fire elements, dramatic landscapes, strong wind effects'
      },
      sad: {
        style: 'Soft, melancholic watercolor illustration',
        colors: 'Cool blues, gentle grays, muted purples with rain or misty elements',
        mood: 'Quietly contemplative, like a rainy afternoon - gentle and understanding',
        elements: 'Gentle rain, misty windows, soft clouds, calm water, quiet spaces'
      },
      frustrated: {
        style: 'Slightly chaotic but artistic composition',
        colors: 'Mixed warm and cool tones, oranges and blues creating tension',
        mood: 'Complex emotions, like tangled thoughts slowly unraveling',
        elements: 'Maze-like patterns, tangled lines that gradually straighten, puzzle pieces'
      },
      happy: {
        style: 'Bright, cheerful illustration with dynamic energy',
        colors: 'Vibrant yellows, warm oranges, bright greens with sunshine elements',
        mood: 'Radiating joy and energy, like a perfect sunny day',
        elements: 'Sunbeams, floating balloons, blooming flowers, clear skies, celebration'
      },
      excited: {
        style: 'Energetic, sparkling illustration with movement',
        colors: 'Electric blues, bright pinks, gold accents with sparkle effects',
        mood: 'Buzzing with anticipation, like fireworks in the sky',
        elements: 'Shooting stars, sparkles, swirling energy, festive elements, dynamic motion'
      },
      worried: {
        style: 'Soft, protective illustration with gentle comfort',
        colors: 'Warm earth tones, soft browns, gentle greens with cozy elements',
        mood: 'Safe and nurturing, like being wrapped in a warm blanket',
        elements: 'Protective canopies, soft nests, gentle embrace, calm shelters'
      },
      neutral: {
        style: 'Balanced, serene illustration',
        colors: 'Harmonious pastels, balanced composition with natural elements',
        mood: 'Peaceful and centered, like a calm lake reflecting the sky',
        elements: 'Natural landscapes, balanced compositions, gentle scenes'
      }
    };

    const selectedStyle = emotionStyles[emotion] || emotionStyles.neutral;

    return `Create a meaningful illustration about: "${englishSummary}"

🎨 EMOTIONAL STYLE:
${selectedStyle.style}

🌈 COLOR PALETTE:
${selectedStyle.colors}

🌟 MOOD & ATMOSPHERE:
${selectedStyle.mood}

✨ VISUAL ELEMENTS:
${selectedStyle.elements}
- Natural, organic forms and shapes
- Emotional resonance over pure cuteness
- Artistic and expressive rather than overly stylized

📐 COMPOSITION:
- Clean, focused composition
- Allow emotions to guide the visual narrative
- Balance between abstract and recognizable elements

🚫 AVOID:
- NO text or letters
- NO overly complex details
- NO generic stock photo aesthetics
- Don't force happiness if the emotion doesn't match

Think: Emotional authenticity meets artistic beauty. Create something that feels real and relatable to human experience.`;
  }

  // 프롬프트에서 영어 요약 부분 추출 (저장용)
  function extractEnglishFromPrompt(imagePrompt) {
    const match = imagePrompt.match(/about: "(.*?)"/);
    return match ? match[1] : '';
  }

  // 대화 종료 → 요약(임시 저장) → 이미지 생성(오버레이 + 성공 시 image_url 업데이트)
  async function summarizeAndDraw() {
    const id = await ensureConversation();

    // 사용자 메시지만 추출하여 요약
    const userMessages = msgs.filter(m => m.role === 'user').map(m => m.content).join(' ');
    
    const summaryPrompt = `다음 사용자의 이야기를 3-4줄로 따뜻하고 긍정적으로 요약해주세요.
사용자의 대화 내용: "${userMessages}"

요약 규칙:
1. 사용자가 한 이야기, 경험, 감정을 중심으로 작성
2. 부정적인 표현은 '어려움을 느꼈다', '고민이 있었다' 정도로 완화 (완전히 제거하지는 않음)
3. 긍정적 측면이나 성장 가능성을 강조
4. 사용자가 나중에 보면 '아, 이런 날이었구나' 하며 따뜻하게 느낄 수 있게
5. 간결하고 일기체로 작성

예시: "오늘은 새로운 도전에 대해 이야기하며 고민도 나눠보았다. 비록 어려움이 있었지만, 하나씩 해결해나가는 과정에서 성장하는 느낌을 받았다."

사용자의 이야기를 바탕으로 따뜻한 일기 요약:`;

    let summaryText = '';
    setLoading(true);

    // 1) 요약 호출 (먼저 localStorage에 임시 저장)
    const labelSumm = 'chat:summarize';
    const tSumm = performance.now();
    try {
      logGroup(labelSumm, () => logReq(labelSumm, { conversation_id: id, user_id: null, content: '[REDACTED: summaryPrompt]' }));
      if (!user || !user.id) {
        throw new Error('로그인이 필요한 기능입니다.');
      }
      const res = await chat({ conversation_id: id, user_id: user.id, content: summaryPrompt });
      summaryText = (res.assistant || '').trim();
      const concise = sanitizeSummary(summaryText);
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
      
      // 사용자 메시지 기반 감정 분석하여 이미지 프롬프트 생성
      const userMessages = msgs.filter(m => m.role === 'user').map(m => m.content);
      const imagePrompt = createEmotionBasedImagePrompt(concise, userMessages);
      
      // 영어 요약 추출 (사용자에게는 보이지 않지만 일관성을 위해 저장)
      const englishSummary = extractEnglishFromPrompt(imagePrompt);

      logGroup(labelImg, () => logReq(labelImg, {
        conversation_id: `[REDACTED summary: len=${concise.length}]`,
        prompt: '[REDACTED imagePrompt]'
      }));

      // ✅ 오버레이 켜기
      setImgOverlay(true);

      const img = await createImage({ conversation_id: id, prompt: imagePrompt });
      logRes(labelImg, img, tImg);

      // UI 알림 (채팅창에도 간단히)
      const line = `[요약 이미지 생성 완료] ${img.image_url}`;
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: line, created_at: new Date().toISOString() }
      ]);

      // Save to Supabase instead of localStorage
      try {
        // Save image to images table
        await saveImageToDb({
          conversation_id: id,
          prompt: imagePrompt,
          image_url: img.image_url
        });
        
        // Save conversation summary with English translation
        await saveConversationSummary(id, concise, img.image_url, englishSummary);
      } catch (error) {
        console.error('Failed to save to database:', error);
      }
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
      
      {/* 개인화 상태 표시 */}
      {userPersonalization && (
        <div style={styles.personalizationBar}>
          <div style={styles.personalizationInfo}>
            <span style={styles.personalizationLabel}>맞춤설정:</span>
            <span style={styles.personalizationValue}>
              {userPersonalization.conversation_style === 'friendly' ? '친근함' : 
               userPersonalization.conversation_style === 'formal' ? '정중함' : '열정적'} • 
              {userPersonalization.response_length === 'short' ? '간결' :
               userPersonalization.response_length === 'medium' ? '보통' : '상세'}
            </span>
            {userPersonalization.topics_of_interest?.length > 0 && (
              <span style={styles.personalizationTopics}>
                관심: {userPersonalization.topics_of_interest.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
          <div style={styles.personalizationActions}>
            <button 
              style={styles.personalizationBtn}
              onClick={() => setShowPersonalizationSettings(true)}
              title="개인화 설정"
            >
              ⚙️
            </button>
            <button
              style={styles.personalizationBtn}
              onClick={() => setTestingMode(!testingMode)}
              title="개인화 테스트 모드"
            >
              🧪
            </button>
          </div>
        </div>
      )}
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
            maxHeight: '60vh',
            minHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 4,
            display: 'grid',
            gap: 6,
            scrollBehavior: 'smooth'
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
          
          {/* 테스트 결과 표시 */}
          {testResults && testingMode && (
            <div style={styles.testResultsCard}>
              <h4 style={styles.testResultsTitle}>개인화 테스트 결과</h4>
              <div style={styles.testResultItem}>
                <strong>응답 스타일 일치도:</strong> {testResults.styleMatch}%
              </div>
              <div style={styles.testResultItem}>
                <strong>응답 길이 적합성:</strong> {testResults.lengthMatch}%
              </div>
              <div style={styles.testResultItem}>
                <strong>전체 개인화 점수:</strong> {testResults.overallScore}%
              </div>
              <button 
                style={styles.testResultsClose}
                onClick={() => setTestResults(null)}
              >
                닫기
              </button>
            </div>
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

      {/* 개인화 설정 모달 */}
      {showPersonalizationSettings && userPersonalization && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>개인화 설정</h3>
            
            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>대화 스타일</label>
              <select 
                value={userPersonalization.conversation_style}
                onChange={(e) => updatePersonalizationSetting('conversation_style', e.target.value)}
                style={styles.settingSelect}
              >
                <option value="friendly">친근함</option>
                <option value="formal">정중함</option>
                <option value="enthusiastic">열정적</option>
              </select>
            </div>
            
            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>응답 길이</label>
              <select 
                value={userPersonalization.response_length}
                onChange={(e) => updatePersonalizationSetting('response_length', e.target.value)}
                style={styles.settingSelect}
              >
                <option value="short">간결</option>
                <option value="medium">보통</option>
                <option value="long">상세</option>
              </select>
            </div>
            
            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>감정 톤</label>
              <select 
                value={userPersonalization.emotional_tone}
                onChange={(e) => updatePersonalizationSetting('emotional_tone', e.target.value)}
                style={styles.settingSelect}
              >
                <option value="warm">따뜻함</option>
                <option value="neutral">중립적</option>
                <option value="supportive">지지적</option>
              </select>
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={styles.modalCloseBtn}
                onClick={() => setShowPersonalizationSettings(false)}
              >
                닫기
              </button>
              <button 
                style={styles.modalSaveBtn}
                onClick={savePersonalizationSettings}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}

const styles = {
  personalizationBar: {
    background: '#f8fafc',
    padding: '8px 16px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
  },
  personalizationInfo: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  personalizationLabel: {
    fontWeight: 600,
    color: '#64748b',
  },
  personalizationValue: {
    color: '#1e293b',
    fontWeight: 500,
  },
  personalizationTopics: {
    color: '#7c3aed',
    fontSize: 11,
  },
  personalizationActions: {
    display: 'flex',
    gap: 4,
  },
  personalizationBtn: {
    background: 'none',
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    opacity: 0.7,
  },
  testResultsCard: {
    background: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: 8,
    padding: 12,
    margin: '8px 0',
    fontSize: 12,
  },
  testResultsTitle: {
    margin: '0 0 8px 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#92400e',
  },
  testResultItem: {
    margin: '4px 0',
    color: '#92400e',
  },
  testResultsClose: {
    background: '#f59e0b',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    marginTop: 8,
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    margin: '0 0 16px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#1e293b',
  },
  settingGroup: {
    marginBottom: 16,
  },
  settingLabel: {
    display: 'block',
    marginBottom: 4,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  settingSelect: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalCloseBtn: {
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
  modalSaveBtn: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 500,
  },
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
