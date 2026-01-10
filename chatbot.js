// DoorExpert AI Chatbot - Google Gemini API
(function() {
    const GEMINI_API_KEY = 'AIzaSyDB9NW1keIPC91u5VbEXLqQ6HSTFiBfcII';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const KAKAO_OPEN_CHAT_URL = 'https://open.kakao.com/o/sDoorExpert';
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuEZ5Ju_357eJEHx6WGZGqpvOXAE6HrVzkUVj6poxyLHILUTi-OYE1hayxtEGAT4Q7Qw/exec';

    // 세션 ID 생성 (사용자 구분용)
    const SESSION_ID = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // DoorExpert 맞춤 시스템 프롬프트
    const SYSTEM_PROMPT = `당신은 DoorExpert의 AI 상담사입니다. DoorExpert는 프리미엄 현관문 설치 전문 기업입니다.

## 당신의 역할
- 현관문 교체/설치에 관한 전문적인 상담 제공
- 견적 문의 및 서비스 안내
- 고객의 질문에 친절하고 상세하게 응답

## DoorExpert 핵심 정보
**서비스 범위:**
- 프리미엄 현관문 교체 및 신규 설치
- 아파트, 빌라, 주택 등 모든 주거 형태 시공 가능
- 방화문, 단열문, 디지털 도어락 설치

**차별화된 강점:**
- ✅ 10년 무상 A/S 및 정기 점검 보장
- ✅ 숙련된 전문 엔지니어 직접 시공 (하청 없음)
- ✅ 단열, 방음, 보안이 뛰어난 최고급 정품 자재만 사용
- ✅ 시공 후 1시간 이내 현장 청소 완료

**연락처:**
- 전화: 1588-0000
- 이메일: support@doorexpert.kr
- 상담 응답시간: 1시간 이내

## 응답 가이드라인
1. **친절하고 전문적인 톤**: 고객을 존중하며 전문 지식을 바탕으로 상담
2. **상세한 설명**: 최소 3-5문장으로 충분한 정보 제공
3. **구조화된 답변**: 필요시 bullet point나 번호 목록 사용
4. **가격 안내**: 구체적인 가격은 "현장 방문 상담 후 정확한 견적을 안내드립니다"라고 안내
5. **상담 유도**: 복잡한 질문이나 견적 요청 시 카카오톡 상담 또는 전화 상담 권유
6. **한국어 사용**: 모든 응답은 한국어로 작성

## 상담이 어려운 경우
다음과 같은 경우 카카오톡 상담을 안내하세요:
- 구체적인 견적 요청
- 특수 시공 문의 (비표준 규격, 특수 자재 등)
- A/S 접수 및 예약
- 긴급 시공 요청
- 결제 및 계약 관련 문의

이런 경우 "더 자세한 상담을 원하시면 카카오톡으로 문의해 주세요!"라고 안내하세요.`;

    let conversationHistory = [];
    let isOpen = false;

    // 기기 정보 가져오기
    function getDeviceInfo() {
        const ua = navigator.userAgent;
        let device = 'Unknown';
        if (/Mobile|Android|iPhone/i.test(ua)) {
            device = 'Mobile';
        } else if (/Tablet|iPad/i.test(ua)) {
            device = 'Tablet';
        } else {
            device = 'Desktop';
        }
        return `${device} | ${navigator.language}`;
    }

    // Google Sheets에 대화 저장
    async function saveChatToSheet(sender, message) {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'chatbot',
                    sessionId: SESSION_ID,
                    sender: sender,
                    message: message,
                    deviceInfo: getDeviceInfo()
                })
            });
        } catch (error) {
            console.error('대화 저장 오류:', error);
        }
    }

    // 마크다운 형식을 HTML로 변환
    function formatMessage(text) {
        let formatted = text.replace(/\n/g, '<br>');
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/✅/g, '<span class="check-icon">✅</span>');
        formatted = formatted.replace(/^- /gm, '• ');
        formatted = formatted.replace(/<br>- /g, '<br>• ');
        formatted = formatted.replace(/(\d+)\. /g, '<span class="list-number">$1.</span> ');
        return formatted;
    }

    // 챗봇 HTML 생성
    function createChatbotHTML() {
        const chatbotContainer = document.createElement('div');
        chatbotContainer.id = 'doorexpert-chatbot';
        chatbotContainer.innerHTML = `
            <button id="chatbot-toggle" class="chatbot-toggle" aria-label="AI 상담 열기">
                <span class="material-symbols-outlined chatbot-icon-open">chat</span>
                <span class="material-symbols-outlined chatbot-icon-close" style="display:none;">close</span>
            </button>
            <div id="chatbot-modal" class="chatbot-modal" style="display:none;">
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">
                            <span class="material-symbols-outlined">smart_toy</span>
                        </div>
                        <div>
                            <h4>DoorExpert AI 상담</h4>
                            <span class="chatbot-status">● 온라인</span>
                        </div>
                    </div>
                    <button id="chatbot-minimize" class="chatbot-minimize" aria-label="최소화">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                </div>
                <div id="chatbot-messages" class="chatbot-messages">
                    <div class="chat-message bot">
                        <div class="message-content">
                            <strong>안녕하세요! DoorExpert AI 상담사입니다.</strong><br><br>
                            프리미엄 현관문 설치에 관해 무엇이든 물어보세요.<br><br>
                            • 현관문 교체 비용이 궁금하신가요?<br>
                            • 어떤 종류의 문이 좋을지 고민되시나요?<br>
                            • 시공 과정이 궁금하신가요?<br><br>
                            편하게 질문해 주세요! 😊
                        </div>
                    </div>
                </div>
                <div class="chatbot-quick-actions">
                    <button class="quick-action-btn" data-message="현관문 교체 비용이 얼마나 드나요?">💰 비용 문의</button>
                    <button class="quick-action-btn" data-message="어떤 종류의 현관문이 있나요?">🚪 문 종류</button>
                    <button class="quick-action-btn" data-message="시공 기간은 얼마나 걸리나요?">⏱️ 시공 기간</button>
                </div>
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="메시지를 입력하세요..." autocomplete="off">
                    <button id="chatbot-send" aria-label="전송">
                        <span class="material-symbols-outlined">send</span>
                    </button>
                </div>
                <div class="chatbot-footer">
                    <a href="${KAKAO_OPEN_CHAT_URL}" target="_blank" class="kakao-btn">
                        <svg class="kakao-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.77l-.96 3.57c-.1.36.26.64.58.46l4.13-2.46c.51.06 1.03.1 1.58.1 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
                        </svg>
                        카카오톡 상담
                    </a>
                    <a href="tel:1588-0000" class="phone-btn">
                        <span class="material-symbols-outlined">call</span>
                        전화 상담
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(chatbotContainer);
    }

    // 챗봇 스타일 생성
    function createChatbotStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #doorexpert-chatbot { font-family: 'Noto Sans KR', sans-serif; }
            .chatbot-toggle { position: fixed; bottom: 24px; right: 24px; width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #496039 0%, #3a4d2e 100%); border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(73, 96, 57, 0.4); z-index: 9999; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
            .chatbot-toggle:hover { transform: scale(1.1); box-shadow: 0 6px 25px rgba(73, 96, 57, 0.5); }
            .chatbot-toggle .material-symbols-outlined { color: white; font-size: 30px; }
            .chatbot-modal { position: fixed; bottom: 100px; right: 24px; width: 400px; max-width: calc(100vw - 48px); height: 600px; max-height: calc(100vh - 140px); background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); z-index: 9998; display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s ease; }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .chatbot-header { background: linear-gradient(135deg, #496039 0%, #3a4d2e 100%); color: white; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; }
            .chatbot-header-info { display: flex; align-items: center; gap: 12px; }
            .chatbot-avatar { width: 44px; height: 44px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .chatbot-avatar .material-symbols-outlined { font-size: 26px; }
            .chatbot-header h4 { margin: 0; font-size: 16px; font-weight: 700; }
            .chatbot-status { font-size: 12px; opacity: 0.9; color: #90EE90; }
            .chatbot-minimize { background: rgba(255, 255, 255, 0.2); border: none; border-radius: 10px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; transition: background 0.2s; }
            .chatbot-minimize:hover { background: rgba(255, 255, 255, 0.3); }
            .chatbot-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; background: linear-gradient(180deg, #f8f9fa 0%, #f0f2f5 100%); }
            .chat-message { display: flex; max-width: 88%; animation: fadeIn 0.3s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .chat-message.bot { align-self: flex-start; }
            .chat-message.user { align-self: flex-end; }
            .message-content { padding: 14px 18px; border-radius: 18px; font-size: 14px; line-height: 1.7; }
            .message-content strong { color: #496039; }
            .message-content .check-icon { margin-right: 4px; }
            .message-content .list-number { color: #496039; font-weight: 600; }
            .chat-message.bot .message-content { background: white; color: #333; border-bottom-left-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
            .chat-message.user .message-content { background: linear-gradient(135deg, #496039 0%, #3a4d2e 100%); color: white; border-bottom-right-radius: 6px; }
            .chat-message.typing .message-content { display: flex; gap: 5px; padding: 18px 24px; }
            .typing-dot { width: 10px; height: 10px; background: #496039; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out; }
            .typing-dot:nth-child(1) { animation-delay: 0s; }
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typingBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
            .chatbot-quick-actions { padding: 12px 16px; background: white; display: flex; gap: 8px; overflow-x: auto; border-top: 1px solid #eee; }
            .quick-action-btn { flex-shrink: 0; padding: 8px 14px; border: 1px solid #496039; background: white; border-radius: 20px; font-size: 13px; color: #496039; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
            .quick-action-btn:hover { background: #496039; color: white; }
            .chatbot-input-area { padding: 14px 16px; background: white; border-top: 1px solid #eee; display: flex; gap: 10px; }
            #chatbot-input { flex: 1; padding: 14px 18px; border: 2px solid #eee; border-radius: 25px; font-size: 14px; outline: none; transition: border-color 0.2s; }
            #chatbot-input:focus { border-color: #496039; }
            #chatbot-send { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #496039 0%, #3a4d2e 100%); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; transition: all 0.2s; }
            #chatbot-send:hover { transform: scale(1.08); box-shadow: 0 4px 12px rgba(73, 96, 57, 0.3); }
            #chatbot-send:disabled { background: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }
            .chatbot-footer { padding: 12px 16px; background: #f8f9fa; display: flex; gap: 10px; border-top: 1px solid #eee; }
            .kakao-btn, .phone-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
            .kakao-btn { background: #FEE500; color: #3C1E1E; }
            .kakao-btn:hover { background: #F5DC00; transform: translateY(-2px); }
            .kakao-icon { width: 20px; height: 20px; }
            .phone-btn { background: #496039; color: white; }
            .phone-btn:hover { background: #3a4d2e; transform: translateY(-2px); }
            .phone-btn .material-symbols-outlined { font-size: 18px; }
            @media (max-width: 480px) {
                .chatbot-modal { width: calc(100vw - 24px); right: 12px; bottom: 90px; height: calc(100vh - 110px); border-radius: 16px; }
                .chatbot-toggle { bottom: 16px; right: 16px; width: 56px; height: 56px; }
                .chatbot-quick-actions { padding: 10px 12px; }
                .quick-action-btn { padding: 6px 12px; font-size: 12px; }
            }
        `;
        document.head.appendChild(style);
    }

    // Gemini API 호출
    async function sendToGemini(userMessage) {
        conversationHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        const requestBody = {
            contents: [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: '네, 알겠습니다. DoorExpert AI 상담사로서 친절하고 상세하게 응대하겠습니다. 고객님의 질문에 전문적인 답변을 드리겠습니다.' }] },
                ...conversationHistory
            ],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 1024,
            }
        };

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            const botResponse = data.candidates[0].content.parts[0].text;

            conversationHistory.push({
                role: 'model',
                parts: [{ text: botResponse }]
            });

            return botResponse;
        } catch (error) {
            console.error('Gemini API Error:', error);
            return '죄송합니다. 일시적인 오류가 발생했습니다.\n\n더 빠른 상담을 원하시면 아래 버튼을 눌러 카카오톡이나 전화로 문의해 주세요! 😊';
        }
    }

    // 메시지 추가
    function addMessage(content, isUser = false) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        const formattedContent = isUser ? content : formatMessage(content);
        messageDiv.innerHTML = `<div class="message-content">${formattedContent}</div>`;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 타이핑 인디케이터
    function showTyping() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'chat-message bot typing';
        typingDiv.innerHTML = `<div class="message-content"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.remove();
    }

    // 메시지 전송 처리
    async function handleSendMessage(message = null) {
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send');
        const messageText = message || input.value.trim();

        if (!messageText) return;

        addMessage(messageText, true);
        input.value = '';
        sendBtn.disabled = true;

        saveChatToSheet('사용자', messageText);
        showTyping();

        const response = await sendToGemini(messageText);

        hideTyping();
        addMessage(response);
        saveChatToSheet('챗봇', response);

        sendBtn.disabled = false;
        input.focus();
    }

    // 챗봇 토글
    function toggleChatbot() {
        const modal = document.getElementById('chatbot-modal');
        const iconOpen = document.querySelector('.chatbot-icon-open');
        const iconClose = document.querySelector('.chatbot-icon-close');

        isOpen = !isOpen;

        if (isOpen) {
            modal.style.display = 'flex';
            iconOpen.style.display = 'none';
            iconClose.style.display = 'block';
            document.getElementById('chatbot-input').focus();
        } else {
            modal.style.display = 'none';
            iconOpen.style.display = 'block';
            iconClose.style.display = 'none';
        }
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        document.getElementById('chatbot-toggle').addEventListener('click', toggleChatbot);
        document.getElementById('chatbot-minimize').addEventListener('click', toggleChatbot);
        document.getElementById('chatbot-send').addEventListener('click', () => handleSendMessage());
        document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.getAttribute('data-message');
                handleSendMessage(message);
            });
        });
    }

    // 초기화
    function init() {
        createChatbotStyles();
        createChatbotHTML();
        setupEventListeners();
    }

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
