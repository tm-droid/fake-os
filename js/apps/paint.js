// Paint window: a 640 x 420 canvas with brush, eraser, undo and saving to Pictures.
import { glyph } from '../ui/icons.js';
import { HOME, basename, joinPath, normalize, isValidName } from '../kernel/fs.js';

const W = 640;
const H = 420;
const MAX_UNDO = 20;
const WHITE = '#ffffff';
const SWATCHES = ['#000000', '#ffffff', '#ff3b30', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];

export default {
  id: 'paint',
  name: 'Paint',
  glyph: 'paint',
  tile: 'linear-gradient(#ffd6a5, #ff8a3d)',
  pinned: true,
  width: 780,
  height: 540,
  minWidth: 480,
  minHeight: 360,
  open(ctx) {
    const body = ctx.window.body;
    body.classList.add('paint-body');
    body.tabIndex = -1;
    body.innerHTML = `
      <div class="paint-app">
        <div class="paint-toolbar" role="toolbar" aria-label="Paint tools">
          <button type="button" class="paint-tool" data-tool="brush" aria-pressed="true" title="Brush" aria-label="Brush">${glyph('paint')}</button>
          <button type="button" class="paint-tool" data-tool="eraser" aria-pressed="false" title="Eraser" aria-label="Eraser">${glyph('eraser')}</button>
          <input type="range" class="paint-size" min="1" max="40" value="6" title="Brush size" aria-label="Brush size">
          <div class="paint-swatches"></div>
          <input type="color" class="paint-color" value="#000000" title="Custom color" aria-label="Custom color">
          <span class="paint-spacer"></span>
          <button type="button" class="paint-tool" data-action="undo" title="Undo" aria-label="Undo">${glyph('undo')}</button>
          <button type="button" class="btn" data-action="clear">Clear</button>
          <button type="button" class="btn primary" data-action="save">Save</button>
        </div>
        <div class="paint-stage">
          <canvas class="paint-canvas" width="${W}" height="${H}"></canvas>
        </div>
      </div>`;

    const $ = (selector) => body.querySelector(selector);
    const canvas = $('.paint-canvas');
    const g = canvas.getContext('2d');
    const sizeInput = $('.paint-size');
    const colorInput = $('.paint-color');
    const swatchBox = $('.paint-swatches');

    let tool = 'brush';
    let color = '#000000';
    let filePath = null;
    let stroke = null; // { id, last, color, width } while a pointer is down
    const history = []; // ImageData snapshots, newest last

    g.lineCap = 'round';
    g.lineJoin = 'round';

    function fillWhite() {
      g.fillStyle = WHITE;
      g.fillRect(0, 0, W, H);
    }

    function remember() {
      history.push(g.getImageData(0, 0, W, H));
      if (history.length > MAX_UNDO) history.shift();
    }

    function undo() {
      if (stroke) return;
      const snapshot = history.pop();
      if (snapshot) g.putImageData(snapshot, 0, 0);
    }

    // Maps a pointer position to canvas pixels, undoing the CSS scaling.
    function pointOf(event) {
      const box = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - box.left) / box.width) * W,
        y: ((event.clientY - box.top) / box.height) * H,
      };
    }

    function dot(p, s) {
      g.beginPath();
      g.arc(p.x, p.y, s.width / 2, 0, Math.PI * 2);
      g.fillStyle = s.color;
      g.fill();
    }

    function segment(a, b, s) {
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokeStyle = s.color;
      g.lineWidth = s.width;
      g.stroke();
    }

    canvas.addEventListener('pointerdown', (event) => {
      if (stroke || event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      remember();
      stroke = {
        id: event.pointerId,
        last: pointOf(event),
        color: tool === 'eraser' ? WHITE : color,
        width: Number(sizeInput.value),
      };
      dot(stroke.last, stroke);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!stroke || event.pointerId !== stroke.id) return;
      const next = pointOf(event);
      segment(stroke.last, next, stroke);
      stroke.last = next;
    });

    const endStroke = (event) => {
      if (stroke && event.pointerId === stroke.id) stroke = null;
    };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    function setTool(next) {
      tool = next;
      for (const btn of body.querySelectorAll('[data-tool]')) {
        btn.setAttribute('aria-pressed', String(btn.dataset.tool === next));
      }
    }

    function pickColor(hex) {
      color = hex;
      colorInput.value = hex;
      setTool('brush');
      for (const swatch of swatchBox.children) {
        swatch.classList.toggle('is-selected', swatch.dataset.color === hex);
      }
    }

    for (const hex of SWATCHES) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'paint-swatch';
      swatch.dataset.color = hex;
      swatch.style.background = hex;
      swatch.setAttribute('aria-label', `Color ${hex}`);
      swatch.addEventListener('click', () => pickColor(hex));
      swatchBox.append(swatch);
    }

    for (const btn of body.querySelectorAll('[data-tool]')) {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    }
    colorInput.addEventListener('input', () => pickColor(colorInput.value));
    $('[data-action="undo"]').addEventListener('click', undo);
    $('[data-action="clear"]').addEventListener('click', clearCanvas);
    $('[data-action="save"]').addEventListener('click', save);

    async function clearCanvas() {
      const ok = await ctx.dialogs.confirm('Clear the whole canvas? You can undo this.', {
        title: 'Clear Canvas',
        ok: 'Clear',
        destructive: true,
      });
      if (!ok || stroke) return;
      remember();
      fillWhite();
    }

    function writeTo(path) {
      try {
        ctx.fs.write(path, canvas.toDataURL('image/png'));
        filePath = path;
        ctx.window.setTitle(basename(path));
      } catch (err) {
        ctx.dialogs.alert(err.message, { title: 'Cannot save picture' });
      }
    }

    async function saveAs() {
      const answer = await ctx.dialogs.prompt('Name the picture.', {
        title: 'Save As',
        ok: 'Save',
        input: { value: 'Untitled.png' },
      });
      if (answer === null) return;
      const name = answer.trim();
      if (!isValidName(name)) {
        ctx.dialogs.alert(`"${answer}" is not a valid name.`, { title: 'Save As' });
        return;
      }
      const fileName = /\.png$/i.test(name) ? name : `${name}.png`;
      const path = joinPath(`${HOME}/Pictures`, fileName);
      if (ctx.fs.exists(path)) {
        const replace = await ctx.dialogs.confirm(`"${fileName}" already exists. Replace it?`, {
          title: 'Save As',
          ok: 'Replace',
          destructive: true,
        });
        if (!replace) return;
      }
      writeTo(path);
    }

    function save() {
      if (filePath) writeTo(filePath);
      else saveAs();
    }

    function draw(img) {
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      fillWhite();
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }

    function openFile(path) {
      let dataUrl;
      try {
        dataUrl = ctx.fs.read(path);
      } catch (err) {
        ctx.dialogs.alert(err.message, { title: 'Cannot open picture' });
        return;
      }
      const img = new Image();
      img.onload = () => {
        draw(img);
        filePath = normalize(path);
        ctx.window.setTitle(basename(filePath));
      };
      img.onerror = () => {
        ctx.dialogs.alert(`${basename(path)} could not be read as a picture.`, { title: 'Cannot open picture' });
      };
      img.src = dataUrl;
    }

    body.addEventListener('keydown', (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 's') {
        event.preventDefault();
        save();
      } else if (key === 'w') {
        event.preventDefault();
        ctx.window.close();
      }
    });

    ctx.window.setMenu([
      {
        title: 'File',
        items: [
          { label: 'Save', shortcut: 'Cmd+S', action: save },
          { label: 'Save As...', action: saveAs },
          '-',
          { label: 'Close Window', shortcut: 'Cmd+W', action: () => ctx.window.close() },
        ],
      },
      {
        title: 'Edit',
        items: [
          { label: 'Undo', shortcut: 'Cmd+Z', action: undo },
          { label: 'Clear Canvas', action: clearCanvas },
        ],
      },
    ]);

    fillWhite();
    pickColor(color);
    ctx.window.setTitle('Untitled');
    if (ctx.args.path) openFile(ctx.args.path);
    body.focus({ preventScroll: true });
  },
};
