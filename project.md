# HaruOn 프로젝트 분석 및 Supabase 이전 계획

## 프로젝트 개요
**HaruOn**은 React 기반의 PWA(Progressive Web App)로, AI 채팅과 이미지 생성 기능을 제공하는 애플리케이션입니다.

## 현재 아키텍처

### 프론트엔드 (React App)
- **기술 스택**: React 18.3.1, React Router DOM 6.26.2, Create React App
- **위치**: 현재 디렉토리 (`/mnt/d/google/a1/ok/`)
- **주요 기능**:
  - 채팅 인터페이스
  - 대화방 생성 및 관리
  - 이미지 생성 요청
  - PWA 지원 (오프라인, 설치 가능)

### 백엔드 API (현재 운영 중)
- **서버 URL**: `http://54.180.8.10`
- **기술**: FastAPI (Uvicorn 서버)
- **API 문서**: `http://54.180.8.10/docs` (Swagger UI)

## API 구조 분석

### 엔드포인트 목록
```
GET  /healthz                              # 서버 상태 확인
POST /v1/conversations                     # 대화방 생성
GET  /v1/conversations                     # 대화방 목록 조회
GET  /v1/conversations/{conversation_id}   # 특정 대화방 조회
DELETE /v1/conversations/{conversation_id} # 대화방 삭제
GET  /v1/conversations/{conversation_id}/messages # 메시지 목록
POST /v1/chat                             # 채팅 메시지 전송
POST /v1/images                           # AI 이미지 생성
```

### 데이터 모델

#### Conversation
```typescript
interface Conversation {
  id: string;
  user_id?: string | null;
  title?: string | null;
}
```

#### Message
```typescript
interface Message {
  id: string;
  conversation_id: string;
  role: string;           // 'user' | 'assistant'
  content: string;
  created_at: string;     // ISO datetime
}
```

#### Chat Request/Response
```typescript
interface ChatRequest {
  conversation_id?: string | null;
  user_id?: string | null;
  content: string;
}

interface ChatResponse {
  conversation_id: string;
  assistant: string;
}
```

#### Image Request/Response
```typescript
interface ImageRequest {
  conversation_id?: string | null;
  prompt: string;
}

interface ImageResponse {
  id: string;
  image_path: string;
  image_url: string;
}
```

## 프론트엔드 구조

### 디렉토리 구조
```
src/
├── api/           # API 통신 로직 (api.js)
├── components/    # 재사용 컴포넌트 (Button, Card, NavBar, TopBar)
├── context/       # React Context (AppProvider.js)
├── pages/         # 페이지 컴포넌트
│   ├── Intro.js   # 인트로 페이지
│   ├── Home.js    # 홈 페이지
│   ├── History.js # 기록 페이지
│   ├── Chat.js    # 채팅 페이지
│   └── Profile.js # 프로필 페이지
├── User/          # 사용자 인증
│   ├── Login/     # 로그인 컴포넌트
│   └── SignUp/    # 회원가입 컴포넌트
├── utils/         # 유틸리티 함수
├── App.js         # 라우팅 설정
└── main.js        # 앱 진입점
```

### 라우팅 구조
```javascript
/                  → Redirect to /intro
/intro            → Intro 페이지
/Login            → 로그인 페이지
/Signup           → 회원가입 페이지
/home             → 홈 페이지 (대화방 생성)
/history          → 기록 페이지
/chat             → 채팅 페이지
/profile          → 프로필 페이지
```

## 백엔드 코드 분석 (로컬 클론)

### 클론된 백엔드 (`backend/` 폴더)
- **실제 구조**: 단순 OpenAI API 프록시
- **엔드포인트**: 
  - `/api/chat` - OpenAI GPT-3.5 채팅
  - `/api/generate-image` - DALL-E 이미지 생성
- **특징**: 데이터베이스 없음, 순수 프록시 서버
- **⚠️ 주의**: 실제 운영 서버와 완전히 다름!

### 운영 중인 백엔드 (54.180.8.10)
- **실제 구조**: 완전한 대화방 관리 시스템
- **데이터베이스**: MySQL (추정)
- **기능**: 대화방 생성/삭제, 메시지 저장, AI 통합

## Supabase 이전 계획

### Supabase 프로젝트 정보
- **Project URL**: `https://wepqznshjvxwuncqzxoz.supabase.co`
- **Project ID**: `wepqznshjvxwuncqzxoz`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcHF6bnNoanZ4d3VuY3F6eG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MjAyNjAsImV4cCI6MjA3MjE5NjI2MH0.E7TcNSaQXEY6Gx7VFZJRBmD3fMCLAGMAtbXMARxRZIc`

### 데이터베이스 스키마 설계 (PostgreSQL)

#### conversations 테이블
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### messages 테이블
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### images 테이블 (선택사항)
```sql
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_path TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 선택된 이전 전략: 완전한 Supabase 이전

**결정 근거:**
- SQLite → PostgreSQL 변경이 필요한 상황에서 서버리스 아키텍처로 전환하는 것이 효율적
- MVP 단계의 단순한 구조로 전체 이전의 복잡성이 관리 가능한 수준
- 장기적으로 서버 운영비 절감 및 자동 확장성 확보
- 현대적인 JAMstack 패턴으로 성능 및 보안 향상

**구현 방식:**
1. **Database**: Supabase PostgreSQL로 테이블 생성
2. **API**: Edge Functions로 모든 엔드포인트 구현
3. **Frontend**: Supabase JavaScript Client 직접 연동
4. **Authentication**: 향후 Supabase Auth 활용 (현재는 익명 사용자)
5. **Storage**: 이미지를 Supabase Storage에 저장

### 주요 우려사항 및 해결책

#### 1. Edge Functions 성능 제약
**우려사항:**
- OpenAI API 호출 시간 + 25초 제한
- Cold start 지연
- 스트리밍 응답 복잡성

**해결책:**
- OpenAI API 평균 응답시간 5-15초로 제한 내 처리 가능
- 함수 분리로 Keep-alive 패턴 적용
- 긴 응답은 청킹해서 여러 번 처리

#### 2. 디버깅 및 개발 환경
**우려사항:**
- Edge Functions 디버깅 어려움
- 로그 추적 불편
- 로컬 테스트 환경 구축

**해결책:**
- Supabase CLI로 로컬 개발 환경 구축 (`supabase start`)
- 상세 로깅 및 에러 트래킹 구현
- 단위별 함수 분리로 테스트 용이성 확보

#### 3. 비용 관리
**우려사항:**
- Edge Functions 실행 횟수별 과금
- 예상치 못한 비용 발생
- OpenAI + Supabase 이중 과금

**해결책:**
- 무료 티어 활용 (월 50만 DB 요청, Edge Functions 500K 실행)
- 사용량 모니터링 및 알림 설정
- 캐싱 전략으로 불필요한 API 호출 최소화

#### 4. 데이터 이관 리스크
**우려사항:**
- SQLite → PostgreSQL 타입 호환성
- 기존 데이터 손실
- API 응답 형식 변경

**해결책:**
- 현재 데이터 규모가 작아 수동 이관 가능
- 기존 API 응답 형식 완전 호환 유지
- 백업 계획 및 롤백 시나리오 준비

## 단계별 이전 계획 (2주 타임박스)

### Week 1: 기반 구축 및 핵심 기능
**목표**: Database + 기본 CRUD + 채팅 기능

#### Day 1-2: 환경 설정
- [x] Supabase 프로젝트 정보 확보
- [ ] Supabase CLI 설치 및 로컬 환경 구축
- [ ] PostgreSQL 테이블 생성 (conversations, messages)
- [ ] 프론트엔드 Supabase 클라이언트 설정

#### Day 3-4: 기본 CRUD
- [ ] conversations CRUD Edge Functions 구현
- [ ] messages 조회 Edge Functions 구현
- [ ] 프론트엔드 API 호출 로직 수정 (conversations)
- [ ] 기본 기능 테스트 및 검증

#### Day 5-7: 채팅 기능
- [ ] OpenAI API 키 설정 (Edge Functions)
- [ ] 채팅 Edge Function 구현 (`/v1/chat`)
- [ ] 채팅 페이지 Supabase 연동
- [ ] 실시간 메시지 표시 구현

### Week 2: 이미지 생성 및 최적화
**목표**: 이미지 생성 + Storage + 최적화

#### Day 8-10: 이미지 기능
- [ ] Supabase Storage 버킷 생성
- [ ] 이미지 생성 Edge Function 구현 (`/v1/images`)
- [ ] 이미지 업로드 및 URL 생성 로직
- [ ] 프론트엔드 이미지 기능 연동

#### Day 11-12: 성능 최적화
- [ ] Edge Functions 성능 튜닝
- [ ] 캐싱 전략 구현
- [ ] 에러 처리 및 로깅 강화
- [ ] 사용량 모니터링 설정

#### Day 13-14: 테스트 및 배포
- [ ] 전체 기능 통합 테스트
- [ ] 성능 및 안정성 검증
- [ ] 프로덕션 배포
- [ ] 사용자 피드백 수집 준비

### 백업 및 롤백 계획

#### 리스크 관리
- **기존 백엔드 서버 유지**: 2주간 병렬 운영
- **데이터 백업**: 매일 PostgreSQL 백업
- **단계별 검증**: 각 기능 완성 후 충분한 테스트
- **롤백 시나리오**: 문제 발생시 기존 서버로 즉시 복귀

#### 성공 지표
- **기능**: 모든 API 엔드포인트 정상 동작
- **성능**: 응답시간 기존 대비 유사 수준 유지
- **안정성**: 24시간 무중단 서비스
- **비용**: 무료 티어 내에서 운영

### 모니터링 계획

#### 실시간 모니터링
- **Supabase 대시보드**: DB 성능, Edge Functions 실행 상태
- **사용량 추적**: API 호출 횟수, 데이터 전송량
- **에러 모니터링**: 실시간 에러 알림 및 로그 분석
- **비용 추적**: 일일 사용량 및 예상 비용 모니터링

## 참고사항
- 현재 프론트엔드는 `user_id: null`로 동작 (로그인 미구현)
- 이미지는 localStorage에 URL만 저장 중
- PWA 매니페스트는 기본 Create React App 설정 사용
- CORS는 모든 Origin 허용으로 설정됨 (`allow_origins: ["*"]`)

## 누락부분

누락된 부분 확인

  1. OpenAI API 키 관리 🔑

  누락: Edge Functions에서 OpenAI API 키를 어떻게 안전하게 관리할지     
  명시되지 않음

  추가 필요:
  - Supabase Vault (비밀 관리) 또는 Edge Functions 환경변수 설정
  - 키 보안 및 로테이션 계획

  2. 데이터베이스 스키마의 API 호환성 📊

  누락: 현재 API가 string ID를 사용하는데, 스키마에서는 UUID 사용

  확인 필요:
  -- 현재 API: id가 string
  -- 계획된 스키마: UUID
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()

  3. 실시간 기능 구현 방식 ⚡

  누락: "실시간 메시지 표시"가 계획에 있지만 구체적 방식 미명시

  추가 필요:
  - Supabase Realtime 구독 설정
  - 채팅 메시지 실시간 동기화 로직

  4. 배포 및 도메인 설정 🌐

  누락:
  - 현재 54.180.8.10에서 새로운 도메인으로 어떻게 전환할지
  - 프론트엔드 배포 방식 (Vercel, Netlify, Supabase Hosting 등)

  5. 이미지 저장 전략 🖼️

  부분 누락:
  - 현재: localStorage에 URL만 저장
  - 계획: Supabase Storage 사용
  - 누락: 기존 이미지 데이터 이관 방법

  6. healthz 엔드포인트 🏥

  누락: /healthz 엔드포인트를 Edge Function으로 구현할지, 아니면        
  Supabase 자체 상태를 확인할지 명시되지 않음

  수정이 필요한 부분

  user_id 처리 방식

  현재 계획: user_id UUID REFERENCES auth.users(id)실제 상황: 로그인    
   미구현, user_id: null 사용

  수정 필요:
  user_id UUID REFERENCES auth.users(id) NULL, -- NULL 허용으로 변경    

  확인 질문

  1. OpenAI API 키는 어떻게 제공하시겠습니까?
  2. 도메인 전환 계획이 있으신가요? (54.180.8.10 → 새 도메인)
  3. 프론트엔드 배포는 어디서 하시겠습니까?
  (Vercel/Netlify/Supabase)
