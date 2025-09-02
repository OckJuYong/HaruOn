// 개인화 시스템 효과성 테스트 모듈
import { chat } from '../api/api';

export class PersonalizationTester {
  constructor(userId, conversationId) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.testCases = [
      {
        id: 'style_friendly',
        input: '오늘 기분이 좋아요!',
        personalization: { conversation_style: 'friendly', response_length: 'medium', emotional_tone: 'warm' },
        expectedPatterns: ['좋네요', '기쁘네요', '멋져요', '반가워요'],
        weight: 0.3
      },
      {
        id: 'style_formal', 
        input: '업무에 대한 조언을 구하고 싶습니다.',
        personalization: { conversation_style: 'formal', response_length: 'medium', emotional_tone: 'neutral' },
        expectedPatterns: ['습니다', '하시기', '드립니다', '말씀'],
        weight: 0.3
      },
      {
        id: 'length_short',
        input: '간단히 답변해주세요.',
        personalization: { conversation_style: 'friendly', response_length: 'short', emotional_tone: 'warm' },
        expectedLength: { min: 10, max: 50 },
        weight: 0.2
      },
      {
        id: 'length_long',
        input: '자세한 설명을 듣고 싶어요.',
        personalization: { conversation_style: 'friendly', response_length: 'long', emotional_tone: 'warm' },
        expectedLength: { min: 100, max: 300 },
        weight: 0.2
      }
    ];
  }

  // 전체 개인화 테스트 실행
  async runCompleteTest() {
    const results = {
      testCases: [],
      overallScore: 0,
      timestamp: new Date().toISOString(),
      userId: this.userId
    };

    console.log('🧪 개인화 시스템 테스트 시작...');

    for (const testCase of this.testCases) {
      const result = await this.runSingleTest(testCase);
      results.testCases.push(result);
      console.log(`✅ 테스트 케이스 ${testCase.id}: ${result.score}점`);
    }

    // 가중 평균으로 전체 점수 계산
    results.overallScore = results.testCases.reduce((sum, tc) => {
      return sum + (tc.score * tc.weight);
    }, 0);

    console.log(`🎯 전체 개인화 점수: ${results.overallScore.toFixed(1)}점`);
    
    return results;
  }

  // 개별 테스트 케이스 실행
  async runSingleTest(testCase) {
    try {
      // 개인화된 시스템 프롬프트 생성
      const systemPrompt = this.generateTestSystemPrompt(testCase.personalization);
      
      // 테스트 메시지 전송
      const response = await chat({
        conversation_id: this.conversationId,
        user_id: this.userId,
        content: testCase.input,
        messages: {
          items: [{
            role: 'system',
            content: systemPrompt
          }]
        }
      });

      const assistantResponse = response.assistant || '';
      
      // 점수 계산
      const score = this.calculateTestScore(testCase, assistantResponse);
      
      return {
        id: testCase.id,
        input: testCase.input,
        response: assistantResponse,
        score: score,
        weight: testCase.weight,
        details: this.generateTestDetails(testCase, assistantResponse, score)
      };
      
    } catch (error) {
      console.error(`테스트 케이스 ${testCase.id} 실행 실패:`, error);
      return {
        id: testCase.id,
        input: testCase.input,
        response: null,
        score: 0,
        weight: testCase.weight,
        error: error.message
      };
    }
  }

  // 테스트용 시스템 프롬프트 생성
  generateTestSystemPrompt(personalization) {
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

위 지침을 정확히 따라서 친구처럼 편안하게 응답해요!`;
  }

  // 테스트 점수 계산
  calculateTestScore(testCase, response) {
    if (!response) return 0;
    
    let score = 0;
    const maxScore = 100;

    // 패턴 매칭 점수 (스타일 테스트)
    if (testCase.expectedPatterns) {
      const matchedPatterns = testCase.expectedPatterns.filter(pattern => 
        response.toLowerCase().includes(pattern.toLowerCase())
      );
      const patternScore = (matchedPatterns.length / testCase.expectedPatterns.length) * maxScore;
      score = Math.max(score, patternScore);
    }

    // 길이 기반 점수 (길이 테스트)
    if (testCase.expectedLength) {
      const responseLength = response.length;
      const { min, max } = testCase.expectedLength;
      
      if (responseLength >= min && responseLength <= max) {
        score = maxScore;
      } else if (responseLength < min) {
        score = Math.max(0, (responseLength / min) * maxScore);
      } else {
        // 길이가 초과된 경우 감점
        const excess = responseLength - max;
        const penalty = Math.min(50, (excess / max) * 50);
        score = Math.max(0, maxScore - penalty);
      }
    }

    // 기본적인 응답 품질 체크
    if (response.length < 5) score -= 30; // 너무 짧은 응답
    if (response.includes('오류') || response.includes('죄송')) score -= 20; // 오류 응답

    return Math.round(Math.max(0, Math.min(maxScore, score)));
  }

  // 테스트 상세 결과 생성
  generateTestDetails(testCase, response, score) {
    const details = {
      responseLength: response?.length || 0,
      testType: testCase.expectedPatterns ? 'style' : 'length'
    };

    if (testCase.expectedPatterns) {
      details.matchedPatterns = testCase.expectedPatterns.filter(pattern =>
        response?.toLowerCase().includes(pattern.toLowerCase())
      );
      details.expectedPatterns = testCase.expectedPatterns;
    }

    if (testCase.expectedLength) {
      details.expectedLength = testCase.expectedLength;
      details.lengthMatch = response && response.length >= testCase.expectedLength.min && 
                           response.length <= testCase.expectedLength.max;
    }

    return details;
  }

  // A/B 테스트 실행 (개인화 ON vs OFF)
  async runABTest(testInput) {
    console.log('🔬 A/B 테스트 실행 중...');
    
    // A: 개인화 없이 테스트
    const responseA = await chat({
      conversation_id: this.conversationId,
      user_id: this.userId,
      content: testInput
    });

    // B: 개인화 적용 테스트
    const responseB = await chat({
      conversation_id: this.conversationId,
      user_id: this.userId,
      content: testInput,
      messages: {
        items: [{
          role: 'system',
          content: this.generateTestSystemPrompt({
            conversation_style: 'friendly',
            response_length: 'medium', 
            emotional_tone: 'warm'
          })
        }]
      }
    });

    return {
      input: testInput,
      responseA: responseA.assistant,
      responseB: responseB.assistant,
      comparison: {
        lengthA: responseA.assistant?.length || 0,
        lengthB: responseB.assistant?.length || 0,
        personalizedResponse: responseB.assistant,
        standardResponse: responseA.assistant
      }
    };
  }

  // 테스트 결과 분석 및 리포트 생성
  generateTestReport(results) {
    const report = {
      summary: {
        totalTests: results.testCases.length,
        passedTests: results.testCases.filter(tc => tc.score >= 70).length,
        averageScore: results.overallScore,
        timestamp: results.timestamp
      },
      detailed: results.testCases.map(tc => ({
        testId: tc.id,
        score: tc.score,
        status: tc.score >= 70 ? 'PASS' : 'FAIL',
        details: tc.details
      })),
      recommendations: this.generateRecommendations(results)
    };

    return report;
  }

  // 개선 권장사항 생성
  generateRecommendations(results) {
    const recommendations = [];
    const lowScoreTests = results.testCases.filter(tc => tc.score < 70);

    if (lowScoreTests.length > 0) {
      recommendations.push('낮은 점수를 받은 테스트 케이스들의 패턴을 분석하여 프롬프트 엔지니어링을 개선하세요.');
    }

    if (results.overallScore < 80) {
      recommendations.push('전체 개인화 점수가 80점 미만입니다. 시스템 프롬프트의 명확성을 높이고 더 구체적인 지침을 제공하세요.');
    }

    const lengthTests = results.testCases.filter(tc => tc.details?.testType === 'length');
    const failedLengthTests = lengthTests.filter(tc => tc.score < 70);
    
    if (failedLengthTests.length > 0) {
      recommendations.push('응답 길이 제어 성능을 개선하기 위해 max_tokens 파라미터 조정을 고려하세요.');
    }

    if (recommendations.length === 0) {
      recommendations.push('개인화 시스템이 우수하게 작동하고 있습니다. 현재 설정을 유지하세요.');
    }

    return recommendations;
  }
}

// 빠른 테스트 실행을 위한 헬퍼 함수
export const quickPersonalizationTest = async (userId, conversationId) => {
  const tester = new PersonalizationTester(userId, conversationId);
  const results = await tester.runCompleteTest();
  const report = tester.generateTestReport(results);
  
  console.log('📊 개인화 테스트 리포트:', report);
  return report;
};