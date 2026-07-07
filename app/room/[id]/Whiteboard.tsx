"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

interface Point { x: number; y: number; }
interface Line { type: 'pen' | 'erase'; points: Point[]; color: string; width: number; }

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#000000', '#ffffff'];
const WIDTHS = [2, 4, 8];

const Icons = {
  Pen: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Eraser: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
  Laser: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="m19 5-4.5 4.5"/><path d="m5 19 4.5-4.5"/><path d="m19 19-4.5-4.5"/><path d="m5 5 4.5 4.5"/></svg>,
  Trash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
};

export default function AlveriumWhiteboard({ isHost }: { isHost: boolean }) {
  const room = useRoomContext();
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const ROOM_KEY = `alverium_wb_${room.name}`;

  // Размер доски по умолчанию 16:9
  const [boardSize, setBoardSize] = useState({ width: 1920, height: 1080 });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [slideBaseUrl, setSlideBaseUrl] = useState<string | null>(null);
  
  // Toolbar State
  const [tool, setTool] = useState<'pen'|'eraser'|'laser'>('pen');
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

  // Железобетонная установка размера холста под реальный размер картинки
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight && (naturalWidth !== boardSize.width || naturalHeight !== boardSize.height)) {
      setBoardSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  useEffect(() => {
    const handleParticipantConnected = () => {
      if (isHost) {
        setTimeout(() => {
          broadcast({ type: 'WB_SYNC', page: currentPage, totalPages, slideBaseUrl, linesMap: linesMap.current });
        }, 2000);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [isHost, currentPage, totalPages, slideBaseUrl, room]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WB_DRAW') {
          if (!linesMap.current[msg.page]) linesMap.current[msg.page] = [];
          linesMap.current[msg.page].push(msg.line);
          saveToLocal();
          if (msg.page === currentPage) drawAllLines(msg.page);
        } else if (msg.type === 'WB_PAGE') {
          setCurrentPage(msg.page);
        } else if (msg.type === 'WB_CLEAR') {
          linesMap.current[msg.page] = [];
          saveToLocal();
          if (msg.page === currentPage) drawAllLines(msg.page);
        } else if (msg.type === 'WB_SLIDES' && !isHost) {
          setTotalPages(msg.pages);
          setSlideBaseUrl(msg.baseUrl);
          setCurrentPage(msg.page);
        } else if (msg.type === 'WB_SYNC' && !isHost) {
          setTotalPages(msg.totalPages);
          setSlideBaseUrl(msg.slideBaseUrl);
          setCurrentPage(msg.page);
          linesMap.current = msg.linesMap || {};
          drawAllLines(msg.page);
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

  // Перерисовка при смене страницы или пересчете размеров
  useEffect(() => { drawAllLines(currentPage); }, [currentPage, boardSize]); 

  // ==========================================
  // ЗАГРУЗКА PDF
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isHost) return;

    setUploadProgress(1);
    try {
        const fd = new FormData();
        fd.append('file', file);
        
        const res = await fetch('https://video.alverium.ru/api/convert_pdf', { method: 'POST', body: fd });
        const data = await res.json();
        
        if (data.status === 'success') {
           setTotalPages(data.pages);
           setSlideBaseUrl(data.slide_base_url);
           setCurrentPage(1);
           broadcast({ type: 'WB_SLIDES', baseUrl: data.slide_base_url, pages: data.pages, page: 1 });
        } else {
           alert("Ошибка конвертации PDF на сервере: " + data.message);
        }
    } catch (err) {
        alert("Ошибка сети при загрузке PDF. Убедитесь, что сервер Flask запущен.");
    } finally {
        setUploadProgress(0);
    }
  };

  const getCoords = (e: React.PointerEvent) => {
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const scaleX = boardSize.width / rect.width;
    const scaleY = boardSize.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost) return;
    const coords = getCoords(e);
    
    if (tool === 'laser') {
      broadcast({ type: 'WB_LASER', x: coords.x, y: coords.y });
      return;
    }

    setIsDrawing(true);
    currentLine.current = { type: tool === 'eraser' ? 'erase' : 'pen', points: [coords], color, width: tool === 'eraser' ? thickness * 6 : thickness };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isHost) return;
    const coords = getCoords(e);
    
    if (tool === 'laser') {
      broadcast({ type: 'WB_LASER', x: coords.x, y: coords.y });
      setLaserPos(coords);
      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 500);
      return;
    }

    if (!isDrawing || !currentLine.current) return;
    currentLine.current.points.push(coords);
    drawAllLines(currentPage, currentLine.current);
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
    currentLine.current = null;
  };

  const drawAllLines = (page: number, activeLine?: Line) => {
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, boardSize.width, boardSize.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const lines = linesMap.current[page] || [];
    const allLines = activeLine ? [...lines, activeLine] : lines;
    
    allLines.forEach(line => {
      ctx.globalCompositeOperation = line.type === 'erase' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.strokeStyle = line.type === 'erase' ? 'rgba(0,0,0,1)' : line.color;
      ctx.lineWidth = line.width;
      line.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  };

  const broadcast = (msg: any) => room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });

  const clearPage = () => {
    if(!window.confirm("Очистить страницу?")) return;
    linesMap.current[currentPage] = [];
    saveToLocal();
    drawAllLines(currentPage);
    broadcast({ type: 'WB_CLEAR', page: currentPage });
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0a]">
      
      {/* ПАНЕЛЬ ПРЕПОДАВАТЕЛЯ (НИЖНЯЯ) */}
      {isHost && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2">
            {uploadProgress > 0 ? 'Загрузка...' : '+ PDF Слайды'}
            <input type="file" accept="application/pdf" className="hidden" disabled={uploadProgress > 0} onChange={handleFileUpload} />
          </label>
          <div className="flex items-center gap-2 text-gray-300 font-mono text-sm">
            <button disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); broadcast({ type: 'WB_PAGE', page: currentPage - 1 }); }} className="px-2 hover:text-white disabled:opacity-50">◀</button>
            <span>{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => { setCurrentPage(p => p + 1); broadcast({ type: 'WB_PAGE', page: currentPage + 1 }); }} className="px-2 hover:text-white disabled:opacity-50">▶</button>
          </div>
          <button onClick={() => alert("Сохранение переносится на бэкенд!")} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
            💾 В LMS
          </button>
        </div>
      )}

      {/* TOOLBAR ИНСТРУМЕНТОВ */}
      {isHost && (
        <div className="absolute top-1/2 -translate-y-1/2 left-4 z-30 flex flex-col gap-2 bg-black/90 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <button onClick={() => setTool('pen')} className={`p-3 rounded-xl transition ${tool === 'pen' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Pen /></button>
          <button onClick={() => setTool('eraser')} className={`p-3 rounded-xl transition ${tool === 'eraser' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Eraser /></button>
          <button onClick={() => setTool('laser')} className={`p-3 rounded-xl transition ${tool === 'laser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}><Icons.Laser /></button>
          
          <div className="w-full h-px bg-white/10 my-1"></div>
          
          <div className={`flex flex-col gap-2 items-center ${tool !== 'pen' ? 'opacity-30 pointer-events-none' : ''}`}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition ${color === c ? 'border-gray-400 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-1"></div>

          <div className={`flex flex-col gap-3 items-center py-2 ${tool === 'laser' ? 'opacity-30 pointer-events-none' : ''}`}>
            {WIDTHS.map(w => (
              <button key={w} onClick={() => setThickness(w)} className={`bg-white rounded-full transition ${thickness === w ? 'bg-red-500' : 'bg-gray-400 hover:bg-gray-200'}`} style={{ width: w + 4, height: w + 4 }} />
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-1"></div>
          <button onClick={clearPage} className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"><Icons.Trash /></button>
        </div>
      )}

      {/* ХОЛСТ С ДИНАМИЧЕСКОЙ СЕТКОЙ */}
      <div className="w-full h-full flex items-center justify-center p-2 md:p-6 relative">
        <div className="relative bg-white shadow-2xl overflow-hidden flex-shrink-0" style={{ maxHeight: '100%', maxWidth: '100%' }}>
          {slideBaseUrl ? (
            <img 
              src={`${slideBaseUrl}${currentPage}.png`} 
              alt={`Slide ${currentPage}`}
              className="max-w-full max-h-full object-contain pointer-events-none select-none block"
              style={{ maxHeight: 'calc(100vh - 140px)' }}
              onLoad={handleImageLoad}
            />
          ) : (
            <svg viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} className="max-w-full max-h-full object-contain pointer-events-none block" style={{ maxHeight: 'calc(100vh - 140px)' }}>
               <rect width="100%" height="100%" fill="white"/>
            </svg>
          )}

          <canvas
            ref={drawCanvasRef}
            width={boardSize.width}
            height={boardSize.height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOut={onPointerUp}
            className={`absolute inset-0 w-full h-full object-fill ${isHost ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ touchAction: 'none' }}
          />

          {laserPos && (
             <div 
               className="absolute w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_5px_rgba(239,68,68,0.8)] pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
               style={{ 
                 left: `${(laserPos.x / boardSize.width) * 100}%`, 
                 top: `${(laserPos.y / boardSize.height) * 100}%` 
               }}
             />
          )}
        </div>
      </div>
    </div>
  );
}
