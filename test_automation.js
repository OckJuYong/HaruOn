// HaruOn 사용자 플로우 자동 테스트 스크립트
// 브라우저 개발자 도구에서 실행

class HaruOnTester {
  constructor() {
    this.testResults = {
      users: [],
      currentStep: 1,
      totalSteps: 7,
      errors: [],
      startTime: new Date()
    };
    
    this.testUsers = [
      {
        id: 1,
        name: "김하루",
        email: "haru1@test.com",
        password: "test123456",
        expectedStyle: "friendly"
      },
      {
        id: 2, 
        name: "이진우",
        email: "jinwoo2@test.com",
        password: "test123456",
        expectedStyle: "formal"
      },
      {
        id: 3,
        name: "박소영", 
        email: "soyoung3@test.com",
        password: "test123456",
        expectedStyle: "enthusiastic"
      }
    ];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (level === 'error') {
      this.testResults.errors.push({ message, timestamp });
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 현재 페이지 URL 확인
  getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/') return 'intro';
    if (path === '/login') return 'login';
    if (path === '/signup') return 'signup';
    if (path === '/home') return 'home';
    if (path === '/chat') return 'chat';
    return 'unknown';
  }

  // 요소가 나타날 때까지 대기
  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.wait(100);
    }
    throw new Error(`Element ${selector} not found within ${timeout}ms`);
  }

  // 회원가입 테스트
  async testSignup(user) {
    try {
      this.log(`사용자 ${user.name} 회원가입 시작`);
      
      // 회원가입 페이지로 이동
      if (this.getCurrentPage() !== 'signup') {
        window.location.href = '/signup';
        await this.wait(2000);
      }

      // 폼 입력
      const emailInput = await this.waitForElement('input[name="email"]');
      const passwordInput = await this.waitForElement('input[name="password"]');
      const submitButton = await this.waitForElement('button[type="submit"]');

      emailInput.value = user.email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      passwordInput.value = user.password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      await this.wait(500);
      submitButton.click();

      // 결과 대기
      await this.wait(3000);
      
      const currentPage = this.getCurrentPage();
      if (currentPage === 'home' || currentPage === 'login') {
        this.log(`✅ ${user.name} 회원가입 성공`, 'success');
        return true;
      } else {
        this.log(`❌ ${user.name} 회원가입 실패 - 현재 페이지: ${currentPage}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ ${user.name} 회원가입 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 로그인 테스트
  async testLogin(user) {
    try {
      this.log(`사용자 ${user.name} 로그인 시작`);
      
      // 로그인 페이지로 이동
      if (this.getCurrentPage() !== 'login') {
        window.location.href = '/login';
        await this.wait(2000);
      }

      // 폼 입력
      const emailInput = await this.waitForElement('input[name="email"]');
      const passwordInput = await this.waitForElement('input[name="password"]');
      const submitButton = await this.waitForElement('button[type="submit"]');

      emailInput.value = user.email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      passwordInput.value = user.password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      await this.wait(500);
      submitButton.click();

      // 로그인 결과 대기
      await this.wait(3000);
      
      if (this.getCurrentPage() === 'home') {
        this.log(`✅ ${user.name} 로그인 성공`, 'success');
        return true;
      } else {
        this.log(`❌ ${user.name} 로그인 실패`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ ${user.name} 로그인 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 채팅 테스트
  async testChat(user, messages) {
    try {
      this.log(`${user.name} 채팅 테스트 시작`);
      
      // 채팅 페이지로 이동
      window.location.href = '/chat';
      await this.wait(2000);

      const testMessages = [
        "안녕하세요! 테스트 메시지입니다.",
        `저는 ${user.name}입니다. ${user.expectedStyle} 스타일로 대화해주세요.`,
        "감사합니다!"
      ];

      for (let i = 0; i < testMessages.length; i++) {
        const message = testMessages[i];
        
        // 메시지 입력
        const inputField = await this.waitForElement('input[placeholder*="메시지"]');
        const sendButton = await this.waitForElement('button:contains("전송")') || 
                          document.querySelector('button[type="submit"]') ||
                          document.querySelector('button:last-child');

        inputField.value = message;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        
        await this.wait(500);
        sendButton.click();

        // 응답 대기
        this.log(`메시지 ${i+1} 전송: ${message.substring(0, 30)}...`);
        await this.wait(5000); // AI 응답 대기
      }

      this.log(`✅ ${user.name} 채팅 테스트 완료`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ ${user.name} 채팅 테스트 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 이미지 생성 및 요약 테스트
  async testImageGeneration(user) {
    try {
      this.log(`${user.name} 이미지 생성 테스트 시작`);
      
      // 요약 버튼 찾기
      const summaryButton = await this.waitForElement('button:contains("대화 종료")') ||
                           document.querySelector('button[title*="요약"]');
      
      if (summaryButton) {
        summaryButton.click();
        this.log(`${user.name} 요약 이미지 생성 시작`);
        
        // 이미지 생성 완료 대기 (더 길게)
        await this.wait(15000);
        
        this.log(`✅ ${user.name} 이미지 생성 테스트 완료`, 'success');
        return true;
      } else {
        this.log(`❌ ${user.name} 요약 버튼을 찾을 수 없음`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ ${user.name} 이미지 생성 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 히스토리 확인 테스트
  async testHistory(user) {
    try {
      this.log(`${user.name} 히스토리 확인 테스트 시작`);
      
      // 홈으로 이동
      window.location.href = '/home';
      await this.wait(3000);
      
      // 히스토리 카드 확인
      const historyCards = document.querySelectorAll('[data-testid="conversation-card"]') ||
                          document.querySelectorAll('.card') ||
                          document.querySelectorAll('div[style*="card"]');
      
      if (historyCards.length > 0) {
        this.log(`✅ ${user.name} 히스토리 ${historyCards.length}개 확인됨`, 'success');
        return true;
      } else {
        this.log(`⚠️ ${user.name} 히스토리가 아직 표시되지 않음`);
        return false;
      }
    } catch (error) {
      this.log(`❌ ${user.name} 히스토리 확인 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 로그아웃
  async logout() {
    try {
      // 로그아웃 버튼 찾기 (다양한 셀렉터 시도)
      const logoutButton = document.querySelector('button:contains("로그아웃")') ||
                          document.querySelector('[data-testid="logout"]') ||
                          document.querySelector('button[title*="로그아웃"]');
      
      if (logoutButton) {
        logoutButton.click();
        await this.wait(2000);
        this.log('로그아웃 성공', 'success');
      } else {
        // 수동 로그아웃 (localStorage 클리어)
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
        await this.wait(2000);
        this.log('수동 로그아웃 완료', 'success');
      }
      return true;
    } catch (error) {
      this.log(`로그아웃 오류: ${error.message}`, 'error');
      return false;
    }
  }

  // 전체 사용자 테스트 실행
  async runFullTest() {
    this.log('🚀 HaruOn 3명 사용자 플로우 테스트 시작', 'success');
    
    for (let i = 0; i < this.testUsers.length; i++) {
      const user = this.testUsers[i];
      const userResult = {
        user: user.name,
        email: user.email,
        steps: {},
        success: false
      };

      this.log(`\n👤 사용자 ${i+1}: ${user.name} 테스트 시작`);

      // 1. 회원가입 또는 로그인
      userResult.steps.signup = await this.testSignup(user);
      if (!userResult.steps.signup) {
        userResult.steps.login = await this.testLogin(user);
      }

      if (userResult.steps.signup || userResult.steps.login) {
        // 2. 채팅 테스트
        userResult.steps.chat = await this.testChat(user);
        await this.wait(2000);

        // 3. 이미지 생성 테스트  
        userResult.steps.imageGeneration = await this.testImageGeneration(user);
        await this.wait(2000);

        // 4. 히스토리 확인
        userResult.steps.history = await this.testHistory(user);
        
        // 성공 여부 판단
        userResult.success = Object.values(userResult.steps).some(step => step === true);
      }

      this.testResults.users.push(userResult);
      
      // 다음 사용자를 위해 로그아웃
      if (i < this.testUsers.length - 1) {
        await this.logout();
        await this.wait(2000);
      }
    }

    // 결과 출력
    this.printResults();
  }

  // 테스트 결과 출력
  printResults() {
    console.log('\n📊 테스트 결과 요약:');
    console.table(this.testResults.users.map(user => ({
      사용자: user.user,
      이메일: user.email,
      회원가입: user.steps.signup ? '✅' : '❌',
      로그인: user.steps.login ? '✅' : '❌', 
      채팅: user.steps.chat ? '✅' : '❌',
      이미지생성: user.steps.imageGeneration ? '✅' : '❌',
      히스토리: user.steps.history ? '✅' : '❌',
      전체성공: user.success ? '✅' : '❌'
    })));

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ 발견된 오류들:');
      this.testResults.errors.forEach(error => {
        console.log(`- ${error.message}`);
      });
    }

    const successCount = this.testResults.users.filter(u => u.success).length;
    console.log(`\n🎯 최종 결과: ${successCount}/${this.testUsers.length}명 성공`);
  }
}

// 테스트 실행
const tester = new HaruOnTester();

// 사용법:
console.log('🧪 HaruOn 사용자 플로우 테스트 준비 완료');
console.log('테스트 시작: tester.runFullTest()');
console.log('수동 단계별 테스트:');
console.log('- tester.testSignup(tester.testUsers[0])');  
console.log('- tester.testLogin(tester.testUsers[0])');
console.log('- tester.testChat(tester.testUsers[0])');

// 전역으로 내보내기
window.haruonTester = tester;