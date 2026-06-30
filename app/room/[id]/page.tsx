"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackToggle,
  useChat,
  useRoomContext,
  useParticipants
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';

// ====================================================
// ПАРСЕР ТОКЕНА
// ====================================================
function parseJwtAdmin(token: string | null) {
  if (!token) return false;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return false;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload?.video?.roomAdmin === true;
  } catch (e) {
    try {
      return JSON.parse(atob(token.split('.')[1]))?.video?.roomAdmin === true;
    } catch (e2) {
      return false;
    }
  }
}

// ====================================================
// ИКОНКИ
// ====================================================
const SettingsIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const RecordIcon = ({ isRecording }: { isRecording?: boolean }) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-5 h-5 ${isRecording ? 'stroke-red-500 animate-pulse' : 'group-hover:stroke-red-500 transition-colors'}`}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor" className={`${isRecording ? 'text-red-500' : 'text-red-600 group-hover:text-red-500'} transition-colors`} /></svg>);
const SidebarIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>);
const SendIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const MuteIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const KickIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>);

// ====================================================
// ИНТЕРАКТИВНЫЙ ХОЛСТ ПОВЕРХ ТРАНСЛЯЦИИ ЭКРАНА
// ====================================================
function ScreenShareWrapper({ tracks, isHost, room }: { tracks: any[], isHost: boolean, room: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  const drawLine = (x0: number, y0: number, x1: number, y1: number, color = '#ef4444') => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = window.innerWidth < 768 ? 2 : 4; // Тоньше на мобилках
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        tempCanvas.getContext('2d')?.drawImage(canvasRef.current, 0, 0);

        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        canvasRef.current.getContext('2d')?.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 500); 
    return () => window.removeEventListener('resize', handleResize);
  }, [tracks]);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== 'SCREEN_DRAW') return;
        if (msg.action === 'clear') clearCanvas();
        else if (msg.action === 'line' && canvasRef.current) {
          drawLine(msg.x0 * canvasRef.current.width, msg.y0 * canvasRef.current.height, msg.x1 * canvasRef.current.width, msg.y1 * canvasRef.current.height, msg.color);
        }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost || !isDrawingMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    lastPos.current = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isHost || !isDrawingMode || !canvasRef.current || !lastPos.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    drawLine(lastPos.current.x * canvasRef.current.width, lastPos.current.y * canvasRef.current.height, x * canvasRef.current.width, y * canvasRef.current.height);
    const msg = JSON.stringify({ type: 'SCREEN_DRAW', action: 'line', x0: lastPos.current.x, y0: lastPos.current.y, x1: x, y1: y, color: '#ef4444' });
    room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
    
    lastPos.current = {x, y};
  };

  const onPointerUp = () => { lastPos.current = null; };

  const broadcastClear = () => {
    clearCanvas();
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'SCREEN_DRAW', action: 'clear' })), { reliable: true });
  };

  return (
    <div className="relative w-full h-full rounded-none md:rounded-xl overflow-hidden shadow-2xl bg-black" ref={containerRef}>
      <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
        <ParticipantTile />
      </GridLayout>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerUp}
        className={`absolute inset-0 z-10 w-full h-full ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={{ touchAction: 'none' }}
      />
      {isHost && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-2xl">
          <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isDrawingMode ? 'bg-red-800 text-white shadow-[0_0_15px_rgba(153,27,27,0.5)]' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'}`}>
            {isDrawingMode ? 'Рисование: ВКЛ' : 'Рисовать (Выкл)'}
          </button>
          {isDrawingMode && (
            <button onClick={broadcastClear} className="px-3 py-2 bg-transparent hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded-lg text-xs font-bold uppercase transition-all">Очистить</button>
          )}
        </div>
      )}
    </div>
  );
}

// ====================================================
// БОКОВАЯ ПАНЕЛЬ
// ====================================================
function AlveriumSidebar({ isOpen, onClose, isHost }: { isOpen: boolean, onClose: () => void, isHost: boolean }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const { send, chatMessages, isSending } = useChat();
  const participants = useParticipants();
  const room = useRoomContext();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) { send(message); setMessage(""); }
  };

  const handleMute = (identity: string) => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'FORCE_MUTE', target: identity })), { reliable: true });
  const handleKick = (identity: string) => {
    if(window.confirm("Удалить пользователя с урока?")) {
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'KICK', target: identity })), { reliable: true });
    }
  };

  return (
    <>
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={onClose} />}
      <div className={`fixed md:relative inset-y-0 right-0 z-40 flex flex-col h-full bg-[#050505] border-l border-white/5 w-[85%] md:w-80 shrink-0 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-3 border-b border-white/5 flex flex-col gap-3">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Панель управления</h2>
            <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white"><CloseIcon /></button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg">
            <button onClick={() => setActiveTab('chat')} className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${activeTab === 'chat' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Чат</button>
            <button onClick={() => setActiveTab('participants')} className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${activeTab === 'participants' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Участники ({participants.length})</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeTab === 'chat' && (
            <div className="space-y-5 h-full flex flex-col justify-end">
              {chatMessages.length === 0 ? <div className="text-gray-600 text-xs text-center mt-auto mb-auto font-light">Тишина в аудитории...</div> : chatMessages.map((msg, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] text-gray-500 mb-1.5 ml-1">{(msg.from as any)?.name || msg.from?.identity || "Гость"}</span>
                  <div className="bg-white/5 text-sm text-gray-200 p-3.5 rounded-2xl rounded-tl-sm border border-white/5 font-light break-words">{msg.message}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'participants' && (
            <div className="space-y-3">
              {participants.map((p) => (
                <div key={p.identity} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">{p.name?.[0]?.toUpperCase() || p.identity[0].toUpperCase()}</div>
                    <span className="text-sm font-medium text-gray-200 truncate">{p.name || p.identity} {p.isLocal && <span className="text-[9px] text-gray-500">(Вы)</span>}</span>
                  </div>
                  {isHost && !p.isLocal && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleMute(p.identity)} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg"><MuteIcon /></button>
                      <button onClick={() => handleKick(p.identity)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg"><KickIcon /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'chat' && (
          <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex gap-3 bg-[#030303]">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Написать..." className="flex-1 bg-white/5 text-white text-sm px-4 py-3 rounded-xl border border-white/5 focus:outline-none focus:border-red-900/50" />
            <button type="submit" disabled={isSending || !message.trim()} className="bg-red-800 hover:bg-red-700 text-white w-12 rounded-xl flex items-center justify-center disabled:opacity-30"><SendIcon /></button>
          </form>
        )}
      </div>
    </>
  );
}

// ====================================================
// ГЛАВНЫЙ ИНТЕРФЕЙС
// ====================================================
function AlveriumStage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHost, setIsHost] = useState(false); 

  // Стейты записи экрана
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = useRoomContext(); 
  const router = useRouter();

  useEffect(() => { setIsHost(parseJwtAdmin(token)); }, [token]);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'FORCE_MUTE' && msg.target === room.localParticipant.identity) room.localParticipant.setMicrophoneEnabled(false);
        else if (msg.type === 'KICK' && msg.target === room.localParticipant.identity) {
          alert("Организатор удалил вас с урока.");
          room.disconnect();
        }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room]);

  // --- ЛОГИКА ЗАПИСИ И ЗАГРУЗКИ ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        recordedChunksRef.current = [];
        
        // Автоматически загружаем в VOD
        const filename = `lesson_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        await uploadToVOD(blob, filename);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); 
      setIsRecording(true);
    } catch (err) {
      console.error("Ошибка начала записи:", err);
      alert("Не удалось начать запись. Проверьте разрешения.");
    }
  };

  const uploadToVOD = async (blob: Blob, filename: string) => {
    setUploadProgress(0);
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB как в твоем Flask
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);

      const fd = new FormData();
      fd.append('file', chunk);
      fd.append('filename', filename);
      fd.append('chunkIndex', i.toString());
      fd.append('totalChunks', totalChunks.toString());
      fd.append('folder', 'common');

      try {
        await fetch('https://video.alverium.ru/upload_chunk', { method: 'POST', body: fd });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        console.error("Ошибка загрузки чанка", e);
      }
    }
    
    setUploadProgress(null);
    alert("Запись успешно загружена в VOD консоль!");
    exitRoom(); // Выходим из комнаты после успешной загрузки
  };

  const handleEndClassClick = () => {
    if (isRecording && mediaRecorderRef.current) {
      if (window.confirm("Остановить запись и загрузить видео на сервер VOD? (Пожалуйста, не закрывайте вкладку во время загрузки)")) {
        mediaRecorderRef.current.stop(); // Это триггерит onstop и загрузку
      }
    } else {
      if (window.confirm("Завершить урок и выйти?")) exitRoom();
    }
  };

  const exitRoom = () => {
    room.disconnect();
  };

  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white font-sans selection:bg-red-900/50 relative">
      
      {/* ПЛАШКА ЗАГРУЗКИ (Блокирует экран при загрузке) */}
      {uploadProgress !== null && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          <h2 className="text-2xl font-bold mb-4">Сохранение записи урока...</h2>
          <p className="text-gray-400 mb-8 text-center max-w-md">Пожалуйста, не закрывайте эту вкладку! Видео отправляется в VOD консоль.</p>
          <div className="w-full max-w-md h-4 bg-gray-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <span className="text-red-500 font-bold">{uploadProgress}%</span>
        </div>
      )}

      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-800 to-red-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">A</div>
          <h1 className="text-sm font-semibold text-gray-100 tracking-wide hidden md:block">Alverium <span className="font-light text-gray-500">Meet</span></h1>
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
          <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'} animate-pulse`}></div>
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">{isRecording ? 'ИДЕТ ЗАПИСЬ' : 'В эфире'}</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-[#0a0a0a]">
          {hasScreenShare ? (
            <>
              {/* Демонстрация экрана во всю ширину (особенно на мобильных) */}
              <div className="absolute inset-0 md:p-4">
                <ScreenShareWrapper tracks={screenTracks} isHost={isHost} room={room} />
              </div>
              {/* Плавающие камеры поверх трансляции */}
              {cameraTracks.length > 0 && (
                <div className="absolute top-4 right-4 md:bottom-6 md:right-6 md:top-auto z-20 w-24 md:w-48 max-h-[50vh] overflow-y-auto flex flex-col gap-2 p-1 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (<div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"><ParticipantTile trackRef={track} /></div>))}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 p-2 md:p-4"><GridLayout tracks={cameraTracks} style={{ height: '100%' }}><ParticipantTile /></GridLayout></div>
          )}
        </div>
        <AlveriumSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isHost={isHost} />
      </main>

      <footer className="bg-[#050505]/90 backdrop-blur-2xl px-4 md:px-8 py-3 md:py-4 flex justify-between items-center z-20 border-t border-white/5 shrink-0">
        <div className="flex gap-2 md:gap-3 w-auto md:w-1/3">
          <button onClick={() => alert('Настройки (в разработке)')} className="hidden md:flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"><SettingsIcon /></button>
          
          {/* КНОПКА ЗАПИСИ (Только для Преподавателя) */}
          {isHost && (
            <button 
              onClick={() => isRecording ? handleEndClassClick() : startRecording()} 
              title="Начать запись экрана"
              className={`hidden md:flex items-center justify-center w-12 h-12 rounded-xl border transition-all ${isRecording ? 'bg-red-900/40 border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-white/5 border-white/5 hover:bg-red-900/20'} text-gray-400 group`}
            >
              <RecordIcon isRecording={isRecording} />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 bg-[#0a0a0a] px-2 py-1.5 md:px-3 md:py-2 rounded-2xl border border-white/5 shadow-2xl">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          {isHost && <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />}
          <div className="w-[1px] h-6 bg-white/10 mx-1 md:mx-2"></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex items-center justify-center w-10 h-10 md:w-12 h-12 rounded-xl border transition-all ${isSidebarOpen ? 'bg-white/10 text-white' : 'bg-transparent text-gray-300 hover:text-white'}`}><SidebarIcon /></button>
        </div>

        <div className="flex justify-end w-auto md:w-1/3">
          <button onClick={handleEndClassClick} className="bg-red-800 hover:bg-red-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] border border-red-600/50">
            <span className="hidden md:inline">Завершить</span><span className="md:hidden">Выйти</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

// ====================================================
// ОБОЛОЧКА
// ====================================================
export default function RoomPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  if (!token) return <div className="text-white flex items-center justify-center h-[100dvh] bg-black text-sm uppercase">ОШИБКА ДОСТУПА.</div>;

  return (
    <Suspense fallback={<div className="text-white flex items-center justify-center h-[100dvh] bg-black">ЗАГРУЗКА...</div>}>
      <LiveKitRoom video={true} audio={true} token={token} serverUrl="wss://meet.alverium.ru" data-lk-theme="none" onDisconnected={() => router.push(process.env.NEXT_PUBLIC_LMS_RETURN_URL || '/')}>
        <AlveriumStage />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </Suspense>
  );
}