"use client";

import { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackToggle,       // Добавили для кнопок
  DisconnectButton   // Добавили для красной кнопки выхода
} from '@livekit/components-react';
import { Track } from 'livekit-client';

// Это наш кастомный интерфейс комнаты
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
      <main className="flex-1 p-4 overflow-hidden relative">
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
      </main>

      {/* 3. Фирменная нижняя панель управления Alverium */}
      <footer className="bg-[#1a1a1a] border-t border-red-900/30 p-4 flex justify-center items-center gap-6 z-10">
        
        {/* Блок с основными инструментами */}
        <div className="flex items-center gap-3 bg-[#222] px-4 py-2 rounded-2xl border border-gray-800 shadow-inner">
          <TrackToggle 
            source={Track.Source.Microphone} 
            className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all"
          />
          <TrackToggle 
            source={Track.Source.Camera} 
            className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all"
          />
          <TrackToggle 
            source={Track.Source.ScreenShare} 
            className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all"
          />
        </div>

        {/* Красная кнопка завершения */}
        <DisconnectButton className="!bg-red-600 hover:!bg-red-500 !text-white px-6 py-3 !rounded-xl font-bold tracking-wide transition-all shadow-lg shadow-red-900/40 border border-red-500">
          Завершить урок
        </DisconnectButton>

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
      data-lk-theme="none" 
    >
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}