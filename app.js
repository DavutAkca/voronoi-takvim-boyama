/**
 * Voronoi Takvim Boyama - Ana Uygulama
 * Tüm veriler tarayıcıda yerel olarak saklanır (IndexedDB)
 */

// Debug: Confirm script is loading
console.log('[VoronoiApp] Script loading started...');

(function () {
    'use strict';

    console.log('[VoronoiApp] IIFE executing...');

    // ===== Configuration =====
    const CONFIG = {
        DB_NAME: 'VoronoiTakvimDB',
        DB_VERSION: 1,
        STORE_IMAGES: 'images',
        STORE_OPERATIONS: 'operations',
        STORE_NOTES: 'notes',
        BOUNDARY_THRESHOLD: 60,      // Dark color threshold for boundaries
        ANTI_ALIAS_TOLERANCE: 40,    // Tolerance for anti-aliased edges
        MAX_HISTORY: 100             // Maximum undo/redo steps
    };

    // ===== State =====
    const state = {
        db: null,
        currentImageId: null,
        currentColor: '#FACC15',
        originalImageData: null,
        currentImageData: null,
        canvas: null,
        ctx: null,
        undoStack: [],
        redoStack: [],
        operations: [],
        notes: [],
        noteMode: false,
        pendingNotePosition: null
    };

    // ===== DOM Elements =====
    const elements = {};

    // ===== Initialize Application =====
    async function init() {
        console.log('[VoronoiApp] init() starting...');
        try {
            cacheElements();
            console.log('[VoronoiApp] Elements cached');
            await initDB();
            console.log('[VoronoiApp] IndexedDB initialized');
            setupEventListeners();
            console.log('[VoronoiApp] Event listeners attached');
            await loadSavedImage();
            console.log('[VoronoiApp] Saved image loaded (if any)');
            updateUI();
            console.log('[VoronoiApp] UI updated');
            registerServiceWorker();
            console.log('[VoronoiApp] ✅ Initialization complete!');
        } catch (error) {
            console.error('[VoronoiApp] ❌ Initialization error:', error);
        }
    }

    function cacheElements() {
        elements.canvas = document.getElementById('mainCanvas');
        elements.ctx = elements.canvas.getContext('2d', { willReadFrequently: true });
        elements.canvasContainer = document.getElementById('canvasContainer');
        elements.placeholder = document.getElementById('placeholder');
        elements.statusText = document.getElementById('statusText');
        elements.noteIndicator = document.getElementById('noteIndicator');
        elements.notesList = document.getElementById('notesList');
        elements.notesPanel = document.getElementById('notesPanel');

        // Buttons
        elements.uploadBtn = document.getElementById('uploadBtn');
        elements.uploadBtnText = document.getElementById('uploadBtnText');
        elements.placeholderUploadBtn = document.getElementById('placeholderUploadBtn');
        elements.imageInput = document.getElementById('imageInput');
        elements.undoBtn = document.getElementById('undoBtn');
        elements.redoBtn = document.getElementById('redoBtn');
        elements.resetBtn = document.getElementById('resetBtn');
        elements.exportPngBtn = document.getElementById('exportPngBtn');
        elements.exportJsonBtn = document.getElementById('exportJsonBtn');
        elements.importJsonBtn = document.getElementById('importJsonBtn');
        elements.importJsonInput = document.getElementById('importJsonInput');
        elements.helpBtn = document.getElementById('helpBtn');
        elements.toggleNoteModeBtn = document.getElementById('toggleNoteModeBtn');

        // Color buttons
        elements.colorBtns = document.querySelectorAll('.color-btn[data-color]');
        elements.customColorBtn = document.getElementById('customColorBtn');
        elements.customColorPicker = document.getElementById('customColorPicker');

        // Modals
        elements.helpModal = document.getElementById('helpModal');
        elements.closeHelpBtn = document.getElementById('closeHelpBtn');
        elements.noteModal = document.getElementById('noteModal');
        elements.noteInput = document.getElementById('noteInput');
        elements.saveNoteBtn = document.getElementById('saveNoteBtn');
        elements.cancelNoteBtn = document.getElementById('cancelNoteBtn');

        // Context menu
        elements.contextMenu = document.getElementById('contextMenu');
        elements.addNoteBtn = document.getElementById('addNoteBtn');
        elements.viewNoteBtn = document.getElementById('viewNoteBtn');
        elements.deleteNoteBtn = document.getElementById('deleteNoteBtn');

        // Toast container
        elements.toastContainer = document.getElementById('toastContainer');

        // Store references in state
        state.canvas = elements.canvas;
        state.ctx = elements.ctx;
    }

    // ===== IndexedDB =====
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

            request.onerror = () => {
                showToast('Veritabanı açılamadı. Lütfen tarayıcı ayarlarını kontrol edin.', 'error');
                reject(request.error);
            };

            request.onsuccess = () => {
                state.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Images store
                if (!db.objectStoreNames.contains(CONFIG.STORE_IMAGES)) {
                    db.createObjectStore(CONFIG.STORE_IMAGES, { keyPath: 'id' });
                }

                // Operations store
                if (!db.objectStoreNames.contains(CONFIG.STORE_OPERATIONS)) {
                    const opStore = db.createObjectStore(CONFIG.STORE_OPERATIONS, { keyPath: 'id', autoIncrement: true });
                    opStore.createIndex('imageId', 'imageId', { unique: false });
                }

                // Notes store
                if (!db.objectStoreNames.contains(CONFIG.STORE_NOTES)) {
                    const notesStore = db.createObjectStore(CONFIG.STORE_NOTES, { keyPath: 'id', autoIncrement: true });
                    notesStore.createIndex('imageId', 'imageId', { unique: false });
                }
            };
        });
    }

    function dbTransaction(storeName, mode = 'readonly') {
        return state.db.transaction(storeName, mode).objectStore(storeName);
    }

    function dbRequest(store, method, ...args) {
        return new Promise((resolve, reject) => {
            const request = store[method](...args);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ===== Image Management =====
    async function loadSavedImage() {
        try {
            const store = dbTransaction(CONFIG.STORE_IMAGES);
            const images = await dbRequest(store, 'getAll');

            if (images.length > 0) {
                const imageData = images[0];
                state.currentImageId = imageData.id;
                await loadImageFromBlob(imageData.blob);
                await loadOperations();
                await loadNotes();
                showToast('Önceki çalışmanız yüklendi.', 'success');
            }
        } catch (error) {
            console.error('Error loading saved image:', error);
        }
    }

    async function saveImage(blob) {
        try {
            const store = dbTransaction(CONFIG.STORE_IMAGES, 'readwrite');

            // Clear existing images first
            await dbRequest(store, 'clear');

            // Save new image
            const id = Date.now().toString();
            await dbRequest(store, 'put', { id, blob, savedAt: new Date().toISOString() });
            state.currentImageId = id;

            // Clear previous operations and notes when new image is uploaded
            await clearOperations();
            await clearNotes();

            return id;
        } catch (error) {
            console.error('Error saving image:', error);
            showToast('Görsel kaydedilemedi.', 'error');
            throw error;
        }
    }

    function loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                state.canvas.width = img.width;
                state.canvas.height = img.height;
                state.ctx.drawImage(img, 0, 0);
                state.originalImageData = state.ctx.getImageData(0, 0, img.width, img.height);
                state.currentImageData = state.ctx.getImageData(0, 0, img.width, img.height);
                URL.revokeObjectURL(url);

                elements.canvas.classList.add('visible');
                elements.placeholder.classList.add('hidden');
                elements.uploadBtnText.textContent = 'Görseli Değiştir';

                resolve();
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Görsel yüklenemedi'));
            };

            img.src = url;
        });
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            showToast('Lütfen PNG veya JPG formatında bir görsel seçin.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const blob = new Blob([e.target.result], { type: file.type });
                await saveImage(blob);
                await loadImageFromBlob(blob);

                // Reset state
                state.undoStack = [];
                state.redoStack = [];
                state.operations = [];
                state.notes = [];

                updateUI();
                showToast('Görsel başarıyla yüklendi!', 'success');
            } catch (error) {
                showToast('Görsel yüklenirken bir hata oluştu.', 'error');
            }
        };

        reader.onerror = () => {
            showToast('Dosya okunamadı.', 'error');
        };

        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset input
    }

    // ===== Operations (Paint History) =====
    async function saveOperation(operation) {
        try {
            const store = dbTransaction(CONFIG.STORE_OPERATIONS, 'readwrite');
            operation.imageId = state.currentImageId;
            await dbRequest(store, 'add', operation);
            state.operations.push(operation);
        } catch (error) {
            console.error('Error saving operation:', error);
        }
    }

    async function loadOperations() {
        try {
            const store = dbTransaction(CONFIG.STORE_OPERATIONS);
            const index = store.index('imageId');
            const operations = await dbRequest(index, 'getAll', state.currentImageId);

            state.operations = operations.sort((a, b) => a.timestamp - b.timestamp);

            // Replay operations
            for (const op of state.operations) {
                replayOperation(op);
            }
        } catch (error) {
            console.error('Error loading operations:', error);
        }
    }

    function replayOperation(operation) {
        if (operation.type === 'fill') {
            floodFill(operation.x, operation.y, operation.color, false);
        }
    }

    async function clearOperations() {
        try {
            const store = dbTransaction(CONFIG.STORE_OPERATIONS, 'readwrite');
            const index = store.index('imageId');
            const request = index.openCursor(IDBKeyRange.only(state.currentImageId));

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        state.operations = [];
                        resolve();
                    }
                };
                request.onerror = reject;
            });
        } catch (error) {
            console.error('Error clearing operations:', error);
        }
    }

    async function saveAllOperations() {
        try {
            await clearOperations();
            const store = dbTransaction(CONFIG.STORE_OPERATIONS, 'readwrite');
            for (const op of state.operations) {
                op.imageId = state.currentImageId;
                await dbRequest(store, 'add', op);
            }
        } catch (error) {
            console.error('Error saving all operations:', error);
        }
    }

    // ===== Notes =====
    async function saveNote(note) {
        try {
            const store = dbTransaction(CONFIG.STORE_NOTES, 'readwrite');
            note.imageId = state.currentImageId;
            const id = await dbRequest(store, 'add', note);
            note.id = id;
            state.notes.push(note);
            renderNotes();
        } catch (error) {
            console.error('Error saving note:', error);
        }
    }

    async function loadNotes() {
        try {
            const store = dbTransaction(CONFIG.STORE_NOTES);
            const index = store.index('imageId');
            state.notes = await dbRequest(index, 'getAll', state.currentImageId);
            renderNotes();
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async function deleteNote(noteId) {
        try {
            const store = dbTransaction(CONFIG.STORE_NOTES, 'readwrite');
            await dbRequest(store, 'delete', noteId);
            state.notes = state.notes.filter(n => n.id !== noteId);
            renderNotes();
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    async function clearNotes() {
        try {
            const store = dbTransaction(CONFIG.STORE_NOTES, 'readwrite');
            const index = store.index('imageId');
            const request = index.openCursor(IDBKeyRange.only(state.currentImageId));

            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        state.notes = [];
                        renderNotes();
                        resolve();
                    }
                };
                request.onerror = reject;
            });
        } catch (error) {
            console.error('Error clearing notes:', error);
        }
    }

    function renderNotes() {
        if (state.notes.length === 0) {
            elements.notesList.innerHTML = '<p class="no-notes">Henüz not eklenmedi</p>';
            return;
        }

        elements.notesList.innerHTML = state.notes.map(note => `
            <div class="note-item" data-note-id="${note.id}" data-x="${note.x}" data-y="${note.y}">
                <div class="note-item-header">
                    <span class="note-item-time">${formatDate(note.timestamp)}</span>
                    <span class="note-item-color" style="background:${note.color || '#9CA3AF'}"></span>
                </div>
                <div class="note-item-text">${escapeHtml(note.text)}</div>
            </div>
        `).join('');
    }

    // ===== Flood Fill Algorithm =====
    function floodFill(startX, startY, fillColor, saveOp = true) {
        if (!state.currentImageData) return;

        const width = state.canvas.width;
        const height = state.canvas.height;
        const imageData = state.ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        startX = Math.floor(startX);
        startY = Math.floor(startY);

        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const startIdx = (startY * width + startX) * 4;
        const startR = data[startIdx];
        const startG = data[startIdx + 1];
        const startB = data[startIdx + 2];

        // Parse fill color
        const fillRGB = hexToRgb(fillColor);
        if (!fillRGB) return;

        // Check if starting on a boundary (dark line)
        if (isDarkBoundary(startR, startG, startB)) {
            return; // Don't fill boundary lines
        }

        // Check if already this color
        if (startR === fillRGB.r && startG === fillRGB.g && startB === fillRGB.b) {
            return;
        }

        // Save state for undo (before fill)
        if (saveOp) {
            const undoData = state.ctx.getImageData(0, 0, width, height);
            state.undoStack.push({
                type: 'imageData',
                data: undoData,
                operations: [...state.operations]
            });
            if (state.undoStack.length > CONFIG.MAX_HISTORY) {
                state.undoStack.shift();
            }
            state.redoStack = [];
        }

        // Flood fill using queue
        const queue = [[startX, startY]];
        const visited = new Set();

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Check if this is a boundary
            if (isDarkBoundary(r, g, b)) continue;

            // Check if similar to start color (anti-alias tolerance)
            if (!isColorSimilar(r, g, b, startR, startG, startB, CONFIG.ANTI_ALIAS_TOLERANCE)) {
                continue;
            }

            visited.add(key);

            // Fill pixel
            data[idx] = fillRGB.r;
            data[idx + 1] = fillRGB.g;
            data[idx + 2] = fillRGB.b;
            data[idx + 3] = 255;

            // Add neighbors
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        state.ctx.putImageData(imageData, 0, 0);
        state.currentImageData = imageData;

        // Save operation
        if (saveOp) {
            const operation = {
                type: 'fill',
                x: startX,
                y: startY,
                color: fillColor,
                timestamp: Date.now()
            };
            saveOperation(operation);
        }

        updateUI();
    }

    function isDarkBoundary(r, g, b) {
        // Check if color is dark (likely a boundary line)
        const brightness = (r + g + b) / 3;
        return brightness < CONFIG.BOUNDARY_THRESHOLD;
    }

    function isColorSimilar(r1, g1, b1, r2, g2, b2, tolerance) {
        return Math.abs(r1 - r2) <= tolerance &&
            Math.abs(g1 - g2) <= tolerance &&
            Math.abs(b1 - b2) <= tolerance;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // ===== Undo / Redo =====
    function undo() {
        if (state.undoStack.length === 0) return;

        const current = {
            type: 'imageData',
            data: state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height),
            operations: [...state.operations]
        };
        state.redoStack.push(current);

        const previous = state.undoStack.pop();
        state.ctx.putImageData(previous.data, 0, 0);
        state.currentImageData = previous.data;
        state.operations = previous.operations;

        saveAllOperations();
        updateUI();
        showToast('Geri alındı', 'info');
    }

    function redo() {
        if (state.redoStack.length === 0) return;

        const current = {
            type: 'imageData',
            data: state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height),
            operations: [...state.operations]
        };
        state.undoStack.push(current);

        const next = state.redoStack.pop();
        state.ctx.putImageData(next.data, 0, 0);
        state.currentImageData = next.data;
        state.operations = next.operations;

        saveAllOperations();
        updateUI();
        showToast('İleri alındı', 'info');
    }

    function reset() {
        if (!state.originalImageData) return;

        if (!confirm('Tüm boyama işlemleri silinecek. Emin misiniz?')) return;

        state.ctx.putImageData(state.originalImageData, 0, 0);
        state.currentImageData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);
        state.undoStack = [];
        state.redoStack = [];
        state.operations = [];

        clearOperations();
        updateUI();
        showToast('Tüm boyamalar sıfırlandı', 'info');
    }

    // ===== Export / Import =====
    function exportPng() {
        if (!state.currentImageData) {
            showToast('Önce bir görsel yükleyin.', 'error');
            return;
        }

        const link = document.createElement('a');
        link.download = `voronoi-takvim-${formatDateForFilename()}.png`;
        link.href = state.canvas.toDataURL('image/png');
        link.click();

        showToast('PNG olarak indirildi!', 'success');
    }

    function exportJson() {
        if (!state.currentImageId) {
            showToast('Önce bir görsel yükleyin.', 'error');
            return;
        }

        const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            imageId: state.currentImageId,
            operations: state.operations,
            notes: state.notes
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `voronoi-yedek-${formatDateForFilename()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);

        showToast('Yedek alındı!', 'success');
    }

    async function importJson(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.version || !backup.operations) {
                throw new Error('Geçersiz yedek dosyası');
            }

            if (!state.originalImageData) {
                showToast('Önce bir görsel yükleyin, sonra yedeği içe aktarın.', 'error');
                return;
            }

            // Reset to original
            state.ctx.putImageData(state.originalImageData, 0, 0);
            state.undoStack = [];
            state.redoStack = [];
            state.operations = [];

            // Replay operations
            for (const op of backup.operations) {
                replayOperation(op);
                state.operations.push(op);
            }

            // Import notes
            await clearNotes();
            for (const note of (backup.notes || [])) {
                delete note.id; // Let DB assign new IDs
                await saveNote(note);
            }

            saveAllOperations();
            updateUI();
            showToast('Yedek başarıyla yüklendi!', 'success');
        } catch (error) {
            console.error('Import error:', error);
            showToast('Yedek dosyası okunamadı: ' + error.message, 'error');
        }

        event.target.value = '';
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Image upload
        elements.uploadBtn.addEventListener('click', () => elements.imageInput.click());
        elements.placeholderUploadBtn.addEventListener('click', () => elements.imageInput.click());
        elements.imageInput.addEventListener('change', handleImageUpload);

        // Color selection
        elements.colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                setActiveColor(color, btn);
            });
        });

        elements.customColorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            setActiveColor(color, elements.customColorBtn);
            elements.customColorBtn.querySelector('.custom-swatch').style.background = color;
            elements.customColorBtn.querySelector('.custom-swatch').textContent = '';
        });

        elements.customColorBtn.addEventListener('click', (e) => {
            if (e.target !== elements.customColorPicker) {
                elements.customColorPicker.click();
            }
        });

        // Canvas interactions
        elements.canvas.addEventListener('click', handleCanvasClick);
        elements.canvas.addEventListener('contextmenu', handleCanvasRightClick);

        // Actions
        elements.undoBtn.addEventListener('click', undo);
        elements.redoBtn.addEventListener('click', redo);
        elements.resetBtn.addEventListener('click', reset);
        elements.exportPngBtn.addEventListener('click', exportPng);
        elements.exportJsonBtn.addEventListener('click', exportJson);
        elements.importJsonBtn.addEventListener('click', () => elements.importJsonInput.click());
        elements.importJsonInput.addEventListener('change', importJson);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        });

        // Help modal
        elements.helpBtn.addEventListener('click', () => {
            elements.helpModal.hidden = false;
        });
        elements.closeHelpBtn.addEventListener('click', () => {
            elements.helpModal.hidden = true;
        });
        elements.helpModal.addEventListener('click', (e) => {
            if (e.target === elements.helpModal) {
                elements.helpModal.hidden = true;
            }
        });

        // Note mode
        elements.toggleNoteModeBtn.addEventListener('click', () => {
            state.noteMode = !state.noteMode;
            elements.noteIndicator.hidden = !state.noteMode;
            elements.toggleNoteModeBtn.classList.toggle('btn-primary', state.noteMode);
            updateStatus();
        });

        // Note modal
        elements.saveNoteBtn.addEventListener('click', handleSaveNote);
        elements.cancelNoteBtn.addEventListener('click', () => {
            elements.noteModal.hidden = true;
            elements.noteInput.value = '';
            state.pendingNotePosition = null;
        });
        elements.noteModal.addEventListener('click', (e) => {
            if (e.target === elements.noteModal) {
                elements.noteModal.hidden = true;
                elements.noteInput.value = '';
                state.pendingNotePosition = null;
            }
        });

        // Context menu
        elements.addNoteBtn.addEventListener('click', () => {
            elements.contextMenu.hidden = true;
            openNoteModal();
        });
        elements.viewNoteBtn.addEventListener('click', () => {
            const noteId = parseInt(elements.contextMenu.dataset.noteId);
            const note = state.notes.find(n => n.id === noteId);
            if (note) {
                alert(`Not: ${note.text}`);
            }
            elements.contextMenu.hidden = true;
        });
        elements.deleteNoteBtn.addEventListener('click', () => {
            const noteId = parseInt(elements.contextMenu.dataset.noteId);
            if (noteId && confirm('Bu notu silmek istediğinize emin misiniz?')) {
                deleteNote(noteId);
            }
            elements.contextMenu.hidden = true;
        });

        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            if (!elements.contextMenu.contains(e.target)) {
                elements.contextMenu.hidden = true;
            }
        });

        // Note item clicks
        elements.notesList.addEventListener('click', (e) => {
            const noteItem = e.target.closest('.note-item');
            if (noteItem) {
                const x = parseInt(noteItem.dataset.x);
                const y = parseInt(noteItem.dataset.y);
                highlightPosition(x, y);
            }
        });
    }

    function handleCanvasClick(e) {
        if (!state.currentImageData) return;

        const rect = state.canvas.getBoundingClientRect();
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (state.noteMode) {
            state.pendingNotePosition = { x, y };
            openNoteModal();
        } else {
            floodFill(x, y, state.currentColor);
        }
    }

    function handleCanvasRightClick(e) {
        e.preventDefault();
        if (!state.currentImageData) return;

        const rect = state.canvas.getBoundingClientRect();
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        state.pendingNotePosition = { x, y };

        // Check if there's a note at this position
        const existingNote = findNoteNear(x, y);

        elements.viewNoteBtn.hidden = !existingNote;
        elements.deleteNoteBtn.hidden = !existingNote;
        if (existingNote) {
            elements.contextMenu.dataset.noteId = existingNote.id;
        }

        // Position context menu
        elements.contextMenu.style.left = `${e.clientX}px`;
        elements.contextMenu.style.top = `${e.clientY}px`;
        elements.contextMenu.hidden = false;
    }

    function findNoteNear(x, y, radius = 30) {
        return state.notes.find(note => {
            const dx = note.x - x;
            const dy = note.y - y;
            return Math.sqrt(dx * dx + dy * dy) < radius;
        });
    }

    function openNoteModal() {
        elements.noteInput.value = '';
        elements.noteModal.hidden = false;
        elements.noteInput.focus();
    }

    async function handleSaveNote() {
        const text = elements.noteInput.value.trim();
        if (!text) {
            showToast('Lütfen bir not girin.', 'error');
            return;
        }

        if (!state.pendingNotePosition) return;

        const note = {
            x: state.pendingNotePosition.x,
            y: state.pendingNotePosition.y,
            text: text,
            color: state.currentColor,
            timestamp: Date.now()
        };

        await saveNote(note);

        elements.noteModal.hidden = true;
        elements.noteInput.value = '';
        state.pendingNotePosition = null;

        showToast('Not kaydedildi!', 'success');
    }

    function highlightPosition(x, y) {
        // Briefly highlight the position on canvas
        const ctx = state.ctx;
        const currentData = ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);

        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.stroke();

        setTimeout(() => {
            ctx.putImageData(currentData, 0, 0);
        }, 1000);
    }

    function setActiveColor(color, activeBtn) {
        state.currentColor = color;
        elements.colorBtns.forEach(btn => btn.classList.remove('active'));
        elements.customColorBtn.classList.remove('active');
        activeBtn.classList.add('active');
        updateStatus();
    }

    // ===== UI Updates =====
    function updateUI() {
        elements.undoBtn.disabled = state.undoStack.length === 0;
        elements.redoBtn.disabled = state.redoStack.length === 0;
        elements.resetBtn.disabled = !state.originalImageData;
        elements.exportPngBtn.disabled = !state.currentImageData;
        elements.exportJsonBtn.disabled = !state.currentImageId;
        elements.importJsonBtn.disabled = !state.originalImageData;

        updateStatus();
    }

    function updateStatus() {
        if (!state.currentImageData) {
            elements.statusText.textContent = 'Görsel yüklenmedi';
        } else if (state.noteMode) {
            elements.statusText.textContent = 'Not modu: Bir alana tıklayarak not ekleyin';
        } else {
            const colorName = getColorName(state.currentColor) || state.currentColor;
            elements.statusText.textContent = `Seçili renk: ${colorName}`;
        }
    }

    function getColorName(hex) {
        const colors = {
            '#FACC15': 'Mutlu (Sarı)',
            '#3B82F6': 'Üzgün (Mavi)',
            '#EF4444': 'Öfkeli (Kırmızı)',
            '#22C55E': 'Sakin (Yeşil)',
            '#A855F7': 'Kaygılı (Mor)',
            '#9CA3AF': 'Nötr (Gri)'
        };
        return colors[hex.toUpperCase()];
    }

    // ===== Toast Notifications =====
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===== Utility Functions =====
    function formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDateForFilename() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== Service Worker =====
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Use relative path with ./ for GitHub Pages compatibility
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('[VoronoiApp] Service Worker registered'))
                .catch(err => console.log('[VoronoiApp] Service Worker registration failed:', err));
        }
    }

    // ===== Start Application =====
    console.log('[VoronoiApp] Document readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('[VoronoiApp] Waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('[VoronoiApp] DOM ready, calling init() directly...');
        init();
    }
})();

console.log('[VoronoiApp] Script fully parsed.');
