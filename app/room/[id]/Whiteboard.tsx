"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface Point { x: number; y: number; }
interface Line { points: Point[]; color: string; width: number; mode: 'draw' | 'erase'; }

// --- ПРЕМИАЛЬНЫЕ SVG ИКОНКИ ---
const ExpandIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>);
const CompressIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>);
const UploadPdfIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>);
const PrevIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="15 18 9 12 15 6"></polyline></svg>);
const NextIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="9 18 15 12 9 6"></polyline></svg>);
const PanIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg>);
const PenIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>);
const EraserIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20"></path><path d="M16 16l-4-4"></path></svg>);
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
const SaveIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>);

export default function AlveriumWhiteboard({ isHost }: { isHost: boolean }) {
  const room = useRoomContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const VIRTUAL_W = 1920;
  const VIRTUAL_H = 1080;
  const ROOM_KEY = `alverium_wb_${room.name}`;
  const ROOM_KEY_PDF = `alverium_wb_pdf_${room.name}`;
  const ROOM_KEY_PAGE = `alverium_wb_page_${room.name}`;

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renderTrigger, setRenderTrigger] = useState(0);
  
  const [activeTool, setActiveTool] = useState<'pan' | 'pen' | 'eraser'>('pen');
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const linesMap = useRef<Record<number, Line[]>>({});
  const currentLine = useRef<Line | null>(null);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);
  const currentPdfUrlRef = useRef<string | null>(null);

  // Инициализация и восстановление состояния (Линии + PDF)
  useEffect(() => {
    setIsMounted(true);
    
    // Восстанавливаем линии
    const savedLines = localStorage.getItem(ROOM_KEY);
    if (savedLines) {
      try { linesMap.current = JSON.parse(savedLines); } catch(e) {}
    }

    // Восстанавливаем PDF, если доску случайно закрыли/открыли
    const savedPdfUrl = localStorage.getItem(ROOM_KEY_PDF);
    const savedPage = localStorage.getItem(ROOM_KEY_PAGE);
    
    if (savedPage) setCurrentPage(Number(savedPage));

    if (savedPdfUrl) {
      currentPdfUrlRef.current = savedPdfUrl;
      fetch(savedPdfUrl)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => {
          pdfBytesRef.current = arrayBuffer.slice(0);
          return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        })
        .then(pdf => {
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
          setRenderTrigger(prev => prev + 1);
        })
        .catch(console.error);
    }
  }, [ROOM_KEY, ROOM_KEY_PDF, ROOM_KEY_PAGE]);

  const saveToLocal = () => {
    localStorage.setItem(ROOM_KEY, JSON.stringify(linesMap.current));
  };

  // Слушатель клавиатуры: Перелистывание слайдов + выход по ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTheaterMode(false);
      }
      if (!isHost) return;
      if (e.key === 'ArrowRight' && currentPage < totalPages) {
        changePage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' && currentPage > 1) {
        changePage(currentPage - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, currentPage, totalPages]);

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    localStorage.setItem(ROOM_KEY_PAGE, newPage.toString());
    broadcast({ type: 'WB_PAGE', page: newPage });
  };

  // Синхронизация опоздавших
  useEffect(() => {
    const handleParticipantConnected = () => {
      if (isHost) {
        setTimeout(() => {
          broadcast({ type: 'WB_PAGE', page: currentPage });
          if (currentPdfUrlRef.current) {
            broadcast({ type: 'WB_PDF_URL', url: currentPdfUrlRef.current });
          }
        }, 2000);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [isHost, currentPage, room]);

  useEffect(() => {
    const handleData = async (payload: Uint8Array) => {
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
        } else if (msg.type === 'WB_PDF_URL' && !isHost) {
          try {
            const res = await fetch(msg.url);
            const arrayBuffer = await res.arrayBuffer();
            pdfBytesRef.current = arrayBuffer.slice(0);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            pdfDocRef.current = pdf;
            setTotalPages(pdf.numPages);
            setRenderTrigger(prev => prev + 1);
          } catch (e) {}
        }
      } catch (e) {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, currentPage, isHost]);

  useEffect(() => {
    if (pdfDocRef.current) renderPdfPage(currentPage);
    drawAllLines(currentPage);
  }, [currentPage, renderTrigger]); 

  const renderPdfPage = async (pageNum: number) => {
    if (!pdfDocRef.current || !bgCanvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(VIRTUAL_W / unscaledViewport.width, VIRTUAL_H / unscaledViewport.height);
      const viewport = page.getViewport({ scale });
      const canvas = bgCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      const offsetX = (VIRTUAL_W - viewport.width) / 2;
      const offsetY = (VIRTUAL_H - viewport.height) / 2;
      const renderContext: any = { canvasContext: ctx, viewport: viewport, transform: [1, 0, 0, 1, offsetX, offsetY] };
      await page.render(renderContext).promise;
    } catch (err) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isHost) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfBytesRef.current = arrayBuffer.slice(0);
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setRenderTrigger(prev => prev + 1);
      broadcast({ type: 'WB_PAGE', page: 1 });

      const fd = new FormData();
      fd.append('file', file);
      fetch('/api/pdf-sync', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            currentPdfUrlRef.current = data.url;
            localStorage.setItem(ROOM_KEY_PDF, data.url);
            localStorage.setItem(ROOM_KEY_PAGE, '1');
            broadcast({ type: 'WB_PDF_URL', url: data.url });
          }
        }).catch(console.error);

    } catch (err) {
        alert("Ошибка чтения PDF: " + err);
    }
  };

  const getCoords = (e: React.PointerEvent) => {
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const scaleX = VIRTUAL_W / rect.width;
    const scaleY = VIRTUAL_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost || activeTool === 'pan') return;
    setIsDrawing(true);
    const coords = getCoords(e);
    currentLine.current = { 
      points: [coords], 
      color: activeTool === 'eraser' ? '#ffffff' : '#ef4444', 
      width: activeTool === 'eraser' ? 24 : 4,
      mode: activeTool === 'eraser' ? 'erase' : 'draw'
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentLine.current || !isHost) return;
    currentLine.current.points.push(getCoords(e));
    drawAllLines(currentPage, currentLine.current);
  };

  const onPointerUp = () => {
    if (!isDrawing || !currentLine.current || !isHost) return;
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
    ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const lines = linesMap.current[page] || [];
    const allLines = activeLine ? [...lines, activeLine] : lines;
    
    allLines.forEach(line => {
      ctx.globalCompositeOperation = line.mode === 'erase' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      line.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  };

  const broadcast = (msg: any) => {
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  };

  const clearPage = () => {
    linesMap.current[currentPage] = [];
    saveToLocal();
    drawAllLines(currentPage);
    broadcast({ type: 'WB_CLEAR', page: currentPage });
  };

  const saveAndUploadNotes = async () => {
    if (!pdfBytesRef.current) { alert("Сначала загрузите PDF!"); return; }
    setUploadProgress(1);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        if (linesMap.current[pageNum] && linesMap.current[pageNum].length > 0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = VIRTUAL_W; tempCanvas.height = VIRTUAL_H;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          
          linesMap.current[pageNum].forEach(line => {
            ctx.globalCompositeOperation = line.mode === 'erase' ? 'destination-out' : 'source-over';
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width;
            line.points.forEach((p, idx) => {
              if (idx === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          });
          
          const pngImageBytes = await fetch(tempCanvas.toDataURL()).then(res => res.arrayBuffer());
          const pngImage = await pdfDoc.embedPng(pngImageBytes);
          const pdfPage = pdfDoc.getPage(i);
          const { width, height } = pdfPage.getSize();
          pdfPage.drawImage(pngImage, { x: 0, y: 0, width: width, height: height, opacity: 1 });
        }
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      uploadChunked(blob);
    } catch (err) {
      alert("Ошибка при сохранении PDF");
      setUploadProgress(0);
    }
  };

  const uploadChunked = async (blob: Blob) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Alverium_Notes_${dateStr}.pdf`;

    for (let i = 0; i < totalChunks; i++) {
      const fd = new FormData();
      fd.append('file', blob.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, blob.size)));
      fd.append('filename', filename);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('folder', 'notes');
      try {
        await fetch('/api/proxy-upload', { method: 'POST', body: fd });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        alert("Ошибка выгрузки конспекта.");
        setUploadProgress(0); return;
      }
    }
    alert(`Конспект успешно сохранен в VOD консоли как ${filename}!`);
    
    // Очищаем кэш после успешной выгрузки
    localStorage.removeItem(ROOM_KEY);
    localStorage.removeItem(ROOM_KEY_PDF);
    localStorage.removeItem(ROOM_KEY_PAGE);
    setUploadProgress(0);
  };

  const getCursorStyle = () => {
    if (!isHost) return 'pointer-events-none';
    if (activeTool === 'pan') return 'cursor-default pointer-events-auto';
    return 'cursor-crosshair pointer-events-auto';
  };

  return (
    <div className={`flex flex-col w-full h-full transition-all duration-300 ease-out ${isTheaterMode ? 'fixed inset-0 z-[99999] bg-[#1a1a1a]' : 'relative bg-transparent overflow-hidden'}`}>
      
      {/* Кнопка переключения режима кинотеатра (улучшена видимость) */}
      <button 
        onClick={() => setIsTheaterMode(!isTheaterMode)} 
        className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-[100000] bg-black/40 hover:bg-black/60 border border-white/20 text-white rounded-xl w-10 h-10 md:w-12 md:h-12 flex items-center justify-center backdrop-blur-md shadow-lg transition-all"
      >
        {isTheaterMode ? <CompressIcon /> : <ExpandIcon />}
      </button>

      {/* ПРЕМИАЛЬНЫЙ ПАРЯЩИЙ DOCK */}
      {isHost && (
        <div className={`absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-[100000] flex items-center gap-1 md:gap-2 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 p-1 md:p-1.5 rounded-2xl shadow-2xl transition-all duration-500 ease-out ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          
          <label className="cursor-pointer w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all" title="Загрузить PDF">
            <UploadPdfIcon />
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
          </label>
          
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          
          <button disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
            <PrevIcon />
          </button>
          <span className="text-white font-mono text-[10px] md:text-xs px-1 min-w-[45px] text-center">
            {currentPage} / {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
            <NextIcon />
          </button>
          
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          
          <button onClick={() => setActiveTool('pan')} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'pan' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <PanIcon />
          </button>
          <button onClick={() => setActiveTool('pen')} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'pen' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <PenIcon />
          </button>
          <button onClick={() => setActiveTool('eraser')} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-white/20 text-white border border-white/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <EraserIcon />
          </button>
          
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          
          <button onClick={clearPage} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all" title="Очистить доску">
            <TrashIcon />
          </button>
          <button onClick={saveAndUploadNotes} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-xl transition-all" title="Сохранить в LMS">
            {uploadProgress > 0 ? <span className="text-[10px] font-bold">{uploadProgress}%</span> : <SaveIcon />}
          </button>
        </div>
      )}

      {/* Резиновый холст: выход двойным кликом по фону доступен для всех в Theater Mode */}
      <div 
        onDoubleClick={() => { if (!isHost || isTheaterMode) setIsTheaterMode(false); }} 
        className="flex-1 w-full h-full flex items-center justify-center relative touch-none p-2 pb-16 md:pb-20"
      >
        <div className="relative w-full max-w-full max-h-full aspect-video bg-white md:rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
          <canvas ref={bgCanvasRef} width={VIRTUAL_W} height={VIRTUAL_H} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <canvas
            ref={drawCanvasRef}
            width={VIRTUAL_W}
            height={VIRTUAL_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOut={onPointerUp}
            className={`absolute inset-0 w-full h-full object-contain ${getCursorStyle()}`}
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
