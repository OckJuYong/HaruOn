// 장기 기억 시스템 자동 테스트 스크립트
// 사용법: node test_memory_system.js

const SUPABASE_URL = 'https://ooafoofzmowsbtbhticw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYWZvb2Z6bW93c2J0Ymh0aWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MDgyNzEsImV4cCI6MjA3MjI4NDI3MX0.mj_tbxlrOFf8ymHP49AIvXMgkRQIK9io9LtrMB4wxuk';

// 200일간의 시나리오 (실제 사용자 대화 패턴)
const scenarios = [
  { day: 1, user: "오늘 새로운 회사에 첫 출근했어", compact: "첫 출근, 긴장됨" },
  { day: 3, user: "첫 프로젝트 배정받았는데 떨려", compact: "새 프로젝트 시작, 부담됨" },
  { day: 5, user: "프로젝트가 생각보다 어려워", compact: "프로젝트 난이도 높음, 고민" },
  { day: 7, user: "동료들이 생각보다 친절해서 다행이야", compact: "동료들 친절, 적응 중" },
  { day: 10, user: "주말에 휴식 취하니까 좀 나아진 것 같아", compact: "휴식 후 회복" },
  { day: 14, user: "프로젝트 중간 발표 잘 끝났어!", compact: "발표 성공, 뿌듯함" },
  { day: 20, user: "팀장님이 칭찬해주셨어", compact: "팀장 칭찬, 기쁨" },
  { day: 30, user: "한 달 차 드디어 적응된 것 같아", compact: "적응 완료, 자신감" },
  { day: 45, user: "팀장님이 승진 제안했어", compact: "승진 제안받음" },
  { day: 60, user: "승진 결정했어! 다음 달부터 팀리더", compact: "승진 확정, 기대됨" },
  { day: 75, user: "리더 역할이 생각보다 어렵네", compact: "리더 역할 부담" },
  { day: 90, user: "팀리더 3개월 차, 생각보다 힘들다", compact: "리더 역할 스트레스" },
  { day: 100, user: "팀원들과 소통이 잘 안 돼", compact: "팀 소통 문제" },
  { day: 120, user: "팀원이랑 갈등 생겨서 스트레스야", compact: "팀 갈등, 스트레스" },
  { day: 140, user: "갈등 해결 방법을 찾고 있어", compact: "갈등 해결 모색 중" },
  { day: 150, user: "갈등 해결했어! 솔직하게 대화했더니", compact: "갈등 해결, 후련함" },
  { day: 170, user: "팀 분위기가 많이 좋아졌어", compact: "팀 분위기 개선" },
  { day: 180, user: "연말 평가 A등급 받았어", compact: "평가 우수, 보람" },
  { day: 190, user: "내년 목표 설정하고 있어", compact: "새 목표 계획" },
  { day: 200, user: "1년 회고하니 정말 많이 성장했어", compact: "1년 성장, 감회" }
];

console.log('🧠 장기 기억 시스템 테스트 시작\n');
console.log('=' .repeat(60));

// Step 1: 테스트 데이터 생성
async function generateTestData() {
  console.log('\n📝 Step 1: 테스트 데이터 생성');
  console.log('-'.repeat(60));

  const testUsers = [];
  const totalUsers = 20;
  const conversationsPerUser = scenarios.length;

  for (let i = 1; i <= totalUsers; i++) {
    const userId = `test-user-${i}`;
    const userConversations = scenarios.map(scenario => ({
      user_id: userId,
      day: scenario.day,
      user_message: scenario.user,
      compact_summary: scenario.compact,
      detailed_summary: `나는 ${scenario.user}. ${scenario.compact}를 느꼈다.`,
      created_at: new Date(Date.now() - (200 - scenario.day) * 24 * 60 * 60 * 1000).toISOString()
    }));

    testUsers.push({
      user_id: userId,
      conversations: userConversations
    });
  }

  console.log(`✓ ${totalUsers}명의 사용자 생성`);
  console.log(`✓ 각 사용자당 ${conversationsPerUser}개 대화`);
  console.log(`✓ 총 ${totalUsers * conversationsPerUser}개 대화 생성`);

  return testUsers;
}

// Step 2: Supabase에 저장
async function saveToSupabase(testUsers) {
  console.log('\n💾 Step 2: Supabase에 데이터 저장');
  console.log('-'.repeat(60));

  let successCount = 0;
  let errorCount = 0;

  for (const user of testUsers) {
    try {
      // profile_data 구조 생성
      const profileData = {
        conversation_summaries: {}
      };

      user.conversations.forEach((conv, index) => {
        const convId = `conv-${user.user_id}-day${conv.day}`;
        profileData.conversation_summaries[convId] = {
          compact_summary: conv.compact_summary,
          detailed_summary: conv.detailed_summary,
          summary: conv.detailed_summary,
          created_at: conv.created_at
        };
      });

      // Supabase에 저장
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: user.user_id,
          profile_data: profileData,
          last_updated_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        successCount++;
        console.log(`✓ ${user.user_id}: ${user.conversations.length}개 대화 저장 완료`);
      } else {
        errorCount++;
        const error = await response.text();
        console.log(`✗ ${user.user_id}: 저장 실패 - ${error}`);
      }

      // API Rate Limit 방지
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      errorCount++;
      console.log(`✗ ${user.user_id}: 오류 - ${error.message}`);
    }
  }

  console.log(`\n결과: 성공 ${successCount}/${testUsers.length}, 실패 ${errorCount}/${testUsers.length}`);
  return { successCount, errorCount };
}

// Step 3: 장기 기억 테스트
async function testLongTermMemory() {
  console.log('\n🧪 Step 3: 장기 기억 기능 테스트');
  console.log('-'.repeat(60));

  const testCases = [
    {
      user_id: 'test-user-1',
      message: '오늘도 회사 잘 다녀왔어',
      expected_keywords: ['출근', '회사', '프로젝트', '적응'],
      description: '초기 출근 기억 확인'
    },
    {
      user_id: 'test-user-5',
      message: '프로젝트 진행은 어때?',
      expected_keywords: ['발표', '성공', '칭찬'],
      description: '프로젝트 관련 과거 기억'
    },
    {
      user_id: 'test-user-10',
      message: '요즘 회사 생활 어때?',
      expected_keywords: ['승진', '리더', '팀장'],
      description: '승진 관련 과거 기억'
    },
    {
      user_id: 'test-user-15',
      message: '힘든 일 있었는데 기억나?',
      expected_keywords: ['갈등', '스트레스', '해결'],
      description: '갈등 해결 과정 기억'
    },
    {
      user_id: 'test-user-20',
      message: '한 해 마무리 어떻게 했어?',
      expected_keywords: ['평가', 'A등급', '성장', '목표'],
      description: '연말 평가 및 성장 기억'
    }
  ];

  let passCount = 0;
  let failCount = 0;
  const results = [];

  for (const testCase of testCases) {
    console.log(`\n테스트: ${testCase.description}`);
    console.log(`  사용자: ${testCase.user_id}`);
    console.log(`  질문: "${testCase.message}"`);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          user_id: testCase.user_id,
          content: testCase.message,
          messages: { items: [] },
          conversation_id: `test-conv-${Date.now()}`
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API 오류: ${error}`);
      }

      const data = await response.json();
      const aiReply = data.reply || '';

      console.log(`  AI 답변: "${aiReply.substring(0, 100)}..."`);

      // 과거 기억 언급 여부 확인
      const memoryIndicators = [
        '저번에', '전에', '말했', '얘기했', '했었잖', '기억',
        '그때', '그 때', '예전에', '이전에'
      ];

      const mentionsMemory = memoryIndicators.some(indicator =>
        aiReply.includes(indicator)
      );

      const mentionsKeyword = testCase.expected_keywords.some(keyword =>
        aiReply.toLowerCase().includes(keyword.toLowerCase())
      );

      if (mentionsMemory || mentionsKeyword) {
        passCount++;
        console.log(`  ✓ 과거 기억 활용 성공!`);
        if (mentionsMemory) console.log(`    - 기억 언급: 발견`);
        if (mentionsKeyword) console.log(`    - 관련 키워드: 발견`);

        results.push({
          ...testCase,
          status: 'PASS',
          reply: aiReply
        });
      } else {
        failCount++;
        console.log(`  ✗ 과거 기억 미활용`);
        results.push({
          ...testCase,
          status: 'FAIL',
          reply: aiReply
        });
      }

      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      failCount++;
      console.log(`  ✗ 테스트 실패: ${error.message}`);
      results.push({
        ...testCase,
        status: 'ERROR',
        error: error.message
      });
    }
  }

  return { passCount, failCount, results };
}

// 메인 실행
async function main() {
  try {
    // Step 1: 데이터 생성
    const testUsers = await generateTestData();

    // Step 2: DB 저장
    const saveResult = await saveToSupabase(testUsers);

    if (saveResult.successCount === 0) {
      console.log('\n❌ 데이터 저장에 실패했습니다. 테스트를 중단합니다.');
      return;
    }

    // 잠시 대기 (DB 반영 시간)
    console.log('\n⏳ DB 반영 대기 중... (5초)');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: 기억 테스트
    const testResult = await testLongTermMemory();

    // 최종 결과
    console.log('\n' + '='.repeat(60));
    console.log('📊 최종 테스트 결과');
    console.log('='.repeat(60));
    console.log(`\n데이터 생성: ${testUsers.length}명의 사용자, ${testUsers.length * scenarios.length}개 대화`);
    console.log(`DB 저장: 성공 ${saveResult.successCount}/${testUsers.length}`);
    console.log(`기억 테스트: 성공 ${testResult.passCount}/${testResult.passCount + testResult.failCount}`);

    if (testResult.passCount > testResult.failCount) {
      console.log('\n✅ 장기 기억 시스템이 정상적으로 작동합니다!');
    } else {
      console.log('\n⚠️ 장기 기억 시스템에 문제가 있을 수 있습니다.');
    }

    console.log('\n상세 결과:');
    testResult.results.forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.description} - ${result.status}`);
      if (result.reply) {
        console.log(`   답변: ${result.reply.substring(0, 80)}...`);
      }
    });

  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류:', error);
  }
}

// 실행
main();
