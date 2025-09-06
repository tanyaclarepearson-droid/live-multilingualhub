// js/adapt.js — minimal client-only PoC
export function initAdaptTool() {
  const $ = (sel) => document.querySelector(sel);

  const fileInput = $('#at-file');
  const clearBtn  = $('#at-clear');
  const txtArea   = $('#at-input');

  const levelSel  = $('#at-level');
  const ckFrames  = $('#at-frames');
  const ckGloss   = $('#at-glossary');
  const ckQs      = $('#at-questions');

  const runBtn    = $('#at-run');
  const preview   = $('#at-preview');
  const dlBtn     = $('#at-download');

  // Helpers
  const readTextFile = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload  = () => resolve(String(fr.result || ''));
    fr.readAsText(file);
  });
// Lazy loader for external scripts
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Read DOCX -> text using mammoth.js (lazy loads)
async function readDocx(file) {
  // CDN: mammoth.browser.min.js exposes window.mammoth
  await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  // Strip HTML to plain-ish text (keeps periods/spaces)
  const tmp = document.createElement('div');
  tmp.innerHTML = result.value;
  const text = tmp.innerText.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// Read PDF -> text using pdf.js (lazy loads)
async function readPdf(file) {
  // pdfjs-dist library + worker
  await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs'); // ignored by browsers as module
  await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.js');
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(' ');
    full += text + '\n\n';
  }
  return full.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

  // Very simple "adaption" stubs
  function simplify(text, level) {
    // Normalize whitespace
    let t = text.replace(/\s+/g, ' ').trim();

    // Split to sentences
    let sentences = t.split(/(?<=[.!?])\s+/);

    // Shorten sentences for L1/2 (toy algo)
    if (level === 'L1' || level === 'L2') {
      sentences = sentences.map(s => {
        // break long sentences at commas
        if (s.length > 140) {
          const parts = s.split(/,\s*/);
          return parts.map(p => p.trim()).join('. ');
        }
        return s;
      });
    }

    // Rejoin
    t = sentences.join(' ');

    // For L1: prefer simpler punctuation
    if (level === 'L1') t = t.replace(/;|:|—/g, '.');

    return t;
  }

  function makeSentenceFrames() {
    return `
      <h4>Sentence frames <span class="badge">L1–L2</span></h4>
      <ul>
        <li>I notice __ because __.</li>
        <li>The main idea is __.</li>
        <li>First __. Then __. Finally __.</li>
      </ul>`;
  }

  function makeGlossary(text) {
    // Very light "top words": select 5 long-ish unique words
    const words = Array.from(new Set(
      text.toLowerCase().match(/[a-záéíóúüñ]{6,}/gi) || []
    ));
    const top = words.slice(0, 5);
    if (!top.length) return '';
    return `
      <h4>Glossary <span class="badge">auto</span></h4>
      <ul>${top.map(w => `<li><strong>${w}</strong> — teacher adds definition</li>`).join('')}</ul>`;
  }

  function makeQuestions() {
    return `
      <h4>Comprehension questions</h4>
      <ol>
        <li>What is the main idea of this text?</li>
        <li>Find two details that support the main idea.</li>
        <li>What question do you still have?</li>
      </ol>`;
  }

  function render({ text, level, frames, glossary, questions }) {
    const body = `
      <h4>Adapted text <span class="badge">${level}</span></h4>
      <p>${text}</p>
      ${frames   ? makeSentenceFrames() : ''}
      ${glossary ? makeGlossary(text)   : ''}
      ${questions? makeQuestions()      : ''}
    `;
    preview.innerHTML = body;
    dlBtn.disabled = false;
  }

  // Wire UI
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File is larger than 15MB.');
      fileInput.value = '';
      return;
    }

    // Text files work now; pdf/docx show a friendly message (stub)
    if (file.name.endsWith('.txt')) {
      txtArea.value = await readTextFile(file);
    } else if (file.name.match(/\.(pdf|docx?|PDF)$/)) {
      txtArea.value = '📄 Uploaded ' + file.name + '. (PDF/DOCX parsing PoC to be added — paste text for now.)';
    } else {
      txtArea.value = 'Unsupported file type. Please paste text for now.';
    }
  });

  clearBtn?.addEventListener('click', () => {
    fileInput.value = '';
    txtArea.value = '';
    preview.textContent = 'Your adapted text will appear here.';
    dlBtn.disabled = true;
  });

  runBtn?.addEventListener('click', () => {
    const raw = txtArea.value.trim();
    if (!raw) { alert('Paste text or upload a file first.'); return; }

    const level = levelSel.value;
    const simplified = simplify(raw, level);

    render({
      text: simplified,
      level,
      frames: ckFrames.checked,
      glossary: ckGloss.checked,
      questions: ckQs.checked
    });
  });

  dlBtn?.addEventListener('click', () => {
    const blob = new Blob([preview.innerText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'adapted-text.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Cosmetic: label click opens file chooser
  document.querySelector('#adapt-tool .file')?.addEventListener('click', () => fileInput?.click());
}
