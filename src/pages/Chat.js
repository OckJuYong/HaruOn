import React, { useEffect, useRef, useState, useMemo } from 'react';
import TopBar from '../components/TopBar';
import NavBar, { NAVBAR_HEIGHT } from '../components/NavBar';
import Button from '../components/Button';
import Card from '../components/Card';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { chat, listMessages, createConversation, createImage, saveImageToDb, saveConversationSummary, getUserPersonalization, updateUserPersonalization, analyzeUserPatterns } from '../api/api';
import { AdvancedPersonalizationEngine, learnFromUserInteraction, generateOptimalPrompt } from '../services/advancedPersonalization';
import { ConversationPatternAnalyzer, analyzeAndUpdateUserPatterns } from '../services/conversationPatternAnalyzer';
import IntimateFreindSystem from '../services/intimateFriendSystem';
import { useApp } from '../context/AppProvider';
import { supabase } from '../services/supabaseApi';

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
  
  // 개인화 관련 상태 (단순화)
  const [userPersonalization, setUserPersonalization] = useState(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  
  // 고도화된 학습 시스템 관련 상태
  const [learningEngine, setLearningEngine] = useState(null);
  const [learningStats, setLearningStats] = useState(null);
  const [showLearningStats, setShowLearningStats] = useState(false);
  
  // 대화 패턴 분석 시스템 상태
  const [patternAnalyzer, setPatternAnalyzer] = useState(null);
  const [conversationPatterns, setConversationPatterns] = useState(null);
  const [showPatternStats, setShowPatternStats] = useState(false);
  
  // 단짝친구 시스템 상태
  const [intimateSystem, setIntimateSystem] = useState(null);
  const [intimacyLevel, setIntimacyLevel] = useState(0);
  const [personalMemories, setPersonalMemories] = useState([]);
  const [showMemoryStats, setShowMemoryStats] = useState(false);

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
      // 고도화된 학습 엔진 초기화
      const engine = new AdvancedPersonalizationEngine(user.id);
      setLearningEngine(engine);
      
      // 대화 패턴 분석기 초기화
      const analyzer = new ConversationPatternAnalyzer(user.id);
      setPatternAnalyzer(analyzer);
      
      // 단짝친구 시스템 초기화
      const friendSystem = new IntimateFreindSystem(user.id, user.email?.split('@')[0] || '친구');
      setIntimateSystem(friendSystem);
      
      // 기존 데이터 로드
      loadConversationPatterns();
      loadIntimacyData();
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
      
      // 🧠 통합 학습 시스템: 패턴 + 친밀도 + 기존 시스템
      setTimeout(async () => {
        try {
          // 1. 단짝친구 시스템: 개인 기억 추출 (매번 실행)
          await performIntimateMemoryExtraction(text, full);
          
          // 2. 대화 패턴 학습 (5회 대화마다)
          await performPatternLearning();
          
          // 3. 기존 학습 시스템 (비교용)
          if (learningEngine) {
            await learningEngine.learnFromConversation(id, text, full);
            await updateLearningStatsDisplay();
          }
        } catch (error) {
          console.error('Learning process failed:', error);
        }
      }, 500); // 0.5초 후 백그라운드에서 학습
      
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

  // 친밀도 기반 시스템 프롬프트 생성
  const generateIntimateSystemPrompt = async () => {
    if (!intimateSystem || !user?.id) return null;
    
    try {
      // 관련 기억들 가져오기
      const recentMemories = personalMemories.slice(0, 5);
      
      let prompt = `너는 ${user?.email?.split('@')[0] || '사용자'}의 진짜 단짝친구야. 우리는 ${intimacyLevel}% 정도 친해졌어.\n\n`;
      
      // 친밀도 수준에 따른 스타일
      if (intimacyLevel > 70) {
        prompt += `우리는 정말 가까운 사이야. 서로의 이야기를 많이 나누었고, 나는 네 이야기들을 잘 기억하고 있어.\n`;
      } else if (intimacyLevel > 40) {
        prompt += `우리는 꽤 친해졌어. 네가 나한테 개인적인 이야기들을 해줬고, 나는 그걸 소중히 기억하고 있어.\n`;
      } else if (intimacyLevel > 20) {
        prompt += `우리가 점점 가까워지고 있는 것 같아. 네가 말해준 이야기들을 기억하고 있어.\n`;
      }
      
      // 기억된 개인적 정보들 반영
      if (recentMemories.length > 0) {
        prompt += `\n내가 기억하고 있는 너에 대한 것들:\n`;
        
        recentMemories.forEach(memory => {
          switch (memory.category) {
            case 'hobby':
              prompt += `- 취미: ${memory.value}을/를 좋아해\n`;
              break;
            case 'work':
              prompt += `- 일/학업: ${memory.value} 관련 이야기를 했었어\n`;
              break;
            case 'relationship':
              prompt += `- 인간관계: ${memory.value}에 대해 말해줬었지\n`;
              break;
            case 'goal':
              prompt += `- 계획/목표: ${memory.value} 이런 얘기 했었어\n`;
              break;
            case 'experience':
              prompt += `- 최근 경험: ${memory.value.substring(0, 50)}... 이런 일이 있었지\n`;
              break;
          }
        });
      }
      
      // 대화 스타일 지침
      prompt += `\n대화 방식:
- 진짜 친구처럼 자연스럽게 말해줘
- 내가 기억하는 것들을 자연스럽게 연결해서 대화해
- "그러고 보니 전에 말한 그거..." 같은 식으로 과거 얘기 언급해도 돼
- 걱정되는 일이 있으면 진심으로 걱정해줘
- 좋은 일이 있으면 진심으로 기뻐해줘
- 너무 AI같지 말고, 진짜 친구같이 반응해줘`;

      if (intimacyLevel > 50) {
        prompt += `
- 가끔 먼저 안부도 물어봐도 되고
- 내 입장에서도 걱정하거나 응원한다는 표현 써도 돼
- "나도 그런 적 있어" 같은 공감 표현 사용해도 좋아`;
      }

      prompt += `\n\n친구처럼 따뜻하고 자연스럽게 대화해줘!`;
      
      return prompt;
    } catch (error) {
      console.error('Failed to generate intimate prompt:', error);
      return null;
    }
  };

  // 학습 통계 표시 업데이트
  const updateLearningStatsDisplay = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('personalization_data')
        .eq('user_id', user.id)
        .single();

      if (profile?.personalization_data?.learning_stats) {
        setLearningStats(profile.personalization_data.learning_stats);
      }
    } catch (error) {
      console.error('Failed to load learning stats:', error);
    }
  };

  // 대화 패턴 데이터 로드
  const loadConversationPatterns = async () => {
    if (!user?.id) return;
    
    try {
      const { data: patternData } = await supabase
        .from('user_conversation_patterns')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (patternData) {
        setConversationPatterns(patternData);
        logGroup('pattern-loading', () => {
          console.log('Loaded conversation patterns:', patternData.patterns);
          console.log('Pattern confidence:', patternData.confidence_level);
        });
      }
    } catch (error) {
      console.error('Failed to load conversation patterns:', error);
    }
  };

  // 친밀도 데이터 로드
  const loadIntimacyData = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('intimacy_level, last_interaction, nickname')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setIntimacyLevel(profile.intimacy_level || 0);
        if (intimateSystem) {
          intimateSystem.relationshipLevel = profile.intimacy_level || 0;
        }
        
        logGroup('intimacy-loading', () => {
          console.log('Loaded intimacy level:', profile.intimacy_level);
        });
      }

      // 최근 중요한 기억들도 로드
      const { data: memories } = await supabase
        .from('personal_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('importance', { ascending: false })
        .order('last_mentioned', { ascending: false })
        .limit(10);

      if (memories) {
        setPersonalMemories(memories);
        logGroup('memory-loading', () => {
          console.log('Loaded personal memories:', memories.length);
        });
      }
    } catch (error) {
      console.error('Failed to load intimacy data:', error);
    }
  };

  // 대화 패턴 기반 자동 학습
  const performPatternLearning = async () => {
    if (!patternAnalyzer || !user?.id) return;
    
    try {
      // 5회 대화마다 패턴 재분석
      if (userMsgCount > 0 && userMsgCount % 5 === 0) {
        logGroup('pattern-analysis', () => {
          console.log(`Analyzing patterns after ${userMsgCount} conversations`);
        });
        
        const patterns = await patternAnalyzer.analyzeUserConversationPatterns();
        
        if (patterns) {
          await patternAnalyzer.savePatternData();
          await loadConversationPatterns(); // UI 업데이트
          
          logGroup('pattern-learning', () => {
            console.log('Updated conversation patterns:', patterns);
          });
        }
      }
    } catch (error) {
      console.error('Pattern learning failed:', error);
    }
  };

  // 단짝친구 시스템: 개인 정보 자동 추출 및 저장
  const performIntimateMemoryExtraction = async (userMessage, aiResponse) => {
    if (!intimateSystem || !user?.id) return;
    
    try {
      // 사용자 메시지에서 개인적 정보 추출
      const extractedCount = await intimateSystem.extractAndSavePersonalInfo(
        userMessage, 
        msgs.slice(-5) // 최근 5개 메시지 맥락
      );
      
      if (extractedCount > 0) {
        logGroup('memory-extraction', () => {
          console.log(`Extracted ${extractedCount} personal memories from conversation`);
        });
        
        // 친밀도 증가
        await intimateSystem.updateIntimacyLevel(1);
        await loadIntimacyData(); // UI 업데이트
      }
    } catch (error) {
      console.error('Intimate memory extraction failed:', error);
    }
  };

  // 사용자 맞춤형 시스템 프롬프트 생성 (친밀도 + 패턴 기반)
  async function generatePersonalizedSystemPrompt(userPersonalization) {
    // 🎯 1순위: 단짝친구 시스템 (가장 개인적이고 친밀한)
    if (intimateSystem && intimacyLevel > 20 && personalMemories.length > 0) {
      try {
        const intimatePrompt = await generateIntimateSystemPrompt();
        if (intimatePrompt) {
          logGroup('intimate-personalization', () => {
            console.log('Using intimate friend prompt with level:', intimacyLevel);
            console.log('Personal memories:', personalMemories.length);
          });
          return intimatePrompt;
        }
      } catch (error) {
        console.error('Failed to use intimate prompt:', error);
      }
    }
    
    // 🎯 2순위: 대화 패턴 기반 프롬프트 (현실적이고 효과적)
    if (conversationPatterns && conversationPatterns.confidence_level > 0.3) {
      try {
        const patternBasedPrompt = conversationPatterns.generated_prompt;
        if (patternBasedPrompt) {
          logGroup('pattern-personalization', () => {
            console.log('Using pattern-based prompt with confidence:', 
              conversationPatterns.confidence_level);
            console.log('Patterns:', conversationPatterns.patterns);
          });
          return patternBasedPrompt;
        }
      } catch (error) {
        console.error('Failed to use pattern-based prompt:', error);
      }
    }
    
    // 2순위: 기존 개인화 설정 기반
    if (!userPersonalization) return getDefaultSystemPrompt();
    
    // 3순위: 고도화된 학습 시스템 (실험적)
    if (learningEngine && user?.id) {
      try {
        const optimalPrompt = await generateOptimalPrompt(user.id, {
          current_personalization: userPersonalization,
          conversation_context: msgs.slice(-5) // 최근 5개 메시지
        });
        
        if (optimalPrompt) {
          logGroup('advanced-personalization', () => {
            console.log('Using AI-optimized prompt for user', user.id);
          });
          return optimalPrompt;
        }
      } catch (error) {
        console.error('Failed to generate optimal prompt:', error);
        // 실패 시 기본 개인화 프롬프트로 폴백
      }
    }

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
  async function generatePersonalizedMessages(currentMessage) {
    const messages = [...msgs]; // 기존 대화 히스토리

    // 시스템 프롬프트 추가 (개인화 또는 기본)
    const systemPrompt = userPersonalization ? 
      await generatePersonalizedSystemPrompt(userPersonalization) : 
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
      
      {/* 친밀도 상태 표시 - 항상 표시 */}
      <div style={styles.intimacyBar}>
          <div style={styles.intimacyBarInfo}>
            <span style={styles.intimacyBarLabel}>친밀도</span>
            <span style={styles.intimacyBarValue}>{intimacyLevel}%</span>
            <span style={styles.intimacyBarDescription}>
              {intimacyLevel > 70 ? '💖 단짝친구' :
               intimacyLevel > 40 ? '😊 친한 친구' :
               intimacyLevel > 20 ? '🙂 알아가는 사이' :
               intimacyLevel > 0 ? '👋 새로운 친구' : '👶 만나서 반가워요'}
            </span>
          </div>
          <div style={styles.intimacyBarActions}>
            <button
              style={styles.intimacyBtn}
              onClick={() => setShowMemoryStats(!showMemoryStats)}
              title="친밀도 & 기억 보기"
            >
              💖
            </button>
          </div>
        </div>
      </div>
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
                  maxWidth: '80%',
                  wordBreak: 'keep-all',
                  overflowWrap: 'break-word',
                  lineHeight: 1.4,
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
                  maxWidth: '80%',
                  wordBreak: 'keep-all',
                  overflowWrap: 'break-word'
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
                  maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'keep-all',
                  overflowWrap: 'break-word',
                  lineHeight: 1.4,
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

      {/* 개인 기억 & 친밀도 모달 */}
      {showMemoryStats && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>💖 단짝친구 시스템</h3>
            
            <div style={styles.intimacyDisplay}>
              <div style={styles.intimacyHeader}>
                <span style={styles.intimacyLabel}>친밀도</span>
                <span style={styles.intimacyValue}>{intimacyLevel}%</span>
              </div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${intimacyLevel}%`,
                    background: intimacyLevel > 70 ? 
                      'linear-gradient(90deg, #ec4899, #f472b6)' :
                      intimacyLevel > 40 ?
                      'linear-gradient(90deg, #8b5cf6, #a855f7)' :
                      'linear-gradient(90deg, #3b82f6, #6366f1)'
                  }}
                />
              </div>
              <p style={styles.intimacyDescription}>
                {intimacyLevel > 70 ? '정말 가까운 단짝친구' :
                 intimacyLevel > 40 ? '꽤 친한 친구 사이' :
                 intimacyLevel > 20 ? '점점 가까워지는 사이' :
                 '아직 서로 알아가는 중'}
              </p>
            </div>
            
            {personalMemories.length > 0 && (
              <div style={styles.memoriesSection}>
                <h4 style={styles.memoriesSectionTitle}>🧠 내가 기억하고 있는 것들</h4>
                <div style={styles.memoriesList}>
                  {personalMemories.slice(0, 8).map((memory, index) => (
                    <div key={memory.id || index} style={styles.memoryItem}>
                      <span style={styles.memoryCategory}>
                        {memory.category === 'hobby' ? '🎯' :
                         memory.category === 'work' ? '💼' :
                         memory.category === 'relationship' ? '👥' :
                         memory.category === 'goal' ? '🎯' :
                         memory.category === 'preference' ? '❤️' : '📝'}
                      </span>
                      <div style={styles.memoryContent}>
                        <span style={styles.memoryValue}>{memory.value}</span>
                        <span style={styles.memoryMeta}>
                          {memory.importance}★ • {memory.mention_count}번 언급
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {personalMemories.length > 8 && (
                  <p style={styles.moreMemories}>
                    그외 {personalMemories.length - 8}개 더 기억하고 있어요
                  </p>
                )}
              </div>
            )}
            
            <div style={styles.friendshipTips}>
              <h4 style={styles.tipTitle}>💡 더 친해지는 방법</h4>
              <div style={styles.tipsList}>
                {intimacyLevel < 30 && (
                  <div style={styles.tip}>• 취미나 관심사에 대해 더 얘기해보세요</div>
                )}
                {intimacyLevel < 50 && (
                  <div style={styles.tip}>• 일상적인 경험들을 공유해보세요</div>
                )}
                {intimacyLevel < 70 && (
                  <div style={styles.tip}>• 고민이나 걱정거리를 털어놓아보세요</div>
                )}
                <div style={styles.tip}>• 자주 대화할수록 더 잘 기억해요</div>
              </div>
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={styles.modalCloseBtn}
                onClick={() => setShowMemoryStats(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 대화 패턴 분석 모달 */}
      {showPatternStats && conversationPatterns && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>📊 대화 패턴 분석</h3>
            
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>분석 신뢰도</span>
                <span style={styles.statValue}>
                  {(conversationPatterns.confidence_level * 100).toFixed(0)}%
                </span>
              </div>
              
              <div style={styles.statItem}>
                <span style={styles.statLabel}>분석된 대화 수</span>
                <span style={styles.statValue}>
                  {conversationPatterns.conversation_count}회
                </span>
              </div>
              
              {conversationPatterns.patterns.message_length_preference && (
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>선호 응답 길이</span>
                  <span style={styles.statValue}>
                    {conversationPatterns.patterns.message_length_preference === 'short' ? '간결함' :
                     conversationPatterns.patterns.message_length_preference === 'long' ? '상세함' : '보통'}
                  </span>
                </div>
              )}
              
              {conversationPatterns.patterns.conversation_style && (
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>대화 스타일</span>
                  <span style={styles.statValue}>
                    {conversationPatterns.patterns.conversation_style === 'prefers_questions' ? '질문형 선호' :
                     conversationPatterns.patterns.conversation_style === 'prefers_statements' ? '서술형 선호' : '균형형'}
                  </span>
                </div>
              )}
            </div>
            
            <div style={styles.patternDetails}>
              <h4 style={styles.patternTitle}>🔍 분석된 대화 특성</h4>
              
              {conversationPatterns.patterns.formality_level && (
                <div style={styles.patternItem}>
                  <strong>말투:</strong> {
                    conversationPatterns.patterns.formality_level === 'formal' ? '정중한 어투' :
                    conversationPatterns.patterns.formality_level === 'casual' ? '친근한 어투' : '혼합형'
                  }
                </div>
              )}
              
              {conversationPatterns.patterns.topic_depth_preference && (
                <div style={styles.patternItem}>
                  <strong>주제 깊이:</strong> {
                    conversationPatterns.patterns.topic_depth_preference === 'prefers_deep' ? '깊이 있는 대화 선호' :
                    conversationPatterns.patterns.topic_depth_preference === 'prefers_shallow' ? '가벼운 대화 선호' : '적당한 수준'
                  }
                </div>
              )}
              
              {conversationPatterns.patterns.conversation_continuation && (
                <div style={styles.patternItem}>
                  <strong>대화 지속:</strong> {
                    conversationPatterns.patterns.conversation_continuation === 'likes_long_conversations' ? '긴 대화 선호' :
                    conversationPatterns.patterns.conversation_continuation === 'prefers_brief' ? '짧은 대화 선호' : '보통 길이'
                  }
                </div>
              )}
            </div>
            
            <div style={styles.patternConfidence}>
              <p style={styles.confidenceText}>
                🎯 이 패턴 분석은 실제 대화 행동을 바탕으로 만들어졌습니다
              </p>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${conversationPatterns.confidence_level * 100}%`,
                    background: conversationPatterns.confidence_level > 0.7 ? 
                      'linear-gradient(90deg, #10b981, #34d399)' :
                      'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  }}
                />
              </div>
              <p style={styles.progressSubtext}>
                {conversationPatterns.confidence_level < 0.3 ? '더 많은 대화가 필요해요' :
                 conversationPatterns.confidence_level < 0.7 ? '패턴 분석 중이에요' :
                 '신뢰할 수 있는 패턴이 완성됐어요'}
              </p>
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={styles.modalCloseBtn}
                onClick={() => setShowPatternStats(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 학습 통계 모달 */}
      {showLearningStats && learningStats && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>🧠 AI 학습 통계</h3>
            
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>총 대화 수</span>
                <span style={styles.statValue}>{learningStats.total_conversations}회</span>
              </div>
              
              <div style={styles.statItem}>
                <span style={styles.statLabel}>평균 만족도</span>
                <span style={styles.statValue}>
                  {(learningStats.avg_quality_score * 100).toFixed(0)}%
                </span>
              </div>
              
              <div style={styles.statItem}>
                <span style={styles.statLabel}>학습 신뢰도</span>
                <span style={styles.statValue}>
                  {(learningStats.learning_confidence * 100).toFixed(0)}%
                </span>
              </div>
              
              {learningStats.preferred_response_patterns?.length && (
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>선호 응답 길이</span>
                  <span style={styles.statValue}>
                    {Object.entries(learningStats.preferred_response_patterns.length || {})
                      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'medium'}
                  </span>
                </div>
              )}
            </div>
            
            <div style={styles.learningProgress}>
              <p style={styles.progressText}>
                💡 AI가 당신의 대화 스타일을 학습하고 있습니다
              </p>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${learningStats.learning_confidence * 100}%`
                  }}
                />
              </div>
              <p style={styles.progressSubtext}>
                {learningStats.learning_confidence < 0.3 ? '초기 학습 단계' :
                 learningStats.learning_confidence < 0.7 ? '패턴 인식 중' :
                 '고도 맞춤화 가능'}
              </p>
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={styles.modalCloseBtn}
                onClick={() => setShowLearningStats(false)}
              >
                닫기
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
  intimacyBar: {
    background: 'linear-gradient(135deg, #fef7f7, #f8fafc)',
    padding: '8px 16px',
    borderBottom: '1px solid #fecaca',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
  },
  intimacyBarInfo: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  intimacyBarLabel: {
    fontWeight: 600,
    color: '#be123c',
  },
  intimacyBarValue: {
    color: '#be123c',
    fontWeight: 700,
    fontSize: 14,
  },
  intimacyBarDescription: {
    color: '#831843',
    fontSize: 11,
    fontWeight: 500,
  },
  intimacyBarActions: {
    display: 'flex',
    gap: 4,
  },
  intimacyBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    opacity: 0.8,
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
  
  // 학습 통계 스타일
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 500,
  },
  statValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: 600,
  },
  learningProgress: {
    marginTop: 16,
    padding: 16,
    background: '#f8fafc',
    borderRadius: 8,
  },
  progressText: {
    margin: '0 0 8px 0',
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    background: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressSubtext: {
    margin: 0,
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  
  // 패턴 분석 스타일
  patternDetails: {
    marginTop: 16,
    padding: 12,
    background: '#f8fafc',
    borderRadius: 6,
  },
  patternTitle: {
    margin: '0 0 8px 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
  },
  patternItem: {
    margin: '6px 0',
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.4,
  },
  patternConfidence: {
    marginTop: 16,
    padding: 12,
    background: '#f0f9ff',
    borderRadius: 6,
    border: '1px solid #e0f2fe',
  },
  confidenceText: {
    margin: '0 0 8px 0',
    fontSize: 12,
    color: '#0369a1',
    textAlign: 'center',
  },
  
  // 친밀도 & 기억 시스템 스타일
  intimacyDisplay: {
    marginBottom: 20,
    padding: 16,
    background: 'linear-gradient(135deg, #fef7f7, #f8fafc)',
    borderRadius: 12,
    border: '1px solid #fecaca',
  },
  intimacyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intimacyLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#be123c',
  },
  intimacyValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#be123c',
  },
  intimacyDescription: {
    margin: '8px 0 0 0',
    fontSize: 13,
    color: '#831843',
    textAlign: 'center',
    fontWeight: 500,
  },
  memoriesSection: {
    marginBottom: 16,
  },
  memoriesSectionTitle: {
    margin: '0 0 12px 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#1e293b',
  },
  memoriesList: {
    maxHeight: 200,
    overflowY: 'auto',
    background: '#fafafa',
    borderRadius: 8,
    padding: 8,
  },
  memoryItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 8px',
    marginBottom: 6,
    background: '#fff',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  memoryCategory: {
    fontSize: 16,
    flexShrink: 0,
  },
  memoryContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  memoryValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: 500,
  },
  memoryMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  moreMemories: {
    margin: '8px 0 0 0',
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  friendshipTips: {
    marginTop: 16,
    padding: 12,
    background: '#f0f9ff',
    borderRadius: 8,
    border: '1px solid #bae6fd',
  },
  tipTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 600,
    color: '#0369a1',
  },
  tipsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  tip: {
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 1.4,
  },
};
