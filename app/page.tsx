"use client";

import { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackToggle,
  DisconnectButton,
  useChat
} from '@livekit/components-react';
import { Track } from 'livekit-client';

// ----------------------------------------------------
// ЧАТ
// ----------------------------------------------------
function AlveriumChat() {
  const { send, chatMessages, isSending } = useChat();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      send(message);
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161616] border-l border-gray-800 w-80 shrink-0">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Чат класса</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="text-gray-600 text-xs text-center mt-4">Пока нет сообщений...</div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">{msg.from?.name || msg.from?.identity}</span>
              <div className="bg-[#2a2a2a] text-sm text-gray-200 p-3 rounded-xl rounded-tl-none">
                {msg.message}
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 border-t border-gray-800 flex gap-2">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Сообщение..." 
          className="flex-1 bg-[#222] text-white text-sm px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-red-500 transition-colors"
        />
        <button type="submit" disabled={isSending || !message.trim()} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
          ➤
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// ГЛАВНЫЙ ИНТЕРФЕЙС КОМНАТЫ
// ----------------------------------------------------
function AlveriumStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans">
      
      {/* 1. Шапка (стала более компактной и темной) */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#111] border-b border-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center font-bold text-white text-sm">A</div>
          <h1 className="text-base font-semibold text-gray-200">Alverium Meet</h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-xs text-gray-300 font-medium">Урок идет</span>
        </div>
      </header>

      {/* 2. Центральная часть (Видео + Чат) */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-2">
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>
        <AlveriumChat />
      </main>

      {/* 3. Нижняя панель в стиле ZOOM */}
      <footer className="bg-[#111] p-3 flex justify-between items-center z-10 border-t border-gray-900 px-6">
        
        {/* Левый блок: Настройки и Запись */}
        <div className="flex gap-1 w-1/3">
          <button 
            onClick={() => alert('Настройки камеры и микрофона (в разработке)')}
            className="flex flex-col items-center justify-center w-14 h-12 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <span className="text-lg">⚙️</span>
            <span className="text-[10px] mt-0.5">Настройки</span>
          </button>
          
          <button 
            onClick={() => alert('Запись урока начнется (в разработке)')}
            className="flex flex-col items-center justify-center w-14 h-12 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <span className="text-lg">⏺️</span>
            <span className="text-[10px] mt-0.5">Запись</span>
          </button>
        </div>

        {/* Центральный блок: Основные инструменты */}
        <div className="flex items-center gap-2 bg-[#222] px-4 py-1.5 rounded-2xl border border-gray-800">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
          <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
          
          <div className="w-px h-8 bg-gray-700 mx-1"></div> {/* Разделитель */}

          <button 
            onClick={() => alert('Модуль загрузки PDF и презентаций (в разработке)')}
            className="flex flex-col items-center justify-center w-12 h-10 bg-transparent hover:bg-gray-700 text-white rounded-xl transition"
            title="Загрузить материалы"
          >
            <span className="text-xl">📁</span>
          </button>
        </div>

        {/* Правый блок: Выход */}
        <div className="flex justify-end w-1/3">
          <DisconnectButton className="!bg-red-600 hover:!bg-red-500 !text-white px-5 py-2.5 !rounded-xl text-sm font-bold tracking-wide transition-all">
            Завершить
          </DisconnectButton>
        </div>

      </footer>
      
    </div>
  );
}

// ----------------------------------------------------
// КОРНЕВОЙ КОМПОНЕНТ
// ----------------------------------------------------
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
    return <div className="text-white flex items-center justify-center h-screen bg-[#0a0a0a]">Загрузка платформы Alverium...</div>;
  }

  return (
    <LiveKitRoom video={true} audio={true} token={token} serverUrl={roomUrl} data-lk-theme="none">
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
