-- 사용자별 학습 데이터 테이블
CREATE TABLE IF NOT EXISTS user_learning_data (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 인덱스 추가
  INDEX idx_user_learning_data_user_id (user_id),
  INDEX idx_user_learning_data_created_at (created_at)
);

-- user_profiles 테이블에 personalization_data 컬럼이 없다면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'personalization_data'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN personalization_data JSONB DEFAULT '{}';
    END IF;
END $$;

-- RLS (Row Level Security) 설정
ALTER TABLE user_learning_data ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 학습 데이터만 조회/수정 가능
CREATE POLICY "Users can view their own learning data" ON user_learning_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning data" ON user_learning_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning data" ON user_learning_data
  FOR UPDATE USING (auth.uid() = user_id);

-- user_profiles 테이블 RLS 정책 추가 (없다면)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" ON user_profiles
          FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" ON user_profiles
          FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 성능을 위한 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_personalization_data 
  ON user_profiles USING GIN (personalization_data);

-- 학습 통계 조회를 위한 함수
CREATE OR replace FUNCTION get_user_learning_summary(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_learning_sessions', COUNT(*),
    'latest_session', MAX(created_at),
    'avg_quality_score', AVG((learning_data->>'quality_metrics')::jsonb->>'overall_quality'::text)::numeric),
    'learning_trend', CASE 
      WHEN COUNT(*) >= 10 THEN 'advanced'
      WHEN COUNT(*) >= 5 THEN 'intermediate'
      ELSE 'beginner'
    END
  ) INTO result
  FROM user_learning_data 
  WHERE user_id = target_user_id 
    AND created_at >= NOW() - INTERVAL '30 days';
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자가 자신의 학습 요약 조회 권한
GRANT EXECUTE ON FUNCTION get_user_learning_summary(UUID) TO authenticated;