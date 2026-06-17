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

// ====================================================
// ПРЕМИУМ SVG ИКОНКИ (Вместо дешевых эмодзи)
// ====================================================
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RecordIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 group-hover:stroke-red-500 transition-colors">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" fill="currentColor" className="text-red-600 group-hover:text-red-500 transition-colors" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

// ====================================================
// ЧАТ (Стиль: Матовое стекло и минимализм)
// ====================================================
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
    <div className="flex flex-col h-full bg-[#050505] border-l border-white/5 w-80 shrink-0">
      <div className="p-5 border-b border-white/5">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Чат класса</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {chatMessages.length === 0 ? (
          <div className="text-gray-600 text-xs text-center mt-10 font-light tracking-wide">Тишина в аудитории...</div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[10px] text-gray-500 mb-1.5 ml-1 tracking-wide">{msg.from?.name || msg.from?.identity}</span>
              <div className="bg-white/5 text-sm text-gray-200 p-3.5 rounded-2xl rounded-tl-sm border border-white/5 font-light leading-relaxed">
                {msg.message}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex gap-3 bg-[#030303]">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Написать..." 
          className="flex-1 bg-white/5 text-white text-sm px-4 py-3 rounded-xl border border-white/5 focus:outline-none focus:border-red-900/50 focus:bg-white/10 transition-all font-light placeholder:text-gray-600"
        />
        <button 
          type="submit" 
          disabled={isSending || !message.trim()} 
          className="bg-red-800 hover:bg-red-700 text-white w-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shadow-[0_0_15px_rgba(153,27,27,0.3)]"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

// ====================================================
// ГЛАВНЫЙ ИНТЕРФЕЙС КОМНАТЫ
// ====================================================
function AlveriumStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex flex-col h-screen bg-[#000000] text-white font-sans selection:bg-red-900/50">
      
      {/* 1. ПРЕМИУМ ШАПКА */}
      <header className="flex items-center justify-between px-8 py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-800 to-red-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">A</div>
          <h1 className="text-sm font-semibold text-gray-100 tracking-wide">Alverium <span className="font-light text-gray-500">Meet</span></h1>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">В эфире</span>
        </div>
      </header>

      {/* 2. ЦЕНТРАЛЬНАЯ ЧАСТЬ */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-4">
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>
        <AlveriumChat />
      </main>

      {/* 3. ПРЕМИУМ ПАНЕЛЬ (Glassmorphism) */}
      <footer className="bg-[#050505]/90 backdrop-blur-2xl px-8 py-4 flex justify-between items-center z-20 border-t border-white/5">
        
        {/* Левый блок */}
        <div className="flex gap-3 w-1/3">
          <button 
            onClick={() => alert('Настройки (в разработке)')}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300 group"
          >
            <div className="group-hover:rotate-90 transition-transform duration-500">
              <SettingsIcon />
            </div>
          </button>
          
          <button 
            onClick={() => alert('Запись (в разработке)')}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-red-900/20 text-gray-400 transition-all duration-300 group"
          >
            <RecordIcon />
          </button>
        </div>

        {/* Центральный блок */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-2 rounded-2xl border border-white/5 shadow-2xl">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-12 !h-10" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-12 !h-10" />
          <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-12 !h-10" />
          
          <div className="w-[1px] h-6 bg-white/10 mx-2"></div>

          <button 
            onClick={() => alert('Файлы (в разработке)')}
            className="flex items-center justify-center w-12 h-10 bg-transparent hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all"
          >
            <FileIcon />
          </button>
        </div>

        {/* Правый блок */}
        <div className="flex justify-end w-1/3">
          <DisconnectButton className="!bg-red-800 hover:!bg-red-700 !text-white px-6 py-3 !rounded-xl text-xs font-semibold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] !border !border-red-600/50">
            Завершить
          </DisconnectButton>
        </div>

      </footer>
      
    </div>
  );
}

// ====================================================
// КОРНЕВОЙ КОМПОНЕНТ
// ====================================================
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
    return <div className="text-white flex items-center justify-center h-screen bg-[#000000] font-light tracking-widest text-sm text-gray-500">ЗАГРУЗКА ALVERIUM...</div>;
  }

  return (
    <LiveKitRoom video={true} audio={true} token={token} serverUrl={roomUrl} data-lk-theme="none">
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
