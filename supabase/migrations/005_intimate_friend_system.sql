-- 단짝친구 같은 AI를 위한 개인 기억 시스템

-- 개인적 기억 저장 테이블
CREATE TABLE IF NOT EXISTS personal_memories (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'hobby', 'work', 'family', 'goal', 'preference', 'experience'
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 1, -- 1-5 중요도
  context TEXT, -- 원본 대화 내용
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_mentioned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 인덱스용
  UNIQUE(user_id, category, key)
);

-- 감정적 상호작용 히스토리
CREATE TABLE IF NOT EXISTS emotional_interactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion_detected VARCHAR(50), -- 'joy', 'sadness', 'anger', 'worry', 'excitement', 'gratitude'
  emotion_intensity NUMERIC(3,2), -- 0.00-1.00
  ai_response_type VARCHAR(50), -- 'supportive', 'celebratory', 'empathetic', 'encouraging'
  user_satisfaction INTEGER, -- 1-5 (사용자 반응 기반 추정)
  conversation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공유된 경험/추억
CREATE TABLE IF NOT EXISTS shared_experiences (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_type VARCHAR(50), -- 'achievement', 'challenge', 'daily_life', 'milestone'
  title VARCHAR(200),
  description TEXT,
  emotional_impact NUMERIC(3,2), -- 0.00-1.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conversation_id UUID
);

-- user_profiles 테이블에 친밀도 컬럼 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'intimacy_level'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN intimacy_level INTEGER DEFAULT 0;
        ALTER TABLE user_profiles ADD COLUMN last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE user_profiles ADD COLUMN nickname VARCHAR(50);
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_personal_memories_user_category ON personal_memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_personal_memories_importance ON personal_memories(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_personal_memories_last_mentioned ON personal_memories(user_id, last_mentioned DESC);
CREATE INDEX IF NOT EXISTS idx_emotional_interactions_user ON emotional_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_experiences_user ON shared_experiences(user_id);

-- RLS 설정
ALTER TABLE personal_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_experiences ENABLE ROW LEVEL SECURITY;

-- 정책 생성
CREATE POLICY "Users can manage their own memories" ON personal_memories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own emotional interactions" ON emotional_interactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own shared experiences" ON shared_experiences
  FOR ALL USING (auth.uid() = user_id);

-- 기억 검색 함수
CREATE OR REPLACE FUNCTION search_relevant_memories(
  target_user_id UUID,
  search_query TEXT,
  memory_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  id INTEGER,
  category VARCHAR(50),
  key VARCHAR(100),
  value TEXT,
  importance INTEGER,
  mention_count INTEGER,
  last_mentioned TIMESTAMP WITH TIME ZONE,
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.category,
    pm.key,
    pm.value,
    pm.importance,
    pm.mention_count,
    pm.last_mentioned,
    (
      CASE 
        WHEN LOWER(pm.value) LIKE '%' || LOWER(search_query) || '%' THEN 0.8
        WHEN LOWER(pm.key) LIKE '%' || LOWER(search_query) || '%' THEN 0.6
        WHEN LOWER(pm.context) LIKE '%' || LOWER(search_query) || '%' THEN 0.4
        ELSE 0.0
      END
      + (pm.importance * 0.1)
      + CASE 
          WHEN pm.last_mentioned >= NOW() - INTERVAL '7 days' THEN 0.3
          WHEN pm.last_mentioned >= NOW() - INTERVAL '30 days' THEN 0.1
          ELSE 0.0
        END
    ) as relevance_score
  FROM personal_memories pm
  WHERE pm.user_id = target_user_id
    AND (
      LOWER(pm.value) LIKE '%' || LOWER(search_query) || '%' OR
      LOWER(pm.key) LIKE '%' || LOWER(search_query) || '%' OR
      LOWER(pm.context) LIKE '%' || LOWER(search_query) || '%'
    )
  ORDER BY relevance_score DESC, pm.importance DESC, pm.last_mentioned DESC
  LIMIT memory_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 친밀도 업데이트 함수
CREATE OR REPLACE FUNCTION update_intimacy_level(
  target_user_id UUID,
  interaction_quality INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  current_intimacy INTEGER;
  new_intimacy INTEGER;
BEGIN
  SELECT COALESCE(intimacy_level, 0) INTO current_intimacy
  FROM user_profiles
  WHERE user_id = target_user_id;
  
  new_intimacy := LEAST(100, current_intimacy + interaction_quality);
  
  INSERT INTO user_profiles (user_id, intimacy_level, last_interaction)
  VALUES (target_user_id, new_intimacy, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    intimacy_level = new_intimacy,
    last_interaction = NOW();
    
  RETURN new_intimacy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 최근 중요한 기억 조회 함수
CREATE OR REPLACE FUNCTION get_recent_important_memories(
  target_user_id UUID,
  min_importance INTEGER DEFAULT 3,
  memory_limit INTEGER DEFAULT 3
)
RETURNS TABLE(
  category VARCHAR(50),
  key VARCHAR(100),
  value TEXT,
  importance INTEGER,
  last_mentioned TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.category,
    pm.key,
    pm.value,
    pm.importance,
    pm.last_mentioned
  FROM personal_memories pm
  WHERE pm.user_id = target_user_id
    AND pm.importance >= min_importance
  ORDER BY pm.last_mentioned DESC, pm.importance DESC
  LIMIT memory_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 감정적 상호작용 통계 함수
CREATE OR REPLACE FUNCTION get_emotional_interaction_stats(target_user_id UUID)
RETURNS TABLE(
  total_interactions BIGINT,
  positive_emotions BIGINT,
  support_needed BIGINT,
  avg_satisfaction NUMERIC,
  dominant_emotion TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE emotion_detected IN ('joy', 'excitement', 'gratitude')) as positive_emotions,
    COUNT(*) FILTER (WHERE emotion_detected IN ('sadness', 'anger', 'worry')) as support_needed,
    AVG(user_satisfaction) as avg_satisfaction,
    MODE() WITHIN GROUP (ORDER BY emotion_detected) as dominant_emotion
  FROM emotional_interactions
  WHERE user_id = target_user_id
    AND created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여
GRANT EXECUTE ON FUNCTION search_relevant_memories(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_intimacy_level(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_important_memories(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_emotional_interaction_stats(UUID) TO authenticated;