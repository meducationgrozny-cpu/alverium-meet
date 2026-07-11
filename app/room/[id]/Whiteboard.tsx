"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

interface Point { x: number; y: number; }
interface Line { type: 'pen' | 'highlighter' | 'eraser'; points: Point[]; color: string; width: number; }

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6',
  '#a855f7', '#ec4899', '#ffffff', '#94a3b8', '#334155', '#000000'
];
const WIDTHS = [2, 6, 12];

const Icons = {
  Pen: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Highlighter: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>,
  Eraser: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
  Laser: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="m19 5-4.5 4.5"/><path d="m5 19 4.5-4.5"/><path d="m19 19-4.5-4.5"/><path d="m5 5 4.5 4.5"/></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  WidthThin: () => <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  WidthMed: () => <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>,
  WidthThick: () => <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>
};

export default function AlveriumWhiteboard({ isHost }: { isHost: boolean }) {
  const room = useRoomContext();
  const ROOM_KEY = `alverium_wb_${room.name}`;

  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const chunksBuffer = useRef<Record<string, { chunks: string[], count: number, total: number }>>({});

  const [boardSize, setBoardSize] = useState({ width: 1920, height: 1080 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [slideBaseUrl, setSlideBaseUrl] = useState<string | null>(null);

  const [tool, setTool] = useState<'pen'|'highlighter'|'eraser'|'laser'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [thickness, setThickness] = useState(WIDTHS[1]);
  const [laserPos, setLaserPos] = useState<{x: number, y: number} | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const linesMap = useRef<Record<number, Line[]>>({});
  const currentLine = useRef<Line | null>(null);
  const laserTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(ROOM_KEY);
    if (saved) { try { linesMap.current = JSON.parse(saved); } catch(e) {} }
  }, [ROOM_KEY]);

  const saveToLocal = () => localStorage.setItem(ROOM_KEY, JSON.stringify(linesMap.current));

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight && (naturalWidth !== boardSize.width || naturalHeight !== boardSize.height)) {
      setBoardSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  const broadcast = (msg: any) => {
    const payloadStr = JSON.stringify(msg);
    const CHUNK_SIZE = 8000; 
    
    if (payloadStr.length < CHUNK_SIZE) {
      room.localParticipant.publishData(new TextEncoder().encode(payloadStr), { reliable: true });
      return;
    }

    const messageId = Math.random().toString(36).substring(2, 9);
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunkData = payloadStr.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkMsg = JSON.stringify({
        type: 'WB_CHUNK', id: messageId, index: i, total: totalChunks, data: chunkData
      });
      setTimeout(() => {
        room.localParticipant.publishData(new TextEncoder().encode(chunkMsg), { reliable: true });
      }, i * 15); 
    }
  };

  useEffect(() => {
    const handleParticipantConnected = () => {
      if (isHost) setTimeout(() => broadcast({ type: 'WB_SYNC', page: currentPage, totalPages, slideBaseUrl, linesMap: linesMap.current }), 2000);
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [isHost, currentPage, totalPages, slideBaseUrl, room]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msgStr = new TextDecoder().decode(payload);
        const msg = JSON.parse(msgStr);

        if (msg.type === 'WB_CHUNK') {
          if (!chunksBuffer.current[msg.id]) chunksBuffer.current[msg.id] = { chunks: [], count: 0, total: msg.total };
          chunksBuffer.current[msg.id].chunks[msg.index] = msg.data;
          chunksBuffer.current[msg.id].count++;

          if (chunksBuffer.current[msg.id].count === msg.total) {
            const fullPayload = chunksBuffer.current[msg.id].chunks.join('');
            delete chunksBuffer.current[msg.id];
            handleData(new TextEncoder().encode(fullPayload));
          }
          return;
        }

        if (msg.type === 'WB_DRAW') {
          if (!linesMap.current[msg.page]) linesMap.current[msg.page] = [];
          linesMap.current[msg.page].push(msg.line);
          saveToLocal();
          if (msg.page === currentPage) {
            const ctx = staticCanvasRef.current?.getContext('2d', { alpha: true });
            if (ctx) drawLineToCtx(ctx, msg.line);
          }
        } else if (msg.type === 'WB_PAGE') {
          setCurrentPage(msg.page);
        } else if (msg.type === 'WB_CLEAR') {
          linesMap.current[msg.page] = [];
          saveToLocal();
          if (msg.page === currentPage) drawAllLines(msg.page);
        } else if (msg.type === 'WB_SLIDES' && !isHost) {
          setTotalPages(msg.pages); setSlideBaseUrl(msg.baseUrl); setCurrentPage(msg.page);
        } else if (msg.type === 'WB_SYNC' && !isHost) {
          setTotalPages(msg.totalPages); setSlideBaseUrl(msg.slideBaseUrl); setCurrentPage(msg.page);
          linesMap.current = msg.linesMap || {}; drawAllLines(msg.page);
        } else if (msg.type === 'WB_LASER') {
          setLaserPos({ x: msg.x, y: msg.y });
          if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
          laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 500);
        }
      } catch (e) {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, currentPage, isHost]);

  useEffect(() => { drawAllLines(currentPage); }, [currentPage, boardSize]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isHost) return;
    setUploadProgress(1);
    try {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/proxy-pdf', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.status === 'success') {
           setTotalPages(data.pages); setSlideBaseUrl(data.slide_base_url); setCurrentPage(1);
           broadcast({ type: 'WB_SLIDES', baseUrl: data.slide_base_url, pages: data.pages, page: 1 });
        } else alert("Ошибка сервера: " + data.message);
    } catch (err) { alert("Сетевая ошибка загрузки PDF."); }
    finally { setUploadProgress(0); }
  };

  const getCoords = (e: React.PointerEvent) => {
    if (!activeCanvasRef.current) return { x: 0, y: 0 };
    const rect = activeCanvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (boardSize.width / rect.width), y: (e.clientY - rect.top) * (boardSize.height / rect.height) };
  };

  const drawLineToCtx = (ctx: CanvasRenderingContext2D, line: Line) => {
    ctx.globalCompositeOperation = line.type === 'eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = line.type === 'highlighter' ? 0.4 : 1.0;
    ctx.beginPath();
    ctx.strokeStyle = line.type === 'eraser' ? 'rgba(0,0,0,1)' : line.color;
    ctx.lineWidth = line.width;
    line.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; 
    ctx.globalAlpha = 1.0;
  };

  const drawAllLines = (page: number) => {
    const ctx = staticCanvasRef.current?.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, boardSize.width, boardSize.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const lines = linesMap.current[page] || [];
    lines.forEach(line => drawLineToCtx(ctx, line));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost) return;
    const coords = getCoords(e);
    if (tool === 'laser') { broadcast({ type: 'WB_LASER', x: coords.x, y: coords.y }); return; }
    setIsDrawing(true);
    currentLine.current = { type: tool, points: [coords], color, width: tool === 'eraser' ? thickness * 6 : (tool === 'highlighter' ? thickness * 3 : thickness) };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isHost) return;
    const coords = getCoords(e);
    if (tool === 'laser') {
      broadcast({ type: 'WB_LASER', x: coords.x, y: coords.y }); setLaserPos(coords);
      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 500); return;
    }
    
    if (!isDrawing || !currentLine.current) return;
    currentLine.current.points.push(coords);

    const activeCtx = activeCanvasRef.current?.getContext('2d', { alpha: true });
    if (activeCtx) {
      activeCtx.clearRect(0, 0, boardSize.width, boardSize.height);
      activeCtx.lineCap = 'round'; activeCtx.lineJoin = 'round';
      drawLineToCtx(activeCtx, currentLine.current);
    }
  };

  const onPointerUp = () => {
    if (!isHost) return;
    if (tool === 'laser') { setLaserPos(null); return; }
    if (!isDrawing || !currentLine.current) return;
    setIsDrawing(false);
    
    if (!linesMap.current[currentPage]) linesMap.current[currentPage] = [];
    linesMap.current[currentPage].push(currentLine.current);
    saveToLocal();
    broadcast({ type: 'WB_DRAW', page: currentPage, line: currentLine.current });

    const staticCtx = staticCanvasRef.current?.getContext('2d', { alpha: true });
    if (staticCtx) {
      staticCtx.lineCap = 'round'; staticCtx.lineJoin = 'round';
      drawLineToCtx(staticCtx, currentLine.current);
    }
    
    const activeCtx = activeCanvasRef.current?.getContext('2d', { alpha: true });
    if (activeCtx) activeCtx.clearRect(0, 0, boardSize.width, boardSize.height);
    
    currentLine.current = null;
  };

  const clearPage = () => {
    if(!window.confirm("Очистить страницу?")) return;
    linesMap.current[currentPage] = []; saveToLocal(); drawAllLines(currentPage);
    broadcast({ type: 'WB_CLEAR', page: currentPage });
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0a]">
      {isHost && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <div className="flex gap-1 pr-3 border-r border-white/10">
            <button onClick={() => setTool('pen')} className={`p-2.5 rounded-xl transition ${tool === 'pen' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Pen /></button>
            <button onClick={() => setTool('highlighter')} className={`p-2.5 rounded-xl transition ${tool === 'highlighter' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Highlighter /></button>
            <button onClick={() => setTool('eraser')} className={`p-2.5 rounded-xl transition ${tool === 'eraser' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Eraser /></button>
            <button onClick={() => setTool('laser')} className={`p-2.5 rounded-xl transition ${tool === 'laser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Laser /></button>
          </div>
          <div className={`grid grid-cols-6 gap-1.5 px-3 border-r border-white/10 ${tool === 'eraser' || tool === 'laser' ? 'opacity-30 pointer-events-none' : ''}`}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-[1.5px] transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className={`flex gap-1 px-3 border-r border-white/10 ${tool === 'laser' ? 'opacity-30 pointer-events-none' : ''}`}>
            {WIDTHS.map((w, i) => (
              <button key={w} onClick={() => setThickness(w)} className={`p-2 rounded-xl flex items-center justify-center transition ${thickness === w ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                {i === 0 && <Icons.WidthThin />}
                {i === 1 && <Icons.WidthMed />}
                {i === 2 && <Icons.WidthThick />}
              </button>
            ))}
          </div>
          <div className="pl-3">
            <button onClick={clearPage} className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"><Icons.Trash /></button>
          </div>
        </div>
      )}

      {isHost && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2">
            {uploadProgress > 0 ? 'Загрузка...' : '+ Загрузить PDF'}
            <input type="file" accept="application/pdf" className="hidden" disabled={uploadProgress > 0} onChange={handleFileUpload} />
          </label>
          <div className="flex items-center gap-2 text-gray-300 font-mono text-sm">
            <button disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); broadcast({ type: 'WB_PAGE', page: currentPage - 1 }); }} className="px-2 hover:text-white disabled:opacity-50">◀</button>
            <span>{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => { setCurrentPage(p => p + 1); broadcast({ type: 'WB_PAGE', page: currentPage + 1 }); }} className="px-2 hover:text-white disabled:opacity-50">▶</button>
          </div>
        </div>
      )}

      <div className="w-full h-full flex items-center justify-center p-4 md:p-10 relative">
        <div
          className="relative bg-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex-shrink-0 transition-all duration-300 rounded-xl overflow-hidden"
          style={{ aspectRatio: `${boardSize.width} / ${boardSize.height}`, maxWidth: '100%', maxHeight: '100%' }}
        >
          {slideBaseUrl ? (
            <img src={`${slideBaseUrl}${currentPage}.png`} alt={`Slide ${currentPage}`} className="absolute inset-0 w-full h-full pointer-events-none select-none" onLoad={handleImageLoad} />
          ) : (
            <svg viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} className="absolute inset-0 w-full h-full pointer-events-none"><rect width="100%" height="100%" fill="white"/></svg>
          )}

          <canvas ref={staticCanvasRef} width={boardSize.width} height={boardSize.height} className="absolute inset-0 w-full h-full object-fill pointer-events-none" />

          <canvas ref={activeCanvasRef} width={boardSize.width} height={boardSize.height} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerOut={onPointerUp} className={`absolute inset-0 w-full h-full object-fill ${isHost ? 'cursor-crosshair' : 'pointer-events-none'}`} style={{ touchAction: 'none' }} />

          {laserPos && (
             <div className="absolute w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_5px_rgba(239,68,68,0.8)] pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75" style={{ left: `${(laserPos.x / boardSize.width) * 100}%`, top: `${(laserPos.y / boardSize.height) * 100}%` }} />
          )}
        </div>
      </div>
    </div>
  );
}
