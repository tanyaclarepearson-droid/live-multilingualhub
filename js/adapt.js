// js/adapt.js — Adapt Tool with lazy-loaded DOCX/PDF parsing + progress/cancel

/* ----------------- helpers: lazy loading + file readers ------------------ */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload  = () => resolve(String(fr.result || ''));
    fr.readAsText(file);
  });
}

/* ------------------------ parsing with progress hooks -------------------- */
// DOCX -> text using mammoth.js (loaded on demand). Accepts onProgress(cb) and isAborted().
async function readDocx(file, onProgress = () => {}, isAborted = () => false) {
  onProgress(5);
  await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
  if (isAborted()) throw new Error('aborted');

  onProgress(20);
  const arrayBuffer = await file.arrayBuffer();
  if (isAborted()) throw new Error('aborted');

  onProgress(50);
  const result = await window.mammoth.convertToHtml({ arrayBuffer });
  if (isAborted()) throw new Error('aborted');

  onProgress(80);
  const tmp = document.createElement('div');
  tmp.innerHTML = result.value;
  const text = tmp.innerText
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  onProgress(100);
  return text;
}

// PDF -> text using pdf.js (loaded on demand). Progress is page-by-page.
async function readPdf(file, onProgress = () => {}, isAborted = () => false) {
  onProgress(5);
  await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.js');
  if (isAborted()) throw new Error('aborted');

  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.js';

  onProgress(10);
  const arrayBuffer = await file.arrayBuffer();
  if (isAborted()) throw new Error('aborted');

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    if (isAborted()) throw new Error('aborted');
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(' ');
    full += text + '\n\n';
    onProgress(Math.round((p / pdf.numPages) * 100));
  }

  return full
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* -------------------------- glossary utilities --------------------------- */
const STOP = new Set([
  'the','a','an','and','or','but','if','then','so','because','than','that','this','these','those',
  'of','in','on','at','to','from','for','by','with','without','about','into','over','under',
  'is','are','was','were','be','been','being','as','it','its','also','can','could','should',
  'do','does','did','done','doing','have','has','had','having','will','would','may','might',
  'you','your','yours','we','our','ours','they','their','theirs','he','she','his','her','hers',
  'i','me','my','mine','us','them','there','here','up','down','out','not','no','yes'
]);

function extractTopWords(text, max = 5) {
  const words = (text.toLowerCase().match(/[a-záéíóúüñ]+/gi) || []);
  const uniq  = Array.from(new Set(words)).filter(w => w.length >= 6 && !STOP.has(w));
  return uniq.sort((a,b) => b.length - a.length).slice(0, max);
}

function makeGlossary(text) {
  const top = extractTopWords(text, 5);
  if (!top.length) return '';
  return `
    <h4>Glossary <span class="badge">auto</span></h4>
    <ul>${top.map(w => `<li><strong>${w}</strong> — definition (optional)</li>`).join('')}</ul>
  `;
}

/* ----------------------------- core features ----------------------------- */
function simplify(text, level) {
  let t = text.replace(/\s+/g, ' ').trim();
  let sentences = t.split(/(?<=[.!?])\s+/);

  if (level === 'L1' || level === 'L2') {
    sentences = sentences.map(s => {
      if (s.length > 140) {
        const parts = s.split(/,\s*/);
        return parts.map(p => p.trim()).join('. ');
      }
      return s;
    });
  }
  t = sentences.join(' ');
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

function makeQuestions() {
  return `
    <h4>Comprehension questions</h4>
    <ol>
      <li>What is the main idea of this text?</li>
      <li>Find two details that support the main idea.</li>
      <li>What question do you still have?</li>
    </ol>`;
}

function renderPreview(previewEl, dlBtn, { text, level, frames, glossary, questions }) {
  const body = `
    <h4>Adapted text <span class="badge">${level}</span></h4>
    <p>${text}</p>
    ${frames   ? makeSentenceFrames() : ''}
    ${glossary ? makeGlossary(text)   : ''}
    ${questions? makeQuestions()      : ''}
  `;
  previewEl.innerHTML = body;
  dlBtn.disabled = false;
}

/* --------------------------- public entry point -------------------------- */
export function initAdaptTool() {
  const $ = (sel) => document.querySelector(sel);

  // Step 1 selectors
  const fileInput = $('#at-file');
  const clearBtn  = $('#at-clear');
  const txtArea   = $('#at-input');

  // Step 2 selectors
  const levelSel  = $('#at-level');
  const ckFrames  = $('#at-frames');
  const ckGloss   = $('#at-glossary');
  const ckQs      = $('#at-questions');

  // Step 3 selectors
  const runBtn    = $('#at-run');
  const preview   = $('#at-preview');
  const dlBtn     = $('#at-download');

  // Progress UI
  const progRoot = $('#at-progress');
  const progBar  = progRoot?.querySelector('.progress-bar');
  const progTxt  = progRoot?.querySelector('.progress-text');
  const cancelBtn= $('#at-cancel');

  let abortParse = false;
  const showProgress = () => { if (progRoot) progRoot.hidden = false; setProgress(0); };
  const hideProgress = () => { if (progRoot) progRoot.hidden = true; };
  const setProgress = (pct) => {
    if (!progBar || !progTxt) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    progBar.style.width = clamped + '%';
    progTxt.textContent = clamped + '%';
  };
  cancelBtn?.addEventListener('click', () => { abortParse = true; });

  /* ---------- file upload: TXT fast path, DOCX/PDF with progress ---------- */
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File is larger than 15MB. Please use a smaller file or paste text.');
      fileInput.value = '';
      return;
    }

    txtArea.value = '';
    preview.textContent = 'Reading file… (beta extractor)';
    dlBtn.disabled = true;
    abortParse = false;
    showProgress();

    try {
      const name = file.name.toLowerCase();
      let text = '';

      if (name.endsWith('.txt')) {
        // fast path — show quick progress
        setProgress(25);
        text = await readTextFile(file);
        setProgress(100);
      } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
        text = await readDocx(file, setProgress, () => abortParse);
      } else if (name.endsWith('.pdf')) {
        text = await readPdf(file, setProgress, () => abortParse);
      } else {
        alert('Unsupported file type. Please upload .txt, .docx, or .pdf — or paste text.');
        preview.textContent = 'Your adapted text will appear here.';
        return;
      }

      if (abortParse) throw new Error('aborted');

      // normalize whitespace a bit
      text = text
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/[ \u00A0]{2,}/g, ' ')
        .trim();

      txtArea.value = text;
      preview.textContent = 'File loaded. Choose options and click "Generate adapted version."';
    } catch (err) {
      if (String(err?.message).includes('aborted')) {
        preview.textContent = 'Upload canceled.';
      } else {
        console.error(err);
        alert('Sorry — the file could not be parsed. Please paste text as a fallback.');
        preview.textContent = 'Your adapted text will appear here.';
      }
    } finally {
      hideProgress();
    }
  });

  /* -------------------------- clear, run, download ----------------------- */
  clearBtn?.addEventListener('click', () => {
    if (fileInput) fileInput.value = '';
    txtArea.value = '';
    preview.textContent = 'Your adapted text will appear here.';
    dlBtn.disabled = true;
  });

  runBtn?.addEventListener('click', () => {
    const raw = txtArea.value.trim();
    if (!raw) { alert('Paste text or upload a file first.'); return; }

    const level = levelSel?.value || 'L2';
    const simplified = simplify(raw, level);

    renderPreview(preview, dlBtn, {
      text: simplified,
      level,
      frames: !!ckFrames?.checked,
      glossary: !!ckGloss?.checked,
      questions: !!ckQs?.checked
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

  // Cosmetic: clicking the stylized label opens the chooser
  document.querySelector('#adapt-tool .file')?.addEventListener('click', () => fileInput?.click());
}
