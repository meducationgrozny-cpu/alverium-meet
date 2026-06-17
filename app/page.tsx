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
  useChat // <-- Добавили хук для создания своего чата
} from '@livekit/components-react';
import { Track } from 'livekit-client';

// ----------------------------------------------------
// НОВЫЙ КОМПОНЕНТ: Наш фирменный текстовый чат
// ----------------------------------------------------
function AlveriumChat() {
  const { send, chatMessages, isSending } = useChat();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      send(message); // Отправляем сообщение на сервер
      setMessage(""); // Очищаем поле ввода
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161616] border-l border-gray-800 w-80 shrink-0">
      {/* Шапка чата */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Чат класса</h2>
      </div>
      
      {/* Список сообщений */}
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

      {/* Поле ввода */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-800 flex gap-2">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Сообщение..." 
          className="flex-1 bg-[#222] text-white text-sm px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-red-500 transition-colors"
        />
        <button 
          type="submit" 
          disabled={isSending || !message.trim()}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
        >
          Отправить
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
    <div className="flex flex-col h-screen bg-[#111111] text-white font-sans">
      
      {/* 1. Шапка */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#1a1a1a] border-b border-red-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center font-bold text-white">A</div>
          <h1 className="text-lg font-semibold tracking-wide">Alverium Meet</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-sm text-gray-300">Урок идет</span>
        </div>
      </header>

      {/* 2. Центральная часть: Видео (слева) + Чат (справа) */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Зона видео */}
        <div className="flex-1 p-4">
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>
        
        {/* Зона чата (Встроили наш новый компонент) */}
        <AlveriumChat />

      </main>

      {/* 3. Нижняя панель управления */}
      <footer className="bg-[#1a1a1a] border-t border-red-900/30 p-4 flex justify-center items-center gap-6 z-10">
        <div className="flex items-center gap-3 bg-[#222] px-4 py-2 rounded-2xl border border-gray-800 shadow-inner">
          <TrackToggle source={Track.Source.Microphone} className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
          <TrackToggle source={Track.Source.Camera} className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
          <TrackToggle source={Track.Source.ScreenShare} className="!bg-gray-800 hover:!bg-gray-700 !text-white !border-none !rounded-xl transition-all" />
        </div>
        <DisconnectButton className="!bg-red-600 hover:!bg-red-500 !text-white px-6 py-3 !rounded-xl font-bold tracking-wide transition-all shadow-lg shadow-red-900/40 border border-red-500">
          Завершить урок
        </DisconnectButton>
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
    return <div className="text-white flex items-center justify-center h-screen bg-[#111111]">Загрузка платформы Alverium...</div>;
  }

  return (
    <LiveKitRoom video={true} audio={true} token={token} serverUrl={roomUrl} data-lk-theme="none">
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
