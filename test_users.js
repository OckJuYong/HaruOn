// 테스트용 3명 사용자 데이터
const testUsers = [
  {
    id: 1,
    name: "김하루",
    email: "haru1@test.com",
    password: "test123456",
    profile: {
      age: 25,
      interests: ["일상", "감정", "자기계발"],
      conversationStyle: "friendly",
      preferredLength: "medium"
    },
    testScenario: {
      messages: [
        "안녕하세요! 오늘 기분이 정말 좋아요 ㅎㅎ",
        "새로운 도전을 시작했는데 조언 좀 해주세요",
        "오늘 하루 정말 알찬 시간이었어요. 감사합니다!"
      ],
      expectedStyle: "친근하고 편안한 말투",
      personalizedSettings: {
        conversation_style: "friendly",
        response_length: "medium", 
        emotional_tone: "warm"
      }
    }
  },
  {
    id: 2,
    name: "이진우",
    email: "jinwoo2@test.com", 
    password: "test123456",
    profile: {
      age: 30,
      interests: ["업무", "전문성", "효율성"],
      conversationStyle: "formal",
      preferredLength: "short"
    },
    testScenario: {
      messages: [
        "업무 관련하여 조언을 구하고 싶습니다.",
        "프로젝트 진행에 어려움이 있어 도움이 필요합니다.",
        "효과적인 업무 처리 방법에 대해 알고 싶습니다."
      ],
      expectedStyle: "정중하고 예의바른 말투",
      personalizedSettings: {
        conversation_style: "formal",
        response_length: "short",
        emotional_tone: "neutral"
      }
    }
  },
  {
    id: 3,
    name: "박소영",
    email: "soyoung3@test.com",
    password: "test123456", 
    profile: {
      age: 22,
      interests: ["취미", "여행", "음식"],
      conversationStyle: "enthusiastic", 
      preferredLength: "long"
    },
    testScenario: {
      messages: [
        "와! 오늘 정말 신나는 일이 있었어요!! 들어보실래요?",
        "여행 계획 세우는 거 도와주세요~ 완전 설렜어요!",
        "맛집 추천도 해주시고 자세한 정보도 많이 알려주세요!!"
      ],
      expectedStyle: "활발하고 열정적인 말투",
      personalizedSettings: {
        conversation_style: "enthusiastic",
        response_length: "long",
        emotional_tone: "supportive"
      }
    }
  }
];

console.log("테스트 사용자 데이터:", testUsers);
export default testUsers;