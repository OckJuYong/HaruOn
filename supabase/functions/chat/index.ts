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
