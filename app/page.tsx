"use client";

import { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks
} from '@livekit/components-react';
import { Track } from 'livekit-client';

// Это наш новый кастомный интерфейс комнаты
function AlveriumStage() {
  // Хук LiveKit: собирает все видео с камер и экранов участников
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex flex-col h-screen bg-[#111111] text-white font-sans">
      
      {/* 1. Наша фирменная шапка */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#1a1a1a] border-b border-red-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center font-bold text-white">
            A
          </div>
          <h1 className="text-lg font-semibold tracking-wide">Alverium Meet</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-sm text-gray-300">Урок идет</span>
        </div>
      </header>

      {/* 2. Главный экран с сеткой видео */}
      <main className="flex-1 p-4 overflow-hidden">
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          {/* ParticipantTile отвечает за отрисовку каждого отдельного видео */}
          <ParticipantTile />
        </GridLayout>
      </main>

      {/* 3. Нижняя панель управления */}
      <footer className="bg-[#1a1a1a] border-t border-gray-800 p-4 flex justify-center">
        {/* Пока берем минимальную стандартную панель, позже сверстаем свои кнопки */}
        <ControlBar variation="minimal" />
      </footer>
      
    </div>
  );
}

// Главная страница
export default function Home() {
  const [token, setToken] = useState("");
  const roomUrl = "wss://meet.alverium.ru";

  useEffect(() => {
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

  if (!token) {
    return <div className="text-white flex items-center justify-center h-screen bg-[#111111]">Загрузка платформы Alverium...</div>;
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={roomUrl}
      // Отключаем стандартную тему, так как теперь мы пишем свой дизайн
      data-lk-theme="none" 
    >
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}