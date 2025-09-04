// 대화 패턴 기반 사용자 학습 시스템
import { supabase } from './supabaseApi';

/**
 * 감정보다는 실제 대화 행동 패턴을 분석하여 사용자 선호도 학습
 * - 메시지 길이 선호도
 * - 질문 vs 서술 패턴  
 * - 대화 지속 패턴
 * - 응답 스타일 선호
 * - 주제 전환 패턴
 */

export class ConversationPatternAnalyzer {
  constructor(userId) {
    this.userId = userId;
    this.patterns = {
      message_length_preference: null,      // 선호하는 AI 응답 길이
      conversation_style: null,             // 질문형 vs 서술형 선호
      topic_depth_preference: null,         // 깊이 있는 대화 vs 가벼운 대화
      response_speed_expectation: null,     // 빠른 응답 vs 신중한 응답
      conversation_continuation: null,      // 대화 지속 vs 빠른 마무리
      formality_level: null                // 격식 수준
    };
  }

  /**
   * 사용자의 대화 패턴 분석
   * 최근 20개 대화를 분석하여 패턴 추출
   */
  async analyzeUserConversationPatterns() {
    try {
      // 최근 대화 데이터 가져오기
      const conversations = await this.getRecentConversations(20);
      
      if (conversations.length < 5) {
        return null; // 충분한 데이터 없음
      }

      // 각 패턴별 분석
      this.patterns.message_length_preference = this.analyzeResponseLengthPreference(conversations);
      this.patterns.conversation_style = this.analyzeConversationStyle(conversations);
      this.patterns.topic_depth_preference = this.analyzeTopicDepthPreference(conversations);
      this.patterns.response_speed_expectation = this.analyzeResponseSpeedExpectation(conversations);
      this.patterns.conversation_continuation = this.analyzeConversationContinuation(conversations);
      this.patterns.formality_level = this.analyzeFormalityLevel(conversations);

      return this.patterns;
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return null;
    }
  }

  /**
   * 최근 대화 데이터 가져오기
   */
  async getRecentConversations(limit = 20) {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, created_at')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!conversations) return [];

    // 각 대화의 메시지들 가져오기
    const conversationData = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        return {
          conversation_id: conv.id,
          messages: messages || [],
          date: conv.created_at
        };
      })
    );

    return conversationData.filter(conv => conv.messages.length > 0);
  }

  /**
   * AI 응답 길이 선호도 분석
   * 사용자가 어떤 길이의 AI 응답에 더 잘 반응하는지 분석
   */
  analyzeResponseLengthPreference(conversations) {
    const responses = [];
    
    conversations.forEach(conv => {
      for (let i = 0; i < conv.messages.length - 1; i++) {
        const aiMessage = conv.messages[i];
        const userReply = conv.messages[i + 1];
        
        if (aiMessage.role === 'assistant' && userReply.role === 'user') {
          const aiLength = aiMessage.content.length;
          const userEngagement = this.measureUserEngagement(userReply);
          
          responses.push({
            ai_length: aiLength,
            user_engagement: userEngagement,
            user_reply_length: userReply.content.length
          });
        }
      }
    });

    if (responses.length < 5) return 'medium';

    // 길이별 사용자 참여도 분석
    const shortResponses = responses.filter(r => r.ai_length < 50);
    const mediumResponses = responses.filter(r => r.ai_length >= 50 && r.ai_length < 150);
    const longResponses = responses.filter(r => r.ai_length >= 150);

    const avgEngagement = {
      short: this.calculateAverageEngagement(shortResponses),
      medium: this.calculateAverageEngagement(mediumResponses),
      long: this.calculateAverageEngagement(longResponses)
    };

    // 가장 높은 참여도를 보인 길이 선택
    const preferredLength = Object.entries(avgEngagement)
      .sort(([,a], [,b]) => b - a)[0][0];

    return preferredLength;
  }

  /**
   * 사용자 참여도 측정 (객관적 지표 기반)
   */
  measureUserEngagement(userMessage) {
    let engagement = 0;
    
    // 메시지 길이 (더 길면 더 참여)
    if (userMessage.content.length > 10) engagement += 0.2;
    if (userMessage.content.length > 30) engagement += 0.2;
    if (userMessage.content.length > 50) engagement += 0.1;
    
    // 질문 포함 (대화 지속 의도)
    if (userMessage.content.includes('?') || 
        userMessage.content.includes('어떻게') ||
        userMessage.content.includes('왜') ||
        userMessage.content.includes('뭐')) {
      engagement += 0.3;
    }
    
    // 구체적 정보 제공
    if (userMessage.content.includes('그런데') ||
        userMessage.content.includes('근데') ||
        userMessage.content.includes('그래서')) {
      engagement += 0.2;
    }
    
    // 감사 표현 (만족도 지표)
    if (userMessage.content.includes('고마워') ||
        userMessage.content.includes('감사') ||
        userMessage.content.includes('도움')) {
      engagement += 0.3;
    }
    
    // 단답형 답변 (낮은 참여도)
    if (userMessage.content.length < 5 || 
        ['응', '그래', '아', '음', 'ㅇㅇ'].includes(userMessage.content.trim())) {
      engagement = Math.max(0, engagement - 0.4);
    }
    
    return Math.min(1.0, engagement);
  }

  /**
   * 평균 참여도 계산
   */
  calculateAverageEngagement(responses) {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.user_engagement, 0) / responses.length;
  }

  /**
   * 대화 스타일 분석 (질문형 vs 서술형)
   */
  analyzeConversationStyle(conversations) {
    const userMessages = conversations.flatMap(conv => 
      conv.messages.filter(m => m.role === 'user')
    );

    let questionCount = 0;
    let statementCount = 0;
    let totalEngagement = { question_response: 0, statement_response: 0 };

    conversations.forEach(conv => {
      for (let i = 0; i < conv.messages.length - 1; i++) {
        const aiMessage = conv.messages[i];
        const userReply = conv.messages[i + 1];
        
        if (aiMessage.role === 'assistant' && userReply.role === 'user') {
          const isQuestion = aiMessage.content.includes('?') || 
                           aiMessage.content.includes('어떤') ||
                           aiMessage.content.includes('무엇') ||
                           aiMessage.content.includes('언제');
          
          const engagement = this.measureUserEngagement(userReply);
          
          if (isQuestion) {
            questionCount++;
            totalEngagement.question_response += engagement;
          } else {
            statementCount++;
            totalEngagement.statement_response += engagement;
          }
        }
      }
    });

    if (questionCount === 0 && statementCount === 0) return 'balanced';

    const avgQuestionEngagement = questionCount > 0 ? 
      totalEngagement.question_response / questionCount : 0;
    const avgStatementEngagement = statementCount > 0 ? 
      totalEngagement.statement_response / statementCount : 0;

    // 0.2 이상 차이가 나면 선호도 인정
    if (avgQuestionEngagement - avgStatementEngagement > 0.2) {
      return 'prefers_questions';
    } else if (avgStatementEngagement - avgQuestionEngagement > 0.2) {
      return 'prefers_statements';
    } else {
      return 'balanced';
    }
  }

  /**
   * 주제 깊이 선호도 분석
   */
  analyzeTopicDepthPreference(conversations) {
    let shallowTopicEngagement = 0;
    let deepTopicEngagement = 0;
    let shallowCount = 0;
    let deepCount = 0;

    conversations.forEach(conv => {
      const messageCount = conv.messages.length;
      const avgMessageLength = conv.messages
        .filter(m => m.role === 'user')
        .reduce((sum, m) => sum + m.content.length, 0) / 
        conv.messages.filter(m => m.role === 'user').length;

      const isDeepConversation = messageCount > 6 || avgMessageLength > 30;
      const conversationEngagement = this.calculateConversationEngagement(conv.messages);

      if (isDeepConversation) {
        deepTopicEngagement += conversationEngagement;
        deepCount++;
      } else {
        shallowTopicEngagement += conversationEngagement;
        shallowCount++;
      }
    });

    if (deepCount === 0 && shallowCount === 0) return 'balanced';

    const avgDeepEngagement = deepCount > 0 ? deepTopicEngagement / deepCount : 0;
    const avgShallowEngagement = shallowCount > 0 ? shallowTopicEngagement / shallowCount : 0;

    if (avgDeepEngagement - avgShallowEngagement > 0.15) {
      return 'prefers_deep';
    } else if (avgShallowEngagement - avgDeepEngagement > 0.15) {
      return 'prefers_shallow';
    } else {
      return 'balanced';
    }
  }

  /**
   * 대화 전체의 참여도 계산
   */
  calculateConversationEngagement(messages) {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 0;

    const totalEngagement = userMessages
      .reduce((sum, msg) => sum + this.measureUserEngagement(msg), 0);
    
    return totalEngagement / userMessages.length;
  }

  /**
   * 응답 속도 기대치 분석
   */
  analyzeResponseSpeedExpectation(conversations) {
    // 실제로는 응답 시간 데이터가 필요하지만,
    // 여기서는 사용자 메시지의 긴급성을 분석
    const userMessages = conversations.flatMap(conv => 
      conv.messages.filter(m => m.role === 'user')
    );

    let urgentMessages = 0;
    let casualMessages = 0;

    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // 긴급함을 나타내는 표현들
      if (content.includes('빨리') || 
          content.includes('급해') ||
          content.includes('어떡해') ||
          content.includes('도와줘') ||
          content.includes('!!!!')) {
        urgentMessages++;
      } else {
        casualMessages++;
      }
    });

    const urgencyRatio = urgentMessages / (urgentMessages + casualMessages);
    
    if (urgencyRatio > 0.3) return 'expects_fast';
    if (urgencyRatio < 0.1) return 'patient';
    return 'normal';
  }

  /**
   * 대화 지속 패턴 분석
   */
  analyzeConversationContinuation(conversations) {
    const conversationLengths = conversations.map(conv => conv.messages.length);
    const avgLength = conversationLengths.reduce((a, b) => a + b, 0) / conversationLengths.length;

    // 대화 종료 패턴 분석
    let abruptEndings = 0;
    let naturalEndings = 0;

    conversations.forEach(conv => {
      const lastUserMessage = [...conv.messages].reverse()
        .find(m => m.role === 'user');
      
      if (lastUserMessage) {
        const content = lastUserMessage.content.toLowerCase();
        
        // 자연스러운 종료
        if (content.includes('고마워') || 
            content.includes('나중에') ||
            content.includes('가야겠') ||
            content.includes('바이')) {
          naturalEndings++;
        } else if (lastUserMessage.content.length < 5) {
          abruptEndings++;
        }
      }
    });

    if (avgLength > 8) return 'likes_long_conversations';
    if (avgLength < 4) return 'prefers_brief';
    return 'moderate_length';
  }

  /**
   * 격식 수준 분석
   */
  analyzeFormalityLevel(conversations) {
    const userMessages = conversations.flatMap(conv => 
      conv.messages.filter(m => m.role === 'user')
    );

    let formalCount = 0;
    let casualCount = 0;

    userMessages.forEach(msg => {
      const content = msg.content;
      
      // 격식 있는 표현
      if (content.includes('습니다') ||
          content.includes('해주세요') ||
          content.includes('부탁드립니다') ||
          content.includes('감사합니다')) {
        formalCount++;
      }
      // 캐주얼한 표현
      else if (content.includes('ㅋㅋ') ||
               content.includes('ㅎㅎ') ||
               content.includes('~') ||
               content.includes('야')) {
        casualCount++;
      }
    });

    const formalRatio = formalCount / (formalCount + casualCount + 1);
    
    if (formalRatio > 0.6) return 'formal';
    if (formalRatio < 0.2) return 'casual';
    return 'mixed';
  }

  /**
   * 학습된 패턴을 바탕으로 최적 응답 스타일 생성
   */
  generateOptimalResponseStyle() {
    const style = {
      preferred_length: this.patterns.message_length_preference || 'medium',
      use_questions: this.patterns.conversation_style === 'prefers_questions',
      depth_level: this.patterns.topic_depth_preference || 'balanced',
      formality: this.patterns.formality_level || 'mixed',
      continuation_style: this.patterns.conversation_continuation || 'moderate_length'
    };

    return style;
  }

  /**
   * 패턴 기반 시스템 프롬프트 생성
   */
  generatePatternBasedPrompt() {
    const style = this.generateOptimalResponseStyle();
    
    let prompt = "너는 사용자의 대화 패턴을 학습한 맞춤형 AI야.\n\n";
    
    // 길이 선호도 적용
    if (style.preferred_length === 'short') {
      prompt += "- 답변은 1-2문장으로 간결하게 해줘\n";
    } else if (style.preferred_length === 'long') {
      prompt += "- 자세하고 구체적인 3-5문장 답변을 해줘\n";
    } else {
      prompt += "- 적당한 길이(2-3문장)로 답변해줘\n";
    }
    
    // 질문 사용 선호도
    if (style.use_questions) {
      prompt += "- 대화를 이어가기 위해 적절한 질문을 포함해줘\n";
    } else {
      prompt += "- 서술형 답변 위주로, 질문은 꼭 필요할 때만 해줘\n";
    }
    
    // 깊이 선호도
    if (style.depth_level === 'prefers_deep') {
      prompt += "- 주제를 깊이 있게 다뤄줘\n";
    } else if (style.depth_level === 'prefers_shallow') {
      prompt += "- 가볍고 부담스럽지 않게 대화해줘\n";
    }
    
    // 격식 수준
    if (style.formality === 'formal') {
      prompt += "- 정중하고 격식 있는 어투를 사용해줘\n";
    } else if (style.formality === 'casual') {
      prompt += "- 친근하고 편안한 반말톤으로 대화해줘\n";
    } else {
      prompt += "- 상황에 맞게 적절한 톤을 사용해줘\n";
    }
    
    prompt += "\n이 사용자의 대화 패턴에 맞춰서 자연스럽게 대화해줘.";
    
    return prompt;
  }

  /**
   * 패턴 데이터를 DB에 저장
   */
  async savePatternData() {
    try {
      const patternData = {
        user_id: this.userId,
        patterns: this.patterns,
        generated_prompt: this.generatePatternBasedPrompt(),
        last_updated: new Date().toISOString(),
        confidence_level: this.calculateConfidenceLevel()
      };

      await supabase
        .from('user_conversation_patterns')
        .upsert(patternData, { onConflict: 'user_id' });

      return true;
    } catch (error) {
      console.error('Failed to save pattern data:', error);
      return false;
    }
  }

  /**
   * 신뢰도 계산 (얼마나 확신을 가지고 패턴을 적용할지)
   */
  calculateConfidenceLevel() {
    const nonNullPatterns = Object.values(this.patterns)
      .filter(pattern => pattern !== null && pattern !== 'balanced').length;
    
    const totalPatterns = Object.keys(this.patterns).length;
    return (nonNullPatterns / totalPatterns) * 0.8; // 최대 80%로 제한
  }
}

// 사용 예시 함수
export const analyzeAndUpdateUserPatterns = async (userId) => {
  const analyzer = new ConversationPatternAnalyzer(userId);
  const patterns = await analyzer.analyzeUserConversationPatterns();
  
  if (patterns) {
    await analyzer.savePatternData();
    return analyzer.generateOptimalResponseStyle();
  }
  
  return null;
};

export default ConversationPatternAnalyzer;