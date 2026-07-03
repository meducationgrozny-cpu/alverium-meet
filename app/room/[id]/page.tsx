"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@livekit/components-styles';
import {
  LiveKitRoom, RoomAudioRenderer, GridLayout, ParticipantTile,
  useTracks, TrackToggle, DisconnectButton, useChat,
  useRoomContext, useParticipants
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';

const AlveriumWhiteboard = dynamic(() => import('./Whiteboard'), { ssr: false });

function parseJwtAdmin(token: string | null) {
  if (!token) return false;
  try {
    const payload = JSON.parse(decodeURIComponent(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    return payload?.video?.roomAdmin === true;
  } catch (e) { return false; }
}

const SettingsIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const RecordIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 group-hover:stroke-red-500"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor" className="text-red-600 group-hover:text-red-500" /></svg>);
const PenIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942a.375.375 0 01-.475-.475l.942-2.827a4.5 4.5 0 011.12-1.89l13.13-13.132z" /></svg>);
const SidebarIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>);
const SendIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const MuteIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const KickIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>);

// ПЛАВАЮЩЕЕ ВИДЕО ДЛЯ ДОСКИ И ЭКРАНА (Только для Спикера)
function DraggableCameras({ tracks }: { tracks: any[] }) {
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0 });

  if (tracks.length === 0) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.dragging) setPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className="absolute z-50 flex flex-col gap-2 w-28 md:w-48 cursor-grab active:cursor-grabbing"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {tracks.map(track => (
        <div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-none">
          <ParticipantTile trackRef={track} />
        </div>
      ))}
    </div>
  );
}

function ScreenShareWrapper({ tracks, isHost, room }: { tracks: any[], isHost: boolean, room: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  const drawLine = (x0: number, y0: number, x1: number, y1: number, color = '#ef4444') => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width; tempCanvas.height = canvasRef.current.height;
        tempCanvas.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
        canvasRef.current.width = containerRef.current.clientWidth; canvasRef.current.height = containerRef.current.clientHeight;
        canvasRef.current.getContext('2d')?.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== 'SCREEN_DRAW') return;
        if (msg.action === 'clear') clearCanvas();
        else if (msg.action === 'line' && canvasRef.current) drawLine(msg.x0 * canvasRef.current.width, msg.y0 * canvasRef.current.height, msg.x1 * canvasRef.current.width, msg.y1 * canvasRef.current.height, msg.color);
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost || !isDrawingMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    lastPos.current = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isHost || !isDrawingMode || !canvasRef.current || !lastPos.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; const y = (e.clientY - rect.top) / rect.height;
    drawLine(lastPos.current.x * canvasRef.current.width, lastPos.current.y * canvasRef.current.height, x * canvasRef.current.width, y * canvasRef.current.height);
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'SCREEN_DRAW', action: 'line', x0: lastPos.current.x, y0: lastPos.current.y, x1: x, y1: y, color: '#ef4444' })), { reliable: true });
    lastPos.current = {x, y};
  };

  const onPointerUp = () => { lastPos.current = null; };

  const broadcastClear = () => {
    clearCanvas();
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'SCREEN_DRAW', action: 'clear' })), { reliable: true });
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl bg-black" ref={containerRef}>
      <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}><ParticipantTile /></GridLayout>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerOut={onPointerUp} className={`absolute inset-0 z-10 w-full h-full ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`} style={{ touchAction: 'none' }} />
      {isHost && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-2xl transition-all">
          <button onClick={() => setIsDrawingMode(!isDrawingMode)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${isDrawingMode ? 'bg-red-800 text-white' : 'text-gray-400'}`}>{isDrawingMode ? 'Рисование: ВКЛ' : 'Рисовать'}</button>
          {isDrawingMode && <button onClick={broadcastClear} className="px-3 py-2 text-gray-400 hover:text-red-400 rounded-lg text-xs font-bold uppercase">Очистить</button>}
        </div>
      )}
    </div>
  );
}

function AlveriumSidebar({ isOpen, onClose, isHost }: { isOpen: boolean, onClose: () => void, isHost: boolean }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const { send, chatMessages, isSending } = useChat();
  const participants = useParticipants();
  const room = useRoomContext();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => { e.preventDefault(); if (message.trim()) { send(message); setMessage(""); } };
  const handleMute = (identity: string) => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'FORCE_MUTE', target: identity })), { reliable: true });
  const handleKick = (identity: string) => { if(window.confirm("Удалить пользователя?")) room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'KICK', target: identity })), { reliable: true }); };

  return (
    <>
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={onClose} />}
      <div className={`fixed md:relative inset-y-0 right-0 z-40 flex flex-col h-full bg-[#050505] border-l border-white/5 w-[85%] md:w-80 shrink-0 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-3 border-b border-white/5 flex flex-col gap-3">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase">Панель управления</h2>
            <button onClick={onClose} className="md:hidden text-gray-400"><CloseIcon /></button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg">
            <button onClick={() => setActiveTab('chat')} className={`flex-1 text-xs py-2 rounded-md ${activeTab === 'chat' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500'}`}>Чат</button>
            <button onClick={() => setActiveTab('participants')} className={`flex-1 text-xs py-2 rounded-md ${activeTab === 'participants' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500'}`}>Участники ({participants.length})</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'chat' && (
            <div className="space-y-5 h-full flex flex-col justify-end">
              {chatMessages.map((msg, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] text-gray-500 mb-1 ml-1">{(msg.from as any)?.name || msg.from?.identity || "Гость"}</span>
                  <div className="bg-white/5 text-sm p-3 rounded-2xl rounded-tl-sm border border-white/5">{msg.message}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'participants' && (
            <div className="space-y-3">
              {participants.map((p) => (
                <div key={p.identity} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">{p.name?.[0]?.toUpperCase() || p.identity[0].toUpperCase()}</div>
                    <span className="text-sm truncate">{p.name || p.identity}</span>
                  </div>
                  {isHost && !p.isLocal && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleMute(p.identity)} className="p-1.5 text-gray-500"><MuteIcon /></button>
                      <button onClick={() => handleKick(p.identity)} className="p-1.5 text-red-500"><KickIcon /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {activeTab === 'chat' && (
          <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex gap-3">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Написать..." className="flex-1 bg-white/5 text-white text-sm px-4 py-3 rounded-xl border-none outline-none" />
            <button type="submit" disabled={!message.trim()} className="bg-red-800 text-white w-12 rounded-xl flex items-center justify-center"><SendIcon /></button>
          </form>
        )}
      </div>
    </>
  );
}

function AlveriumStage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Добавляем ID хоста, чтобы отфильтровать камеры
  const [hostIdentity, setHostIdentity] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = useRoomContext();

  useEffect(() => { setIsHost(parseJwtAdmin(token)); }, [token]);

  // FIX: Определяем, кто в комнате Хост
  useEffect(() => {
    const handleParticipantConnected = (p: any) => {
      // Ищем в метадате или имени маркер администратора.
      // Если мы сами хост, мы можем заявить об этом всем.
      if (isHost && isWhiteboardOpen) {
        setTimeout(() => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'WHITEBOARD_TOGGLE', isOpen: true, hostId: room.localParticipant.identity })), { reliable: true }), 1000);
      }
    };
    
    // Если мы сами заходим и мы хост
    if (isHost) {
      setHostIdentity(room.localParticipant.identity);
    }

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [room, isHost, isWhiteboardOpen]);

  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WHITEBOARD_TOGGLE') {
          setIsWhiteboardOpen(msg.isOpen);
          // Ученик запоминает ID хоста
          if (msg.hostId) setHostIdentity(msg.hostId);
          // Или если сигнал пришел от конкретного участника, считаем его хостом
          else if (participant) setHostIdentity(participant.identity);
        }
        else if (msg.type === 'FORCE_MUTE' && msg.target === room.localParticipant.identity) room.localParticipant.setMicrophoneEnabled(false);
        else if (msg.type === 'KICK' && msg.target === room.localParticipant.identity) { alert("Удалены."); room.disconnect(); }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const toggleWhiteboard = () => {
    const newState = !isWhiteboardOpen; setIsWhiteboardOpen(newState);
    if (isHost) {
      setHostIdentity(room.localParticipant.identity);
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'WHITEBOARD_TOGGLE', isOpen: newState, hostId: room.localParticipant.identity })), { reliable: true });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: true, preferCurrentTab: true } as any);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        setIsRecording(false); stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) uploadRecordedLesson(blob);
      };
      mediaRecorderRef.current = recorder; recorder.start(1000); setIsRecording(true);
    } catch (err) { alert("Не удалось запустить запись."); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop(); };

  const uploadRecordedLesson = async (blob: Blob) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const filename = `Alverium_Lesson_${new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19)}.webm`;
    for (let i = 0; i < totalChunks; i++) {
      const fd = new FormData();
      fd.append('file', blob.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, blob.size)), filename);
      fd.append('filename', filename); fd.append('chunkIndex', String(i)); fd.append('totalChunks', String(totalChunks)); fd.append('folder', 'common');
      try {
        await fetch('https://video.alverium.ru/upload_chunk', { method: 'POST', body: fd });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) { setUploadProgress(0); return; }
    }
    alert("Урок загружен!"); setUploadProgress(0);
  };

  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  // ФИЛЬТРАЦИЯ: Оставляем только камеру спикера (Хоста) для плавающего окна
  const speakerCameraTracks = cameraTracks.filter(track => {
    // Если хост определен, показываем только его. Иначе показываем всех (на всякий случай)
    if (hostIdentity) {
      return track.participant.identity === hostIdentity;
    }
    return true; 
  });

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white relative">
      <header className="flex justify-between px-4 py-3 bg-[#050505]/80 border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center font-bold">A</div>
          <h1 className="text-sm font-semibold hidden md:block">Alverium Meet</h1>
          {uploadProgress > 0 && <div className="text-[10px] text-green-400">Выгрузка: {uploadProgress}%</div>}
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
          <span className="text-[10px] text-gray-400">{isRecording ? 'ИДЕТ ЗАПИСЬ' : 'В ЭФИРЕ'}</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative bg-[#0a0a0a]">
        <div className="flex-1 relative overflow-hidden">
          {/* ФОНОВЫЙ КОНТЕНТ (ДОСКА ИЛИ ЭКРАН) */}
          {isWhiteboardOpen ? (
            <div className="absolute inset-0 z-0 p-0 md:p-2"><AlveriumWhiteboard isHost={isHost} /></div>
          ) : hasScreenShare ? (
            <div className="absolute inset-0 z-0 p-0 md:p-2"><ScreenShareWrapper tracks={screenTracks} isHost={isHost} room={room} /></div>
          ) : (
            <div className="absolute inset-0 p-2 md:p-4"><GridLayout tracks={cameraTracks} style={{ height: '100%' }}><ParticipantTile /></GridLayout></div>
          )}

          {/* ПЛАВАЮЩЕЕ ОКНО: теперь только Спикер */}
          {(isWhiteboardOpen || hasScreenShare) && <DraggableCameras tracks={speakerCameraTracks} />}
        </div>
        <AlveriumSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isHost={isHost} />
      </main>

      <footer className="bg-[#050505] px-4 py-3 flex justify-between z-20 border-t border-white/5 shrink-0">
        <div className="flex gap-2 w-auto md:w-1/3">
          <button className="hidden md:flex w-12 h-12 bg-white/5 rounded-xl items-center justify-center text-gray-400"><SettingsIcon /></button>
          {isHost && <button onClick={isRecording ? stopRecording : startRecording} className={`hidden md:flex w-12 h-12 rounded-xl items-center justify-center ${isRecording ? 'bg-red-900/40 text-red-500' : 'bg-white/5 text-gray-400'}`}><RecordIcon /></button>}
          {isHost && <button onClick={toggleWhiteboard} className={`flex w-10 h-10 md:w-12 md:h-12 rounded-xl items-center justify-center ${isWhiteboardOpen ? 'bg-red-800 text-white' : 'bg-white/5 text-gray-400'}`}><PenIcon /></button>}
        </div>
        <div className="flex gap-1 bg-[#0a0a0a] px-2 py-1.5 rounded-2xl border border-white/5">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent !w-10 !h-10 text-gray-300" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent !w-10 !h-10 text-gray-300" />
          {isHost && <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent !w-10 !h-10 text-gray-300" />}
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 text-gray-300 flex items-center justify-center"><SidebarIcon /></button>
        </div>
        <div className="flex justify-end w-auto md:w-1/3">
          <DisconnectButton className="!bg-red-800 !text-white px-4 md:px-6 py-2.5 !rounded-xl text-[10px] font-bold"><span className="hidden md:inline">Завершить</span><span className="md:hidden">Выйти</span></DisconnectButton>
        </div>
      </footer>
    </div>
  );
}

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  if (!token) return <div className="text-white flex items-center justify-center h-[100dvh] bg-black text-sm uppercase p-6 text-center">ОШИБКА ДОСТУПА. Войдите через платформу Alverium.</div>;
  return (<LiveKitRoom video={true} audio={true} token={token} serverUrl="wss://meet.alverium.ru" data-lk-theme="none" onDisconnected={() => router.push(process.env.NEXT_PUBLIC_LMS_RETURN_URL || '/')}><AlveriumStage /><RoomAudioRenderer /></LiveKitRoom>);
}

export default function RoomPage() {
  return (<Suspense fallback={<div className="bg-black text-white h-[100dvh] flex items-center justify-center">ЗАГРУЗКА...</div>}><RoomContent /></Suspense>);
}
