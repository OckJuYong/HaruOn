import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Authentication Functions ---
export const signUp = async (userData) => {
  const { email, password, nickname } = userData;
  const { user, session, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      data: {
        nickname: nickname
      }
    }
  });
  if (error) throw error;
  return { user, session };
};

export const signIn = async (email, password) => {
  const { user, session, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user, session };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const onAuthStateChange = (callback) => {
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  return authListener;
};

export const resetPasswordForEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/update-password', // Assuming a password update page
  });
  if (error) throw error;
};

// --- Conversation/Message Functions (assuming 'conversations' and 'messages' tables) ---
export const createConversation = async (payload) => {
  const { data, error } = await supabase.from('conversations').insert([payload]).select();
  if (error) throw error;
  return data[0];
};

export const listConversations = async (userId) => {
  const { data, error } = await supabase.from('conversations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getConversation = async (conversationId) => {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
  if (error) throw error;
  return data;
};

export const deleteConversationApi = async (conversationId) => {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  if (error) throw error;
};

export const listMessages = async (conversationId) => {
  const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

// --- Edge Function Calls (assuming 'chat' and 'generate-image' are deployed as Edge Functions) ---
export const chat = async (payload) => {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: payload,
  });
  if (error) throw error;
  return data;
};

export const createImage = async ({ conversation_id, prompt }) => {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt, conversation_id },
  });
  if (error) throw error;
  return data;
};

// --- Health Check ---
export const healthz = async () => {
  try {
    // 간단한 Supabase 연결 테스트로 대체
    const { error } = await supabase.from('conversations').select('count').limit(1);
    if (error) throw error;
    return { ok: true, status: 200 };
  } catch (error) {
    console.error("Health check failed:", error);
    return { ok: false, status: error.status || 500 };
  }
};

// --- Image Management Functions ---
export const saveImageToDb = async (imageData) => {
  if (!imageData.conversation_id) {
    throw new Error('conversation_id is required to save image');
  }
  
  const { data, error } = await supabase.from('images').insert([imageData]).select();
  if (error) throw error;
  return data[0];
};

export const getUserImages = async (userId) => {
  // images 테이블에는 user_id가 없으므로 conversations를 통해 간접 조회
  const { data, error } = await supabase
    .from('images')
    .select(`
      *,
      conversations!inner(user_id)
    `)
    .eq('conversations.user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// --- User Profile Functions ---
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
};

export const upsertUserProfile = async (userId, profileData) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ 
      user_id: userId, 
      profile_data: profileData,
      last_updated_at: new Date().toISOString()
    })
    .select();
  if (error) throw error;
  return data[0];
};

// --- User Personalization Functions ---
export const getUserPersonalization = async (userId) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (profile?.profile_data?.personalization) {
      return profile.profile_data.personalization;
    }

    // 기본 개인화 설정 반환
    return {
      conversation_style: 'friendly',
      response_length: 'medium', 
      emotional_tone: 'warm',
      topics_of_interest: [],
      conversation_patterns: [],
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get user personalization:', error);
    return null;
  }
};

export const updateUserPersonalization = async (userId, personalizationData) => {
  try {
    // 현재 프로필 데이터 가져오기
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    let currentData = {};
    if (profile && profile.profile_data) {
      currentData = profile.profile_data;
    }

    // 개인화 데이터 업데이트
    currentData.personalization = {
      ...currentData.personalization,
      ...personalizationData,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        profile_data: currentData,
        last_updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return currentData.personalization;
  } catch (error) {
    console.error('Failed to update user personalization:', error);
    throw error;
  }
};

export const analyzeUserPatterns = async (userId) => {
  try {
    // 최근 10개 대화 가져오기
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!conversations || conversations.length < 3) {
      return null; // 충분한 데이터 없음
    }

    // 각 대화의 메시지 가져오기
    const conversationAnalysis = await Promise.all(
      conversations.slice(0, 5).map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        const userMessages = messages?.filter(m => m.role === 'user') || [];
        const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];

        return {
          conversation_id: conv.id,
          user_message_count: userMessages.length,
          avg_user_message_length: userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length,
          avg_assistant_message_length: assistantMessages.reduce((sum, m) => sum + m.content.length, 0) / assistantMessages.length,
          conversation_duration: messages?.length || 0,
          user_messages: userMessages.map(m => m.content),
          topics: extractTopicsFromMessages(userMessages.map(m => m.content))
        };
      })
    );

    // 패턴 분석
    const patterns = {
      preferred_response_length: analyzePreferredResponseLength(conversationAnalysis),
      conversation_style: analyzeConversationStyle(conversationAnalysis),
      topics_of_interest: analyzeTopicsOfInterest(conversationAnalysis),
      interaction_patterns: analyzeInteractionPatterns(conversationAnalysis),
      recent_conversations: conversationAnalysis.slice(0, 3)
    };

    return patterns;
  } catch (error) {
    console.error('Failed to analyze user patterns:', error);
    return null;
  }
};

// --- Pattern Analysis Helper Functions ---
const extractTopicsFromMessages = (messages) => {
  const topicKeywords = {
    '일상': ['일상', '하루', '오늘', '어제', '내일', '생활', '일과'],
    '감정': ['기분', '감정', '행복', '슬픔', '우울', '스트레스', '힘들', '좋다'],
    '일': ['회사', '직장', '업무', '일', '프로젝트', '동료', '상사'],
    '관계': ['친구', '가족', '연인', '사람', '관계', '만남'],
    '취미': ['취미', '영화', '음악', '책', '게임', '운동', '여행'],
    '고민': ['고민', '걱정', '문제', '어려움', '힘들다', '도움'],
    '계획': ['계획', '목표', '꿈', '미래', '준비', '도전']
  };

  const topics = {};
  const allText = messages.join(' ').toLowerCase();

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    const count = keywords.reduce((sum, keyword) => {
      return sum + (allText.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    if (count > 0) {
      topics[topic] = count;
    }
  });

  return Object.entries(topics)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([topic]) => topic);
};

const analyzePreferredResponseLength = (conversations) => {
  const avgLengths = conversations.map(c => c.avg_assistant_message_length).filter(l => !isNaN(l));
  if (avgLengths.length === 0) return 'medium';
  
  const avgLength = avgLengths.reduce((sum, l) => sum + l, 0) / avgLengths.length;
  
  if (avgLength < 50) return 'short';
  if (avgLength < 150) return 'medium'; 
  return 'long';
};

const analyzeConversationStyle = (conversations) => {
  const userMessages = conversations.flatMap(c => c.user_messages);
  const allText = userMessages.join(' ').toLowerCase();

  const styleIndicators = {
    casual: ['ㅋㅋ', 'ㅎㅎ', '~', '!', '야', '어', '음'],
    polite: ['습니다', '요', '죄송', '감사', '부탁', '여쭤'],
    emotional: ['정말', '너무', '완전', '진짜', '심각', '최고', '최악']
  };

  let maxScore = 0;
  let dominantStyle = 'friendly';

  Object.entries(styleIndicators).forEach(([style, indicators]) => {
    const score = indicators.reduce((sum, indicator) => {
      return sum + (allText.match(new RegExp(indicator, 'g')) || []).length;
    }, 0);
    
    if (score > maxScore) {
      maxScore = score;
      dominantStyle = style === 'casual' ? 'friendly' : 
                     style === 'polite' ? 'formal' : 
                     'enthusiastic';
    }
  });

  return dominantStyle;
};

const analyzeTopicsOfInterest = (conversations) => {
  const allTopics = conversations.flatMap(c => c.topics);
  const topicCounts = {};

  allTopics.forEach(topic => {
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });

  return Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic);
};

const analyzeInteractionPatterns = (conversations) => {
  const avgMessageCount = conversations.reduce((sum, c) => sum + c.user_message_count, 0) / conversations.length;
  const avgConversationLength = conversations.reduce((sum, c) => sum + c.conversation_duration, 0) / conversations.length;

  return {
    typical_session_length: avgConversationLength > 10 ? 'long' : avgConversationLength > 5 ? 'medium' : 'short',
    engagement_level: avgMessageCount > 8 ? 'high' : avgMessageCount > 4 ? 'medium' : 'low',
    interaction_frequency: conversations.length > 7 ? 'frequent' : conversations.length > 3 ? 'regular' : 'occasional'
  };
};

// --- Conversation Summary Functions ---
// 🎯 개선: 2가지 요약 저장 (100자 detailed + 30자 compact)
export const saveConversationSummary = async (conversationId, detailedSummary, imageUrl = null, englishSummary = null, compactSummary = null) => {
  try {
    // 먼저 해당 conversation의 user_id를 가져옴
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (convError) throw convError;

    const userId = conversation.user_id;

    // 현재 프로필 데이터 가져오기
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    let currentData = {};
    if (profile && profile.profile_data) {
      currentData = profile.profile_data;
    }

    // conversation_summaries 데이터를 profile_data에 저장
    if (!currentData.conversation_summaries) {
      currentData.conversation_summaries = {};
    }

    currentData.conversation_summaries[conversationId] = {
      summary: detailedSummary, // 🎯 100자 상세 요약 (사용자 표시용 - 그림일기)
      detailed_summary: detailedSummary, // 명시적으로 detailed 저장
      compact_summary: compactSummary, // 🎯 30자 핵심 요약 (장기 기억용 - 이후 대화 맥락 제공)
      english_summary: englishSummary, // 영어 요약 (사용자에게는 보이지 않음)
      image_url: imageUrl,
      created_at: new Date().toISOString()
    };

    // 업데이트 또는 삽입
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        profile_data: currentData,
        last_updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return currentData.conversation_summaries[conversationId];

  } catch (error) {
    console.error('Failed to save conversation summary:', error);
    throw error;
  }
};

export const getConversationSummary = async (conversationId) => {
  try {
    // 먼저 해당 conversation의 user_id를 가져옴
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();
    
    if (convError) throw convError;
    
    const userId = conversation.user_id;
    
    // 프로필 데이터에서 요약 정보 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') throw profileError;
    
    if (profile && profile.profile_data && profile.profile_data.conversation_summaries) {
      return profile.profile_data.conversation_summaries[conversationId] || null;
    }
    
    return null;
    
  } catch (error) {
    console.error('Failed to get conversation summary:', error);
    return null;
  }
};

// --- Cat Artist Profile Functions (이미지 개인화) ---

// 🎨 고양이 아티스트 프로필 가져오기
export const getCatArtistProfile = async (userId) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (profile?.profile_data?.cat_artist_profile) {
      return profile.profile_data.cat_artist_profile;
    }

    // 기본 프로필 반환 (초기 사용자)
    return {
      drawing_personality: 'friendly',
      favorite_colors: [],
      line_thickness: 'medium',
      coloring_style: 'simple',
      detail_level: 'minimal',
      mood_tendency: 'neutral',
      iterations: 0,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get cat artist profile:', error);
    return null;
  }
};

// 🎨 고양이 아티스트 프로필 업데이트
export const updateCatArtistProfile = async (userId, profileData) => {
  try {
    // 현재 프로필 데이터 가져오기
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    let currentData = {};
    if (profile && profile.profile_data) {
      currentData = profile.profile_data;
    }

    // cat_artist_profile 업데이트
    currentData.cat_artist_profile = {
      ...currentData.cat_artist_profile,
      ...profileData,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        profile_data: currentData,
        last_updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return currentData.cat_artist_profile;
  } catch (error) {
    console.error('Failed to update cat artist profile:', error);
    throw error;
  }
};

// 🎨 이미지 생성 히스토리 저장
export const saveImageHistory = async (userId, historyItem) => {
  try {
    // 현재 프로필 데이터 가져오기
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    let currentData = {};
    if (profile && profile.profile_data) {
      currentData = profile.profile_data;
    }

    // image_generation_history 배열에 추가
    if (!currentData.image_generation_history) {
      currentData.image_generation_history = [];
    }

    currentData.image_generation_history.push({
      ...historyItem,
      timestamp: new Date().toISOString()
    });

    // 최근 50개만 유지 (용량 관리)
    if (currentData.image_generation_history.length > 50) {
      currentData.image_generation_history = currentData.image_generation_history.slice(-50);
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        profile_data: currentData,
        last_updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return currentData.image_generation_history;
  } catch (error) {
    console.error('Failed to save image history:', error);
    throw error;
  }
};

// 🎨 이미지 히스토리 가져오기
export const getImageHistory = async (userId) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (profile?.profile_data?.image_generation_history) {
      return profile.profile_data.image_generation_history;
    }

    return [];
  } catch (error) {
    console.error('Failed to get image history:', error);
    return [];
  }
};