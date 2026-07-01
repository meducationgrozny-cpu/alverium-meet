"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackToggle,
  DisconnectButton,
  useChat,
  useRoomContext,
  useParticipants
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';

const AlveriumWhiteboard = dynamic(() => import('./Whiteboard'), { 
  ssr: false,
  loading: () => <div className="text-gray-500 font-light text-xs animate-pulse p-4">Загрузка доски...</div>
});

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
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.video?.roomAdmin === true;
    } catch (e2) {
      return false;
    }
  }
}

// ====================================================
// ИКОНКИ
// ====================================================
const SettingsIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const RecordIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 group-hover:stroke-red-500 transition-colors"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor" className="text-red-600 group-hover:text-red-500 transition-colors" /></svg>);
const PenIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942a.375.375 0 01-.475-.475l.942-2.827a4.5 4.5 0 011.12-1.89l13.13-13.132z" /></svg>);
const SidebarIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>);
const SendIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const MuteIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const KickIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>);


// ====================================================
// ИНТЕРАКТИВНЫЙ ХОЛСТ ПОВЕРХ ТРАНСЛЯЦИИ ЭКРАНА (ZOOM KILLER)
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
    ctx.lineWidth = 4;
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
    setTimeout(handleResize, 100); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== 'SCREEN_DRAW') return;
        
        if (msg.action === 'clear') {
          clearCanvas();
        } else if (msg.action === 'line' && canvasRef.current) {
          const w = canvasRef.current.width;
          const h = canvasRef.current.height;
          drawLine(msg.x0 * w, msg.y0 * h, msg.x1 * w, msg.y1 * h, msg.color);
        }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost || !isDrawingMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    lastPos.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
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
    const msg = JSON.stringify({ type: 'SCREEN_DRAW', action: 'clear' });
    room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl bg-black" ref={containerRef}>
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-2xl transition-all">
          <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isDrawingMode ? 'bg-red-800 text-white shadow-[0_0_15px_rgba(153,27,27,0.5)]' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'}`}>
            {isDrawingMode ? 'Рисование: ВКЛ' : 'Рисовать'}
          </button>
          {isDrawingMode && (
            <button onClick={broadcastClear} className="px-3 py-2 bg-transparent hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded-lg text-xs font-bold uppercase transition-all">
              Очистить
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ====================================================
// БОКОВАЯ ПАНЕЛЬ (ЧАТ + УЧАСТНИКИ)
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

  const handleMute = (identity: string) => {
    const msg = JSON.stringify({ type: 'FORCE_MUTE', target: identity });
    room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
  };

  const handleKick = (identity: string) => {
    if(window.confirm("Удалить пользователя с урока?")) {
      const msg = JSON.stringify({ type: 'KICK', target: identity });
      room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
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
// ГЛАВНЫЙ ИНТЕРФЕЙС КОМНАТЫ С ЗАПИСЬЮ
// ====================================================
function AlveriumStage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isHost, setIsHost] = useState(false); 

  // --- Стейты и рефы для записи ---
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = useRoomContext(); 

  useEffect(() => { setIsHost(parseJwtAdmin(token)); }, [token]);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WHITEBOARD_TOGGLE') setIsWhiteboardOpen(msg.isOpen);
        else if (msg.type === 'FORCE_MUTE' && msg.target === room.localParticipant.identity) room.localParticipant.setMicrophoneEnabled(false);
        else if (msg.type === 'KICK' && msg.target === room.localParticipant.identity) {
          alert("Организатор удалил вас с урока.");
          room.disconnect();
        }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room]);

  const toggleWhiteboard = () => {
    const newState = !isWhiteboardOpen;
    setIsWhiteboardOpen(newState);
    if (isHost) room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'WHITEBOARD_TOGGLE', isOpen: newState })), { reliable: true });
  };

  // --- Логика Записи Урока ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        // @ts-ignore
        preferCurrentTab: true 
      });

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) {
          uploadRecordedLesson(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); 
      setIsRecording(true);
    } catch (err) {
      console.error("Ошибка запуска записи:", err);
      alert("Не удалось запустить запись. Убедитесь, что разрешили доступ к вкладке.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadRecordedLesson = async (blob: Blob) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const folder = "common";
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Alverium_Lesson_${dateStr}.webm`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);

      const fd = new FormData();
      fd.append('file', chunk);
      fd.append('filename', filename);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('folder', folder);

      try {
        await fetch('https://video.alverium.ru/upload_chunk', {
          method: 'POST',
          body: fd
        });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        alert(`Ошибка при загрузке части ${i + 1} из ${totalChunks}`);
        setUploadProgress(0);
        return;
      }
    }
    alert("Урок успешно загружен в VOD консоль!");
    setUploadProgress(0);
  };

  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white font-sans selection:bg-red-900/50 relative">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-800 to-red-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">A</div>
          <h1 className="text-sm font-semibold text-gray-100 tracking-wide hidden md:block">Alverium <span className="font-light text-gray-500">Meet</span></h1>
          
          {uploadProgress > 0 && (
            <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-900/20 px-3 py-1 rounded-full border border-green-800/50">
              Выгрузка: {uploadProgress}%
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
          {isRecording ? (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
          )}
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">
            {isRecording ? 'Идет запись' : 'В эфире'}
          </span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-[#0a0a0a]">
          {isWhiteboardOpen ? (
            <>
              <div className="absolute inset-0 p-2 md:p-4"><AlveriumWhiteboard isHost={isHost} /></div>
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (<div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"><ParticipantTile trackRef={track} /></div>))}
                </div>
              )}
            </>
          ) : hasScreenShare ? (
            <>
              <div className="absolute inset-0 p-2 md:p-4">
                <ScreenShareWrapper tracks={screenTracks} isHost={isHost} room={room} />
              </div>
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
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
          
          {isHost && (
            <button 
              onClick={isRecording ? stopRecording : startRecording} 
              className={`hidden md:flex items-center justify-center w-12 h-12 rounded-xl transition-all relative overflow-hidden ${isRecording ? 'bg-red-900/40 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/5 hover:bg-red-900/20 text-gray-400'}`}
              title={isRecording ? "Остановить запись" : "Начать запись"}
            >
              <RecordIcon />
              {uploadProgress > 0 && <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>}
            </button>
          )}

          {isHost && (
            <button onClick={toggleWhiteboard} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border transition-all ${isWhiteboardOpen ? 'bg-red-800 border-red-600 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}><PenIcon /></button>
          )}
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 bg-[#0a0a0a] px-2 py-1.5 md:px-3 md:py-2 rounded-2xl border border-white/5 shadow-2xl">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          {isHost && <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />}
          <div className="w-[1px] h-6 bg-white/10 mx-1 md:mx-2"></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border transition-all ${isSidebarOpen ? 'bg-white/10 text-white' : 'bg-transparent text-gray-300 hover:text-white'}`}><SidebarIcon /></button>
        </div>

        <div className="flex justify-end w-auto md:w-1/3">
          <DisconnectButton className="!bg-red-800 hover:!bg-red-700 !text-white px-4 md:px-6 py-2.5 md:py-3 !rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] !border !border-red-600/50">
            <span className="hidden md:inline">Завершить</span><span className="md:hidden">Выйти</span>
          </DisconnectButton>
        </div>
      </footer>
    </div>
  );
}

// ====================================================
// ОБОЛОЧКА И МАРШРУТИЗАЦИЯ
// ====================================================
function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const roomUrl = "wss://meet.alverium.ru";

  if (!token) return <div className="text-white flex items-center justify-center h-[100dvh] bg-black text-sm uppercase p-6 text-center">ОШИБКА ДОСТУПА. Войдите через платформу Alverium.</div>;

  return (
    <LiveKitRoom video={true} audio={true} token={token} serverUrl={roomUrl} data-lk-theme="none" onDisconnected={() => router.push(process.env.NEXT_PUBLIC_LMS_RETURN_URL || '/')}>
      <AlveriumStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="text-white flex items-center justify-center h-[100dvh] bg-black">ЗАГРУЗКА...</div>}>
      <RoomContent />
    </Suspense>
  );
}
