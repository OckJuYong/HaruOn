-- =====================================================
-- Complete HaruOn Database Schema
-- =====================================================

-- =====================================================
-- Core Tables
-- =====================================================

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  english_summary TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Images Table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB DEFAULT '{}',
  personalization_data JSONB DEFAULT '{}',
  intimacy_level INTEGER DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  nickname VARCHAR(50),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Summaries Table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
  summary TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Advanced Personalization Tables
-- =====================================================

-- User Conversation Patterns
CREATE TABLE IF NOT EXISTS user_conversation_patterns (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL DEFAULT '{}',
  confidence_level NUMERIC(3,2) DEFAULT 0.0,
  conversation_count INTEGER DEFAULT 0,
  generated_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Personal Memories
CREATE TABLE IF NOT EXISTS personal_memories (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 1,
  context TEXT,
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_mentioned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category, key)
);

-- Emotional Interactions
CREATE TABLE IF NOT EXISTS emotional_interactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion_detected VARCHAR(50),
  emotion_intensity NUMERIC(3,2),
  ai_response_type VARCHAR(50),
  user_satisfaction INTEGER,
  conversation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared Experiences
CREATE TABLE IF NOT EXISTS shared_experiences (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_type VARCHAR(50),
  title VARCHAR(200),
  description TEXT,
  emotional_impact NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conversation_id UUID
);

-- =====================================================
-- Calendar & Daily Quest Tables
-- =====================================================

-- Daily Quest Templates
CREATE TABLE IF NOT EXISTS daily_quest_templates (
  id SERIAL PRIMARY KEY,
  day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1 AND day_number <= 365),
  question_text TEXT NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Daily Quests
CREATE TABLE IF NOT EXISTS user_daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_template_id INTEGER REFERENCES daily_quest_templates(id),
  response_text TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Entries (Calendar)
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  emotions JSONB,
  summary_text TEXT,
  image_url TEXT,
  conversation_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- =====================================================
-- Indexes
-- =====================================================

-- Core Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_images_conversation ON images(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- Personalization Indexes
CREATE INDEX IF NOT EXISTS idx_personal_memories_user_category ON personal_memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_personal_memories_importance ON personal_memories(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_personal_memories_last_mentioned ON personal_memories(user_id, last_mentioned DESC);
CREATE INDEX IF NOT EXISTS idx_emotional_interactions_user ON emotional_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_experiences_user ON shared_experiences(user_id);

-- Calendar & Quest Indexes
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON user_daily_quests(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON daily_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_quest_templates_day ON daily_quest_templates(day_number);

-- Unique Index for Daily Quest (날짜별 중복 방지)
-- DATE() 함수는 IMMUTABLE이 아니므로 CAST 사용
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quest_daily
  ON user_daily_quests(user_id, quest_template_id, ((completed_at AT TIME ZONE 'UTC')::date));

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_conversation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quest_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own conversations" ON conversations;
CREATE POLICY "Users can manage their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;
CREATE POLICY "Users can manage their own messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own images" ON images;
CREATE POLICY "Users can manage their own images" ON images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = images.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own profiles" ON user_profiles;
CREATE POLICY "Users can manage their own profiles" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own summaries" ON conversation_summaries;
CREATE POLICY "Users can manage their own summaries" ON conversation_summaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_summaries.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own conversation patterns" ON user_conversation_patterns;
CREATE POLICY "Users can manage their own conversation patterns" ON user_conversation_patterns
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own memories" ON personal_memories;
CREATE POLICY "Users can manage their own memories" ON personal_memories
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own emotional interactions" ON emotional_interactions;
CREATE POLICY "Users can manage their own emotional interactions" ON emotional_interactions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own shared experiences" ON shared_experiences;
CREATE POLICY "Users can manage their own shared experiences" ON shared_experiences
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view quest templates" ON daily_quest_templates;
CREATE POLICY "Anyone can view quest templates" ON daily_quest_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own quest responses" ON user_daily_quests;
CREATE POLICY "Users can view their own quest responses" ON user_daily_quests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own quest responses" ON user_daily_quests;
CREATE POLICY "Users can insert their own quest responses" ON user_daily_quests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quest responses" ON user_daily_quests;
CREATE POLICY "Users can update their own quest responses" ON user_daily_quests
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own daily entries" ON daily_entries;
CREATE POLICY "Users can view their own daily entries" ON daily_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own daily entries" ON daily_entries;
CREATE POLICY "Users can insert their own daily entries" ON daily_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own daily entries" ON daily_entries;
CREATE POLICY "Users can update their own daily entries" ON daily_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- Views
-- =====================================================

DROP VIEW IF EXISTS conversations_api;
CREATE VIEW conversations_api AS
SELECT
  id::text as id,
  user_id::text as user_id,
  title,
  summary,
  english_summary,
  image_url,
  created_at::text as created_at,
  updated_at::text as updated_at
FROM conversations;

-- =====================================================
-- Functions
-- =====================================================

-- Update Intimacy Level
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
  ON CONFLICT (user_id)
  DO UPDATE SET
    intimacy_level = new_intimacy,
    last_interaction = NOW();

  RETURN new_intimacy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_intimacy_level(UUID, INTEGER) TO authenticated;

-- Get Today's Quest for User
CREATE OR REPLACE FUNCTION get_today_quest_for_user(target_user_id UUID)
RETURNS TABLE (
  quest_id INTEGER,
  question TEXT,
  category VARCHAR,
  already_completed BOOLEAN
) AS $$
DECLARE
  user_start_date DATE;
  days_since_start INTEGER;
  today_quest_day INTEGER;
BEGIN
  SELECT DATE(created_at) INTO user_start_date
  FROM auth.users
  WHERE id = target_user_id;

  days_since_start := DATE_PART('day', NOW() - user_start_date)::INTEGER;
  today_quest_day := (days_since_start % 365) + 1;

  RETURN QUERY
  SELECT
    t.id,
    t.question_text,
    t.category,
    EXISTS(
      SELECT 1 FROM user_daily_quests udq
      WHERE udq.user_id = target_user_id
        AND udq.quest_template_id = t.id
        AND DATE(udq.completed_at) = CURRENT_DATE
    ) as already_completed
  FROM daily_quest_templates t
  WHERE t.day_number = today_quest_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_today_quest_for_user(UUID) TO authenticated;

-- Get Monthly Calendar Data
CREATE OR REPLACE FUNCTION get_monthly_calendar_data(
  target_user_id UUID,
  target_year INTEGER,
  target_month INTEGER
)
RETURNS TABLE (
  entry_date DATE,
  emotions JSONB,
  summary_text TEXT,
  image_url TEXT,
  has_quest BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.entry_date,
    de.emotions,
    de.summary_text,
    de.image_url,
    EXISTS(
      SELECT 1 FROM user_daily_quests udq
      WHERE udq.user_id = target_user_id
        AND DATE(udq.completed_at) = de.entry_date
    ) as has_quest
  FROM daily_entries de
  WHERE de.user_id = target_user_id
    AND EXTRACT(YEAR FROM de.entry_date) = target_year
    AND EXTRACT(MONTH FROM de.entry_date) = target_month
  ORDER BY de.entry_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_monthly_calendar_data(UUID, INTEGER, INTEGER) TO authenticated;

-- Update Daily Entry from Summary (Trigger Function)
CREATE OR REPLACE FUNCTION update_daily_entry_from_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_entries (
    user_id,
    entry_date,
    summary_text,
    image_url,
    conversation_ids
  )
  SELECT
    c.user_id,
    DATE(NEW.created_at),
    NEW.summary,
    NEW.image_url,
    ARRAY[c.id]
  FROM conversations c
  WHERE c.id = NEW.conversation_id
  ON CONFLICT (user_id, entry_date)
  DO UPDATE SET
    summary_text = COALESCE(daily_entries.summary_text, '') || E'\n\n' || EXCLUDED.summary_text,
    image_url = COALESCE(EXCLUDED.image_url, daily_entries.image_url),
    conversation_ids = array_append(daily_entries.conversation_ids, NEW.conversation_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_daily_entry ON conversation_summaries;
CREATE TRIGGER trigger_update_daily_entry
  AFTER INSERT ON conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_entry_from_summary();

-- =====================================================
-- Initial Data: 30 Sample Daily Quests
-- =====================================================

INSERT INTO daily_quest_templates (day_number, question_text, category) VALUES
(1, '살면서 가장 행복했던 순간은 언제였나요?', 'happiness'),
(2, '내 인생의 터닝포인트는 무엇이었나요?', 'growth'),
(3, '가장 슬펐던 순간을 떠올려보세요.', 'sadness'),
(4, '지금까지 가장 감사했던 일은 무엇인가요?', 'gratitude'),
(5, '앞으로 가장 이루고 싶은 목표는 무엇인가요?', 'goals'),
(6, '어린 시절 가장 기억에 남는 추억은?', 'memories'),
(7, '오늘 하루는 어땠나요?', 'daily'),
(8, '최근에 배운 가장 중요한 교훈은?', 'growth'),
(9, '당신에게 가장 큰 영향을 준 사람은 누구인가요?', 'relationships'),
(10, '스트레스를 받을 때 어떻게 대처하나요?', 'coping'),
(11, '나를 가장 잘 표현하는 단어 3가지는?', 'self'),
(12, '후회하는 일이 있다면 무엇인가요?', 'reflection'),
(13, '내가 가장 자랑스러워하는 성취는?', 'achievement'),
(14, '미래의 나에게 하고 싶은 말은?', 'future'),
(15, '오늘 감사한 일 3가지를 적어보세요.', 'gratitude'),
(16, '가장 좋아하는 취미나 활동은 무엇인가요?', 'hobbies'),
(17, '힘들 때 나를 지탱해주는 것은?', 'support'),
(18, '꿈꾸는 이상적인 삶은 어떤 모습인가요?', 'dreams'),
(19, '최근에 느낀 강한 감정은 무엇이었나요?', 'emotions'),
(20, '내가 극복한 가장 큰 어려움은?', 'challenges'),
(21, '나의 강점과 약점은 무엇인가요?', 'self'),
(22, '행복을 느끼는 순간은 언제인가요?', 'happiness'),
(23, '가장 편안함을 느끼는 장소는 어디인가요?', 'comfort'),
(24, '나를 동기부여하는 것은 무엇인가요?', 'motivation'),
(25, '친구나 가족과의 소중한 기억은?', 'relationships'),
(26, '오늘 나에게 칭찬 한마디를 해준다면?', 'self-love'),
(27, '불안할 때 나는 어떤 생각을 하나요?', 'anxiety'),
(28, '내가 가장 소중히 여기는 가치는?', 'values'),
(29, '변화시키고 싶은 나의 습관은?', 'habits'),
(30, '오늘의 기분을 색깔로 표현한다면?', 'emotions')
ON CONFLICT (day_number) DO NOTHING;
