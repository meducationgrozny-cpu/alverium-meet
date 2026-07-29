"use client";

import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('lesson-test');
  const [now, setNow] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);
  
  // Состояния для формы входа ученика
  const [studentName, setStudentName] = useState('Ученик-' + Math.floor(Math.random()*1000));
  const [selectedRoom, setSelectedRoom] = useState('');

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        // Если комната появилась, а ничего не выбрано - выбираем первую
        if (data.rooms?.length > 0 && !selectedRoom) {
          setSelectedRoom(data.rooms[0].name);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    const timeInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(interval); clearInterval(timeInterval); };
  }, []);

  const formatDuration = (creationTime: number) => {
    const diff = Math.max(0, Math.floor((now - creationTime) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const generateLink = async (roomName: string, role: string, pName: string) => {
    try {
      const res = await fetch('/api/dev-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomName, participantName: pName, role }) });
      if (res.ok) return `${window.location.origin}${(await res.json()).roomUrl}`;
    } catch (err) {}
    return null;
  };

  const startNewLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const link = await generateLink(newRoomName, 'host', 'Преподаватель-' + Math.floor(Math.random()*1000));
    if (link) window.location.href = link;
    setActionLoading(false);
  };

  const joinAsStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return alert('Выберите комнату!');
    const link = await generateLink(selectedRoom, 'student', studentName);
    if (link) window.location.href = link;
  };

  const killRoom = async (roomName: string) => {
    if (!confirm(`Точно завершить эфир ${roomName}?`)) return;
    await fetch('/api/rooms', { method: 'DELETE', body: JSON.stringify({ roomName }) });
    fetchRooms();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-4 mb-10 border-b border-white/10 pb-6">
          <div className="w-12 h-12 bg-red-700 rounded-xl flex items-center justify-center font-bold text-xl">A</div>
          <div><h1 className="text-2xl font-bold">Alverium Meet Control</h1><p className="text-gray-500 text-sm">Мониторинг эфиров и управление уроками</p></div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            
            {/* БЛОК: Создать урок (Для препода) */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900"></div>
              <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-gray-300">Создать урок</h2>
              <form onSubmit={startNewLesson} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">НАЗВАНИЕ КОМНАТЫ</label>
                  <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" required />
                </div>
                <button type="submit" disabled={actionLoading} className="w-full bg-red-700 hover:bg-red-600 font-bold py-3.5 px-4 rounded-xl">{actionLoading ? 'Запуск...' : 'Начать эфир'}</button>
              </form>
            </div>

            {/* БЛОК: Войти как ученик (Для телефона) */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-900"></div>
              <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-gray-300">Войти на урок</h2>
              <form onSubmit={joinAsStudentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">ВЫБЕРИТЕ ЭФИР</label>
                  <select 
                    value={selectedRoom} 
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white outline-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>Нет активных эфиров</option>
                    {rooms.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">ВАШЕ ИМЯ</label>
                  <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" required />
                </div>
                <button type="submit" disabled={rooms.length === 0} className="w-full bg-blue-700 hover:bg-blue-600 font-bold py-3.5 px-4 rounded-xl disabled:bg-gray-700 disabled:text-gray-500">Войти как Ученик</button>
              </form>
            </div>

          </div>

          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wider text-gray-300 flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>Активные эфиры ({rooms.length})</h2>
            {loading ? <div className="text-gray-500 bg-white/5 p-6 rounded-2xl text-center">Загрузка данных...</div> : rooms.length === 0 ? <div className="text-gray-500 bg-white/5 p-10 rounded-2xl border border-white/10 text-center">Нет запущенных уроков</div> : (
              <div className="space-y-4">
                {rooms.map(room => (
                  <div key={room.sid} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{room.name}</h3>
                          {room.isRecording && <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Идет запись</span>}
                        </div>
                        <div className="flex gap-4 text-xs font-medium text-gray-400">
                          <span className="bg-white/5 px-2.5 py-1 rounded-md">⏱ В эфире: <span className="text-white">{formatDuration(room.creationTime)}</span></span>
                          <span className="bg-white/5 px-2.5 py-1 rounded-md">👥 Участников: <span className="text-white">{room.participants}</span></span>
                        </div>
                      </div>
                      <button onClick={() => killRoom(room.name)} className="text-xs text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors">✕ Завершить</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => { const link = await generateLink(room.name, 'host', 'Преподаватель-' + Math.floor(Math.random()*1000)); if(link) window.location.href = link; }} className="w-full bg-red-700/20 hover:bg-red-700 text-red-400 hover:text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors border border-red-700/50">Войти как Преподаватель (с этого устройства)</button>
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
