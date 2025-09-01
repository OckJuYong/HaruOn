# HaruOn Supabase 이전 실행 계획서

## 🎯 목표
기존 서버(54.180.8.10)의 모든 기능을 **동일한 수준**으로 Supabase로 이전

## 📋 사전 준비사항
- [x] Supabase 프로젝트 생성 완료
- [x] OpenAI API 키 확보 (보안 저장 필요)
- [ ] 기존 데이터 백업 (참조용, 완전 이전)

## 📋 작업 순서 요약

**👆 먼저 해야 할 일:**
1. **Day 0**: OpenAI API 키 Supabase에 안전 저장 (사전 준비)
2. **Day 1**: Supabase 환경 설정 및 데이터베이스 테이블 생성
3. **Day 2**: React 앱에 Supabase 클라이언트 연결
4. **Day 3-4**: 기본 CRUD (대화방 생성/조회/삭제) 구현
5. **Day 5**: 채팅 기능 (OpenAI Edge Function) 구현
6. **Day 6-7**: 프론트엔드 연동 및 기본 테스트
7. **Day 8**: 이미지 저장소 설정
8. **Day 9-10**: DALL-E 이미지 생성 기능 구현
9. **Day 11-12**: 기본 안정성 테스트
10. **Day 13-14**: 배포 및 최종 확인

---

## 🗓️ 2주 타임박스 실행 계획

## 사전 준비 (Day 0)

### Day 0: OpenAI API 키 보안 설정
**목표**: API 키를 Supabase에 안전하게 저장

#### 작업 0-1: Supabase에 OpenAI API 키 설정
```bash
# Supabase CLI로 API 키 안전 저장
supabase secrets set OPENAI_API_KEY=

# 또는 Supabase Dashboard → Settings → Edge Functions에서 설정
```

**완료 기준**: `supabase secrets list`로 OPENAI_API_KEY 확인

---

## Week 1: 기반 구축 (Day 1-7)

### Day 1: Supabase 환경 설정
**목표**: 로컬 개발 환경 구축 및 데이터베이스 스키마 생성

#### 작업 1-1: Supabase CLI 설치
```bash
npm install -g supabase

supabase init

supabase start
```

#### 작업 1-2: 데이터베이스 테이블 생성 (API 호환성 보장)
Supabase Dashboard → SQL Editor에서 실행:

```sql
-- conversations 테이블 (UUID → string 호환성 고려)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT NULL, -- 익명 사용자 허용
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- messages 테이블  
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- images 테이블 (향후 확장용)
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API 호환성을 위한 뷰 생성 (UUID → string 변환)
CREATE VIEW conversations_api AS
SELECT 
  id::text as id,
  user_id::text as user_id,
  title,
  created_at::text as created_at,
  updated_at::text as updated_at
FROM conversations;

CREATE VIEW messages_api AS
SELECT 
  id::text as id,
  conversation_id::text as conversation_id,
  role,
  content,
  created_at::text as created_at
FROM messages;

CREATE VIEW images_api AS
SELECT 
  id::text as id,
  conversation_id::text as conversation_id,
  prompt,
  image_url,
  created_at::text as created_at
FROM images;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
```

#### 작업 1-3: Row Level Security (RLS) 설정
```sql
-- RLS 활성화
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- 익명 사용자를 위한 정책 (현재는 모든 접근 허용)
CREATE POLICY "Allow all for anonymous users" ON conversations FOR ALL USING (true);
CREATE POLICY "Allow all for anonymous users" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all for anonymous users" ON images FOR ALL USING (true);
```

**완료 기준**: Supabase Dashboard에서 테이블 생성 확인

---

### Day 2: 프론트엔드 Supabase 클라이언트 설정
**목표**: React 앱에 Supabase 연동 준비

#### 작업 2-1: Supabase 클라이언트 설치
```bash
npm install @supabase/supabase-js
```

#### 작업 2-2: 환경 변수 설정
`.env` 파일 생성:
```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

#### 작업 2-3: Supabase 클라이언트 초기화
`src/lib/supabase.js` 생성:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

**완료 기준**: `supabase.from('conversations').select('*')` 실행하여 빈 배열 반환 확인

---

### Day 3-4: 기본 CRUD 기능 구현
**목표**: conversations 테이블 기본 CRUD 기능 구현

#### 작업 3-1: API 서비스 레이어 생성 (기존 API 호환)
`src/services/supabaseApi.js` 생성:
```javascript
import { supabase } from '../lib/supabase'

// UUID 문자열 변환 헬퍼 함수
const convertUUIDtoString = (obj) => {
  if (!obj) return obj
  return {
    ...obj,
    id: obj.id?.toString(),
    user_id: obj.user_id?.toString(),
    conversation_id: obj.conversation_id?.toString(),
    created_at: obj.created_at
  }
}

// 대화방 생성 (기존 API 호환)
export const createConversation = async ({ user_id = null, title }) => {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{ 
      user_id: user_id ? user_id : null, 
      title 
    }])
    .select()
    .single()
  
  if (error) throw error
  return convertUUIDtoString(data)
}

// 대화방 목록 조회 (기존 API 호환)
export const getConversations = async (limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  
  // 기존 API 형식에 맞춤: { total, items }
  const items = data.map(convertUUIDtoString)
  return { 
    total: items.length,
    items: items
  }
}

// 특정 대화방 조회 (기존 API 호환)
export const getConversation = async (id) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return convertUUIDtoString(data)
}

// 대화방 삭제 (기존 API 호환)
export const deleteConversation = async (id) => {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  // 기존 API는 204 응답, Supabase는 자동으로 처리
}

// 메시지 목록 조회 (기존 API 호환)
export const getMessages = async (conversation_id, limit = 50, offset = 0) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  
  // 기존 API 형식에 맞춤: { total, items }
  const items = data.map(convertUUIDtoString)
  return { 
    total: items.length,
    items: items
  }
}

// healthz 체크 (기존 API 완전 호환)
export const healthz = async () => {
  try {
    const { error } = await supabase
      .from('conversations')
      .select('id')
      .limit(1)
    
    // 기존 API 형식: 단순 객체 반환
    return error ? { ok: false, status: 'error' } : { ok: true, status: 'healthy' }
  } catch (err) {
    return { ok: false, status: 'error' }
  }
}
```

#### 작업 3-2: 기존 API 로직 교체
`src/api/api.js` 수정:
```javascript
// 기존 fetch 기반 API를 Supabase로 교체
export { 
  createConversation,
  getConversations as listConversations, // 기존 함수명 호환
  getConversation,
  deleteConversation as deleteConversationApi, // 기존 함수명 호환
  getMessages as listMessages, // 기존 함수명 호환
  healthz
} from '../services/supabaseApi'

// 아직 구현하지 않는 함수들 (임시)
export const chat = () => Promise.reject(new Error('Not implemented yet'))
// 임시로 구현하지 않음 - Day 9에서 실제 DALL-E 연동 구현
```

**완료 기준**: Home 페이지에서 대화방 생성 및 목록 조회 정상 동작

---

### Day 5: 채팅 기능 구현 
**목표**: 기존과 동일한 채팅 기능 구현 (OpenAI 프록시)

#### 작업 5-1: 메시지 CRUD 함수 추가
`src/services/supabaseApi.js`에 추가:
```javascript
// 메시지 추가
export const addMessage = async (conversation_id, role, content) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([{ conversation_id, role, content }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 실제 OpenAI 채팅 함수 (Supabase Edge Functions 사용)
export const chat = async ({ conversation_id, user_id = null, content }) => {
  // 사용자 메시지 저장
  const userMessage = await addMessage(conversation_id, 'user', content)
  
  // Supabase Edge Function 호출 (OpenAI GPT-3.5-turbo API 연동)
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { 
      conversation_id,
      content,
      messages: await getMessages(conversation_id) // 대화 컨텍스트 포함
    }
  })
  
  if (error) throw error
  
  // 어시스턴트 응답 저장
  const assistantMessage = await addMessage(conversation_id, 'assistant', data.reply)
  
  return { 
    conversation_id: conversation_id.toString(), 
    assistant: data.reply 
  }
}
```

#### 작업 5-2: 기본 실시간 메시지 구독
`src/hooks/useMessages.js` 생성:
```javascript
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getMessages } from '../services/supabaseApi'

// 기존과 동일한 방식으로 UUID 변환
const convertUUIDtoString = (obj) => {
  if (!obj) return obj
  return {
    ...obj,
    id: obj.id?.toString(),
    conversation_id: obj.conversation_id?.toString(),
    created_at: obj.created_at
  }
}

export const useMessages = (conversationId) => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!conversationId) return

    // 초기 메시지 로드
    const loadMessages = async () => {
      try {
        const { items } = await getMessages(conversationId)
        setMessages(items)
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()

    // 기본 실시간 구독 (단순 추가)
    const subscription = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, 
        (payload) => {
          const convertedMessage = convertUUIDtoString(payload.new)
          setMessages(prev => [...prev, convertedMessage])  // 기존과 동일: 단순 추가
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [conversationId])

  return { messages, loading }
}
```

#### 작업 5-3: 채팅 Edge Function 구현 (단순 프록시)
`supabase/functions/chat/index.ts` 생성:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content, messages } = await req.json()
    
    // 기존 방식과 동일하게 전체 메시지 컨텍스트 사용
    const chatMessages = messages?.items || []
    const formattedMessages = chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
    formattedMessages.push({ role: 'user', content })
    
    // OpenAI API 호출 (기본 에러 처리만)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    const result = await openaiResponse.json()
    const reply = result.choices[0].message.content

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
```

**완료 기준**: 기존과 동일한 채팅 동작 확인

---

### Day 6-7: 채팅 페이지 연동 및 기본 테스트
**목표**: 기존 채팅 기능과 동일한 수준으로 동작 확인

#### 작업 6-1: Edge Functions 배포
```bash
# Supabase Edge Functions 배포
supabase functions deploy chat
supabase functions deploy generate-image  # Day 9에서 사용할 이미지 함수도 미리 배포

# API 키 설정 확인
supabase secrets list
```

#### 작업 6-2: Chat 페이지 리팩토링
`src/pages/Chat.js` 수정:
- 기존 API 호출을 Supabase 함수로 교체
- `useMessages` 훅 적용
- 실시간 메시지 표시 구현
- 실제 OpenAI 응답 처리

#### 작업 6-3: 기본 기능 테스트
- 대화방 생성 → 채팅 → 메시지 저장 기본 플로우 확인
- 기존과 동일한 수준의 동작 검증

**완료 기준**: 기존 서버와 동일한 채팅 기능 동작

---

## Week 2: 이미지 기능 및 최적화 (Day 8-14)

### Day 8: Supabase Storage 설정
**목표**: 이미지 저장소 준비

#### 작업 8-1: Storage 버킷 생성
Supabase Dashboard → Storage에서:
1. `images` 버킷 생성
2. Public 액세스 정책 설정

#### 작업 8-2: 이미지 업로드 함수 구현
```javascript
export const uploadImage = async (file, conversationId) => {
  const fileName = `${conversationId}/${Date.now()}-${file.name}`
  
  const { data, error } = await supabase.storage
    .from('images')
    .upload(fileName, file)
  
  if (error) throw error
  
  // 공개 URL 생성
  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(fileName)
  
  return urlData.publicUrl
}
```

**완료 기준**: 테스트 이미지 업로드 및 URL 생성 확인

---

### Day 9-10: 이미지 생성 기능 구현
**목표**: OpenAI DALL-E API 실제 연동

#### 작업 9-1: DALL-E Edge Function 생성
`supabase/functions/generate-image/index.ts` 생성:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()
    
    // OpenAI DALL-E API 호출
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      })
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const result = await openaiResponse.json()
    const imageUrl = result.data[0].url

    return new Response(
      JSON.stringify({ image_url: imageUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
```

#### 작업 9-2: 실제 이미지 생성 함수 구현
`src/services/supabaseApi.js`에 추가:
```javascript
export const createImage = async ({ conversation_id, prompt }) => {
  try {
    // Supabase Edge Function 호출 (DALL-E API 연동)
    const { data: imageData, error: functionError } = await supabase.functions.invoke('generate-image', {
      body: { prompt }
    })
    
    if (functionError) throw functionError
    
    // images 테이블에 저장
    const { data, error } = await supabase
      .from('images')
      .insert([{ 
        conversation_id, 
        prompt, 
        image_url: imageData.image_url 
      }])
      .select()
      .single()
    
    if (error) throw error
    
    return {
      id: data.id,
      image_path: '',
      image_url: data.image_url
    }
  } catch (error) {
    console.error('이미지 생성 실패:', error)
    throw error
  }
}
```

**완료 기준**: 실제 DALL-E 이미지 생성 및 데이터베이스 저장 성공

---

### Day 11-12: 기본 안정성 테스트
**목표**: 기존 기능 수준 유지 확인

#### 작업 11-1: 기본 동작 검증
- 모든 기본 기능 정상 동작 확인
- 기존과 동일한 수준의 안정성 검증

#### 작업 11-2: 단순 테스트
- 대화방 CRUD 동작 확인
- 채팅 및 이미지 생성 기본 동작 확인

**완료 기준**: 기존 서버와 동일한 수준의 기능 동작

---

### Day 13-14: 기본 배포 및 확인
**목표**: 이전 완료 및 기본 동작 확인

#### 작업 13-1: 전체 기능 확인
- 기존 서버 대비 동일한 기능 동작 확인
- 기본적인 사용 시나리오 테스트

#### 작업 13-2: 배포 설정
```bash
# Supabase 프로젝트에 배포
npm run build
# 기본 배포
```

#### 작업 13-3: 기본 모니터링
- Supabase Dashboard 기본 확인
- 기본 동작 상태 점검

**완료 기준**: 
- 기존과 동일한 기능 동작
- 기본 배포 완료

---

## ⚠️ 주의사항 및 백업 계획

### 데이터 백업
- 매일 PostgreSQL 백업 확인
- 중요 설정 값 별도 보관

### 롤백 시나리오 (완전 이전이므로 제한적)
- 기존 서버는 완전 중단되므로 롤백 불가
- Supabase 내에서 백업 복원만 가능

### 성능 모니터링
- Supabase Dashboard 일일 확인
- 사용량이 무료 티어 한계 근접시 알림 설정

## 📊 성공 지표 (기존 기능 동일 수준)
- ✅ 기존과 동일한 API 엔드포인트 동작
- ✅ 기존과 동일한 응답 시간
- ✅ 기존과 동일한 실시간 메시지 기능
- ✅ 기본적인 안정성 유지
- ✅ Supabase 무료 티어 내 운영

---

## 🔄 데이터 이관 및 배포 전환 계획

## 🔄 데이터 이관 및 배포 전환 계획 (선택사항)

### 기존 데이터 백업 (필요시)
```bash
# 기존 서버에서 데이터 백업 (선택사항)
curl http://54.180.8.10/v1/conversations | jq > backup_conversations.json
curl http://54.180.8.10/healthz > backup_health.json
```

### 배포 전환 단계 (완전 이전 - Supabase Only)

#### Phase 1: Supabase 기반 개발 (Week 1)
- 기존 서버 참조용으로만 사용 (데이터 백업)
- Supabase 환경에서 모든 기능 구현
- Echo 채팅 → 실제 OpenAI 연동까지 완료

#### Phase 2: 통합 테스트 (Week 2 초반)
- Supabase 기반으로 모든 기능 테스트
- 실제 OpenAI API 연동 검증
- 성능 및 안정성 확인

#### Phase 3: 프로덕션 배포 (Week 2 후반)
- Supabase만 사용하는 완전한 서버리스 앱 배포
- 기존 서버 완전 중단 (더 이상 사용 안 함)
- 독립적인 Supabase 기반 운영

### 데이터 이관 스크립트 (선택사항)
Week 1 Day 2-3에 실행:
```javascript
// scripts/migrateData.js
import { supabase } from '../src/lib/supabase'

const migrateFromBackup = async () => {
  // 1. 백업 파일에서 conversations 데이터 읽기
  const backupConversations = require('./backup_conversations.json')
  
  // 2. Supabase로 데이터 이관
  for (const conv of backupConversations.items) {
    await supabase
      .from('conversations')
      .insert([{ 
        title: conv.title,
        user_id: null, // 익명 사용자
        created_at: conv.created_at
      }])
  }
  
  console.log('Data migration completed')
}
```

## 🔐 보안 및 API 키 관리

### 데이터베이스 비밀번호
- **Database Password**: `haroo1973`
- **사용법**: CLI 연결 시 데이터베이스 비밀번호 입력 프롬프트에서 사용

### OpenAI API 키 설정 (이미 완료)

#### Supabase Edge Functions 환경변수 설정
```bash
# ✅ 이미 설정된 API 키
# Supabase Dashboard → Functions → Settings에서 설정
OPENAI_API_KEY=

# 또는 CLI로 설정
supabase secrets set OPENAI_API_KEY=
```

#### Edge Functions에서 사용
```typescript
// supabase/functions/chat/index.ts
const openaiKey = Deno.env.get('OPENAI_API_KEY')

if (!openaiKey) {
  throw new Error('OpenAI API key not configured')
}

// OpenAI API 호출
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: requestMessages
  })
})
```

#### API 키 보안 체크리스트
- [x] 환경변수로만 관리 (코드에 하드코딩 금지)
- [x] Supabase Edge Functions 환경변수 사용
- [ ] 정기적 키 순환 (3개월마다)
- [ ] 사용량 모니터링 및 예상치 못한 증가 알림

## ⚠️ 추가 주의사항

### API 호환성 테스트
각 단계별로 다음 테스트 수행:
```javascript
// 호환성 테스트 스크립트
const testApiCompatibility = async () => {
  // 1. ID 형식 확인 (string)
  const conv = await createConversation({title: 'test'})
  console.assert(typeof conv.id === 'string', 'ID should be string')
  
  // 2. 응답 구조 확인
  const list = await getConversations()
  console.assert('total' in list && 'items' in list, 'Response structure mismatch')
  
  // 3. healthz 형식 확인
  const health = await healthz()
  console.assert('ok' in health, 'Health check format mismatch')
}
```

### DALL-E 이미지 생성 설명
**Day 9-10에서 구현하는 "실제 이미지 생성":**
- OpenAI DALL-E-3 모델 사용으로 프롬프트 기반 실제 이미지 생성
- 1024x1024 해상도의 고품질 이미지 생성
- Edge Functions를 통한 안전한 API 키 관리
- 생성된 이미지 URL을 데이터베이스에 저장하여 영구 보존

### 긴급 복구 시나리오 (완전 이전)
기존 서버 없이 Supabase만 사용하므로 내부 복구만 가능:
```bash
# 1. Supabase 데이터베이스 백업 복원
supabase db reset  # 로컬에서 테스트

# 2. Edge Functions 재배포
supabase functions deploy

# 3. API 키 재설정 (유출시)
supabase secrets set OPENAI_API_KEY=new_key

# 4. 프론트엔드 재배포
npm run build && supabase hosting deploy
```

## 🔧 추가 기술적 고려사항

### UUID vs 기존 ID 형식 분석
**기존 프론트엔드 ID 사용 패턴 확인:**
```javascript
// 현재 코드 (src/pages/Home.js:27)
navigate(`/chat?cid=${encodeURIComponent(conv.id)}&t=${encodeURIComponent(conv.title)}`)

// URL 길이 비교:
// 기존: /chat?cid=conv_123 (짧고 깔끔)
// UUID: /chat?cid=550e8400-e29b-41d4-a716-446655440000 (길고 복잡)
```

**해결 방안:**
1. **Short ID 생성** (권장):
```sql
-- conversations 테이블에 short_id 컬럼 추가
ALTER TABLE conversations ADD COLUMN short_id TEXT UNIQUE;

-- Trigger로 자동 생성
CREATE OR REPLACE FUNCTION generate_short_id() RETURNS TEXT AS $$
BEGIN
  RETURN 'conv_' || substr(gen_random_uuid()::text, 1, 8);
END;
$$ LANGUAGE plpgsql;
```

2. **Base64 인코딩**:
```javascript
// UUID를 짧게 인코딩
const shortId = btoa(uuid).replace(/[+/=]/g, '').substring(0, 10)
```

### RLS 정책 테스트 방법
**Day 1 완료 후 실행할 테스트:**
```javascript
// RLS 정책 작동 확인 스크립트
const testRLS = async () => {
  try {
    // 1. 익명 사용자로 데이터 삽입 테스트
    const { data, error } = await supabase
      .from('conversations')
      .insert([{ title: 'RLS Test' }])
    
    if (error) throw error
    console.log('✅ RLS allows anonymous insert:', data)
    
    // 2. 데이터 조회 테스트
    const { data: selectData } = await supabase
      .from('conversations')
      .select('*')
    
    console.log('✅ RLS allows anonymous select:', selectData.length, 'rows')
    
    // 3. 테스트 데이터 정리
    await supabase
      .from('conversations')
      .delete()
      .eq('title', 'RLS Test')
      
  } catch (err) {
    console.error('❌ RLS test failed:', err.message)
  }
}
```

### addMessage 함수 UUID 변환 수정
**필수 수정**: API 호환성을 위해 UUID → string 변환 필요
```javascript
// 호환성을 위한 수정
export const addMessage = async (conversation_id, role, content) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([{ conversation_id, role, content }])
    .select()
    .single()
  
  if (error) throw error
  return convertUUIDtoString(data) // API 호환성을 위한 변환
}
```

### 기존 기능 수준 유지
**기본 메시지 처리:** 기존과 동일한 방식 유지
```javascript
// 기존 방식 그대로 유지
export const getMessages = async (conversation_id, limit = 50, offset = 0) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  
  return { 
    total: data.length,
    items: data.map(convertUUIDtoString)
  }
}
```

---
**마지막 업데이트**: 2025-08-31
