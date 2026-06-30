


"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

// Подключаем наш новый компонент Интерактивной доски
import AlveriumWhiteboard from './Whiteboard';

// ====================================================
// ПРЕМИУМ SVG ИКОНКИ
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

// Иконка Ручки для активации Интерактивной доски
const PenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942a.375.375 0 01-.475-.475l.942-2.827a4.5 4.5 0 011.12-1.89l13.13-13.132z" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.373 5.472v3.028l2.946-1.5A9.743 9.743 0 0012 20.25z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ====================================================
// ЧАТ (Адаптивный: Шторка на мобилках, Блок на ПК)
// ====================================================
function AlveriumChat({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
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
    <>
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={onClose} />
      )}
      
      <div className={`fixed md:relative inset-y-0 right-0 z-40 flex flex-col h-full bg-[#050505] border-l border-white/5 w-[85%] md:w-80 shrink-0 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-5 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Чат класса</h2>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {chatMessages.length === 0 ? (
            <div className="text-gray-600 text-xs text-center mt-10 font-light tracking-wide">Тишина в аудитории...</div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[10px] text-gray-500 mb-1.5 ml-1 tracking-wide">
                  {(msg.from as any)?.name || msg.from?.identity || "Гость"}
                </span>
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
          <button type="submit" disabled={isSending || !message.trim()} className="bg-red-800 hover:bg-red-700 text-white w-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shadow-[0_0_15px_rgba(153,27,27,0.3)]">
            <SendIcon />
          </button>
        </form>
      </div>
    </>
  );
}

// ====================================================
// ГЛАВНЫЙ ИНТЕРФЕЙС КОМНАТЫ
// ====================================================
function AlveriumStage() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

  // 1. Берем токен из URL
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  // 2. Расшифровываем JWT напрямую, чтобы 100% увидеть права, которые дал Турпал
  let isHost = false;
  if (token) {
    try {
      const base64Payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64Payload));
      isHost = payload?.video?.roomAdmin === true;
    } catch (e) {
      console.error("Ошибка парсинга токена", e);
    }
  }

  // Разделяем треки на камеры и трансляции экрана
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white font-sans selection:bg-red-900/50 relative">
      {/* ШАПКА */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-800 to-red-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">A</div>
          <h1 className="text-sm font-semibold text-gray-100 tracking-wide hidden md:block">Alverium <span className="font-light text-gray-500">Meet</span></h1>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">В эфире</span>
        </div>
      </header>

      {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-[#0a0a0a]">
          
          {/* ЛОГИКА РЕНДЕРИНГА ЭКРАНА */}
          {isWhiteboardOpen ? (
            <>
              {/* Показ интерактивной доски (100% экрана) */}
              <div className="absolute inset-0 p-2 md:p-4">
                <AlveriumWhiteboard isHost={isHost} />
              </div>
              
              {/* Плавающее окно с камерами спикеров (PiP) */}
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (
                    <div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-inner relative">
                      <ParticipantTile trackRef={track} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : hasScreenShare ? (
            <>
              {/* Показ трансляции экрана (100% экрана) */}
              <div className="absolute inset-0 p-2 md:p-4">
                <GridLayout tracks={screenTracks} style={{ height: '100%', width: '100%' }}>
                  <ParticipantTile />
                </GridLayout>
              </div>
              
              {/* Плавающее окно с камерами спикеров (PiP) */}
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (
                    <div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-inner relative">
                      <ParticipantTile trackRef={track} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Обычная сетка камер */
            <div className="absolute inset-0 p-2 md:p-4">
              <GridLayout tracks={cameraTracks} style={{ height: '100%' }}>
                <ParticipantTile />
              </GridLayout>
            </div>
          )}

        </div>

        <AlveriumChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ */}
      <footer className="bg-[#050505]/90 backdrop-blur-2xl px-4 md:px-8 py-3 md:py-4 flex justify-between items-center z-20 border-t border-white/5 shrink-0">
        <div className="flex gap-2 md:gap-3 w-auto md:w-1/3">
          <button onClick={() => alert('Настройки (в разработке)')} className="hidden md:flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300 group">
            <div className="group-hover:rotate-90 transition-transform duration-500"><SettingsIcon /></div>
          </button>
          <button onClick={() => alert('Запись (в разработке)')} className="hidden md:flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-red-900/20 text-gray-400 transition-all duration-300 group">
            <RecordIcon />
          </button>
          
          {/* КНОПКА ИНТЕРАКТИВНОЙ ДОСКИ (Показываем ТОЛЬКО преподавателю) */}
          {isHost && (
            <button 
              onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)} 
              className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border transition-all duration-300 ${
                isWhiteboardOpen 
                  ? 'bg-red-800 border-red-600 text-white shadow-[0_0_15px_rgba(153,27,27,0.4)]' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
              title="Интерактивная доска и PDF"
            >
              <PenIcon />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 bg-[#0a0a0a] px-2 py-1.5 md:px-3 md:py-2 rounded-2xl border border-white/5 shadow-2xl">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          {isHost && (
            <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          )}
          
          <div className="w-[1px] h-6 bg-white/10 mx-1 md:mx-2"></div>
          
          {/* Кнопка вызова чата на мобилках */}
          <button onClick={() => setIsChatOpen(true)} className="md:hidden flex items-center justify-center w-10 h-10 bg-transparent hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all">
            <ChatIcon />
          </button>
        </div>

        <div className="flex justify-end w-auto md:w-1/3">
          <DisconnectButton className="!bg-red-800 hover:!bg-red-700 !text-white px-4 md:px-6 py-2.5 md:py-3 !rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] !border !border-red-600/50">
            <span className="hidden md:inline">Завершить</span>
            <span className="md:hidden">Выйти</span>
          </DisconnectButton>
        </div>
      </footer>
    </div>
  );
}

// ====================================================
// ВНУТРЕННИЙ КОМПОНЕНТ (Логика и Маршрутизация)
// ====================================================
function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const token = searchParams.get('token');
  const roomUrl = "wss://meet.alverium.ru";

  // Обработка Graceful Exit при отключении
  const handleDisconnect = () => {
    const returnUrl = process.env.NEXT_PUBLIC_LMS_RETURN_URL || '/';
    if (returnUrl.startsWith('http')) {
      window.location.href = returnUrl;
    } else {
      router.push(returnUrl);
    }
  };

  if (!token) {
    return (
      <div className="text-white flex items-center justify-center h-[100dvh] bg-[#000000] font-light tracking-widest text-sm text-gray-500 uppercase text-center p-6">
        ОШИБКА ДОСТУПА. <br/><br/> Пожалуйста, войдите через основную платформу Alverium.
      </div>
    );
  }

  return (
    <LiveKitRoom 
      video={true} 
      audio={true} 
      token={token} 
      serverUrl={roomUrl} 
      data-lk-theme="none"
      onDisconnected={handleDisconnect}
    >
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ====================================================
// КОРНЕВОЙ КОМПОНЕНТ
// ====================================================
export default function RoomPage() {
  return (
    <Suspense fallback={<div className="text-white flex items-center justify-center h-[100dvh] bg-[#000000] font-light tracking-widest text-sm text-gray-500">ЗАГРУЗКА ALVERIUM...</div>}>
      <RoomContent />
    </Suspense>
  );
}
