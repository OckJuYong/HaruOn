// 고도화된 사용자 맞춤형 학습 시스템
import { supabase } from './supabaseApi';

/**
 * 사용자별 강화학습 시스템
 * 대화할 때마다 사용자 선호도와 패턴을 학습하여 개인화 모델을 업데이트
 */
export class AdvancedPersonalizationEngine {
  constructor(userId) {
    this.userId = userId;
    this.learningData = null;
    this.conversationContext = [];
  }

  /**
   * 대화 후 피드백 기반 학습
   * 사용자의 반응, 대화 지속 시간, 후속 질문 등을 분석
   */
  async learnFromConversation(conversationId, userMessage, assistantResponse, userFeedback = null) {
    try {
      // 1. 대화 품질 분석
      const qualityMetrics = await this.analyzeConversationQuality(
        userMessage, 
        assistantResponse, 
        conversationId
      );

      // 2. 사용자 반응 패턴 분석
      const reactionPattern = await this.analyzeUserReaction(
        userMessage, 
        assistantResponse,
        userFeedback
      );

      // 3. 학습 데이터 업데이트
      await this.updateLearningModel({
        conversation_id: conversationId,
        quality_metrics: qualityMetrics,
        reaction_pattern: reactionPattern,
        timestamp: new Date().toISOString()
      });

      // 4. 실시간 개인화 조정
      await this.adjustPersonalizationSettings(qualityMetrics, reactionPattern);

    } catch (error) {
      console.error('Learning from conversation failed:', error);
    }
  }

  /**
   * 대화 품질 분석
   * AI 응답이 사용자에게 얼마나 적합했는지 다각도로 분석
   */
  async analyzeConversationQuality(userMessage, assistantResponse, conversationId) {
    // 사용자 메시지의 감정 강도 분석
    const userEmotionIntensity = this.analyzeEmotionIntensity(userMessage);
    
    // 응답 길이 적절성 분석
    const lengthAppropriatenesss = this.analyzeLengthAppropriateness(
      userMessage, 
      assistantResponse
    );

    // 톤 매칭 분석
    const toneMatching = this.analyzeToneMatching(userMessage, assistantResponse);

    // 후속 대화 지속성 예측
    const conversationContinuity = await this.predictConversationContinuity(conversationId);

    return {
      emotion_intensity: userEmotionIntensity,
      length_appropriateness: lengthAppropriatenesss,
      tone_matching: toneMatching,
      conversation_continuity: conversationContinuity,
      overall_quality: (lengthAppropriatenesss + toneMatching + conversationContinuity) / 3
    };
  }

  /**
   * 감정 강도 분석
   * 사용자 메시지의 감정적 강도를 0-1로 측정
   */
  analyzeEmotionIntensity(message) {
    const strongEmotionWords = [
      '진짜', '정말', '너무', '완전', '엄청', '대박', '최고', '최악',
      '미치겠', '죽겠', '살겠', '화나', '짜증', '열받', '속상', '우울'
    ];

    const exclamationCount = (message.match(/[!]/g) || []).length;
    const capsCount = (message.match(/[ㄱ-ㅎㅏ-ㅣ가-힣A-Z]{2,}/g) || []).length;
    const emotionWordCount = strongEmotionWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;

    const intensity = Math.min(1.0, 
      (emotionWordCount * 0.3 + exclamationCount * 0.2 + capsCount * 0.1)
    );

    return intensity;
  }

  /**
   * 응답 길이 적절성 분석
   * 사용자 메시지와 맥락에 따른 적절한 응답 길이인지 분석
   */
  analyzeLengthAppropriateness(userMessage, assistantResponse) {
    const userLength = userMessage.length;
    const assistantLength = assistantResponse.length;
    const ratio = assistantLength / Math.max(userLength, 10);

    // 사용자가 짧게 물었는데 너무 길게 답한 경우 감점
    if (userLength < 20 && assistantLength > 200) return 0.3;
    
    // 사용자가 길게 얘기했는데 너무 짧게 답한 경우 감점  
    if (userLength > 100 && assistantLength < 30) return 0.4;

    // 적절한 비율 (0.5~2.0)
    if (ratio >= 0.5 && ratio <= 2.0) return 1.0;
    
    // 비율이 벗어날수록 감점
    return Math.max(0.2, 1.0 - Math.abs(ratio - 1.0) * 0.3);
  }

  /**
   * 톤 매칭 분석
   * 사용자의 톤과 AI 응답의 톤이 얼마나 잘 맞는지 분석
   */
  analyzeToneMatching(userMessage, assistantResponse) {
    const userTone = this.detectTone(userMessage);
    const assistantTone = this.detectTone(assistantResponse);

    // 톤 호환성 매트릭스
    const toneCompatibility = {
      casual: { casual: 1.0, formal: 0.3, emotional: 0.7 },
      formal: { casual: 0.4, formal: 1.0, emotional: 0.6 },
      emotional: { casual: 0.6, formal: 0.4, emotional: 1.0 },
      excited: { casual: 0.8, formal: 0.2, emotional: 0.9 },
      sad: { casual: 0.3, formal: 0.6, emotional: 0.9 }
    };

    return toneCompatibility[userTone]?.[assistantTone] || 0.5;
  }

  /**
   * 톤 감지
   */
  detectTone(message) {
    const patterns = {
      casual: /[ㅋㅎ~!]{2,}|야|어|음|그냥/,
      formal: /습니다|입니다|해주세요|부탁드립니다/,
      emotional: /정말|너무|완전|진짜|ㅠㅠ|ㅜㅜ/,
      excited: /와+|우와|대박|짱|최고|!{2,}/,
      sad: /힘들|우울|속상|슬퍼|ㅠ+|ㅜ+/
    };

    for (const [tone, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) return tone;
    }
    
    return 'casual';
  }

  /**
   * 대화 지속성 예측
   * 이 응답 이후 사용자가 계속 대화할 가능성 예측
   */
  async predictConversationContinuity(conversationId) {
    try {
      // 최근 5개 메시지 패턴 분석
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!recentMessages || recentMessages.length < 2) return 0.5;

      // 사용자 메시지 간격 분석
      const userMessages = recentMessages.filter(m => m.role === 'user');
      if (userMessages.length < 2) return 0.5;

      // 메시지 길이 변화 추이 (길어지면 관심 증가)
      const lengthTrend = this.analyzeLengthTrend(userMessages);
      
      // 응답 시간 패턴 (빨라지면 몰입도 증가)
      const responsePattern = this.analyzeResponsePattern(userMessages);

      return (lengthTrend + responsePattern) / 2;
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * 메시지 길이 변화 추이 분석
   */
  analyzeLengthTrend(messages) {
    if (messages.length < 2) return 0.5;
    
    const lengths = messages.reverse().map(m => m.content.length);
    let trend = 0;
    
    for (let i = 1; i < lengths.length; i++) {
      if (lengths[i] > lengths[i-1]) trend += 0.2;
      else if (lengths[i] < lengths[i-1]) trend -= 0.1;
    }
    
    return Math.max(0, Math.min(1, 0.5 + trend));
  }

  /**
   * 응답 패턴 분석
   */
  analyzeResponsePattern(messages) {
    if (messages.length < 2) return 0.5;
    
    const timestamps = messages.map(m => new Date(m.created_at).getTime());
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    // 응답 간격이 짧아질수록 몰입도 높음
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const recentInterval = intervals[intervals.length - 1];
    
    if (recentInterval < avgInterval * 0.7) return 0.8; // 빨라짐
    if (recentInterval > avgInterval * 1.5) return 0.3; // 느려짐
    return 0.6; // 비슷함
  }

  /**
   * 사용자 반응 패턴 분석
   * 긍정적/부정적 반응 신호 감지
   */
  async analyzeUserReaction(userMessage, assistantResponse, explicitFeedback = null) {
    if (explicitFeedback) {
      return { 
        type: explicitFeedback.type, 
        score: explicitFeedback.score,
        source: 'explicit' 
      };
    }

    // 암시적 피드백 분석
    const nextUserMessage = await this.getNextUserMessage(assistantResponse);
    if (!nextUserMessage) {
      return { type: 'neutral', score: 0.5, source: 'implicit' };
    }

    return this.analyzeImplicitFeedback(nextUserMessage);
  }

  /**
   * 암시적 피드백 분석
   * 사용자의 다음 메시지에서 만족도 추정
   */
  analyzeImplicitFeedback(nextMessage) {
    const positiveSignals = [
      '고마워', '감사', '좋다', '맞다', '그래', '완전', '정말',
      '도움', '이해했', '알겠', 'ㅋㅋ', 'ㅎㅎ', '👍', '😊'
    ];

    const negativeSignals = [
      '아니', '그게 아니', '틀렸', '이상해', '잘못', '아니다',
      '다시', '모르겠', '이해 안', '😞', '😢', 'ㅠㅠ'
    ];

    const continueSignals = [
      '그럼', '그런데', '또', '그리고', '근데', '다음', '더'
    ];

    let score = 0.5;
    
    positiveSignals.forEach(signal => {
      if (nextMessage.includes(signal)) score += 0.1;
    });
    
    negativeSignals.forEach(signal => {
      if (nextMessage.includes(signal)) score -= 0.15;
    });
    
    continueSignals.forEach(signal => {
      if (nextMessage.includes(signal)) score += 0.05;
    });

    score = Math.max(0, Math.min(1, score));

    let type = 'neutral';
    if (score > 0.7) type = 'positive';
    else if (score < 0.3) type = 'negative';

    return { type, score, source: 'implicit' };
  }

  /**
   * 학습 모델 업데이트
   * 분석된 데이터를 기반으로 사용자별 학습 모델 업데이트
   */
  async updateLearningModel(learningData) {
    try {
      // user_learning_data 테이블에 학습 데이터 저장
      await supabase.from('user_learning_data').insert({
        user_id: this.userId,
        learning_data: learningData,
        created_at: new Date().toISOString()
      });

      // 누적 학습 통계 업데이트
      await this.updateCumulativeLearning(learningData);
    } catch (error) {
      console.error('Failed to update learning model:', error);
    }
  }

  /**
   * 누적 학습 통계 업데이트
   */
  async updateCumulativeLearning(newData) {
    try {
      // 기존 누적 데이터 가져오기
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('personalization_data')
        .eq('user_id', this.userId)
        .single();

      const currentData = existing?.personalization_data || {};
      const learningStats = currentData.learning_stats || {
        total_conversations: 0,
        avg_quality_score: 0.5,
        preferred_response_patterns: {},
        learning_confidence: 0.1
      };

      // 새 데이터로 통계 업데이트
      learningStats.total_conversations += 1;
      learningStats.avg_quality_score = (
        learningStats.avg_quality_score * 0.9 + 
        newData.quality_metrics.overall_quality * 0.1
      );
      
      // 학습 신뢰도 증가 (최대 0.95)
      learningStats.learning_confidence = Math.min(0.95, 
        learningStats.learning_confidence + 0.01
      );

      // 선호 패턴 업데이트
      this.updatePreferredPatterns(learningStats, newData);

      // DB 업데이트
      await supabase
        .from('user_profiles')
        .update({
          personalization_data: {
            ...currentData,
            learning_stats: learningStats,
            last_learning_update: new Date().toISOString()
          }
        })
        .eq('user_id', this.userId);

    } catch (error) {
      console.error('Failed to update cumulative learning:', error);
    }
  }

  /**
   * 선호 패턴 업데이트
   */
  updatePreferredPatterns(stats, newData) {
    const patterns = stats.preferred_response_patterns;
    const quality = newData.quality_metrics;

    // 응답 길이 선호도 업데이트
    if (quality.length_appropriateness > 0.7) {
      const responseLength = newData.quality_metrics.response_length || 'medium';
      patterns.length = patterns.length || {};
      patterns.length[responseLength] = (patterns.length[responseLength] || 0) + 1;
    }

    // 톤 선호도 업데이트  
    if (quality.tone_matching > 0.7) {
      const tone = newData.quality_metrics.preferred_tone || 'friendly';
      patterns.tone = patterns.tone || {};
      patterns.tone[tone] = (patterns.tone[tone] || 0) + 1;
    }
  }

  /**
   * 실시간 개인화 설정 조정
   * 학습 결과를 바탕으로 즉시 개인화 설정 미세조정
   */
  async adjustPersonalizationSettings(qualityMetrics, reactionPattern) {
    try {
      if (qualityMetrics.overall_quality < 0.4 || reactionPattern.score < 0.3) {
        // 품질이 낮으면 설정 조정
        await this.adjustSettingsBasedOnFeedback(qualityMetrics, reactionPattern);
      }
    } catch (error) {
      console.error('Failed to adjust personalization settings:', error);
    }
  }

  /**
   * 피드백 기반 설정 조정
   */
  async adjustSettingsBasedOnFeedback(qualityMetrics, reactionPattern) {
    const adjustments = {};

    // 길이 조정
    if (qualityMetrics.length_appropriateness < 0.5) {
      if (qualityMetrics.response_too_long) {
        adjustments.response_length = 'short';
      } else if (qualityMetrics.response_too_short) {
        adjustments.response_length = 'long';
      }
    }

    // 톤 조정
    if (qualityMetrics.tone_matching < 0.5) {
      if (reactionPattern.type === 'negative') {
        adjustments.conversation_style = 'formal'; // 더 정중하게
      }
    }

    if (Object.keys(adjustments).length > 0) {
      await this.updatePersonalizationSettings(adjustments);
    }
  }

  /**
   * 개인화 설정 업데이트
   */
  async updatePersonalizationSettings(adjustments) {
    try {
      const { data: current } = await supabase
        .from('user_profiles')
        .select('personalization_data')
        .eq('user_id', this.userId)
        .single();

      const updated = {
        ...current?.personalization_data,
        ...adjustments,
        auto_adjusted: true,
        last_auto_adjustment: new Date().toISOString()
      };

      await supabase
        .from('user_profiles')
        .update({ personalization_data: updated })
        .eq('user_id', this.userId);

    } catch (error) {
      console.error('Failed to update personalization settings:', error);
    }
  }
}

/**
 * 글로벌 학습 함수들
 */

// 대화 후 자동 학습 실행
export const learnFromUserInteraction = async (userId, conversationData) => {
  const engine = new AdvancedPersonalizationEngine(userId);
  await engine.learnFromConversation(
    conversationData.conversation_id,
    conversationData.user_message,
    conversationData.assistant_response,
    conversationData.user_feedback
  );
};

// 사용자별 최적 프롬프트 생성
export const generateOptimalPrompt = async (userId, context) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('personalization_data')
      .eq('user_id', userId)
      .single();

    if (!profile?.personalization_data?.learning_stats) {
      return generateDefaultPrompt(context);
    }

    const learningData = profile.personalization_data;
    const confidence = learningData.learning_stats.learning_confidence || 0.1;
    
    // 높은 신뢰도일 때만 고도로 개인화된 프롬프트 사용
    if (confidence > 0.7) {
      return generateHighlyPersonalizedPrompt(learningData, context);
    } else {
      return generateModeratelyPersonalizedPrompt(learningData, context);
    }
  } catch (error) {
    console.error('Failed to generate optimal prompt:', error);
    return generateDefaultPrompt(context);
  }
};

// 고도로 개인화된 프롬프트 생성
const generateHighlyPersonalizedPrompt = (learningData, context) => {
  const stats = learningData.learning_stats;
  const patterns = stats.preferred_response_patterns;
  
  let prompt = "너는 이 사용자와 대화를 많이 나눠본 친한 친구야.\n\n";
  
  // 학습된 선호도 반영
  if (patterns.length) {
    const preferredLength = Object.entries(patterns.length)
      .sort(([,a], [,b]) => b - a)[0][0];
    prompt += `이 사용자는 ${preferredLength} 길이의 답변을 선호해.\n`;
  }
  
  if (patterns.tone) {
    const preferredTone = Object.entries(patterns.tone)
      .sort(([,a], [,b]) => b - a)[0][0];
    prompt += `대화 스타일은 ${preferredTone}로 해줘.\n`;
  }
  
  prompt += `\n학습 신뢰도: ${(stats.learning_confidence * 100).toFixed(0)}%\n`;
  prompt += `평균 만족도: ${(stats.avg_quality_score * 100).toFixed(0)}%\n\n`;
  prompt += "이전 대화들에서 학습한 이 사용자만의 특성을 고려해서 답변해줘.";
  
  return prompt;
};

// 중간 수준 개인화 프롬프트 생성  
const generateModeratelyPersonalizedPrompt = (learningData, context) => {
  const stats = learningData.learning_stats;
  
  let prompt = "너는 사용자의 친구야.\n\n";
  
  if (stats.total_conversations > 5) {
    prompt += "이 사용자와 몇 번 대화해봤으니까 어느 정도 성향을 알겠어.\n";
  }
  
  prompt += "자연스럽고 친근하게 대화해줘.";
  
  return prompt;
};

// 기본 프롬프트 생성
const generateDefaultPrompt = (context) => {
  return "너는 사용자의 친한 친구야. 자연스럽고 친근하게 대화해줘.";
};