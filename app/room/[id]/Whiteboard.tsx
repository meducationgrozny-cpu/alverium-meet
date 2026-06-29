'use client';

import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Настраиваем воркер для Next.js (используем CDN, чтобы не было конфликтов с Turbopack)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ====================================================
// ИКОНКИ ДЛЯ ТУЛБАРА
// ====================================================
const CursorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
  </svg>
);

const PenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const EraserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11L9 21H3v-6L13 5l6 6zM13 5l4-4 4 4-4 4" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export default function AlveriumWhiteboard() {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<'cursor' | 'pen' | 'eraser'>('cursor');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обработчик загрузки локального PDF
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);
      setPageNumber(1);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="relative w-full h-full flex bg-[#0a0a0a] overflow-hidden rounded-xl border border-white/5">
      
      {/* ЛЕВАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ (Тулбар как на скетче) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 bg-[#050505]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
        <button 
          onClick={() => setActiveTool('cursor')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'cursor' ? 'bg-red-800 text-white shadow-[0_0_15px_rgba(153,27,27,0.4)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title="Указатель (Скролл)"
        >
          <CursorIcon />
        </button>
        <button 
          onClick={() => setActiveTool('pen')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'pen' ? 'bg-red-800 text-white shadow-[0_0_15px_rgba(153,27,27,0.4)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title="Ручка"
        >
          <PenIcon />
        </button>
        <button 
          onClick={() => setActiveTool('eraser')}
          className={`p-3 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-red-800 text-white shadow-[0_0_15px_rgba(153,27,27,0.4)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title="Ластик"
        >
          <EraserIcon />
        </button>
        
        <div className="w-full h-[1px] bg-white/10 my-1"></div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          title="Загрузить PDF"
        >
          <UploadIcon />
        </button>
        <input 
          type="file" 
          accept="application/pdf" 
          ref={fileInputRef} 
          onChange={onFileChange} 
          className="hidden" 
        />
      </div>

      {/* ЦЕНТРАЛЬНАЯ ОБЛАСТЬ (Холст и PDF) */}
      <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-auto custom-scrollbar">
        {!pdfFile ? (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
            <UploadIcon />
            <p className="font-light tracking-wide text-sm">Загрузите PDF для начала урока</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white transition-all"
            >
              Выбрать файл
            </button>
          </div>
        ) : (
          <div className="relative shadow-2xl transition-all duration-300">
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-white/50 text-sm font-light animate-pulse">Загрузка документа...</div>}
              className="flex items-center justify-center"
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="rounded-md overflow-hidden"
                width={800} // Базовая ширина, позже сделаем адаптивной
              />
            </Document>

            {/* ПРОЗРАЧНЫЙ КАНВАС ДЛЯ РИСОВАНИЯ (Наложим его поверх PDF на следующем шаге) */}
            <div className={`absolute inset-0 z-10 ${activeTool === 'cursor' ? 'pointer-events-none' : 'cursor-crosshair'}`}>
              {/* Тут будет perfect-freehand */}
            </div>
          </div>
        )}
      </div>

      {/* ПАНЕЛЬ ПАГИНАЦИИ (Снизу по центру) */}
      {pdfFile && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#050505]/90 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-2xl">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(p => p - 1)}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 font-bold px-2 transition-all"
          >
            &larr;
          </button>
          <span className="text-xs font-medium text-gray-300 tracking-widest">
            {pageNumber} <span className="text-gray-600">/</span> {numPages}
          </span>
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(p => p + 1)}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 font-bold px-2 transition-all"
          >
            &rarr;
          </button>
        </div>
      )}
    </div>
  );
}