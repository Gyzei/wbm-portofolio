(() => {
  const data = JSON.parse(document.getElementById('iv-data').textContent);
  const graph = data.graph;
  const $ = id => document.getElementById(`iv-${id}`);
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const media = id => data.media.find(file => Number(file.id) === id);
  const scene = id => graph.scenes.find(item => item.id === id);
  const number = id => String(graph.scenes.findIndex(item => item.id === id) + 1).padStart(2, '0');
  const formatTimecode = seconds => {
    if (seconds == null) return '';
    const total = Math.round(seconds);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const parseTimecode = value => { const match = /^(\d+):([0-5]\d)$/.exec(value); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };
  const snapshot = () => JSON.stringify(graph);
  let baseline = snapshot(), historySnapshot = baseline, selected = null, connecting = null, zoom = 1, saving = false, drag = null;
  const undoStack = [], redoStack = [], HISTORY_LIMIT = 100;
  let historyInputAt = 0;
  const MIN_ZOOM = .005, MAX_ZOOM = 2;
  const WORLD_PADDING = 32, MAX_POSITION = 20000, CANVAS_STEP = 512;
  const thumbnailObserver = new IntersectionObserver(entries => entries.forEach(({target, isIntersecting}) => {
    if (!isIntersecting) return;
    target.preload = 'metadata';
    target.src = target.dataset.lazyVideo;
    target.load();
    delete target.dataset.lazyVideo;
    thumbnailObserver.unobserve(target);
  }), {rootMargin:'120px'});
  let pan = null, spaceHeld = false, suppressCanvasClick = false;
  let connectingChoice = null, wireDrag = null, edgeScrollFrame = 0;
  let canvasWidth = 1200, canvasHeight = 800;
  let previewScene = null, previewGraph = null;
  let sceneDuration = null;
  const videoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>';
  function announce(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('iv-error', error);
  }
  function dirty() {
    $('save-state').textContent = saving ? 'Menyimpan…' : snapshot() === baseline ? 'Draft tersimpan' : 'Perubahan belum disimpan';
    $('save-state').classList.toggle('is-dirty', snapshot() !== baseline);
  }
  function setInspectorVisible(visible) {
    visible = Boolean(visible && scene(selected));
    $('inspector').hidden = !visible;
    $('inspector-toggle').setAttribute('aria-expanded', String(visible));
  }
  function updateHistoryButtons() {
    $('undo').disabled = undoStack.length === 0;
    $('redo').disabled = redoStack.length === 0;
  }
  function changed(typing = false) {
    const current = snapshot(), coalesce = typing && Date.now() - historyInputAt < 700;
    if (current !== historySnapshot) {
      if (!coalesce) {
        undoStack.push(historySnapshot);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack.length = 0;
      }
      historySnapshot = current;
    }
    historyInputAt = typing ? Date.now() : 0;
    dirty(); updateHistoryButtons();
  }
  function restoreHistory(from, to, message) {
    if (!from.length) return announce(message === 'dibatalkan' ? 'Tidak ada perubahan untuk dibatalkan.' : 'Tidak ada perubahan untuk diulang.');
    to.push(snapshot());
    if (to.length > HISTORY_LIMIT) to.shift();
    clearConnection();
    Object.assign(graph, JSON.parse(from.pop()));
    if (!scene(selected)) selected = scene(graph.startId)?.id ?? graph.scenes[0]?.id ?? null;
    historySnapshot = snapshot(); historyInputAt = 0;
    render(); dirty(); updateHistoryButtons(); announce(`Perubahan ${message}.`);
  }
  function undo() { restoreHistory(undoStack, redoStack, 'dibatalkan'); }
  function redo() { restoreHistory(redoStack, undoStack, 'diulang'); }
  function resizeWorld() {
    const viewportWidth = $('canvas').clientWidth / zoom, viewportHeight = $('canvas').clientHeight / zoom;
    // Keep content margins independent of zoom, so zooming out does not permanently inflate the workspace.
    canvasWidth = Math.max(canvasWidth, ...graph.scenes.map(item => item.x + 232 + WORLD_PADDING * 2 + CANVAS_STEP));
    canvasHeight = Math.max(canvasHeight, ...graph.scenes.map(item => item.y + 550 + WORLD_PADDING * 2 + CANVAS_STEP));
    const width = Math.max(canvasWidth, viewportWidth);
    const height = Math.max(canvasHeight, viewportHeight);
    $('world').style.width = `${width}px`;
    $('world').style.height = `${height}px`;
    $('world').style.transform = `scale(${zoom})`;
    $('world-size').style.width = `${width * zoom}px`;
    $('world-size').style.height = `${height * zoom}px`;
    $('edges').setAttribute('width', width);
    $('edges').setAttribute('height', height);
    $('wire-preview').setAttribute('width', width);
    $('wire-preview').setAttribute('height', height);
  }
  function growCanvas(right, bottom) {
    // shortcut: Keep scene positions within the existing 20,000-unit storage limit; raise both client/server limits together for larger stories.
    const limit = MAX_POSITION + WORLD_PADDING * 2 + 550 + CANVAS_STEP;
    const width = Math.max(canvasWidth, Math.min(limit, Math.ceil((right + CANVAS_STEP / 2) / CANVAS_STEP) * CANVAS_STEP));
    const height = Math.max(canvasHeight, Math.min(limit, Math.ceil((bottom + CANVAS_STEP / 2) / CANVAS_STEP) * CANVAS_STEP));
    if (width === canvasWidth && height === canvasHeight) return;
    canvasWidth = width; canvasHeight = height; resizeWorld();
  }
  function worldPoint(x, y) {
    const world = $('world').getBoundingClientRect();
    return {x:(x - world.left) / zoom, y:(y - world.top) / zoom};
  }
  function socketPoint(socket) {
    const rect = socket.getBoundingClientRect();
    return worldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  function wirePath(from, to) {
    const bend = Math.max(70, Math.abs(to.x - from.x) * .45);
    const start = Math.min(from.x + bend, parseFloat($('world').style.width) - 8), end = Math.max(8, to.x - bend);
    return `M${from.x} ${from.y}C${start} ${from.y} ${end} ${to.y} ${to.x} ${to.y}`;
  }
  function renderEdges(movedId) {
    let markup = '';
    graph.scenes.forEach(item => {
      const node = document.querySelector(`[data-node="${item.id}"]`);
      item.choices.forEach((choice, index) => {
        if (movedId && item.id !== movedId && choice.target !== movedId) return;
        const target = document.querySelector(`[data-input-port="${choice.target}"]`);
        const output = node?.querySelector(`[data-choice-port="${index}"]`);
        if (!target || !output) return;
        markup += `<path class="iv-edge ${selected === item.id ? 'is-selected' : ''}" data-edge-source="${item.id}" data-edge-target="${choice.target}" data-edge-choice="${index}" d="${wirePath(socketPoint(output), socketPoint(target))}"><title>${escape(item.title)} → ${escape(choice.label)} → ${escape(scene(choice.target)?.title || '')}</title></path>`;
      });
    });
    if (movedId) {
      $('edges').querySelectorAll(`[data-edge-source="${movedId}"], [data-edge-target="${movedId}"]`).forEach(edge => edge.remove());
      $('edges').insertAdjacentHTML('beforeend', markup);
    } else $('edges').innerHTML = markup;
    if (wireDrag?.moved) drawWirePreview();
  }
  function updateEdgeTitles(selector) {
    $('edges').querySelectorAll(selector).forEach(edge => {
      const from = scene(edge.dataset.edgeSource), choice = from.choices[Number(edge.dataset.edgeChoice)];
      edge.querySelector('title').textContent = `${from.title} → ${choice.label} → ${scene(choice.target).title}`;
    });
  }
  function outputSocket(item, index = null) {
    const isNew = index === null;
    const label = isNew ? `Tambah cabang scene ${number(item.id)}` : `Sambungkan ulang pilihan ${item.choices[index].label} pada scene ${number(item.id)}`;
    return `<button type="button" class="iv-port ${isNew ? 'iv-output-port' : 'iv-choice-port'}" data-output-port="${item.id}" ${isNew ? '' : `data-output-choice="${index}" data-choice-port="${index}"`} aria-label="${escape(label)}" title="Tarik ke input scene, atau klik untuk memilih tujuan" ${isNew && item.choices.length >= 8 ? 'disabled' : ''}></button>`;
  }
  function renderNodes() {
    if (connecting && (!scene(connecting) || (connectingChoice && !scene(connecting).choices.includes(connectingChoice)))) clearConnection();
    $('nodes').innerHTML = graph.scenes.map(item => {
      const file = media(item.mediaId), isStart = graph.startId === item.id;
      return `<article class="iv-node ${selected === item.id ? 'is-selected' : ''}" data-node="${item.id}" tabindex="0" aria-label="Scene ${number(item.id)}: ${escape(item.title)}${isStart ? ', scene awal' : ''}" style="left:${item.x}px;top:${item.y}px">
        <button type="button" class="iv-port iv-input-port" data-input-port="${item.id}" aria-label="Input scene ${escape(item.title)}" title="Input · lepas koneksi di sini"></button>
        <div class="iv-node-handle" title="Drag untuk memindahkan scene"><span class="iv-node-number">${number(item.id)}</span><span>${isStart ? 'SCENE AWAL' : item.choices.length ? 'SCENE' : 'AKHIR CERITA'}</span><span class="iv-node-grip" aria-hidden="true">⠿</span></div>
        <div class="iv-node-thumbnail">${file ? `<video data-lazy-video="${escape(file.fileAddress)}#t=0.1" preload="none" muted playsinline aria-label="Thumbnail ${escape(file.fileName)}"></video><span class="iv-node-play">${videoIcon}</span>` : `${videoIcon}<span>${item.mediaId === null ? 'Tarik video ke sini' : 'Video tidak tersedia'}</span>`}</div>
        <div class="iv-node-info"><strong title="${escape(item.title)}">${escape(item.title)}</strong><small>${file ? escape(file.fileName) : 'Video belum dipilih'}</small></div>
        <div class="iv-node-choices">${item.choices.map((choice, index) => `<div class="iv-node-choice"><span>${escape(choice.label)}</span><span class="iv-choice-destination">${number(choice.target)}</span>${outputSocket(item, index)}</div>`).join('')}</div>
        <div class="iv-node-footer"><button type="button" class="iv-connect" data-connect="${item.id}" aria-label="Hubungkan ${escape(item.title)} ke scene lain"><span>+ Hubungkan scene</span></button>${outputSocket(item)}</div></article>`;
    }).join('');
    $('nodes').querySelectorAll('[data-lazy-video]').forEach(video => thumbnailObserver.observe(video));
    $('empty').hidden = graph.scenes.length !== 0;
    $('world-size').hidden = graph.scenes.length === 0;
    $('flow-count').textContent = `${graph.scenes.length} scene · ${graph.scenes.reduce((total, item) => total + item.choices.length, 0)} cabang`;
    $('scene-count').textContent = graph.scenes.length;
    $('fit').disabled = graph.scenes.length === 0;
    $('focus').disabled = !scene(selected);
    resizeWorld();
    renderEdges();
    refreshConnectionTargets();
  }
  function renderSceneList() {
    $('scene-list').innerHTML = graph.scenes.length ? graph.scenes.map((item, index) => `<li draggable="true" data-order="${item.id}" class="${selected === item.id ? 'is-selected' : ''}"><button class="iv-list-select" type="button" data-select="${item.id}"><span>${number(item.id)}</span><strong>${escape(item.title)}</strong>${graph.startId === item.id ? '<small>Awal</small>' : ''}</button><div><button type="button" data-move="-1" data-id="${item.id}" aria-label="Naikkan ${escape(item.title)}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-id="${item.id}" aria-label="Turunkan ${escape(item.title)}" ${index === graph.scenes.length - 1 ? 'disabled' : ''}>↓</button></div></li>`).join('') : '<li class="iv-list-empty">Belum ada scene. Tambahkan scene pertama untuk mulai.</li>';
  }
  function customSelect(kind, selected, label, options, index = '') {
    const id = `iv-${kind}-options${index === '' ? '' : `-${index}`}`;
    const current = options.find(option => String(option.value) === String(selected));
    return `<div class="iv-custom-select" data-custom-select data-kind="${kind}" data-index="${index}" data-value="${escape(selected ?? '')}">
      <button type="button" class="iv-select-trigger" role="combobox" aria-label="${escape(label)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}" data-select-trigger><span data-selected-label>${escape(current?.label || 'Pilih…')}</span><span aria-hidden="true">⌄</span></button>
      <div class="iv-select-menu" data-select-menu hidden><input type="search" data-option-search aria-label="Cari ${escape(label.toLowerCase())}" placeholder="Cari…" autocomplete="off"><div id="${id}" class="iv-select-options" role="listbox" aria-label="${escape(label)}">${options.map(option => `<button type="button" role="option" class="iv-select-option" data-custom-option data-option-value="${escape(option.value)}" aria-selected="${String(option.value) === String(selected)}">${escape(option.label)}</button>`).join('')}</div><p class="iv-select-no-results" data-select-empty hidden>Tidak ada hasil.</p></div>
    </div>`;
  }
  function closeCustomSelect(root, focus = false) {
    if (!root) return;
    root.querySelector('[data-select-menu]').hidden = true;
    root.querySelector('[data-select-trigger]').setAttribute('aria-expanded', 'false');
    if (focus) root.querySelector('[data-select-trigger]').focus();
  }
  function chooseCustomOption(root, option) {
    const value = option.dataset.optionValue, kind = root.dataset.kind;
    root.dataset.value = value;
    root.querySelector('[data-selected-label]').textContent = option.textContent;
    root.querySelectorAll('[data-custom-option]').forEach(item => item.setAttribute('aria-selected', String(item === option)));
    closeCustomSelect(root, true);
    if (kind === 'media') {
      const item = scene(selected);
      if (!item) return;
      item.mediaId = value === '' ? null : Number(value);
      changed(); renderNodes(); renderInspector(); $('scene-media').querySelector('[data-select-trigger]')?.focus();
    } else {
      const choice = scene(selected)?.choices[Number(root.dataset.index)];
      if (!choice) return;
      choice.target = value; changed(); renderNodes();
    }
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-select-trigger]');
    const option = event.target.closest('[data-custom-option]');
    if (option) { chooseCustomOption(option.closest('[data-custom-select]'), option); return; }
    if (trigger) {
      const root = trigger.closest('[data-custom-select]'), opening = trigger.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('[data-custom-select]').forEach(item => closeCustomSelect(item));
      if (opening) {
        root.querySelector('[data-select-menu]').hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        root.querySelector('[data-option-search]').focus();
      }
      return;
    }
    if (!event.target.closest('[data-custom-select]')) document.querySelectorAll('[data-custom-select]').forEach(item => closeCustomSelect(item));
  });
  document.addEventListener('input', event => {
    const search = event.target.closest('[data-option-search]');
    if (!search) return;
    const root = search.closest('[data-custom-select]'), query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    root.querySelectorAll('[data-custom-option]').forEach(option => {
      option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
      if (!option.hidden) count++;
    });
    root.querySelector('[data-select-empty]').hidden = count !== 0;
  });
  document.addEventListener('keydown', event => {
    const root = event.target.closest?.('[data-custom-select]');
    if (!root) return;
    if (event.key === 'Escape') { event.preventDefault(); closeCustomSelect(root, true); return; }
    if (event.target.matches('[data-select-trigger]') && ['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();
      root.querySelector('[data-select-menu]').hidden = false;
      event.target.setAttribute('aria-expanded', 'true');
      root.querySelector('[data-option-search]').focus();
    } else if (event.target.matches('[data-option-search]') && ['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const options = [...root.querySelectorAll('[data-custom-option]:not([hidden])')];
      options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus();
    } else if (event.target.matches('[data-custom-option]') && ['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const options = [...root.querySelectorAll('[data-custom-option]:not([hidden])')], current = options.indexOf(event.target);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : current + (event.key === 'ArrowDown' ? 1 : -1);
      options[index]?.focus();
    }
  });
  function renderChoices() {
    const item = scene(selected);
    if (!item) return;
    $('choice-count').textContent = `${item.choices.length} / 8`;
    item.choices.forEach((choice, index) => {
      if (choice.timeSec === undefined) choice.timeSec = null;
    });
    $('choices').innerHTML = item.choices.map((choice, index) => `<div class="iv-choice-editor"><div><label class="iv-field">Pilihan ${index + 1}<input data-choice-label="${index}" maxlength="100" required value="${escape(choice.label)}"></label><button type="button" data-remove-choice="${index}" aria-label="Hapus pilihan ${index + 1}">×</button></div><div class="iv-choice-row"><div class="iv-field">Menuju scene${customSelect('target', choice.target, 'Tujuan scene', graph.scenes.filter(target => target.id !== item.id).map(target => ({value:target.id, label:`${number(target.id)} · ${target.title}`})), index)}</div><label class="iv-field iv-field-time">Tombol Muncul<input type="text" inputmode="numeric" pattern="\\d+:([0-5]\\d)" maxlength="7" data-choice-time="${index}" value="${escape(formatTimecode(choice.timeSec))}" placeholder="mm:ss" title="Format menit:detik; maksimal ${formatTimecode(sceneDuration)}" ${sceneDuration === null ? 'disabled' : ''}></label></div></div>`).join('');
    $('add-choice').disabled = graph.scenes.length < 2 || item.choices.length >= 8;
    $('add-choice').title = graph.scenes.length < 2 ? 'Tambahkan scene lain terlebih dahulu' : '';
  }
  function renderInspector() {
    const item = scene(selected);
    $('inspector-toggle').disabled = !item;
    if (!item) setInspectorVisible(false);
    $('inspector-empty').hidden = Boolean(item);
    $('scene-fields').hidden = !item;
    $('selected-number').textContent = item ? `SCENE ${number(item.id)}` : '—';
    if (!item) return;
    $('scene-title').value = item.title;
    const videoOptions = [{value:'', label:'Belum ada video'}, ...(item.mediaId !== null && !media(item.mediaId) ? [{value:item.mediaId, label:'Video tidak tersedia — pilih ulang'}] : []), ...data.media.map(file => ({value:Number(file.id), label:file.fileName}))];
    $('scene-media').innerHTML = customSelect('media', item.mediaId ?? '', 'Video scene', videoOptions);
    const file = media(item.mediaId);
    sceneDuration = null;
    $('inspector-video').innerHTML = file ? `<video src="${escape(file.fileAddress)}" controls playsinline preload="metadata"></video>` : `<div>${videoIcon}<span>Belum ada video</span></div>`;
    const inspectorVideo = $('inspector-video').querySelector('video');
    inspectorVideo?.addEventListener('loadedmetadata', () => {
      if (scene(selected) !== item || !Number.isFinite(inspectorVideo.duration)) return;
      sceneDuration = Math.min(86400, Math.floor(inspectorVideo.duration));
      const clamped = item.choices.some(choice => choice.timeSec != null && choice.timeSec > sceneDuration);
      if (clamped) {
        item.choices.forEach(choice => { if (choice.timeSec != null) choice.timeSec = Math.min(choice.timeSec, sceneDuration); });
        changed(); announce('Timer cabang disesuaikan dengan durasi video.');
      }
      renderChoices();
    });
    $('set-start').textContent = graph.startId === item.id ? '✓ Scene awal cerita' : 'Jadikan scene awal';
    $('set-start').disabled = graph.startId === item.id;
    renderChoices();
  }
  function render() { $('title').value = graph.title; renderNodes(); renderSceneList(); renderInspector(); }
  function select(id, reveal = false) {
    selected = id;
    setInspectorVisible(true);
    render();
    const node = document.querySelector(`[data-node="${id}"]`);
    node?.focus({preventScroll:true});
    if (reveal) frameScenes([scene(id)]);
  }
  function addScene(mediaId = null, position = null) {
    if (graph.scenes.length >= 100) return announce('Maksimal 100 scene per draft.', true);
    const file = media(mediaId);
    const item = {id:`s_${Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('')}`, title:file ? file.fileName.replace(/\.[^.]+$/, '').slice(0, 100) : `Scene ${graph.scenes.length + 1}`, mediaId,
      x:Math.round(Math.min(MAX_POSITION, Math.max(0, position?.x ?? 80 + (graph.scenes.length % 4) * 320))),
      y:Math.round(Math.min(MAX_POSITION, Math.max(0, position?.y ?? 80 + Math.floor(graph.scenes.length / 4) * 390))), choices:[]};
    graph.scenes.push(item);
    graph.startId ??= item.id;
    clearConnection();
    changed();
    select(item.id, true);
    announce(`Scene ${number(item.id)} ditambahkan. Pilih video dan hubungkan scene.`);
  }
  function connectionError(targetId) {
    const from = scene(connecting);
    if (!from || !scene(targetId) || from.id === targetId) return 'Pilih scene lain sebagai tujuan, atau tekan Esc untuk batal.';
    if (!connectingChoice && from.choices.length >= 8) return 'Maksimal 8 pilihan per scene.';
    if (connectingChoice?.target !== targetId && from.choices.some(choice => choice !== connectingChoice && choice.target === targetId)) return 'Scene ini sudah terhubung. Edit labelnya di inspector.';
    return '';
  }
  function refreshConnectionTargets() {
    $('nodes').querySelectorAll('[data-node]').forEach(node => {
      if (!scene(node.dataset.node)) return;
      node.classList.toggle('is-target', Boolean(connecting) && !connectionError(node.dataset.node));
      node.classList.remove('is-snap-target', 'is-invalid-target');
      node.querySelector('[data-connect]').setAttribute('aria-pressed', String(connecting === node.dataset.node && !connectingChoice));
      node.querySelectorAll('[data-output-port]').forEach(port => {
        const choice = port.dataset.outputChoice === undefined ? null : scene(node.dataset.node).choices[Number(port.dataset.outputChoice)];
        port.setAttribute('aria-pressed', String(connecting === node.dataset.node && choice === connectingChoice));
      });
    });
  }
  function activateConnection(sourceId, choice = null) {
    if (connecting === sourceId && connectingChoice === choice) { clearConnection(); announce('Menghubungkan dibatalkan.'); return; }
    clearConnection(); connecting = sourceId; connectingChoice = choice;
    if (!choice && scene(sourceId).choices.length >= 8) { clearConnection(); announce('Maksimal 8 pilihan per scene.', true); return; }
    refreshConnectionTargets();
    announce('Klik input atau scene tujuan. Tekan Esc untuk batal.');
  }
  function connect(targetId) {
    const error = connectionError(targetId);
    if (error) { announce(error, true); return false; }
    const from = scene(connecting);
    if (connectingChoice) connectingChoice.target = targetId;
    else from.choices.push({label:from.choices.length ? `Pilihan ${from.choices.length + 1}` : 'Lanjutkan', target:targetId, timeSec:null});
    const sourceId = from.id;
    clearConnection();
    changed(); select(sourceId);
    announce('Cabang terhubung. Label pilihan bisa diubah di inspector.');
    return true;
  }
  function stopEdgeScroll() {
    cancelAnimationFrame(edgeScrollFrame); edgeScrollFrame = 0;
  }
  function scrollAtEdge() {
    edgeScrollFrame = 0;
    const gesture = wireDrag || drag;
    if (!gesture?.moved || gesture.finished) return;
    const canvas = $('canvas'), rect = canvas.getBoundingClientRect();
    const x = gesture.currentX - rect.left, y = gesture.currentY - rect.top;
    if (x < -48 || y < -48 || x > canvas.clientWidth + 48 || y > canvas.clientHeight + 48) return;
    const speed = (point, size) => point < 48 ? -Math.min(18, (48 - point) / 3) : point > size - 48 ? Math.min(18, (point - size + 48) / 3) : 0;
    const dx = speed(x, canvas.clientWidth), dy = speed(y, canvas.clientHeight);
    if (!dx && !dy) return;
    const left = canvas.scrollLeft, top = canvas.scrollTop;
    growCanvas(dx > 0 ? (left + canvas.clientWidth + dx) / zoom : 0, dy > 0 ? (top + canvas.clientHeight + dy) / zoom : 0);
    canvas.scrollLeft += dx; canvas.scrollTop += dy;
    if (canvas.scrollLeft === left && canvas.scrollTop === top) return;
    if (wireDrag) drawWirePreview();
    else moveDraggedScene();
    edgeScrollFrame = requestAnimationFrame(scrollAtEdge);
  }
  function startEdgeScroll() { if (!edgeScrollFrame) scrollAtEdge(); }
  function stopWire() {
    const finished = wireDrag;
    wireDrag = null;
    if (finished) suppressCanvasClick = true;
    stopEdgeScroll();
    $('wire-preview').setAttribute('hidden', '');
    $('canvas').classList.remove('is-wiring');
    $('edges').querySelectorAll('.is-rewiring').forEach(edge => edge.classList.remove('is-rewiring'));
    if (finished && $('canvas').hasPointerCapture(finished.pointerId)) $('canvas').releasePointerCapture(finished.pointerId);
  }
  function clearConnection() {
    stopWire(); connecting = null; connectingChoice = null;
    refreshConnectionTargets();
  }
  function wireTarget(x, y) {
    const rect = $('canvas').getBoundingClientRect();
    if (x < rect.left || y < rect.top || x > rect.left + $('canvas').clientWidth || y > rect.top + $('canvas').clientHeight) return null;
    const hit = document.elementFromPoint(x, y);
    if (hit?.closest('[data-output-port]')) return null;
    const node = hit?.closest('[data-node]');
    if (node) return node.dataset.node;
    let closest = null, distance = 28;
    $('nodes').querySelectorAll('[data-input-port]').forEach(port => {
      const bounds = port.getBoundingClientRect(), offset = Math.hypot(x - bounds.left - bounds.width / 2, y - bounds.top - bounds.height / 2);
      if (offset < distance) { closest = port.dataset.inputPort; distance = offset; }
    });
    return closest;
  }
  function drawWirePreview() {
    if (!wireDrag?.moved) return;
    const targetId = wireTarget(wireDrag.currentX, wireDrag.currentY);
    const valid = targetId !== null && !connectionError(targetId);
    const destination = valid ? socketPoint(document.querySelector(`[data-input-port="${targetId}"]`)) : worldPoint(wireDrag.currentX, wireDrag.currentY);
    $('wire-path').setAttribute('d', wirePath(socketPoint(wireDrag.port), destination));
    $('wire-preview').removeAttribute('hidden');
    $('wire-preview').classList.toggle('is-valid', valid);
    $('wire-preview').classList.toggle('is-invalid', targetId !== null && !valid);
    $('nodes').querySelectorAll('.is-snap-target,.is-invalid-target').forEach(node => node.classList.remove('is-snap-target', 'is-invalid-target'));
    if (targetId) document.querySelector(`[data-node="${targetId}"]`).classList.add(valid ? 'is-snap-target' : 'is-invalid-target');
    if (wireDrag.targetId !== targetId) {
      announce(valid ? `Lepas untuk menghubungkan ke ${scene(targetId).title}.` : targetId ? connectionError(targetId) : 'Lepas di input scene tujuan. Esc untuk batal.');
    }
    wireDrag.targetId = targetId;
    if (connectingChoice) {
      const index = scene(connecting).choices.indexOf(connectingChoice);
      $('edges').querySelector(`[data-edge-source="${connecting}"][data-edge-choice="${index}"]`)?.classList.add('is-rewiring');
    }
  }
  function finishWire(event) {
    if (!wireDrag || wireDrag.pointerId !== event.pointerId) return;
    const finished = wireDrag;
    if (event.type === 'pointerup' && finished.moved) {
      finished.currentX = event.clientX; finished.currentY = event.clientY; drawWirePreview();
    }
    stopWire();
    if (event.type !== 'pointerup') { clearConnection(); announce('Menghubungkan dibatalkan.'); }
    else if (!finished.moved) {
      connecting = finished.previousSource; connectingChoice = finished.previousChoice;
      activateConnection(finished.sourceId, finished.choice);
    } else if (finished.targetId && !connectionError(finished.targetId)) connect(finished.targetId);
    else { clearConnection(); announce('Koneksi tidak diubah. Lepas pada input scene lain.', true); }
    suppressCanvasClick = true;
    setTimeout(() => { suppressCanvasClick = false; }, 0);
  }
  function reorder(id, destination) {
    const index = graph.scenes.findIndex(item => item.id === id);
    if (index < 0 || destination < 0 || destination >= graph.scenes.length || index === destination) return;
    const [item] = graph.scenes.splice(index, 1);
    graph.scenes.splice(destination, 0, item);
    changed(); render();
    announce('Urutan scene diperbarui. Hubungan cabang tetap sama. Klik Rapikan untuk menata kanvas.');
  }
  function renderMedia() {
    const query = $('media-search').value.toLowerCase();
    const files = data.media.filter(file => file.fileName.toLowerCase().includes(query));
    $('media-list').innerHTML = files.length ? files.map(file => `<article class="iv-media-card" draggable="true" data-media="${Number(file.id)}"><div class="iv-media-thumb"><video data-lazy-video="${escape(file.fileAddress)}#t=0.1" muted playsinline preload="none" aria-label="Thumbnail ${escape(file.fileName)}"></video><span>${escape(file.fileName.split('.').pop().toUpperCase())}</span></div><div class="iv-media-description"><strong title="${escape(file.fileName)}">${escape(file.fileName)}</strong><small>Drag ke kanvas atau scene</small></div><button type="button" class="iv-media-add" data-add-media="${Number(file.id)}" aria-label="Buat scene dari ${escape(file.fileName)}">+</button></article>`).join('') : `<div class="iv-media-empty">${videoIcon}<strong>${data.media.length ? 'Video tidak ditemukan' : 'Belum ada video'}</strong><p>${data.media.length ? 'Coba kata pencarian lain.' : 'Upload video di Media Library. Kamu tetap bisa menyusun scene terlebih dahulu.'}</p></div>`;
    $('media-list').querySelectorAll('[data-lazy-video]').forEach(video => thumbnailObserver.observe(video));
  }
  document.querySelectorAll('[data-iv-add]').forEach(button => button.addEventListener('click', () => addScene()));
  $('media-search').addEventListener('input', renderMedia);
  $('media-list').addEventListener('click', event => {
    const button = event.target.closest('[data-add-media]');
    if (button) addScene(Number(button.dataset.addMedia));
  });
  document.querySelectorAll('[data-iv-tab]').forEach(tab => {
    function activate() {
      document.querySelectorAll('[data-iv-tab]').forEach(button => {
        const active = button === tab;
        button.setAttribute('aria-selected', active);
        button.tabIndex = active ? 0 : -1;
        $(`${button.dataset.ivTab}-panel`).hidden = !active;
      });
    }
    tab.addEventListener('click', activate);
    tab.addEventListener('keydown', event => {
      if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        const other = event.key === 'Home' ? $('media-tab') : event.key === 'End' ? $('scenes-tab') : tab.dataset.ivTab === 'media' ? $('scenes-tab') : $('media-tab');
        other.click(); other.focus();
      }
    });
  });
  $('nodes').addEventListener('click', event => {
    if (drag?.moved || wireDrag) return;
    const port = event.target.closest('[data-output-port]');
    if (port) {
      activateConnection(port.dataset.outputPort, port.dataset.outputChoice === undefined ? null : scene(port.dataset.outputPort).choices[Number(port.dataset.outputChoice)]);
      return;
    }
    const connector = event.target.closest('[data-connect]');
    if (connector) {
      activateConnection(connector.dataset.connect);
      document.querySelector(`[data-node="${connector.dataset.connect}"]`)?.focus({preventScroll:true});
      return;
    }
    const node = event.target.closest('[data-node]');
    if (node) connecting ? connect(node.dataset.node) : select(node.dataset.node);
  });
  $('nodes').addEventListener('keydown', event => {
    if (event.target.closest('button')) return;
    const node = event.target.closest('[data-node]');
    if (!node) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      connecting ? connect(node.dataset.node) : select(node.dataset.node);
    }
    const delta = {ArrowLeft:[-10,0], ArrowRight:[10,0], ArrowUp:[0,-10], ArrowDown:[0,10]}[event.key];
    if (delta) {
      event.preventDefault();
      selected = node.dataset.node;
      const item = scene(selected);
      item.x = Math.min(MAX_POSITION, Math.max(0, item.x + delta[0] * (event.shiftKey ? 5 : 1)));
      item.y = Math.min(MAX_POSITION, Math.max(0, item.y + delta[1] * (event.shiftKey ? 5 : 1)));
      changed(); render();
      document.querySelector(`[data-node="${selected}"]`).focus({preventScroll:true});
    }
  });
  $('nodes').addEventListener('pointerdown', event => {
    if (event.button !== 0 || wireDrag || pan) return;
    const port = event.target.closest('[data-output-port]');
    if (port && !port.disabled) {
      event.preventDefault();
      const sourceId = port.dataset.outputPort, choice = port.dataset.outputChoice === undefined ? null : scene(sourceId).choices[Number(port.dataset.outputChoice)];
      wireDrag = {pointerId:event.pointerId, sourceId, choice, port, previousSource:connecting, previousChoice:connectingChoice,
        startX:event.clientX, startY:event.clientY, currentX:event.clientX, currentY:event.clientY, moved:false, targetId:null};
      connecting = sourceId; connectingChoice = choice;
      $('canvas').setPointerCapture(event.pointerId); $('canvas').classList.add('is-wiring');
      port.focus({preventScroll:true}); refreshConnectionTargets();
      return;
    }
    if (connecting || !event.target.closest('.iv-node-handle')) return;
    const node = event.target.closest('[data-node]'), item = scene(node.dataset.node);
    const point = worldPoint(event.clientX, event.clientY);
    drag = {id:item.id, startX:event.clientX, startY:event.clientY, offsetX:point.x - WORLD_PADDING - item.x, offsetY:point.y - WORLD_PADDING - item.y,
      currentX:event.clientX, currentY:event.clientY, moved:false, pointerId:event.pointerId};
    node.setPointerCapture(event.pointerId);
  });
  function moveDraggedScene() {
    if (!drag?.moved || drag.finished) return;
    const point = worldPoint(drag.currentX, drag.currentY), item = scene(drag.id);
    const x = Math.round(Math.min(MAX_POSITION, Math.max(0, point.x - WORLD_PADDING - drag.offsetX)));
    const y = Math.round(Math.min(MAX_POSITION, Math.max(0, point.y - WORLD_PADDING - drag.offsetY)));
    if (item.x === x && item.y === y) return;
    item.x = x; item.y = y;
    const node = document.querySelector(`[data-node="${drag.id}"]`);
    node.style.left = `${x}px`; node.style.top = `${y}px`; node.classList.add('is-dragging');
    resizeWorld(); renderEdges(drag.id);
  }
  $('nodes').addEventListener('pointermove', event => {
    if (!drag || drag.finished || drag.pointerId !== event.pointerId) return;
    drag.currentX = event.clientX; drag.currentY = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
    drag.moved = true;
    moveDraggedScene(); startEdgeScroll();
  });
  function finishDrag(event) {
    if (!drag || drag.finished || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved, id = drag.id;
    drag.finished = true; stopEdgeScroll();
    const node = document.querySelector(`[data-node="${id}"]`);
    if (node?.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    // Keep the completed drag through the following click, so moving never connects/selects by accident.
    if (moved) { changed(); select(id); }
    setTimeout(() => { drag = null; }, 0);
  }
  $('nodes').addEventListener('pointerup', finishDrag);
  $('nodes').addEventListener('pointercancel', finishDrag);
  $('nodes').addEventListener('lostpointercapture', finishDrag);
  $('canvas').addEventListener('pointermove', event => {
    if (!wireDrag || wireDrag.pointerId !== event.pointerId) return;
    wireDrag.currentX = event.clientX; wireDrag.currentY = event.clientY;
    if (!wireDrag.moved && Math.hypot(event.clientX - wireDrag.startX, event.clientY - wireDrag.startY) < 4) return;
    wireDrag.moved = true; drawWirePreview(); startEdgeScroll();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => $('canvas').addEventListener(type, finishWire));
  $('canvas').addEventListener('pointerdown', event => {
    suppressCanvasClick = false;
    if (wireDrag || drag || event.pointerType === 'touch' || ![0,1].includes(event.button)) return;
    if (event.button === 0 && (event.target.closest('button,a,input,select,textarea') || (!spaceHeld && event.target.closest('[data-node]')))) return;
    const canvas = $('canvas');
    const bounds = canvas.getBoundingClientRect();
    if (event.clientX >= bounds.left + canvas.clientWidth || event.clientY >= bounds.top + canvas.clientHeight) return;
    event.preventDefault(); event.stopPropagation();
    pan = {pointerId:event.pointerId, x:event.clientX, y:event.clientY, left:canvas.scrollLeft, top:canvas.scrollTop, moved:false};
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-panning');
    canvas.focus({preventScroll:true});
  }, true);
  $('canvas').addEventListener('pointermove', event => {
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.x, dy = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    pan.moved = true;
    growCanvas(dx < 0 ? (pan.left - dx + $('canvas').clientWidth) / zoom : 0, dy < 0 ? (pan.top - dy + $('canvas').clientHeight) / zoom : 0);
    $('canvas').scrollLeft = pan.left - dx;
    $('canvas').scrollTop = pan.top - dy;
  });
  function stopPan(event) {
    if (!pan || (event?.pointerId !== undefined && event.pointerId !== pan.pointerId)) return;
    const finished = pan;
    pan = null;
    suppressCanvasClick = finished.moved;
    if ($('canvas').hasPointerCapture(finished.pointerId)) $('canvas').releasePointerCapture(finished.pointerId);
    $('canvas').classList.remove('is-panning');
    setTimeout(() => { suppressCanvasClick = false; }, 0);
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => $('canvas').addEventListener(type, stopPan));
  $('canvas').addEventListener('click', event => {
    if (suppressCanvasClick) { suppressCanvasClick = false; event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  ['pointerup','pointercancel'].forEach(type => document.addEventListener(type, () => {
    if (suppressCanvasClick || wireDrag || pan) setTimeout(() => { suppressCanvasClick = false; }, 0);
  }, true));
  $('canvas').addEventListener('scroll', () => {
    const canvas = $('canvas');
    const right = canvas.scrollLeft > 0 && canvas.scrollLeft + canvas.clientWidth >= canvas.scrollWidth - 96;
    const bottom = canvas.scrollTop > 0 && canvas.scrollTop + canvas.clientHeight >= canvas.scrollHeight - 96;
    if (right || bottom) growCanvas(right ? (canvas.scrollLeft + canvas.clientWidth) / zoom : 0, bottom ? (canvas.scrollTop + canvas.clientHeight) / zoom : 0);
    if (wireDrag?.moved) drawWirePreview();
    if (drag?.moved) moveDraggedScene();
  });
  $('canvas').addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  document.addEventListener('keydown', event => {
    if (!event.target.closest?.('.iv-canvas-column') || event.target.closest('input,select,textarea,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') {
      if (!event.target.closest('#iv-canvas') || event.target.closest('button,a')) return;
      event.preventDefault(); event.stopPropagation();
      spaceHeld = true; $('canvas').classList.add('is-pan-ready');
    } else if (['+','=','-','0','f','F'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '0') frameScenes(graph.scenes);
      else if (event.key.toLowerCase() === 'f') { if (scene(selected)) frameScenes([scene(selected)]); }
      else setZoom(event.key === '-' ? zoom / 1.2 : zoom * 1.2);
    } else if (event.target === $('canvas')) {
      const delta = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[event.key];
      if (delta) {
        event.preventDefault();
        $('canvas').scrollLeft += delta[0] * (event.shiftKey ? 240 : 80);
        $('canvas').scrollTop += delta[1] * (event.shiftKey ? 240 : 80);
      }
    }
    if (event.key === 'Escape') stopPan();
  }, true);
  document.addEventListener('keyup', event => {
    if (event.code === 'Space') { spaceHeld = false; $('canvas').classList.remove('is-pan-ready'); }
  });
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('library-toggle').addEventListener('click', event => {
    const library = $('library'), closed = !library.hidden;
    library.hidden = closed;
    library.parentElement.classList.toggle('iv-library-closed', closed);
    event.currentTarget.setAttribute('aria-expanded', String(!closed));
    event.currentTarget.setAttribute('aria-label', `${closed ? 'Buka' : 'Tutup'} panel media dan scene`);
    event.currentTarget.title = event.currentTarget.getAttribute('aria-label');
  });
  $('inspector-toggle').addEventListener('click', () => setInspectorVisible($('inspector').hidden));
  $('inspector-close').addEventListener('click', () => { setInspectorVisible(false); $('inspector-toggle').focus(); });
  window.addEventListener('blur', () => {
    spaceHeld = false; $('canvas').classList.remove('is-pan-ready'); stopPan();
    clearConnection();
    if (drag && !drag.finished) finishDrag({pointerId:drag.pointerId});
    suppressCanvasClick = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && connecting) { clearConnection(); announce('Menghubungkan dibatalkan.'); }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    else if (event.key.toLowerCase() === 'z' && !event.target.closest?.('input[type="search"],[contenteditable="true"]')) {
      event.preventDefault(); event.shiftKey ? redo() : undo();
    }
  });
  $('scene-list').addEventListener('click', event => {
    const selectButton = event.target.closest('[data-select]'), moveButton = event.target.closest('[data-move]');
    if (selectButton) { clearConnection(); select(selectButton.dataset.select, true); }
    if (moveButton) {
      const id = moveButton.dataset.id, direction = Number(moveButton.dataset.move);
      reorder(id, graph.scenes.findIndex(item => item.id === id) + direction);
      document.querySelector(`[data-move="${direction}"][data-id="${id}"]`)?.focus();
    }
  });
  $('editor').addEventListener('dragstart', event => {
    const file = event.target.closest('[data-media]'), row = event.target.closest('[data-order]');
    if (file) { event.dataTransfer.setData('application/x-iv-media', file.dataset.media); event.dataTransfer.effectAllowed = 'copy'; }
    else if (row) { event.dataTransfer.setData('application/x-iv-scene', row.dataset.order); event.dataTransfer.effectAllowed = 'move'; }
    else event.preventDefault();
  });
  $('canvas').addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes('application/x-iv-media')) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    $('canvas').classList.add('is-dropzone');
  });
  $('canvas').addEventListener('dragleave', event => { if (!$('canvas').contains(event.relatedTarget)) $('canvas').classList.remove('is-dropzone'); });
  $('canvas').addEventListener('drop', event => {
    const mediaId = Number(event.dataTransfer.getData('application/x-iv-media'));
    $('canvas').classList.remove('is-dropzone');
    if (!media(mediaId)) return;
    event.preventDefault();
    const node = event.target.closest('[data-node]');
    clearConnection();
    if (node) { scene(node.dataset.node).mediaId = mediaId; changed(); select(node.dataset.node); announce('Video scene diganti.'); }
    else {
      const bounds = $('canvas').getBoundingClientRect();
      addScene(mediaId, {x:(event.clientX - bounds.left + $('canvas').scrollLeft) / zoom - WORLD_PADDING, y:(event.clientY - bounds.top + $('canvas').scrollTop) / zoom - WORLD_PADDING});
    }
  });
  $('scene-list').addEventListener('dragover', event => {
    if (event.dataTransfer.types.includes('application/x-iv-scene')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
  });
  $('scene-list').addEventListener('drop', event => {
    event.preventDefault();
    const id = event.dataTransfer.getData('application/x-iv-scene'), row = event.target.closest('[data-order]');
    if (row) reorder(id, graph.scenes.findIndex(item => item.id === row.dataset.order));
  });
  $('title').addEventListener('input', event => { graph.title = event.target.value; changed(true); });
  $('scene-title').addEventListener('input', event => {
    if (!scene(selected)) return;
    scene(selected).title = event.target.value;
    const node = document.querySelector(`[data-node="${selected}"]`), title = node.querySelector('.iv-node-info strong');
    title.textContent = event.target.value;
    title.title = event.target.value;
    node.setAttribute('aria-label', `Scene ${number(selected)}: ${event.target.value}${graph.startId === selected ? ', scene awal' : ''}`);
    node.querySelector('[data-input-port]').setAttribute('aria-label', `Input scene ${event.target.value}`);
    node.querySelector('[data-connect]').setAttribute('aria-label', `Hubungkan ${event.target.value} ke scene lain`);
    changed(true); renderSceneList(); updateEdgeTitles(`[data-edge-source="${selected}"], [data-edge-target="${selected}"]`);
  });
  $('set-start').addEventListener('click', () => { graph.startId = selected; changed(); render(); announce('Scene awal cerita diperbarui. Reorder tidak mengubah scene awal.'); });
  $('add-choice').addEventListener('click', () => {
    const item = scene(selected), target = graph.scenes.find(other => other.id !== selected);
    if (!item || !target || item.choices.length >= 8) return;
    item.choices.push({label:`Pilihan ${item.choices.length + 1}`, target:target.id, timeSec:null});
    changed(); renderNodes(); renderChoices();
    $('choices').querySelector('.iv-choice-editor:last-child input')?.focus();
  });
  $('choices').addEventListener('input', event => {
    const labelInput = event.target.closest('[data-choice-label]');
    const timeInput = event.target.closest('[data-choice-time]');
    if (labelInput) {
      const index = Number(labelInput.dataset.choiceLabel);
      scene(selected).choices[index].label = labelInput.value;
      const node = document.querySelector(`[data-node="${selected}"]`);
      node.querySelectorAll('.iv-node-choice > span:first-child')[index].textContent = labelInput.value;
      node.querySelector(`[data-choice-port="${index}"]`).setAttribute('aria-label', `Sambungkan ulang pilihan ${labelInput.value} pada scene ${number(selected)}`);
      changed(true); updateEdgeTitles(`[data-edge-source="${selected}"][data-edge-choice="${index}"]`);
    } else if (timeInput) {
      const index = Number(timeInput.dataset.choiceTime);
      const val = timeInput.value.trim(), num = val === '' ? null : parseTimecode(val);
      const valid = val === '' || (num !== null && sceneDuration !== null && num <= sceneDuration);
      timeInput.setCustomValidity(valid ? '' : sceneDuration === null ? 'Durasi video belum tersedia.' : num === null ? 'Gunakan format menit:detik, misalnya 01:25.' : `Maksimal ${formatTimecode(sceneDuration)} sesuai durasi video.`);
      if (valid) { scene(selected).choices[index].timeSec = num; changed(true); }
    }
  });
  $('choices').addEventListener('change', event => {
    const timeInput = event.target.closest('[data-choice-time]');
    if (timeInput && !timeInput.checkValidity()) {
      timeInput.reportValidity();
      timeInput.value = formatTimecode(scene(selected).choices[Number(timeInput.dataset.choiceTime)].timeSec);
      timeInput.setCustomValidity('');
      return;
    }
  });
  $('choices').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-choice]');
    if (!button) return;
    scene(selected).choices.splice(Number(button.dataset.removeChoice), 1); changed(); renderNodes(); renderChoices();
  });
  $('delete-scene').addEventListener('click', () => {
    $('delete-description').textContent = `Scene ${number(selected)} · ${scene(selected).title}`;
    $('delete-dialog').showModal();
  });
  $('confirm-delete').addEventListener('click', () => {
    clearConnection();
    graph.scenes = graph.scenes.filter(item => item.id !== selected);
    graph.scenes.forEach(item => { item.choices = item.choices.filter(choice => choice.target !== selected); });
    if (graph.startId === selected) graph.startId = graph.scenes[0]?.id ?? null;
    selected = graph.scenes[0]?.id ?? null;
    $('delete-dialog').close(); changed(); render(); announce('Scene dan cabang terkait dihapus dari draft. Video asli tetap aman.');
  });
  $('arrange').addEventListener('click', () => {
    let y = 70;
    for (let index = 0; index < graph.scenes.length; index += 4) {
      const row = graph.scenes.slice(index, index + 4);
      const height = Math.max(...row.map(item => document.querySelector(`[data-node="${item.id}"]`).offsetHeight));
      row.forEach((item, column) => { item.x = 70 + column * 340; item.y = y; });
      y += height + 70;
    }
    changed(); renderNodes(); renderInspector(); frameScenes(graph.scenes); announce('Scene dirapikan mengikuti urutan daftar.');
  });
  function setZoom(value, anchorX = $('canvas').clientWidth / 2, anchorY = $('canvas').clientHeight / 2) {
    const previous = zoom;
    const x = ($('canvas').scrollLeft + anchorX) / previous;
    const y = ($('canvas').scrollTop + anchorY) / previous;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    resizeWorld();
    $('canvas').scrollLeft = x * zoom - anchorX;
    $('canvas').scrollTop = y * zoom - anchorY;
    $('zoom-reset').textContent = `${(zoom * 100).toFixed(zoom < .01 ? 1 : 0)}%`;
    $('zoom-out').disabled = zoom <= MIN_ZOOM;
    $('zoom-in').disabled = zoom >= MAX_ZOOM;
    if (wireDrag?.moved) drawWirePreview();
    if (drag?.moved) moveDraggedScene();
  }
  function frameScenes(items) {
    if (!items.length) return;
    const left = Math.min(...items.map(item => item.x + WORLD_PADDING - 22)), top = Math.min(...items.map(item => item.y + WORLD_PADDING));
    const right = Math.max(...items.map(item => item.x + WORLD_PADDING + document.querySelector(`[data-node="${item.id}"]`).offsetWidth + 22));
    const bottom = Math.max(...items.map(item => item.y + WORLD_PADDING + document.querySelector(`[data-node="${item.id}"]`).offsetHeight));
    setZoom(Math.min(1, ($('canvas').clientWidth - 48) / (right - left), ($('canvas').clientHeight - 48) / (bottom - top)));
    $('canvas').scrollLeft = (left + right) / 2 * zoom - $('canvas').clientWidth / 2;
    $('canvas').scrollTop = (top + bottom) / 2 * zoom - $('canvas').clientHeight / 2;
  }
  $('fit').addEventListener('click', () => frameScenes(graph.scenes));
  $('focus').addEventListener('click', () => { if (scene(selected)) frameScenes([scene(selected)]); });
  $('zoom-in').addEventListener('click', () => setZoom(zoom * 1.2));
  $('zoom-out').addEventListener('click', () => setZoom(zoom / 1.2));
  $('zoom-reset').addEventListener('click', () => setZoom(1));
  $('canvas').addEventListener('wheel', event => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.deltaY === 0) return;
    event.preventDefault();
    const bounds = $('canvas').getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? $('canvas').clientHeight : 1);
    setZoom(zoom * Math.exp(-delta * .002), event.clientX - bounds.left, event.clientY - bounds.top);
  }, {passive:false});
  async function save() {
    if (saving) return;
    const sent = snapshot();
    saving = true; $('save').disabled = true; dirty(); announce('Draft sedang disimpan…');
    try {
      const response = await fetch('dashboard/interactive-api.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({graph:JSON.parse(sent), revision:data.revision, token:data.token, scenarioId:data.scenarioId})});
      const result = await response.json().catch(() => { throw new Error('Respons server tidak valid. Draft tetap ada di halaman ini; coba simpan kembali.'); });
      if (!response.ok) throw new Error(result.error || 'Draft gagal disimpan. Coba kembali.');
      data.revision = result.revision; baseline = sent;
      announce(snapshot() === baseline ? 'Draft berhasil disimpan ke database.' : 'Draft tersimpan. Ada perubahan baru yang belum disimpan.');
    } catch (error) { announce(error instanceof TypeError ? 'Koneksi gagal. Draft tetap ada di halaman ini; coba simpan kembali.' : error.message, true); }
    finally { saving = false; $('save').disabled = false; dirty(); }
  }
  $('save').addEventListener('click', save);
  $('reload').addEventListener('click', () => location.reload());
  $('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(graph, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'interactive-video-draft.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Salinan draft diunduh. File ini merupakan backup data; belum tersedia fitur import.');
  });
  window.addEventListener('beforeunload', event => { if (snapshot() !== baseline) { event.preventDefault(); event.returnValue = ''; } });
  function playScene(id) {
    previewScene = previewGraph.scenes.find(item => item.id === id);
    if (!previewScene) return;
    const file = media(previewScene.mediaId);
    $('player-choices').replaceChildren();
    $('player-message').textContent = file ? 'Pilihan bertimer muncul sesuai waktu yang diatur; pilihan lainnya muncul setelah video selesai.' : 'Scene belum memiliki video yang tersedia. Kamu bisa mencoba pilihan alurnya di bawah.';
    $('player-scene').textContent = previewScene.title;
    $('player').pause(); $('player').hidden = !file;
    if (file) { $('player').src = file.fileAddress; $('player').load(); }
    else { $('player').removeAttribute('src'); $('player').load(); showPlayerChoices(previewScene.choices.map((choice, index) => ({choice, index}))); }
  }
  function showPlayerChoices(choices = previewScene.choices) {
    $('player-choices').innerHTML = choices.map(({choice, index}) => `<button type="button" class="iv-button" data-preview-choice="${index}">${escape(choice.label)} <span aria-hidden="true">→</span></button>`).join('');
    if (!choices.length && !previewScene.choices.length) $('player-message').textContent = 'Akhir cerita. Gunakan “Ulang dari awal” untuk mencoba alur lain.';
    else if (choices.length) $('player-message').textContent = 'Apa yang terjadi selanjutnya? Pilih jalan ceritamu.';
  }
  $('preview').addEventListener('click', () => {
    if (!graph.scenes.length) return announce('Tambahkan setidaknya satu scene untuk mencoba preview.', true);
    previewGraph = JSON.parse(snapshot());
    $('preview-title').textContent = previewGraph.title;
    $('preview-dialog').showModal(); playScene(previewGraph.startId);
  });
  const player = $('player');
  player.addEventListener('ended', () => showPlayerChoices(previewScene.choices.map((choice, index) => ({choice, index}))));
  player.addEventListener('timeupdate', () => {
    if (!previewScene || player.paused) return;
    const due = previewScene.choices.map((choice, index) => ({choice, index})).filter(({choice}) => choice.timeSec !== null && choice.timeSec !== undefined && Number(choice.timeSec) <= player.currentTime);
    const shown = new Set([...$('player-choices').querySelectorAll('[data-preview-choice]')].map(button => Number(button.dataset.previewChoice)));
    if (due.some(({index}) => !shown.has(index))) showPlayerChoices(due);
  });
  player.addEventListener('play', () => { delete player.dataset.triggeredChoice; });
  player.addEventListener('error', () => {
    if (!$('preview-dialog').open || !previewScene || !player.getAttribute('src')) return;
    showPlayerChoices(previewScene.choices.map((choice, index) => ({choice, index}))); $('player-message').textContent = 'Video tidak dapat diputar. Periksa file/codec (MOV tidak didukung semua browser). Pilihan alur tetap bisa dicoba.';
  });
  $('player-choices').addEventListener('click', event => { const button = event.target.closest('[data-preview-choice]'); if (button) playScene(previewScene.choices[Number(button.dataset.previewChoice)].target); });
  $('restart').addEventListener('click', () => playScene(previewGraph.startId));
  $('preview-dialog').addEventListener('close', () => { $('player').pause(); $('player').removeAttribute('src'); $('player').load(); previewScene = null; });
  renderMedia(); render();
  new ResizeObserver(() => { resizeWorld(); renderEdges(); }).observe($('canvas'));
})();
