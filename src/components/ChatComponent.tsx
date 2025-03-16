'use client';

import { useEffect, useState, useRef } from 'react';
export default function ChatComponent() {
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; isAi: boolean; isComplete?: boolean }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Get ephemeral token
        const tokenResponse = await fetch('/api/realtime-session');
        if (!tokenResponse.ok) {
          throw new Error(`Failed to get session token: ${tokenResponse.statusText}`);
        }
        const data = await tokenResponse.json();
        if (!data.client_secret?.value) {
          throw new Error('Invalid session token response');
        }
        const EPHEMERAL_KEY = data.client_secret.value;

        // Create peer connection
        const pc = new RTCPeerConnection();
        peerConnection.current = pc;

        // Get audio stream from microphone
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });

        // Add audio track to peer connection
        mediaStream.getAudioTracks().forEach(track => {
          pc.addTrack(track, mediaStream);
        });

        // Set up audio element for remote audio
        if (audioRef.current) {
          audioRef.current.autoplay = true;
          pc.ontrack = e => {
            if (audioRef.current) {
              audioRef.current.srcObject = e.streams[0];
            }
          };
        }

        // Set up data channel
        const dc = pc.createDataChannel('oai-events');
        dataChannel.current = dc;

        dc.addEventListener('message', async (e) => {
          const realtimeEvent = JSON.parse(e.data);
          console.log('Received event:', realtimeEvent);
          if (realtimeEvent.type === 'response.text.delta') {
            // 文字起こしのテキストを追加
            setMessages(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.isAi && !lastMessage.isComplete) {
                // 既存のメッセージを更新
                const newMessages = [...prev];
                newMessages[prev.length - 1] = {
                  ...lastMessage,
                  text: lastMessage.text + realtimeEvent.text
                };
                return newMessages;
              } else {
                // 新しいメッセージを作成
                return [...prev, { text: realtimeEvent.text, isAi: true, isComplete: false }];
              }
            });
          } else if (realtimeEvent.type === 'response.text.done') {
            // メッセージを完了状態にする
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages.length > 0) {
                newMessages[newMessages.length - 1] = {
                  ...newMessages[newMessages.length - 1],
                  isComplete: true
                };
              }
              return newMessages;
            });
          } else if (realtimeEvent.type === 'function.call') {
            try {
              const response = await fetch('/api/handle-function-call', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(realtimeEvent),
              });
              
              if (!response.ok) {
                throw new Error('Failed to handle function call');
              }

              const result = await response.json();
              console.log('Function call result:', result);

              // 結果をAIに返す
              if (dataChannel.current?.readyState === 'open') {
                const resultEvent = {
                  type: 'function.result',
                  function: {
                    name: realtimeEvent.function.name,
                    result
                  }
                };
                dataChannel.current.send(JSON.stringify(resultEvent));
              }

              // 結果をメッセージとして表示
              setMessages(prev => [...prev, { 
                text: `Function ${realtimeEvent.function.name} executed: ${JSON.stringify(result, null, 2)}`, 
                isAi: true 
              }]);
            } catch (error) {
              console.error('Error handling function call:', error);
              if (dataChannel.current?.readyState === 'open') {
                const errorEvent = {
                  type: 'function.error',
                  function: {
                    name: realtimeEvent.function.name,
                    error: 'Failed to execute function'
                  }
                };
                dataChannel.current.send(JSON.stringify(errorEvent));
              }
            }
          }
        });

        // Create and set local description
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Get remote description from OpenAI
        const baseUrl = 'https://api.openai.com/v1/realtime';
        const model = 'gpt-4o-realtime-preview-2024-12-17';
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            'Content-Type': 'application/sdp'
          },
        });

        const answer: RTCSessionDescriptionInit = {
          type: 'answer' as RTCSdpType,
          sdp: await sdpResponse.text(),
        };
        await pc.setRemoteDescription(answer);

        setIsConnected(true);

        return () => {
          pc.close();
        };
      } catch (error) {
        console.error('WebRTC initialization error:', error);
        setIsConnected(false);
      }
    };

    initWebRTC();
  }, []);
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && dataChannel.current?.readyState === 'open') {
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            }
          ]
        }
      };
      dataChannel.current.send(JSON.stringify(event));

      setMessages(prev => [...prev, { text: message, isAi: false }]);
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <audio ref={audioRef} className="hidden" />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-32 h-32 mb-4">
          <img
            src="/sample.jpg"
            alt="AI Assistant"
            className="w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-lg"
          />
          {isConnected ? (
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
          ) : (
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
      </div>
      <div className="h-64 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.isAi ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.isAi
                  ? `bg-blue-500 text-white rounded-tr-none ${!msg.isComplete ? 'animate-pulse' : ''}`
                  : 'bg-gray-100 rounded-tl-none'
              }`}
            >
              <p className={msg.isAi ? 'text-white' : 'text-gray-800'}>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4 bg-white shadow-lg">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 p-3 border rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="メッセージを入力..."
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isConnected}
          >
            送信
          </button>
        </form>
        {!isConnected && (
          <p className="text-red-500 text-sm mt-2 text-center">
            サーバーに接続できません
          </p>
        )}
      </div>
    </div>
  );
}
