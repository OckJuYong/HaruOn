import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import NavBar from '../components/NavBar';
import Card from '../components/Card';
import { useApp } from '../context/AppProvider';
import { supabase } from '../services/supabaseApi';

// 감정 색상 매핑
const EMOTION_COLORS = {
  happiness: '#10b981', // green
  sadness: '#3b82f6', // blue
  anxiety: '#f59e0b', // amber
  anger: '#ef4444', // red
  neutral: '#6b7280', // gray
};

// 캘린더 컴포넌트
export default function Calendar() {
  const { user } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 월별 데이터 로드
  useEffect(() => {
    if (!user?.id) return;

    const loadCalendarData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_monthly_calendar_data', {
          target_user_id: user.id,
          target_year: currentYear,
          target_month: currentMonth,
        });

        if (error) throw error;
        setCalendarData(data || []);
      } catch (error) {
        console.error('Failed to load calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarData();
  }, [user, currentYear, currentMonth]);

  // 이전/다음 달로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth, 1));
  };

  // 해당 월의 일수 계산
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // 해당 월의 첫 번째 날의 요일 (0=일요일)
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // 날짜별 데이터 매핑
  const dataByDate = {};
  calendarData.forEach((entry) => {
    const date = new Date(entry.entry_date).getDate();
    dataByDate[date] = entry;
  });

  // 캘린더 그리드 생성
  const renderCalendar = () => {
    const days = [];
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - firstDay + 1;
      const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
      const dayData = isValidDay ? dataByDate[dayNumber] : null;

      // 주요 감정 색상 결정
      let emotionColor = '#f3f4f6'; // default gray
      if (dayData?.emotions) {
        const emotions = dayData.emotions;
        const maxEmotion = Object.keys(emotions).reduce((a, b) =>
          emotions[a] > emotions[b] ? a : b
        );
        emotionColor = EMOTION_COLORS[maxEmotion] || emotionColor;
      }

      days.push(
        <div
          key={i}
          onClick={() => isValidDay && dayData && setSelectedEntry(dayData)}
          style={{
            aspectRatio: '1',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 4,
            cursor: isValidDay && dayData ? 'pointer' : 'default',
            backgroundColor: isValidDay && dayData ? emotionColor : '#fafafa',
            opacity: isValidDay ? 1 : 0.3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.2s',
            ...(isValidDay && dayData && { ':hover': { transform: 'scale(1.05)' } }),
          }}
        >
          {isValidDay && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: dayData ? '#fff' : '#111' }}>
                {dayNumber}
              </div>
              {dayData?.image_url && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    marginTop: 4,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.5)',
                  }}
                >
                  <img
                    src={dayData.image_url}
                    alt="일기"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              {dayData?.has_quest && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#fbbf24',
                  }}
                />
              )}
            </>
          )}
        </div>
      );
    }

    return days;
  };

  // 모달: 일별 상세 정보
  const renderModal = () => {
    if (!selectedEntry) return null;

    const date = new Date(selectedEntry.entry_date);
    const emotions = selectedEntry.emotions || {};

    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedEntry(null);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: 16,
        }}
      >
        <div
          style={{
            width: 'min(600px, 96vw)',
            maxHeight: '86vh',
            backgroundColor: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: 16,
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, '0')}.
              {String(date.getDate()).padStart(2, '0')}
            </div>
            <button
              onClick={() => setSelectedEntry(null)}
              style={{
                border: 0,
                background: 'transparent',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          {/* 내용 */}
          <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
            {/* 이미지 */}
            {selectedEntry.image_url && (
              <img
                src={selectedEntry.image_url}
                alt="일기 이미지"
                style={{
                  width: '100%',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              />
            )}

            {/* 감정 분석 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>감정 분석</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.keys(emotions).map((emotion) => (
                  <div
                    key={emotion}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 16,
                      backgroundColor: EMOTION_COLORS[emotion] || '#6b7280',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  >
                    {emotion} {emotions[emotion]}%
                  </div>
                ))}
              </div>
            </div>

            {/* 요약 */}
            {selectedEntry.summary_text && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>하루 요약</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedEntry.summary_text}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <TopBar title="캘린더" />

      <main style={{ padding: 16 }}>
        {/* 월 선택 */}
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
            }}
          >
            <button
              onClick={goToPreviousMonth}
              style={{
                border: 0,
                background: 'transparent',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {currentYear}년 {currentMonth}월
            </div>
            <button
              onClick={goToNextMonth}
              style={{
                border: 0,
                background: 'transparent',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ›
            </button>
          </div>
        </Card>

        {/* 요일 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            marginBottom: 4,
          }}
        >
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>로딩 중...</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
            }}
          >
            {renderCalendar()}
          </div>
        )}

        {/* 범례 */}
        <Card style={{ marginTop: 16, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>감정 색상</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.keys(EMOTION_COLORS).map((emotion) => (
              <div key={emotion} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: EMOTION_COLORS[emotion],
                  }}
                />
                <span style={{ fontSize: 11 }}>{emotion}</span>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <NavBar />

      {/* 상세 모달 */}
      {renderModal()}
    </div>
  );
}
