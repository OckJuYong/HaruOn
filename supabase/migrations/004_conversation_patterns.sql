-- 대화 패턴 분석 테이블
CREATE TABLE IF NOT EXISTS user_conversation_patterns (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL DEFAULT '{}',
  generated_prompt TEXT,
  confidence_level NUMERIC(3,2) DEFAULT 0.00,
  conversation_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 유니크 제약 조건
  UNIQUE(user_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_conversation_patterns_user_id ON user_conversation_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_patterns_confidence ON user_conversation_patterns(confidence_level);
CREATE INDEX IF NOT EXISTS idx_conversation_patterns_updated ON user_conversation_patterns(last_updated);

-- RLS 설정
ALTER TABLE user_conversation_patterns ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 패턴 데이터만 조회/수정 가능
CREATE POLICY "Users can view their own conversation patterns" ON user_conversation_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation patterns" ON user_conversation_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation patterns" ON user_conversation_patterns
  FOR UPDATE USING (auth.uid() = user_id);

-- 패턴 분석을 위한 함수 생성
CREATE OR REPLACE FUNCTION get_user_conversation_summary(target_user_id UUID)
RETURNS TABLE(
  total_conversations BIGINT,
  avg_conversation_length NUMERIC,
  most_active_time TEXT,
  common_topics TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT c.id) as total_conversations,
    AVG(message_counts.msg_count) as avg_conversation_length,
    EXTRACT(HOUR FROM c.created_at)::TEXT as most_active_time,
    ARRAY[]::TEXT[] as common_topics
  FROM conversations c
  LEFT JOIN (
    SELECT conversation_id, COUNT(*) as msg_count
    FROM messages 
    WHERE role = 'user'
    GROUP BY conversation_id
  ) message_counts ON c.id = message_counts.conversation_id
  WHERE c.user_id = target_user_id
    AND c.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY EXTRACT(HOUR FROM c.created_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자별 대화 패턴 업데이트 함수
CREATE OR REPLACE FUNCTION update_conversation_patterns(
  target_user_id UUID,
  new_patterns JSONB,
  new_prompt TEXT DEFAULT NULL,
  new_confidence NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO user_conversation_patterns (
    user_id, 
    patterns, 
    generated_prompt, 
    confidence_level,
    conversation_count,
    last_updated
  ) VALUES (
    target_user_id, 
    new_patterns, 
    new_prompt, 
    COALESCE(new_confidence, 0.1),
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    patterns = EXCLUDED.patterns,
    generated_prompt = COALESCE(EXCLUDED.generated_prompt, user_conversation_patterns.generated_prompt),
    confidence_level = COALESCE(EXCLUDED.confidence_level, user_conversation_patterns.confidence_level),
    conversation_count = user_conversation_patterns.conversation_count + 1,
    last_updated = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_user_conversation_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_patterns(UUID, JSONB, TEXT, NUMERIC) TO authenticated;