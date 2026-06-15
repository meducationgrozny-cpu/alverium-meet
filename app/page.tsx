"use client";

import { useState, useEffect } from 'react';
import '@livekit/components-styles';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';

export default function Home() {
  const [token, setToken] = useState("");
  const roomUrl = "wss://meet.alverium.ru";

  useEffect(() => {
    // При заходе на сайт автоматически стучимся в наш API за токеном
    const fetchToken = async () => {
      try {
        const response = await fetch('/api/token');
        const data = await response.json();
        setToken(data.token);
      } catch (e) {
        console.error("Ошибка при получении токена:", e);
      }
    };
    
    fetchToken();
  }, []);

  // Пока токен не получен, показываем экран загрузки
  if (!token) {
    return <div className="text-white flex items-center justify-center h-screen bg-black">Выписываем пропуск в комнату...</div>;
  }

  return (
    <main className="h-screen w-full bg-black">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={roomUrl}
        data-lk-theme="default" 
        style={{ height: '100vh', width: '100vw' }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}