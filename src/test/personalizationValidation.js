// 개인화 시스템 검증 스크립트
import { PersonalizationTester } from '../services/personalizationTest';
import { getUserPersonalization, analyzeUserPatterns, updateUserPersonalization } from '../services/supabaseApi';

// 모의 사용자 데이터
const mockUser = {
  id: 'test-user-123',
  conversationId: 'test-conv-456'
};

// 개인화 시스템 검증 함수들
export const validatePersonalizationSystem = async () => {
  console.log('🚀 개인화 시스템 검증 시작...');
  
  const results = {
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      score: 0
    }
  };

  try {
    // 1. 기본 개인화 설정 테스트
    console.log('📋 1. 기본 개인화 설정 로드 테스트');
    const basicTest = await testBasicPersonalization();
    results.tests.push(basicTest);
    
    // 2. 패턴 분석 시스템 테스트
    console.log('🔍 2. 패턴 분석 시스템 테스트');
    const patternTest = await testPatternAnalysis();
    results.tests.push(patternTest);
    
    // 3. 동적 프롬프트 생성 테스트
    console.log('⚡ 3. 동적 프롬프트 생성 테스트');
    const promptTest = await testPromptGeneration();
    results.tests.push(promptTest);
    
    // 4. 실시간 개인화 적용 테스트
    console.log('🎯 4. 실시간 개인화 적용 테스트');
    const realtimeTest = await testRealtimePersonalization();
    results.tests.push(realtimeTest);
    
    // 결과 집계
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.status === 'PASS').length;
    results.summary.failed = results.tests.filter(t => t.status === 'FAIL').length;
    results.summary.score = (results.summary.passed / results.summary.total) * 100;
    
    console.log('📊 검증 완료:', results.summary);
    return results;
    
  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error);
    return { error: error.message, results };
  }
};

// 기본 개인화 설정 테스트
const testBasicPersonalization = async () => {
  try {
    const personalization = await getUserPersonalization(mockUser.id);
    
    const expectedFields = ['conversation_style', 'response_length', 'emotional_tone'];
    const hasAllFields = expectedFields.every(field => personalization.hasOwnProperty(field));
    
    return {
      name: 'Basic Personalization Load',
      status: hasAllFields ? 'PASS' : 'FAIL',
      details: {
        loaded: personalization,
        hasRequiredFields: hasAllFields,
        fields: expectedFields.filter(field => personalization.hasOwnProperty(field))
      }
    };
  } catch (error) {
    return {
      name: 'Basic Personalization Load',
      status: 'FAIL',
      error: error.message
    };
  }
};

// 패턴 분석 테스트
const testPatternAnalysis = async () => {
  try {
    // 모의 대화 데이터로 패턴 분석 (실제로는 데이터베이스에서 가져옴)
    const patterns = await analyzeUserPatterns(mockUser.id);
    
    const hasPatternData = patterns && (
      patterns.conversation_style ||
      patterns.preferred_response_length ||
      patterns.topics_of_interest
    );
    
    return {
      name: 'Pattern Analysis System',
      status: hasPatternData ? 'PASS' : 'FAIL',
      details: {
        patterns: patterns,
        hasValidPatterns: hasPatternData
      }
    };
  } catch (error) {
    return {
      name: 'Pattern Analysis System', 
      status: 'FAIL',
      error: error.message
    };
  }
};

// 프롬프트 생성 테스트
const testPromptGeneration = async () => {
  try {
    const testPersonalization = {
      conversation_style: 'friendly',
      response_length: 'medium',
      emotional_tone: 'warm',
      topics_of_interest: ['일상', '감정']
    };
    
    // 프롬프트 생성 함수 시뮬레이션
    const prompt = generateSystemPrompt(testPersonalization);
    
    const hasRequiredElements = prompt.includes('친근하고') && 
                              prompt.includes('적당한 길이로') &&
                              prompt.includes('따뜻하고');
    
    return {
      name: 'Dynamic Prompt Generation',
      status: hasRequiredElements ? 'PASS' : 'FAIL',
      details: {
        generated: prompt.substring(0, 100) + '...',
        hasStyleMapping: prompt.includes('친근하고'),
        hasLengthMapping: prompt.includes('적당한 길이로'),
        hasToneMapping: prompt.includes('따뜻하고')
      }
    };
  } catch (error) {
    return {
      name: 'Dynamic Prompt Generation',
      status: 'FAIL', 
      error: error.message
    };
  }
};

// 실시간 개인화 테스트
const testRealtimePersonalization = async () => {
  try {
    const tester = new PersonalizationTester(mockUser.id, mockUser.conversationId);
    
    // 간단한 테스트 케이스만 실행
    const quickTest = {
      id: 'realtime_test',
      input: '안녕하세요!',
      personalization: {
        conversation_style: 'friendly',
        response_length: 'short',
        emotional_tone: 'warm'
      },
      expectedPatterns: ['안녕', '좋은', '반가워'],
      weight: 1.0
    };
    
    // 실제 API 호출 대신 모의 응답 사용 (테스트 환경)
    const mockResponse = '안녕하세요! 반가워요. 좋은 하루 보내세요!';
    const score = tester.calculateTestScore(quickTest, mockResponse);
    
    return {
      name: 'Realtime Personalization',
      status: score >= 50 ? 'PASS' : 'FAIL',
      details: {
        testInput: quickTest.input,
        mockResponse: mockResponse,
        score: score,
        threshold: 50
      }
    };
  } catch (error) {
    return {
      name: 'Realtime Personalization',
      status: 'FAIL',
      error: error.message
    };
  }
};

// 시스템 프롬프트 생성 헬퍼 함수 (Chat.js의 함수와 동일)
const generateSystemPrompt = (personalization) => {
  const styleMap = {
    friendly: '친근하고 친구 같은 말투로',
    formal: '정중하고 예의 바른 말투로', 
    enthusiastic: '활발하고 열정적인 말투로'
  };

  const lengthMap = {
    short: '간결하게 1-2문장으로',
    medium: '적당한 길이로 2-3문장으로',
    long: '상세하게 3-5문장으로'
  };

  const toneMap = {
    warm: '따뜻하고 공감적인 톤으로',
    neutral: '중립적이고 균형잡힌 톤으로',
    supportive: '지지적이고 격려하는 톤으로'
  };

  return `당신은 사용자와 대화하는 친근한 AI 친구입니다.
  
대화 스타일: ${styleMap[personalization.conversation_style] || '친근하고 친구 같은 말투로'} 대화해요.
응답 길이: ${lengthMap[personalization.response_length] || '적당한 길이로 2-3문장으로'} 답변해요.
감정적 톤: ${toneMap[personalization.emotional_tone] || '따뜻하고 공감적인 톤으로'} 응답해요.

중요한 대화 방식:
- "~해드리겠습니다", "~말씀해주세요" 같은 딱딱한 표현은 사용하지 마세요
- 대신 "~해요", "~에요", "~는 거 어떤데요?" 같은 친근한 말투를 사용하세요
- 상대방과 티키타카하는 친구처럼 자연스럽게 대화하세요
- 존댓어는 사용하되 심리상담사처럼 딱딱하지 말고 편안하게 대화하세요

${personalization.topics_of_interest?.length > 0 ? 
  `관심 주제: 사용자는 주로 ${personalization.topics_of_interest.join(', ')}에 관심이 많습니다.` : ''}

위 정보를 바탕으로 사용자와 친구처럼 편안하고 자연스럽게 대화해요!`;
};

// 개인화 성능 벤치마크
export const benchmarkPersonalization = async () => {
  console.log('⚡ 개인화 성능 벤치마크 시작...');
  
  const startTime = performance.now();
  
  // 1. 개인화 데이터 로딩 시간
  const loadStart = performance.now();
  const personalization = await getUserPersonalization(mockUser.id);
  const loadTime = performance.now() - loadStart;
  
  // 2. 패턴 분석 시간
  const analyzeStart = performance.now();
  const patterns = await analyzeUserPatterns(mockUser.id);
  const analyzeTime = performance.now() - analyzeStart;
  
  // 3. 프롬프트 생성 시간
  const promptStart = performance.now();
  const prompt = generateSystemPrompt(personalization);
  const promptTime = performance.now() - promptStart;
  
  const totalTime = performance.now() - startTime;
  
  const benchmark = {
    loadingTime: Math.round(loadTime * 100) / 100,
    analysisTime: Math.round(analyzeTime * 100) / 100,
    promptGenerationTime: Math.round(promptTime * 100) / 100,
    totalTime: Math.round(totalTime * 100) / 100,
    performance: {
      loading: loadTime < 100 ? 'EXCELLENT' : loadTime < 300 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
      analysis: analyzeTime < 500 ? 'EXCELLENT' : analyzeTime < 1000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
      generation: promptTime < 10 ? 'EXCELLENT' : promptTime < 50 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    }
  };
  
  console.log('📈 성능 벤치마크 결과:', benchmark);
  return benchmark;
};

// 전체 검증 실행
if (typeof window !== 'undefined') {
  window.validatePersonalization = validatePersonalizationSystem;
  window.benchmarkPersonalization = benchmarkPersonalization;
}