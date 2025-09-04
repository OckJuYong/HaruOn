// 단짝친구 같은 AI를 위한 고도화된 시스템
import { supabase } from './supabaseApi';

/**
 * 진짜 친구처럼 느껴지게 하는 핵심 기능들:
 * 1. 개인적 기억 시스템 (취미, 관심사, 중요한 사건들)
 * 2. 시간 맥락 인식 (며칠 전 얘기 연결, 계절/날씨 반응)
 * 3. 감정 유대감 형성 (공감, 걱정, 축하 등의 자연스러운 반응)
 * 4. 능동적 관심 표현 (먼저 안부 묻기, 약속 기억하기)
 * 5. 개인화된 별명/호칭 시스템
 * 6. 공유된 추억 만들기
 */

export class IntimateFreindSystem {
  constructor(userId, userName = null) {
    this.userId = userId;
    this.userName = userName;
    this.personalMemory = new Map();
    this.emotionalContext = [];
    this.sharedExperiences = [];
    this.relationshipLevel = 0; // 0-100, 친밀도 수준
  }

  /**
   * 개인적 기억 저장 및 관리
   */
  async savePersonalMemory(category, key, value, importance = 1, context = '') {
    const memory = {
      category, // 'hobby', 'work', 'family', 'goal', 'preference', 'experience'
      key,
      value,
      importance, // 1-5, 중요도
      context,
      created_at: new Date().toISOString(),
      last_mentioned: new Date().toISOString(),
      mention_count: 1
    };

    try {
      // 기존 기억 업데이트 또는 새로 추가
      const { data: existing } = await supabase
        .from('personal_memories')
        .select('*')
        .eq('user_id', this.userId)
        .eq('category', category)
        .eq('key', key)
        .single();

      if (existing) {
        // 기존 기억 업데이트 (언급 횟수 증가, 마지막 언급 시간 업데이트)
        await supabase
          .from('personal_memories')
          .update({
            value,
            last_mentioned: new Date().toISOString(),
            mention_count: existing.mention_count + 1,
            importance: Math.max(existing.importance, importance)
          })
          .eq('id', existing.id);
      } else {
        // 새로운 기억 저장
        await supabase
          .from('personal_memories')
          .insert({
            user_id: this.userId,
            ...memory
          });
      }

      this.personalMemory.set(`${category}:${key}`, memory);
      return true;
    } catch (error) {
      console.error('Failed to save personal memory:', error);
      return false;
    }
  }

  /**
   * 대화에서 개인적 정보 자동 추출 및 저장
   */
  async extractAndSavePersonalInfo(userMessage, conversationContext = []) {
    const extractions = [];

    // 취미/활동 추출
    const hobbies = this.extractHobbies(userMessage);
    for (const hobby of hobbies) {
      extractions.push(['hobby', hobby.key, hobby.value, hobby.importance, userMessage]);
    }

    // 직업/학업 정보 추출
    const workInfo = this.extractWorkInfo(userMessage);
    for (const work of workInfo) {
      extractions.push(['work', work.key, work.value, work.importance, userMessage]);
    }

    // 인간관계 정보 추출
    const relationships = this.extractRelationships(userMessage);
    for (const rel of relationships) {
      extractions.push(['relationship', rel.key, rel.value, rel.importance, userMessage]);
    }

    // 목표/계획 추출
    const goals = this.extractGoals(userMessage);
    for (const goal of goals) {
      extractions.push(['goal', goal.key, goal.value, goal.importance, userMessage]);
    }

    // 선호도/취향 추출
    const preferences = this.extractPreferences(userMessage);
    for (const pref of preferences) {
      extractions.push(['preference', pref.key, pref.value, pref.importance, userMessage]);
    }

    // 중요한 사건/경험 추출
    const experiences = this.extractExperiences(userMessage, conversationContext);
    for (const exp of experiences) {
      extractions.push(['experience', exp.key, exp.value, exp.importance, userMessage]);
    }

    // 모든 추출된 정보 저장
    for (const [category, key, value, importance, context] of extractions) {
      await this.savePersonalMemory(category, key, value, importance, context);
    }

    return extractions.length;
  }

  /**
   * 취미/활동 추출
   */
  extractHobbies(message) {
    const hobbies = [];
    const hobbyPatterns = {
      sports: {
        patterns: ['운동', '헬스', '요가', '필라테스', '수영', '농구', '축구', '야구', '테니스', '골프', '등산', '조깅', '런닝'],
        importance: 3
      },
      music: {
        patterns: ['음악', '노래', '기타', '피아노', '드럼', '바이올린', '콘서트', '공연', '밴드'],
        importance: 3
      },
      reading: {
        patterns: ['독서', '책', '소설', '에세이', '자기계발서', '도서관'],
        importance: 2
      },
      cooking: {
        patterns: ['요리', '베이킹', '제빵', '맛집', '레시피', '쿠킹'],
        importance: 2
      },
      travel: {
        patterns: ['여행', '캠핑', '해외여행', '국내여행', '여행계획'],
        importance: 4
      },
      gaming: {
        patterns: ['게임', '게이밍', 'PC방', '콘솔', '모바일게임'],
        importance: 2
      },
      art: {
        patterns: ['그림', '그래픽', '디자인', '사진', '촬영', '편집'],
        importance: 3
      }
    };

    for (const [hobbyType, config] of Object.entries(hobbyPatterns)) {
      for (const pattern of config.patterns) {
        if (message.includes(pattern)) {
          hobbies.push({
            key: hobbyType,
            value: pattern,
            importance: config.importance
          });
        }
      }
    }

    return hobbies;
  }

  /**
   * 직업/학업 정보 추출
   */
  extractWorkInfo(message) {
    const workInfo = [];
    
    // 직업 관련
    const jobPatterns = [
      '회사', '직장', '사무실', '출근', '퇴근', '야근', '회의', '프로젝트', 
      '업무', '일', '팀장', '동료', '상사', '부서', '개발자', '디자이너',
      '마케터', '기획자', '영업', '인사', '재무', '학생', '대학교', '학교',
      '수업', '강의', '시험', '과제', '전공', '학과'
    ];

    for (const pattern of jobPatterns) {
      if (message.includes(pattern)) {
        workInfo.push({
          key: 'current_work',
          value: pattern,
          importance: 3
        });
      }
    }

    return workInfo;
  }

  /**
   * 인간관계 정보 추출
   */
  extractRelationships(message) {
    const relationships = [];
    
    const relationshipPatterns = {
      family: ['엄마', '아빠', '부모님', '형', '누나', '언니', '동생', '가족', '할머니', '할아버지'],
      friends: ['친구', '절친', '동창', '친구들', '룸메이트'],
      romantic: ['남친', '여친', '애인', '연인', '남자친구', '여자친구', '썸', '데이트'],
      colleagues: ['동료', '선배', '후배', '팀원', '상사', '부하직원']
    };

    for (const [relType, patterns] of Object.entries(relationshipPatterns)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          relationships.push({
            key: relType,
            value: pattern,
            importance: relType === 'family' || relType === 'romantic' ? 4 : 3
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 목표/계획 추출
   */
  extractGoals(message) {
    const goals = [];
    
    const goalIndicators = [
      '계획', '목표', '하고 싶', '배우고 싶', '가고 싶', '되고 싶',
      '준비', '도전', '시작', '해볼', '다짐', '결심'
    ];

    for (const indicator of goalIndicators) {
      if (message.includes(indicator)) {
        goals.push({
          key: 'future_plan',
          value: message.substring(0, 100), // 전체 맥락 저장
          importance: 4
        });
        break; // 하나만 저장
      }
    }

    return goals;
  }

  /**
   * 선호도/취향 추출
   */
  extractPreferences(message) {
    const preferences = [];
    
    const preferencePatterns = {
      food: ['좋아하는 음식', '싫어하는 음식', '맛있', '맛없', '짜', '싱거', '매워', '달아'],
      weather: ['좋아하는 날씨', '싫어하는 날씨', '더워', '추워', '시원', '따뜻'],
      time: ['아침형', '저녁형', '새벽', '밤늦게'],
      style: ['스타일', '패션', '브랜드', '선호']
    };

    for (const [prefType, patterns] of Object.entries(preferencePatterns)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          preferences.push({
            key: prefType,
            value: pattern,
            importance: 2
          });
        }
      }
    }

    return preferences;
  }

  /**
   * 중요한 경험/사건 추출
   */
  extractExperiences(message, conversationContext) {
    const experiences = [];
    
    const experienceIndicators = [
      '어제', '오늘', '이번 주', '지난주', '최근에', '처음', '마지막',
      '기억에 남는', '잊을 수 없는', '충격적', '감동적', '슬펐', '기뻤',
      '성공했', '실패했', '합격', '불합격', '승진', '퇴사', '입학', '졸업'
    ];

    for (const indicator of experienceIndicators) {
      if (message.includes(indicator)) {
        experiences.push({
          key: 'recent_experience',
          value: message,
          importance: 3
        });
        break;
      }
    }

    return experiences;
  }

  /**
   * 저장된 기억을 바탕으로 맥락적 응답 생성
   */
  async generateContextualResponse(currentMessage, conversationHistory = []) {
    // 관련 기억들 검색
    const relevantMemories = await this.findRelevantMemories(currentMessage);
    
    // 시간적 맥락 분석
    const timeContext = this.analyzeTimeContext(currentMessage, conversationHistory);
    
    // 감정적 맥락 분석
    const emotionalContext = this.analyzeEmotionalContext(currentMessage, conversationHistory);
    
    // 친밀도 기반 응답 스타일 결정
    const responseStyle = this.determineResponseStyle();
    
    return this.craftPersonalizedResponse({
      currentMessage,
      relevantMemories,
      timeContext,
      emotionalContext,
      responseStyle
    });
  }

  /**
   * 현재 메시지와 관련된 기억들 찾기
   */
  async findRelevantMemories(currentMessage, limit = 5) {
    try {
      // 키워드 기반으로 관련 기억 검색
      const { data: memories } = await supabase
        .from('personal_memories')
        .select('*')
        .eq('user_id', this.userId)
        .order('importance', { ascending: false })
        .order('last_mentioned', { ascending: false })
        .limit(limit * 2); // 여유롭게 가져와서 필터링

      if (!memories) return [];

      // 현재 메시지와의 관련성 점수 계산
      const scoredMemories = memories.map(memory => ({
        ...memory,
        relevanceScore: this.calculateRelevanceScore(currentMessage, memory)
      })).filter(memory => memory.relevanceScore > 0.3)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      return scoredMemories;
    } catch (error) {
      console.error('Failed to find relevant memories:', error);
      return [];
    }
  }

  /**
   * 관련성 점수 계산
   */
  calculateRelevanceScore(message, memory) {
    let score = 0;
    const messageLower = message.toLowerCase();
    
    // 직접적 키워드 매칭
    if (messageLower.includes(memory.key.toLowerCase()) || 
        messageLower.includes(memory.value.toLowerCase())) {
      score += 0.8;
    }

    // 카테고리별 관련성
    if (memory.category === 'hobby' && (messageLower.includes('취미') || messageLower.includes('여가'))) {
      score += 0.6;
    }
    if (memory.category === 'work' && (messageLower.includes('일') || messageLower.includes('회사'))) {
      score += 0.6;
    }

    // 중요도 가중치
    score += memory.importance * 0.1;

    // 최근 언급 가중치 (최근 언급된 것일수록 높은 점수)
    const daysSinceLastMention = (Date.now() - new Date(memory.last_mentioned).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastMention < 7) score += 0.3;
    else if (daysSinceLastMention < 30) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * 시간적 맥락 분석
   */
  analyzeTimeContext(message, history) {
    const timeContext = {
      timeReference: null,
      shouldRemember: false,
      shouldFollowUp: false
    };

    // 시간 참조 감지
    const timePatterns = {
      past: ['어제', '지난주', '이전에', '전에', '예전에', '과거에'],
      recent: ['방금', '조금 전', '아까', '오늘', '최근에'],
      future: ['내일', '다음주', '나중에', '앞으로', '계획'],
      recurring: ['매일', '항상', '자주', '가끔', '때때로']
    };

    for (const [timeType, patterns] of Object.entries(timePatterns)) {
      if (patterns.some(pattern => message.includes(pattern))) {
        timeContext.timeReference = timeType;
        break;
      }
    }

    // 기억해야 할 정보인지 판단
    if (message.includes('약속') || message.includes('만나기로') || 
        message.includes('계획') || message.includes('하기로')) {
      timeContext.shouldRemember = true;
    }

    // 후속 질문이 필요한지 판단
    if (timeContext.timeReference === 'future' || message.includes('고민')) {
      timeContext.shouldFollowUp = true;
    }

    return timeContext;
  }

  /**
   * 감정적 맥락 분석
   */
  analyzeEmotionalContext(message, history) {
    const emotions = {
      joy: ['기뻐', '행복', '좋아', '신나', '최고', '완전', '대박', 'ㅋㅋ', 'ㅎㅎ'],
      sadness: ['슬퍼', '우울', '힘들', '속상', '아쉬워', 'ㅠㅠ', 'ㅜㅜ'],
      anger: ['화나', '짜증', '열받', '빡쳐', '미치겠'],
      worry: ['걱정', '불안', '무서워', '떨려', '어떡하지'],
      excitement: ['설레', '기대', '두근두근', '와', '우와'],
      gratitude: ['고마워', '감사해', '도움', '고맙다']
    };

    let dominantEmotion = 'neutral';
    let emotionScore = 0;

    for (const [emotion, keywords] of Object.entries(emotions)) {
      const matches = keywords.filter(keyword => message.includes(keyword)).length;
      if (matches > emotionScore) {
        emotionScore = matches;
        dominantEmotion = emotion;
      }
    }

    return {
      emotion: dominantEmotion,
      intensity: Math.min(1.0, emotionScore * 0.3),
      needsSupport: ['sadness', 'anger', 'worry'].includes(dominantEmotion),
      celebratory: ['joy', 'excitement'].includes(dominantEmotion)
    };
  }

  /**
   * 친밀도 기반 응답 스타일 결정
   */
  determineResponseStyle() {
    // 친밀도 계산 (대화 수, 공유된 정보량, 감정적 교류 등)
    const intimacyLevel = Math.min(100, this.relationshipLevel);
    
    return {
      intimacy: intimacyLevel,
      useNickname: intimacyLevel > 30,
      sharePersonalThoughts: intimacyLevel > 50,
      makeJokes: intimacyLevel > 40,
      showConcern: intimacyLevel > 20,
      rememberDetails: intimacyLevel > 15
    };
  }

  /**
   * 개인화된 응답 생성
   */
  craftPersonalizedResponse({
    currentMessage,
    relevantMemories,
    timeContext,
    emotionalContext,
    responseStyle
  }) {
    let response = "";
    
    // 1. 감정적 반응 먼저
    response += this.generateEmotionalResponse(emotionalContext, responseStyle);
    
    // 2. 기억 기반 맥락 연결
    if (relevantMemories.length > 0) {
      response += this.generateMemoryBasedResponse(relevantMemories, responseStyle);
    }
    
    // 3. 시간적 맥락 반영
    if (timeContext.timeReference) {
      response += this.generateTimeBasedResponse(timeContext, responseStyle);
    }
    
    // 4. 친밀한 마무리
    response += this.generateIntimateClosing(responseStyle, emotionalContext);
    
    return response.trim();
  }

  /**
   * 감정적 응답 생성
   */
  generateEmotionalResponse(emotionalContext, responseStyle) {
    const { emotion, needsSupport, celebratory } = emotionalContext;
    
    if (needsSupport) {
      const supportResponses = [
        "어떤 일이야? 괜찮아?",
        "힘들겠다... 무슨 일 있었어?",
        "어휴, 정말 속상하겠네. 얘기해봐."
      ];
      return supportResponses[Math.floor(Math.random() * supportResponses.length)] + " ";
    }
    
    if (celebratory) {
      const celebrationResponses = [
        "와! 정말 좋겠다!",
        "대박이네! 축하해!",
        "완전 좋은 일이네!"
      ];
      return celebrationResponses[Math.floor(Math.random() * celebrationResponses.length)] + " ";
    }
    
    return "";
  }

  /**
   * 기억 기반 응답 생성
   */
  generateMemoryBasedResponse(memories, responseStyle) {
    if (memories.length === 0) return "";
    
    const topMemory = memories[0];
    
    // 카테고리별 기억 연결
    switch (topMemory.category) {
      case 'hobby':
        return `그러고 보니 ${topMemory.value} 얘기 했었잖아! `;
      case 'work':
        return `회사 일 관련해서 전에도 얘기했는데, `;
      case 'relationship':
        return `${topMemory.value} 얘기구나! `;
      case 'goal':
        return `전에 말한 그 계획이랑 관련있는 거야? `;
      default:
        return `어, 이거 전에도 얘기한 것 같은데? `;
    }
  }

  /**
   * 시간 기반 응답 생성  
   */
  generateTimeBasedResponse(timeContext, responseStyle) {
    if (timeContext.shouldRemember) {
      return "이거 내가 기억해둘게! ";
    }
    
    if (timeContext.shouldFollowUp) {
      return "그래서 어떻게 할 거야? ";
    }
    
    return "";
  }

  /**
   * 친밀한 마무리
   */
  generateIntimateClosing(responseStyle, emotionalContext) {
    if (responseStyle.intimacy > 50) {
      const intimateClosings = [
        "나한테 언제든 말해줘!",
        "우리 사이에 뭘 그래!",
        "걱정하지마, 내가 있잖아!"
      ];
      return intimateClosings[Math.floor(Math.random() * intimateClosings.length)];
    }
    
    if (responseStyle.intimacy > 20) {
      return "더 얘기하고 싶으면 언제든지!";
    }
    
    return "";
  }

  /**
   * 능동적 대화 시작 (사용자가 접속했을 때)
   */
  async generateProactiveGreeting() {
    const memories = await this.findRecentImportantMemories();
    const timeOfDay = new Date().getHours();
    
    let greeting = "";
    
    // 시간대별 인사
    if (timeOfDay < 12) greeting = "좋은 아침이야! ";
    else if (timeOfDay < 18) greeting = "오늘 하루 어때? ";
    else greeting = "오늘 하루 수고했어! ";
    
    // 기억 기반 능동적 질문
    if (memories.length > 0) {
      const memory = memories[0];
      if (memory.category === 'goal') {
        greeting += `그런데 ${memory.value} 어떻게 되어가고 있어?`;
      } else if (memory.category === 'work') {
        greeting += "회사 일은 어떻게 되고 있어?";
      } else if (memory.category === 'hobby') {
        greeting += `${memory.value} 요즘 어때?`;
      }
    } else {
      greeting += "오늘은 뭐 했어?";
    }
    
    return greeting;
  }

  /**
   * 최근 중요한 기억들 가져오기
   */
  async findRecentImportantMemories(limit = 3) {
    try {
      const { data: memories } = await supabase
        .from('personal_memories')
        .select('*')
        .eq('user_id', this.userId)
        .gte('importance', 3)
        .order('last_mentioned', { ascending: false })
        .limit(limit);

      return memories || [];
    } catch (error) {
      console.error('Failed to find recent important memories:', error);
      return [];
    }
  }

  /**
   * 친밀도 업데이트
   */
  async updateIntimacyLevel(interactionQuality = 1) {
    this.relationshipLevel = Math.min(100, this.relationshipLevel + interactionQuality);
    
    try {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          intimacy_level: this.relationshipLevel,
          last_interaction: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Failed to update intimacy level:', error);
    }
  }
}

export default IntimateFreindSystem;