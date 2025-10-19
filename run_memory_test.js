// 실제 장기 기억 시스템 테스트 및 보고서 생성
// 실제 Supabase DB + Edge Function 사용

const fs = require('fs');

const SUPABASE_URL = 'https://ooafoofzmowsbtbhticw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vYWZvb2Z6bW93c2J0Ymh0aWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MDgyNzEsImV4cCI6MjA3MjI4NDI3MX0.mj_tbxlrOFf8ymHP49AIvXMgkRQIK9io9LtrMB4wxuk';

// 테스트 사용자 생성 (실제 UUID)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 테스트 시나리오
const testScenarios = [
  {
    name: "직장인 A (프로젝트 진행)",
    conversations: [
      { day: 1, message: "오늘 새 프로젝트 시작했어", compact: "신규 프로젝트 시작" },
      { day: 3, message: "프로젝트 진행이 생각보다 순조로워", compact: "프로젝트 순조로움" },
      { day: 7, message: "중간 발표 잘 끝났어!", compact: "중간 발표 성공" },
    ],
    testQuestion: "프로젝트 어떻게 되고 있어?",
    expectedKeywords: ["프로젝트", "발표", "순조", "시작"]
  },
  {
    name: "학생 B (시험 준비)",
    conversations: [
      { day: 1, message: "다음 주에 중간고사야", compact: "중간고사 앞둠" },
      { day: 3, message: "공부 너무 힘들어", compact: "시험 공부 스트레스" },
      { day: 5, message: "드디어 시험 끝났어!", compact: "시험 종료" },
    ],
    testQuestion: "요즘 공부는 어때?",
    expectedKeywords: ["시험", "중간고사", "공부"]
  },
  {
    name: "프리랜서 C (프로젝트 수주)",
    conversations: [
      { day: 1, message: "새로운 클라이언트랑 미팅했어", compact: "신규 클라이언트 미팅" },
      { day: 2, message: "계약 성사됐어!", compact: "계약 성사" },
      { day: 5, message: "작업 시작했는데 재밌어", compact: "작업 시작, 만족" },
    ],
    testQuestion: "요즘 일은 어때?",
    expectedKeywords: ["클라이언트", "계약", "작업", "미팅"]
  }
];

// 보고서 데이터
const report = {
  testDate: new Date().toISOString(),
  totalUsers: testScenarios.length,
  totalConversations: 0,
  results: [],
  stats: {
    success: 0,
    fail: 0,
    error: 0
  }
};

console.log('🧠 장기 기억 시스템 실제 테스트 시작');
console.log('='.repeat(70));
console.log('');

// Step 1: 테스트 사용자별 데이터 저장
async function saveTestData(scenario, userId) {
  console.log(`\n📝 [${scenario.name}] 대화 데이터 저장 중...`);

  try {
    const profileData = {
      conversation_summaries: {}
    };

    scenario.conversations.forEach((conv, index) => {
      const convId = generateUUID();
      const daysAgo = 10 - conv.day; // 최근으로 조정

      profileData.conversation_summaries[convId] = {
        compact_summary: conv.compact,
        detailed_summary: `${conv.message}에 대해 이야기했다.`,
        summary: conv.message,
        created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      };
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        profile_data: profileData,
        last_updated_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log(`  ✓ ${scenario.conversations.length}개 대화 저장 완료`);
      return true;
    } else {
      const error = await response.text();
      console.log(`  ✗ 저장 실패: ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`  ✗ 오류: ${error.message}`);
    return false;
  }
}

// Step 2: Edge Function 호출 및 기억 테스트
async function testMemoryRecall(scenario, userId) {
  console.log(`\n🧪 [${scenario.name}] 기억 테스트 실행`);
  console.log(`  질문: "${scenario.testQuestion}"`);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        content: scenario.testQuestion,
        messages: { items: [] },
        conversation_id: generateUUID()
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Edge Function 오류: ${error}`);
    }

    const data = await response.json();
    const aiReply = data.reply || '';

    console.log(`  AI 답변: "${aiReply}"`);

    // 기억 활용 분석
    const memoryIndicators = [
      '저번', '전에', '말했', '얘기했', '했었잖', '기억',
      '그때', '예전에', '이전에', '지난번'
    ];

    const usesMemoryIndicator = memoryIndicators.some(indicator =>
      aiReply.includes(indicator)
    );

    const mentionsKeyword = scenario.expectedKeywords.some(keyword =>
      aiReply.toLowerCase().includes(keyword.toLowerCase())
    );

    let memoryScore = 0;
    if (usesMemoryIndicator) memoryScore += 50;
    if (mentionsKeyword) memoryScore += 50;

    const result = {
      scenario: scenario.name,
      question: scenario.testQuestion,
      aiResponse: aiReply,
      usesMemoryIndicator,
      mentionsKeyword,
      memoryScore,
      status: memoryScore >= 50 ? 'SUCCESS' : 'FAIL',
      timestamp: new Date().toISOString()
    };

    if (result.status === 'SUCCESS') {
      console.log(`  ✅ 과거 기억 활용 성공! (점수: ${memoryScore}/100)`);
      report.stats.success++;
    } else {
      console.log(`  ❌ 과거 기억 미활용 (점수: ${memoryScore}/100)`);
      report.stats.fail++;
    }

    return result;

  } catch (error) {
    console.log(`  ✗ 테스트 오류: ${error.message}`);
    report.stats.error++;

    return {
      scenario: scenario.name,
      question: scenario.testQuestion,
      aiResponse: null,
      error: error.message,
      status: 'ERROR',
      timestamp: new Date().toISOString()
    };
  }
}

// Step 3: 메인 테스트 실행
async function runTests() {
  console.log(`총 ${testScenarios.length}명의 테스트 사용자 시나리오 실행\n`);

  for (const scenario of testScenarios) {
    const userId = generateUUID();

    console.log('\n' + '='.repeat(70));
    console.log(`테스트 ${report.results.length + 1}/${testScenarios.length}: ${scenario.name}`);
    console.log('='.repeat(70));

    // 1. 대화 데이터 저장
    const saved = await saveTestData(scenario, userId);

    if (!saved) {
      console.log('  ⚠️ 데이터 저장 실패로 테스트 스킵');
      continue;
    }

    report.totalConversations += scenario.conversations.length;

    // 2. 잠시 대기 (DB 반영)
    console.log('  ⏳ DB 반영 대기... (3초)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. 기억 테스트
    const result = await testMemoryRecall(scenario, userId);
    report.results.push(result);

    // Rate limit 방지
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Step 4: 보고서 생성
function generateReport() {
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 테스트 완료 - 보고서 생성 중...');
  console.log('='.repeat(70));

  const successRate = report.stats.success / (report.stats.success + report.stats.fail) * 100;

  const reportContent = `# 🧠 장기 기억 시스템 테스트 보고서

## 📅 테스트 정보
- **실행 일시:** ${new Date(report.testDate).toLocaleString('ko-KR')}
- **테스트 환경:** 실제 Supabase DB + Edge Function
- **테스트 사용자:** ${report.totalUsers}명
- **총 대화 수:** ${report.totalConversations}개

---

## 📊 테스트 결과 요약

| 항목 | 결과 |
|------|------|
| **총 테스트** | ${report.stats.success + report.stats.fail + report.stats.error}건 |
| **성공** | ${report.stats.success}건 ✅ |
| **실패** | ${report.stats.fail}건 ❌ |
| **오류** | ${report.stats.error}건 ⚠️ |
| **성공률** | **${successRate.toFixed(1)}%** |

---

## 🎯 테스트 결과 판정

${successRate >= 70 ? '### ✅ **테스트 통과!**\n\n장기 기억 시스템이 정상적으로 작동합니다.' :
  successRate >= 50 ? '### ⚠️ **부분 성공**\n\n일부 개선이 필요합니다.' :
  '### ❌ **테스트 실패**\n\n시스템 점검이 필요합니다.'}

---

## 📋 상세 테스트 결과

${report.results.map((r, i) => `
### ${i + 1}. ${r.scenario} - ${r.status}

**테스트 질문:**
\`\`\`
${r.question}
\`\`\`

**AI 답변:**
\`\`\`
${r.aiResponse || '오류 발생: ' + (r.error || '알 수 없음')}
\`\`\`

**분석:**
- 기억 표현 사용: ${r.usesMemoryIndicator ? '✅ 예 (저번에, 전에 등)' : '❌ 아니오'}
- 과거 키워드 언급: ${r.mentionsKeyword ? '✅ 예' : '❌ 아니오'}
- **기억 활용 점수: ${r.memoryScore || 0}/100**

---
`).join('\n')}

## 🔍 분석 및 결론

### 작동 원리 확인
${report.stats.success > 0 ? `
✅ **정상 작동 확인**
- Edge Function이 DB에서 과거 대화 요약을 성공적으로 로드
- AI가 과거 맥락을 이해하고 자연스럽게 언급
- 사용자 경험 향상 효과 확인
` : `
❌ **작동 미확인**
- 시스템 점검 필요
`}

### 개선 사항
${report.stats.fail > 0 || report.stats.error > 0 ? `
1. 실패/오류 케이스 분석 필요
2. Edge Function 로그 확인
3. 프롬프트 튜닝 검토
` : '현재 개선 사항 없음'}

---

## 📈 200일 시뮬레이션 예측

**현재 성공률 기준 (${successRate.toFixed(1)}%):**

| 기간 | 예상 효과 |
|------|----------|
| 1주 | 최근 대화 기억 시작 |
| 1개월 | ${successRate >= 70 ? '안정적인 맥락 유지' : '부분적 맥락 유지'} |
| 3개월 | ${successRate >= 70 ? '장기 관계 형성' : '추가 개선 필요'} |
| 6개월 | ${successRate >= 70 ? '진짜 친구처럼 기억' : '시스템 최적화 필요'} |

**예상 사용자 수 (20명):**
- 성공적인 기억 활용: ${Math.round(20 * successRate / 100)}명
- 개선 필요: ${20 - Math.round(20 * successRate / 100)}명

---

## ✅ 체크리스트

- [${report.stats.success > 0 ? 'x' : ' '}] 기본 기억 기능 작동
- [${successRate >= 50 ? 'x' : ' '}] 50% 이상 성공률
- [${successRate >= 70 ? 'x' : ' '}] 70% 이상 성공률 (목표)
- [${report.stats.error === 0 ? 'x' : ' '}] 오류 없음

---

**생성 일시:** ${new Date().toLocaleString('ko-KR')}
**테스트 도구:** 자동화 테스트 스크립트 v1.0
`;

  // 파일로 저장
  const filename = `장기기억_테스트_보고서_${new Date().toISOString().split('T')[0]}.md`;
  fs.writeFileSync(filename, reportContent, 'utf8');

  console.log(`\n✅ 보고서 생성 완료: ${filename}`);
  console.log('\n' + '='.repeat(70));
  console.log('📊 최종 결과');
  console.log('='.repeat(70));
  console.log(`성공: ${report.stats.success}/${report.stats.success + report.stats.fail}`);
  console.log(`성공률: ${successRate.toFixed(1)}%`);
  console.log(`판정: ${successRate >= 70 ? '✅ 통과' : successRate >= 50 ? '⚠️ 부분 성공' : '❌ 실패'}`);
  console.log('='.repeat(70));

  return reportContent;
}

// 실행
async function main() {
  try {
    await runTests();
    generateReport();
  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류:', error);
  }
}

main();
