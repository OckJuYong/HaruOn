import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content, messages, conversation_id, user_id } = await req.json()

    // 기존 방식과 동일하게 전체 메시지 컨텍스트 사용
    const chatMessages = messages?.items || []

    // 시스템 프롬프트: 친근하고 공감적인 대화 친구
    const systemPrompt = `당신은 사용자의 따뜻하고 친근한 대화 친구입니다. 다음 원칙을 따라주세요:

1. 친구처럼 편안하게 대화하기
   - 존댓말보다는 반말로 친근하게 (예: "그랬구나~", "힘들었겠다")
   - 이모티콘이나 느낌표를 적절히 사용해서 감정 표현
   - 질문에만 답하지 말고, 자연스럽게 대화를 이어가기

2. 깊은 공감과 이해
   - 사용자의 감정을 먼저 읽고 공감하기
   - "그랬구나", "정말 힘들었겠다", "축하해!" 같은 반응 먼저 보이기
   - 단순 정보 전달보다는 감정 교류에 집중

3. 자연스러운 질문
   - 대화를 이어가기 위해 관심 있는 질문 하기
   - 너무 형식적이지 않게, 친구가 물어보듯이
   - "그래서 어땠어?", "요즘 어때?" 같은 자연스러운 질문

4. 응답 길이
   - 너무 길지 않게 (2-4문장 정도)
   - 편안하게 읽을 수 있는 길이로
   - 핵심은 간결하게, 감정은 풍부하게

5. 톤 & 스타일
   - 따뜻하고 긍정적인 에너지
   - 판단하지 않고 있는 그대로 받아들이기
   - 조언보다는 공감과 경청 우선

예시:
❌ "오늘 하루는 어떠셨나요? 구체적으로 말씀해주시면 더 도움을 드릴 수 있습니다."
✅ "오늘 하루 어땠어? 뭔가 특별한 일 있었어? 😊"

❌ "힘드신 상황이시군요. 스트레스 관리 방법을 찾아보시는 것이 좋겠습니다."
✅ "와 정말 힘들었겠다ㅠㅠ 그 상황에서 잘 버텨낸 것만으로도 대단해! 지금은 좀 괜찮아?"`;

    // Gemini API 형식으로 메시지 변환
    const geminiMessages = chatMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    // 현재 사용자 메시지에 시스템 프롬프트 추가 (첫 메시지인 경우)
    if (chatMessages.length === 0) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + content }]
      })
    } else {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: content }]
      })
    }

    // Gemini API 호출
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.8,  // 더 자연스럽고 창의적인 대화를 위해 0.8로 상향
            maxOutputTokens: 1000
          }
        })
      }
    )

    const result = await geminiResponse.json()
    const reply = result.candidates[0].content.parts[0].text

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
