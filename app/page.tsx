"use client";

import '@livekit/components-styles';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';

export default function Home() {
  // Наш боевой сервер LiveKit
  const roomUrl = "wss://meet.alverium.ru";
  
  // ВРЕМЕННЫЙ ТОКЕН: Сюда нужно будет вставить длинный токен (eyJ...), 
  // который мы генерировали на сервере. Позже этот токен будет выдавать Django.
  const token = "ВСТАВЬ_СВОЙ_ТЕСТОВЫЙ_ТОКЕН_СЮДА";

  if (token === "ВСТАВЬ_СВОЙ_ТЕСТОВЫЙ_ТОКЕН_СЮДА") {
    return <div className="text-white p-10">Пожалуйста, вставьте тестовый токен в код.</div>;
  }

  return (
    <main className="h-screen w-full bg-black">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={roomUrl}
        // data-lk-theme применяет красивые стили по умолчанию
        data-lk-theme="default" 
        style={{ height: '100vh', width: '100vw' }}
      >
        {/* Компонент, который сам рисует сетку видео, кнопки микрофона, камеры и т.д. */}
        <VideoConference />
        {/* Компонент для воспроизведения звука комнаты */}
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}