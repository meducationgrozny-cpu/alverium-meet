"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import '@livekit/components-styles';
import {
  LiveKitRoom, RoomAudioRenderer, GridLayout, ParticipantTile,
  useTracks, TrackToggle, DisconnectButton, useChat,
  useRoomContext, useParticipants, useConnectionState, VideoTrack
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';

const AlveriumWhiteboard = dynamic(() => import('./Whiteboard'), { ssr: false });

function parseJwtAdmin(token: string | null) {
  if (!token) return false;
  try {
    const payload = JSON.parse(decodeURIComponent(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    return payload?.video?.roomAdmin === true;
  } catch (e) { return false; }
}

// ==========================================
// ИКОНКИ
// ==========================================
const SettingsIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const RecordIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 group-hover:stroke-red-500"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor" className="text-current" /></svg>);
const PenIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942a.375.375 0 01-.475-.475l.942-2.827a4.5 4.5 0 011.12-1.89l13.13-13.132z" /></svg>);
const SidebarIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>);
const SendIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const MuteIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const KickIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>);
const ScreenShareIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>);

// ==========================================
// TOAST КОМПОНЕНТ
// ==========================================
const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
  <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5 pointer-events-none'}`}>
    <div className="bg-black/90 backdrop-blur-md border border-white/10 text-white px-6 py-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] font-medium text-sm flex items-center gap-3">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
      {message}
    </div>
  </div>
);

// ==========================================
// МОДАЛКА НАСТРОЕК
// ==========================================
const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'visual' | 'diagnostics'>('diagnostics');
  const connectionState = useConnectionState();
  const room = useRoomContext();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#050505] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Настройки комнаты</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><CloseIcon /></button>
        </div>
        <div className="flex border-b border-white/5">
          <button onClick={() => setActiveTab('devices')} className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'devices' ? 'text-red-500 border-b-2 border-red-500 bg-red-500/10' : 'text-gray-400 hover:text-gray-200'}`}>Устройства</button>
          <button onClick={() => setActiveTab('visual')} className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'visual' ? 'text-red-500 border-b-2 border-red-500 bg-red-500/10' : 'text-gray-400 hover:text-gray-200'}`}>Визуал</button>
          <button onClick={() => setActiveTab('diagnostics')} className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'diagnostics' ? 'text-red-500 border-b-2 border-red-500 bg-red-500/10' : 'text-gray-400 hover:text-gray-200'}`}>Диагностика</button>
        </div>
        <div className="p-6 h-72 overflow-y-auto text-sm text-gray-300">
          {activeTab === 'diagnostics' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-gray-400">WebRTC Статус:</span>
                <span className={connectionState === ConnectionState.Connected ? 'text-green-500' : 'text-red-500'}>{connectionState}</span>
              </div>
              <div className="flex justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-gray-400">Разрешение экрана:</span>
                <span>{window.innerWidth} x {window.innerHeight}</span>
              </div>
              <div className="flex justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-gray-400">Имя комнаты:</span>
                <span>{room?.name || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// УМНАЯ КАМЕРА (СТРОГИЕ ГРАНИЦЫ И БЕЗ ИМЕН)
// ==========================================
function DraggableCameras({ tracks }: { tracks: any[] }) {
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  if (tracks.length === 0) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const rect = dragRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current || !dragRef.current.parentElement) return;
    const parent = dragRef.current.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const maxX = parent.clientWidth - dragRef.current.offsetWidth;
    const maxY = parent.clientHeight - dragRef.current.offsetHeight;
    let newX = e.clientX - parentRect.left - offsetRef.current.x;
    let newY = e.clientY - parentRect.top - offsetRef.current.y;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    setPos({ x: newX, y: newY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  return (
    <div 
      ref={dragRef}
      className={`absolute z-50 flex flex-col gap-2 w-28 md:w-48 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} active:cursor-grabbing`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {tracks.map(track => (
        <div key={track.publication?.trackSid || track.participant.identity} className={`w-full aspect-video bg-black rounded-xl border ${isDragging ? 'border-red-500' : 'border-white/20'} shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden transition-colors`}>
          <VideoTrack trackRef={track} className="w-full h-full object-cover pointer-events-none" />
        </div>
      ))}
    </div>
  );
}

// ==========================================
// ЧАТ И САЙДБАР (ПОЛНОЕ СХЛОПЫВАНИЕ)
// ==========================================
function AlveriumSidebar({ isOpen, onClose, isHost }: { isOpen: boolean, onClose: () => void, isHost: boolean }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const { send, chatMessages } = useChat();
  const participants = useParticipants();
  const room = useRoomContext();
  const [message, setMessage] = useState("");

  const handleSend = (e: React.FormEvent) => { e.preventDefault(); if (message.trim()) { send(message); setMessage(""); } };
  const handleMute = (identity: string) => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'FORCE_MUTE', target: identity })), { reliable: true });
  const handleKick = (identity: string) => { if(window.confirm("Удалить пользователя?")) room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'KICK', target: identity })), { reliable: true }); };

  return (
    <>
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={onClose} />}
      <div className={`fixed md:relative inset-y-0 right-0 z-40 flex flex-col h-full bg-[#050505] border-l border-white/5 shrink-0 transform transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'translate-x-0 w-[85%] md:w-80 md:opacity-100' : 'translate-x-full md:translate-x-0 w-0 opacity-0 border-none'}`}>
        <div className="p-3 border-b border-white/5 flex flex-col gap-3 w-full md:w-80 shrink-0">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase">Панель управления</h2>
            <button onClick={onClose} className="md:hidden text-gray-400"><CloseIcon /></button>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg">
            <button onClick={() => setActiveTab('chat')} className={`flex-1 text-xs py-2 rounded-md ${activeTab === 'chat' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500'}`}>Чат</button>
            <button onClick={() => setActiveTab('participants')} className={`flex-1 text-xs py-2 rounded-md ${activeTab === 'participants' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500'}`}>Участники ({participants.length})</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 w-full md:w-80 shrink-0">
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
          <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex gap-3 w-full md:w-80 shrink-0">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Написать..." className="flex-1 bg-white/5 text-white text-sm px-4 py-3 rounded-xl border-none outline-none" />
            <button type="submit" disabled={!message.trim()} className="bg-red-800 text-white w-12 rounded-xl flex items-center justify-center"><SendIcon /></button>
          </form>
        )}
      </div>
    </>
  );
}

// ==========================================
// ГЛАВНАЯ СЦЕНА
// ==========================================
function AlveriumStage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [hostIdentity, setHostIdentity] = useState<string | null>(null);

  // СОСТОЯНИЯ ЗАПИСИ
  const [isRecording, setIsRecording] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = useRoomContext();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });

  useEffect(() => { setIsHost(parseJwtAdmin(token)); }, [token]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  };

  useEffect(() => {
    if (isHost) setHostIdentity(room.localParticipant.identity);
    const handleParticipantConnected = () => {
      if (isHost && isWhiteboardOpen) {
        setTimeout(() => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'WHITEBOARD_TOGGLE', isOpen: true, hostId: room.localParticipant.identity })), { reliable: true }), 1000);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [room, isHost, isWhiteboardOpen]);

  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WHITEBOARD_TOGGLE') {
          setIsWhiteboardOpen(msg.isOpen);
          if (msg.hostId) setHostIdentity(msg.hostId);
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

  // ==========================================
  // ЛОГИКА ЗАПУСКА И ОСТАНОВКИ ЗАПИСИ
  // ==========================================
  const handleRecordClick = async () => {
    if (!isRecording) {
      try {
        showToast("Запуск записи на сервере...");
        const res = await fetch('https://meet.alverium.ru/api/start-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: room.name })
        });
        
        const data = await res.json();
        if (data.success) {
          setEgressId(data.egressId);
          setIsRecording(true);
          showToast("🔴 Запись урока началась!");
        } else {
          showToast("Ошибка запуска: " + data.error);
        }
      } catch (err) {
        console.error('Ошибка при запуске записи:', err);
        showToast("Ошибка соединения с сервером записи");
      }
    } else {
      try {
        showToast("Остановка записи...");
        await fetch('https://meet.alverium.ru/api/stop-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egressId: egressId })
        });
        
        setIsRecording(false);
        setEgressId(null);
        showToast("✅ Запись сохранена в VOD-консоль");
      } catch (err) {
        console.error('Ошибка при остановке записи:', err);
        showToast("Ошибка при остановке записи");
      }
    }
  };

  const speakerCameraTracks = cameraTracks.filter(track => hostIdentity ? track.participant.identity === hostIdentity : true);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white relative">
      <Toast message={toastMsg} visible={toastVisible} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <header className="flex justify-between px-4 py-3 bg-[#050505]/80 border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center font-bold">A</div>
          <h1 className="text-sm font-semibold hidden md:block">Alverium Meet</h1>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="text-[10px] text-gray-400">В ЭФИРЕ</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative bg-[#0a0a0a]">
        <div className="flex-1 relative overflow-hidden transition-all duration-300">
          {isWhiteboardOpen ? (
            <div className="absolute inset-0 z-0 p-0 md:p-2 flex items-center justify-center">
              <AlveriumWhiteboard isHost={isHost} />
            </div>
          ) : (
            <div className="absolute inset-0 p-2 md:p-4"><GridLayout tracks={cameraTracks} style={{ height: '100%' }}><ParticipantTile /></GridLayout></div>
          )}

          {isWhiteboardOpen && <DraggableCameras tracks={speakerCameraTracks} />}
        </div>
        
        <AlveriumSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isHost={isHost} />
      </main>

      <footer className="bg-[#050505] px-4 py-3 flex justify-between z-20 border-t border-white/5 shrink-0">
        <div className="flex gap-2 w-auto md:w-1/3">
          <button onClick={() => setIsSettingsOpen(true)} className="hidden md:flex w-12 h-12 bg-white/5 rounded-xl items-center justify-center text-gray-400 hover:text-white transition-colors"><SettingsIcon /></button>
          
          {/* ОБНОВЛЕННАЯ КНОПКА ЗАПИСИ */}
          {isHost && (
            <button 
              onClick={handleRecordClick} 
              className={`hidden md:flex w-12 h-12 rounded-xl items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-900/40 text-red-500 animate-pulse border border-red-500/30' : 'bg-white/5 text-gray-400 hover:text-red-400'}`}
            >
              <RecordIcon />
            </button>
          )}

          {isHost && <button onClick={toggleWhiteboard} className={`flex w-10 h-10 md:w-12 md:h-12 rounded-xl items-center justify-center transition-colors ${isWhiteboardOpen ? 'bg-red-800 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}><PenIcon /></button>}
        </div>
        
        <div className="flex gap-1 bg-[#0a0a0a] px-2 py-1.5 rounded-2xl border border-white/5">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent !w-10 !h-10 text-gray-300 hover:!text-white" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent !w-10 !h-10 text-gray-300 hover:!text-white" />
          {isHost && <button onClick={() => showToast("Демонстрация экрана находится в разработке. Скоро будет доступно!")} className="w-10 h-10 text-gray-300 hover:text-white flex items-center justify-center transition-colors"><ScreenShareIcon /></button>}
          
          <div className="w-[1px] h-6 bg-white/10 mx-1 mt-2"></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`w-10 h-10 flex items-center justify-center transition-colors rounded-xl ${isSidebarOpen ? 'text-red-500 bg-red-500/10' : 'text-gray-300 hover:text-white'}`}><SidebarIcon /></button>
        </div>
        
        <div className="flex justify-end w-auto md:w-1/3">
          <DisconnectButton className="!bg-red-800 hover:!bg-red-700 !text-white px-4 md:px-6 py-2.5 !rounded-xl text-[10px] font-bold transition-colors"><span className="hidden md:inline">Завершить</span><span className="md:hidden">Выйти</span></DisconnectButton>
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
  return (<LiveKitRoom video={true} audio={true} token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://meet.alverium.ru"} data-lk-theme="none" onDisconnected={() => router.push(process.env.NEXT_PUBLIC_LMS_RETURN_URL || '/')}><AlveriumStage /><RoomAudioRenderer /></LiveKitRoom>);
}

export default function RoomPage() {
  return (<Suspense fallback={<div className="bg-black text-white h-[100dvh] flex items-center justify-center">ЗАГРУЗКА...</div>}><RoomContent /></Suspense>);
}
