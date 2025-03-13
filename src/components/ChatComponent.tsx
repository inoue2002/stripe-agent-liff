'use client';

import { useEffect, useState, useRef } from 'react';
export default function ChatComponent() {
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; isAi: boolean }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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

          if (realtimeEvent.type === 'text.content') {
            setMessages(prev => [...prev, { text: realtimeEvent.text, isAi: true }]);
          } else if (realtimeEvent.type === 'function.call') {
            console.log('Function call received:', realtimeEvent);
            // 関数呼び出しは一旦ログだけ出力
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
        type: 'response.create',
        response: {
          modalities: ['text'],
          instructions: message,
        },
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
        <div className="relative w-64 h-64 mb-8">
          <img
            src="/sample.jpg"
            alt="AI Assistant"
            className="w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-lg"
          />
          {isConnected ? (
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-green-500 rounded-full border-2 border-white" />
          ) : (
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
      </div>
      <div className="h-48 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.isAi ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.isAi
                  ? 'bg-blue-100 rounded-tl-none'
                  : 'bg-green-100 rounded-tr-none'
              }`}
            >
              <p className="text-gray-800">{msg.text}</p>
            </div>
          </div>
        ))}
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
