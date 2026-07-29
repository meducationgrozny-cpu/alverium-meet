const fs = require('fs');
const file = './app/room/[id]/Whiteboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const startStr = '// Фоновая выгрузка для учеников';
const endStr = '} catch (err) {';
const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
   const newBlock = `// Фоновая выгрузка (НАПРЯМУЮ В NEXT.JS БЕЗ PYTHON-СЕРВЕРА)
    const fd = new FormData();
    fd.append('file', file);
    fetch('/api/pdf-sync', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          currentPdfUrlRef.current = data.url;
          broadcast({ type: 'WB_PDF_URL', url: data.url });
        }
      }).catch(console.error);

`;
   code = code.substring(0, startIndex) + newBlock + code.substring(endIndex);
}

// Меняем логику ученика: убираем прокси-прослойку
const oldFetch = 'const res = await fetch(`/api/proxy-pdf?url=${encodeURIComponent(msg.url)}`);';
const newFetch = 'const res = await fetch(msg.url);';
code = code.replace(oldFetch, newFetch);

fs.writeFileSync(file, code);
console.log("Логика доски успешно обновлена на нативную!");
