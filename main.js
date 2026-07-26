// --- 要素取得 ---
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const actionArea = document.getElementById('action-area');
const btnUndo = document.getElementById('btn-undo');
const btnDownload = document.getElementById('btn-download');

// タブ・パネル
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const brushOptions = document.querySelectorAll('.brush-option');
const sizeSlider = document.getElementById('size-slider');
const brushSizeVal = document.getElementById('brush-size-val');

// スタンプ
const stampGrid = document.getElementById('stamp-grid');
const stampSlider = document.getElementById('stamp-slider');
const stampSizeVal = document.getElementById('stamp-size-val');

// 調整パネル項目
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessVal = document.getElementById('brightness-val');
const frameSelect = document.getElementById('frame-select');
const btnAutoMosaicFaces = document.getElementById('btn-auto-mosaic-faces');

const cursorRing = document.getElementById('cursor-ring');

// --- 状態管理 ---
let originalImage = null;
let effectCanvas = null;
let history = [];
let isDrawing = false;
let lastX = 0, lastY = 0;

let currentMode = 'brush'; // 'brush' or 'stamp'
let brushType = 'blur-strong';
let currentStamp = '🥰';

// --- スタンプ自動生成 ---
const emojis = ['🥰','🥺','🤪','🤩','😎','🤫','🫣','😶‍🌫️','😍','🫠','😐','🙌','✋','😺','😻','😹','🙀','😸','😽','🙈','🗿','🐰','🐶','🦍','🐷','⭐','💖','🌸','㊙️'];
emojis.forEach((emoji, index) => {
    const div = document.createElement('div');
    div.className = 'stamp-item' + (index === 0 ? ' active' : '');
    div.innerText = emoji;
    div.addEventListener('click', () => {
        document.querySelector('.stamp-item.active').classList.remove('active');
        div.classList.add('active');
        currentStamp = emoji;
    });
    stampGrid.appendChild(div);
});

// --- タブ切り替え ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        panels.forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
        
        const targetId = tab.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        targetPanel.classList.remove('hidden');
        targetPanel.classList.add('active');

        currentMode = targetId === 'panel-brush' ? 'brush' : (targetId === 'panel-stamp' ? 'stamp' : 'adjust');
        updateCanvasCursorClass();
        if (currentMode !== 'brush') cursorRing.style.display = 'none';
    });
});

function updateCanvasCursorClass() {
    canvas.className = currentMode === 'brush' ? 'mode-brush' : 'mode-stamp';
}

// スライダー数値連動
sizeSlider.addEventListener('input', (e) => { brushSizeVal.innerText = e.target.value + 'px'; });
stampSlider.addEventListener('input', (e) => { stampSizeVal.innerText = e.target.value + 'px'; });
brightnessSlider.addEventListener('input', (e) => {
    brightnessVal.innerText = e.target.value;
    if (originalImage) rebuildCanvasWithAdjustments();
});
frameSelect.addEventListener('change', () => {
    if (originalImage) rebuildCanvasWithAdjustments();
});

// ブラシ選択
brushOptions.forEach(option => {
    option.addEventListener('click', () => {
        document.querySelector('.brush-option.active').classList.remove('active');
        option.classList.add('active');
        brushType = option.getAttribute('data-type');
        if (originalImage) generateEffectCanvas();
    });
});

// --- 画像読み込み ---
function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => initCanvas(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

dropArea.addEventListener('dragover', (e) => { e.preventDefault(); });
dropArea.addEventListener('drop', (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { handleFile(e.target.files[0]); });

function initCanvas(img) {
    originalImage = img;
    const maxWidth = 1200;
    let width = img.width, height = img.height;
    if (width > maxWidth) {
        height = Math.floor(height * (maxWidth / width));
        width = maxWidth;
    }
    canvas.width = width;
    canvas.height = height;
    
    rebuildCanvasWithAdjustments();
    
    dropArea.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    actionArea.classList.remove('hidden');
    updateCanvasCursorClass();
    
    history = [];
    saveHistory();
    generateEffectCanvas();
}

// 明るさ・フレームを適用してキャンバスを再構築
function rebuildCanvasWithAdjustments() {
    if (!originalImage) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 一時キャンバスで明るさ調整
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');
    
    const brightness = parseInt(brightnessSlider.value);
    tCtx.filter = `brightness(${100 + brightness}%)`;
    tCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

    // フレーム効果
    const frameType = frameSelect.value;
    if (frameType === 'simple') {
        tCtx.filter = 'none';
        tCtx.strokeStyle = '#CBD5E0';
        tCtx.lineWidth = 4;
        tCtx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    } else if (frameType === 'shadow') {
        tCtx.filter = 'none';
        tCtx.strokeStyle = '#E2E8F0';
        tCtx.lineWidth = 10;
        tCtx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    } else if (frameType === 'polaroid') {
        tCtx.filter = 'none';
        tCtx.fillStyle = '#FFFFFF';
        const pad = 25;
        tCtx.fillRect(0, 0, canvas.width, pad); // 上
        tCtx.fillRect(0, 0, pad, canvas.height); // 左
        tCtx.fillRect(canvas.width - pad, 0, pad, canvas.height); // 右
        tCtx.fillRect(0, canvas.height - pad * 2.5, canvas.width, pad * 2.5); // 下（広め）
        
        tCtx.strokeStyle = '#E2E8F0';
        tCtx.lineWidth = 2;
        tCtx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }

    ctx.drawImage(tempCanvas, 0, 0);
}

function generateEffectCanvas() {
    if (!originalImage) return;
    effectCanvas = document.createElement('canvas');
    effectCanvas.width = canvas.width; effectCanvas.height = canvas.height;
    const eCtx = effectCanvas.getContext('2d');
    
    // 現在のキャンバス状態を元にエフェクトを生成
    if (brushType.includes('blur')) {
        const blurAmount = brushType === 'blur-strong' ? '15px' : '5px';
        eCtx.filter = `blur(${blurAmount})`;
        eCtx.drawImage(canvas, 0, 0);
    } 
    else if (brushType.includes('mosaic')) {
        const mosaicSize = brushType === 'mosaic-large' ? 15 : 6;
        const w = canvas.width / mosaicSize; const h = canvas.height / mosaicSize;
        eCtx.imageSmoothingEnabled = false;
        eCtx.drawImage(canvas, 0, 0, w, h);
        eCtx.drawImage(effectCanvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
    }
}

// --- カーソル追従 ---
function updateCursorRing(e) {
    if (!originalImage || currentMode !== 'brush') {
        cursorRing.style.display = 'none';
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const displaySize = sizeSlider.value * scale;

    cursorRing.style.width = displaySize + 'px';
    cursorRing.style.height = displaySize + 'px';
    cursorRing.style.left = e.clientX + 'px';
    cursorRing.style.top = e.clientY + 'px';
    cursorRing.style.display = 'block';
}

window.addEventListener('pointermove', (e) => {
    if (e.target === canvas) updateCursorRing(e);
    else cursorRing.style.display = 'none';
});

// --- 描画・操作 ---
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

canvas.addEventListener('pointerdown', (e) => {
    if (!originalImage || currentMode === 'adjust') return;
    const pos = getPointerPos(e);
    
    if (currentMode === 'brush') {
        isDrawing = true;
        lastX = pos.x; lastY = pos.y;
        applyBrush(lastX, lastY, sizeSlider.value / 2);
    } 
    else if (currentMode === 'stamp') {
        drawStamp(pos.x, pos.y);
        saveHistory();
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || currentMode !== 'brush') return;
    const pos = getPointerPos(e);
    const radius = sizeSlider.value / 2;
    const distance = Math.hypot(pos.x - lastX, pos.y - lastY);
    
    for (let i = 0; i < distance; i += 3) {
        const t = i / distance;
        const x = lastX + (pos.x - lastX) * t;
        const y = lastY + (pos.y - lastY) * t;
        applyBrush(x, y, radius);
    }
    lastX = pos.x; lastY = pos.y;
});

canvas.addEventListener('pointerup', finishDrawing);
canvas.addEventListener('pointerleave', finishDrawing);

function finishDrawing() {
    if (isDrawing) {
        isDrawing = false;
        saveHistory();
    }
}

function applyBrush(x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(effectCanvas, 0, 0);
    ctx.restore();
}

function drawStamp(x, y) {
    const size = parseInt(stampSlider.value);
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentStamp, x, y);
}

// 自動モザイク補助（画面中央付近にサンプル用のぼかし円を自動配置する便利機能）
btnAutoMosaicFaces.addEventListener('click', () => {
    if (!originalImage) return;
    ctx.save();
    ctx.beginPath();
    // 画面中央付近に疑似的な顔隠しエリアを自動で配置
    ctx.arc(canvas.width / 2, canvas.height / 2.5, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(effectCanvas, 0, 0);
    ctx.restore();
    saveHistory();
    alert('中央付近のモザイク処理を適用しました！気になる箇所が他にあればブラシでなぞってください。');
});

// --- 履歴・保存・シェア ---
function saveHistory() {
    if (history.length > 15) history.shift();
    history.push(canvas.toDataURL());
}

btnUndo.addEventListener('click', () => {
    if (history.length > 1) {
        history.pop();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            generateEffectCanvas();
        };
        img.src = history[history.length - 1];
    }
});

btnDownload.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'quickmosaic_edited.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// シェア機能
const shareUrl = window.location.href;
const shareText = "ブラウザ完結型・安全に写真の顔隠しができる「QuickMosaic」";
document.getElementById('share-x').addEventListener('click', () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
});
document.getElementById('share-fb').addEventListener('click', () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
});
document.getElementById('share-line').addEventListener('click', () => {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
});
document.getElementById('share-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl).then(() => alert('リンクをコピーしました！'));
});

document.getElementById('link-disclaimer').addEventListener('click', (e) => {
    e.preventDefault();
    alert('【免責事項】\n当サイトのツールは、すべての画像処理をご利用の端末内でのみ実行しており、外部サーバーに画像データは送信されません。');
});