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
