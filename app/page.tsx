"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('lesson-test');
  const [now, setNow] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);

  // Опрашиваем сервер каждые 5 секунд
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    const timeInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(interval); clearInterval(timeInterval); };
  }, []);

  // Вычисляем длительность урока
  const formatDuration = (creationTime: number) => {
    const diff = Math.max(0, Math.floor((now - creationTime) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // Генерация токена для входа
  const generateLink = async (roomName: string, role: string) => {
    const participantName = role === 'host' ? 'Преподаватель' : `Ученик-${Math.floor(Math.random()*1000)}`;
    try {
      const res = await fetch('/api/dev-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName, role }),
      });
      if (res.ok) {
        const data = await res.json();
        return `${window.location.origin}${data.roomUrl}`;
      }
    } catch (err) {}
    return null;
  };

  const startNewLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const link = await generateLink(newRoomName, 'host');
    if (link) window.location.href = link;
    setActionLoading(false);
  };

  const joinAsHost = async (roomName: string) => {
    const link = await generateLink(roomName, 'host');
    if (link) window.location.href = link;
  };

  const copyStudentLink = async (roomName: string) => {
    const link = await generateLink(roomName, 'student');
    if (link) {
      navigator.clipboard.writeText(link);
      alert('✅ Ссылка для ученика скопирована! Можешь отправлять её себе на телефон или в Telegram.');
    } else {
      alert('❌ Ошибка генерации ссылки');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-4 mb-10 border-b border-white/10 pb-6">
          <div className="w-12 h-12 bg-red-700 rounded-xl flex items-center justify-center font-bold text-xl">A</div>
          <div>
            <h1 className="text-2xl font-bold">Alverium Meet Control</h1>
            <p className="text-gray-500 text-sm">Мониторинг эфиров и управление уроками</p>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Левая колонка: Создание урока */}
          <div className="md:col-span-1">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900"></div>
              <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-gray-300">Создать урок</h2>
              
              <form onSubmit={startNewLesson} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">НАЗВАНИЕ КОМНАТЫ</label>
                  <input 
                    type="text" 
                    value={newRoomName} 
                    onChange={(e) => setNewRoomName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
                    placeholder="bio-test-1"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all"
                >
                  {actionLoading ? 'Запуск...' : 'Начать эфир'}
                </button>
              </form>
            </div>
          </div>

          {/* Правая колонка: Мониторинг активных комнат */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wider text-gray-300 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Активные эфиры ({rooms.length})
            </h2>

            {loading ? (
              <div className="text-gray-500 bg-white/5 p-6 rounded-2xl text-center">Загрузка данных...</div>
            ) : rooms.length === 0 ? (
              <div className="text-gray-500 bg-white/5 p-10 rounded-2xl border border-white/10 text-center flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Нет запущенных уроков
              </div>
            ) : (
              <div className="space-y-4">
                {rooms.map(room => (
                  <div key={room.sid} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-white/20">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-white">{room.name}</h3>
                        {room.isRecording && (
                          <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Идет запись
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-400">
                        <span className="bg-white/5 px-2.5 py-1 rounded-md">⏱ В эфире: <span className="text-white">{formatDuration(room.creationTime)}</span></span>
                        <span className="bg-white/5 px-2.5 py-1 rounded-md">👥 Участников: <span className="text-white">{room.participants}</span></span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => copyStudentLink(room.name)}
                        className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-2 px-4 rounded-xl text-xs transition-colors border border-white/5"
                      >
                        📱 Ссылка ученику
                      </button>
                      <button 
                        onClick={() => joinAsHost(room.name)}
                        className="flex-1 md:flex-none bg-red-700/20 hover:bg-red-700 text-red-400 hover:text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors border border-red-700/50"
                      >
                        Войти преподом
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
