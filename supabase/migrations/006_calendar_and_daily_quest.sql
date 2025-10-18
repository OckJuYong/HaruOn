-- =====================================================
-- 006: Calendar & Daily Quest System
-- =====================================================
-- 목적:
-- 1. 캘린더 기능: 일별 감정 평가, 이미지, 요약을 달력 형태로 시각화
-- 2. 365 데일리 퀘스트: 매일 주제를 제공하여 사용자 Context 수집
-- =====================================================

-- 1. Daily Quest 질문 템플릿 테이블
CREATE TABLE IF NOT EXISTS daily_quest_templates (
  id SERIAL PRIMARY KEY,
  day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1 AND day_number <= 365),
  question_text TEXT NOT NULL,
  category VARCHAR(50), -- 예: 'happiness', 'sadness', 'growth', 'relationships' 등
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 사용자별 Daily Quest 응답 기록
CREATE TABLE IF NOT EXISTS user_daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_template_id INTEGER REFERENCES daily_quest_templates(id),
  response_text TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 중복 방지: 같은 날 같은 퀘스트는 한 번만
  UNIQUE(user_id, quest_template_id, DATE(completed_at))
);

-- 3. Daily Emotion & Summary 기록 (캘린더용)
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,

  -- 감정 분석 결과 (JSON: {sadness: 30, happiness: 50, anxiety: 20})
  emotions JSONB,

  -- 하루 요약 텍스트
  summary_text TEXT,

  -- 생성된 이미지 URL
  image_url TEXT,

  -- 해당 날짜의 대화방 ID들 (여러 대화가 있을 수 있음)
  conversation_ids UUID[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 하루에 하나의 엔트리만
  UNIQUE(user_id, entry_date)
);

-- 인덱스 추가
CREATE INDEX idx_daily_quests_user_date ON user_daily_quests(user_id, completed_at DESC);
CREATE INDEX idx_daily_entries_user_date ON daily_entries(user_id, entry_date DESC);
CREATE INDEX idx_daily_quest_templates_day ON daily_quest_templates(day_number);

-- RLS 설정
ALTER TABLE user_daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quest_templates ENABLE ROW LEVEL SECURITY;

-- Daily Quest Templates는 모두가 읽을 수 있음
CREATE POLICY "Anyone can view quest templates" ON daily_quest_templates
  FOR SELECT USING (true);

-- 사용자는 자신의 퀘스트 응답만 관리
CREATE POLICY "Users can view their own quest responses" ON user_daily_quests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quest responses" ON user_daily_quests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quest responses" ON user_daily_quests
  FOR UPDATE USING (auth.uid() = user_id);

-- 사용자는 자신의 일일 엔트리만 관리
CREATE POLICY "Users can view their own daily entries" ON daily_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily entries" ON daily_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily entries" ON daily_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 초기 365개 퀘스트 데이터 삽입
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

-- 나머지 335개 퀘스트는 실제 서비스에서 추가 예정
-- 여기서는 30개만 샘플로 추가

-- =====================================================
-- 유틸리티 함수: 사용자의 오늘 퀘스트 가져오기
-- =====================================================
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
  -- 사용자가 가입한 날짜 (또는 첫 퀘스트 날짜)
  SELECT DATE(created_at) INTO user_start_date
  FROM auth.users
  WHERE id = target_user_id;

  -- 가입일로부터 며칠 지났는지 계산
  days_since_start := DATE_PART('day', NOW() - user_start_date)::INTEGER;

  -- 365일 순환 (1~365)
  today_quest_day := (days_since_start % 365) + 1;

  -- 오늘의 퀘스트 가져오기
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

-- =====================================================
-- 유틸리티 함수: 월별 캘린더 데이터 가져오기
-- =====================================================
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

-- =====================================================
-- 트리거: 대화 요약/이미지 생성 시 daily_entries 자동 업데이트
-- =====================================================
CREATE OR REPLACE FUNCTION update_daily_entry_from_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- conversation_summaries 테이블에 요약이 생성되면 daily_entries에 반영
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

CREATE TRIGGER trigger_update_daily_entry
  AFTER INSERT ON conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_entry_from_summary();
