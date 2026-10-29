document.getElementById('run').addEventListener('click', async () => {
  const run = document.getElementById('run'), result = document.getElementById('result');
  let frame, checks = 0, revision = 0;
  run.disabled = true;
  result.textContent = 'Running…';
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    checks++;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  let stored = {title:'Regression test', startId:'a', scenes:['a','b','c'].map((id, index) => ({
    id, title:id.toUpperCase(), mediaId:null, x:80 + index * 320, y:80, choices:[],
  }))};
  try {
    const url = new URL('../admin.php?page=interactive&scenario=1', location.href);
    const template = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
    if (!template.getElementById('iv-data')) throw new Error('Login ke dashboard terlebih dahulu.');
    async function mount(graph, media = []) {
      frame?.remove();
      const doc = template.cloneNode(true), base = doc.createElement('base');
      base.href = url.href;
      doc.head.prepend(base);
      doc.getElementById('iv-data').textContent = JSON.stringify({graph:clone(graph), media, token:'test-token', revision});
      frame = document.createElement('iframe');
      frame.title = 'Editor test sandbox';
      frame.style = 'position:absolute;left:-4000px;top:0;width:1440px;height:900px';
      const ready = new Promise(resolve => { frame.onload = resolve; });
      frame.srcdoc = doc.documentElement.outerHTML;
      document.body.append(frame);
      await ready;
      frame.contentWindow.fetch = async (address, options) => {
        check(new URL(address, url).pathname.endsWith('/dashboard/interactive-api.php') && options.method === 'POST', 'Only the expected save request is allowed.');
        const input = JSON.parse(options.body);
        check(input.token === 'test-token' && input.revision === revision, 'Save must send the current token and revision.');
        stored = clone(input.graph);
        return new Response(JSON.stringify({revision:++revision}), {status:200});
      };
      return frame.contentDocument;
    }
    let doc = await mount(stored);
    let win = frame.contentWindow;
    const get = id => doc.getElementById(`iv-${id}`);
    const node = id => doc.querySelector(`[data-node="${id}"]`);
    const input = (element, value) => { element.value = value; element.dispatchEvent(new win.Event('input', {bubbles:true})); };
    const scale = () => Number(get('world').style.transform.match(/scale\(([^)]+)\)/)[1]);
    const allVisible = () => {
      const canvas = get('canvas'), bounds = canvas.getBoundingClientRect();
      return [...doc.querySelectorAll('[data-node]')].every(item => {
        const box = item.getBoundingClientRect();
        return box.left >= bounds.left - 1 && box.top >= bounds.top - 1 && box.right <= bounds.left + canvas.clientWidth + 1 && box.bottom <= bounds.top + canvas.clientHeight + 1;
      });
    };

    const canvas = get('canvas');
    check(get('focus').disabled, 'Focus scene must be disabled until a scene is selected.');
    check(get('inspector').hidden && get('inspector-toggle').disabled && get('inspector-toggle').getAttribute('aria-expanded') === 'false', 'Inspector must start closed until a scene is selected.');
    check(get('undo').disabled && get('redo').disabled, 'Undo and redo controls should start disabled.');
    input(get('title'), 'Edited title');
    get('undo').click();
    check(get('title').value === 'Regression test' && !get('redo').disabled, 'Undo should restore the visible project title and enable redo.');
    get('redo').click();
    check(get('title').value === 'Edited title', 'Redo button should restore the edited project title.');
    get('undo').click();
    check(get('title').value === 'Regression test', 'Undo button should restore the project title.');
    get('fit').click();
    check(allVisible(), 'See all must fit all scenes into the canvas.');
    get('zoom-reset').click();
    canvas.scrollLeft = 100; canvas.scrollTop = 100; canvas.focus();
    const panStart = canvas.scrollLeft;
    canvas.dispatchEvent(new win.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true, cancelable:true}));
    check(canvas.scrollLeft === panStart + 80, 'Arrow keys on the canvas must pan the viewport, not scenes.');

    const rect = canvas.getBoundingClientRect(), anchor = {x:150, y:120};
    const worldPoint = {x:(canvas.scrollLeft + anchor.x) / scale(), y:(canvas.scrollTop + anchor.y) / scale()};
    const wheel = new win.WheelEvent('wheel', {deltaY:-100, altKey:true, clientX:rect.left + anchor.x, clientY:rect.top + anchor.y, bubbles:true, cancelable:true});
    canvas.dispatchEvent(wheel);
    check(wheel.defaultPrevented && scale() > 1, 'Alt+wheel must zoom the canvas.');
    check(Math.abs((canvas.scrollLeft + anchor.x) / scale() - worldPoint.x) < 2 && Math.abs((canvas.scrollTop + anchor.y) / scale() - worldPoint.y) < 2, 'Zoom must keep the world point under the cursor fixed.');
    const plainWheel = new win.WheelEvent('wheel', {deltaY:100, bubbles:true, cancelable:true});
    canvas.dispatchEvent(plainWheel);
    check(!plainWheel.defaultPrevented, 'Ordinary wheel scrolling must stay native.');
    const browserZoom = new win.WheelEvent('wheel', {deltaY:100, ctrlKey:true, bubbles:true, cancelable:true});
    canvas.dispatchEvent(browserZoom);
    check(!browserZoom.defaultPrevented, 'Browser Ctrl+wheel zoom must not be intercepted.');

    get('zoom-reset').click(); canvas.scrollLeft = 100; canvas.scrollTop = 100;
    const capture = canvas.setPointerCapture;
    // Synthetic pointer events have no native active pointer; the real drag is also checked in-browser.
    canvas.setPointerCapture = () => {};
    const pointer = (target, type, x, y, button = 0) => target.dispatchEvent(new win.PointerEvent(type, {pointerId:44, pointerType:'mouse', button, clientX:rect.left + x, clientY:rect.top + y, bubbles:true, cancelable:true}));
    try {
      pointer(canvas, 'pointerdown', 160, 160);
      pointer(canvas, 'pointermove', 100, 120);
      pointer(canvas, 'pointerup', 100, 120);
      check(Math.abs(canvas.scrollLeft - 160) < 1.5 && Math.abs(canvas.scrollTop - 140) < 1.5, 'Dragging empty canvas must pan both axes.');
      await new Promise(resolve => setTimeout(resolve, 0));
      canvas.dispatchEvent(new win.KeyboardEvent('keydown', {key:' ', code:'Space', bubbles:true, cancelable:true}));
      const left = node('a').style.left, top = node('a').style.top;
      pointer(node('a').querySelector('.iv-node-handle'), 'pointerdown', 160, 160);
      pointer(canvas, 'pointermove', 140, 140);
      pointer(canvas, 'pointercancel', 140, 140);
      doc.dispatchEvent(new win.KeyboardEvent('keyup', {key:' ', code:'Space', bubbles:true}));
      check(node('a').style.left === left && node('a').style.top === top, 'Space+drag must not move the scene.');
      check(!canvas.classList.contains('is-panning') && !canvas.classList.contains('is-pan-ready'), 'Pointer cancel and Space release must clear pan mode.');
      await new Promise(resolve => setTimeout(resolve, 0));
      pointer(node('a'), 'pointerdown', 160, 160, 1);
      check(canvas.classList.contains('is-panning'), 'Middle mouse must pan even over a scene.');
      pointer(canvas, 'pointerup', 160, 160, 1);
    } finally { canvas.setPointerCapture = capture; }
    check(get('save-state').textContent === 'Draft tersimpan', 'Viewport navigation must not dirty the draft.');
    const initialCanvasWidth = canvas.clientWidth;
    get('library-toggle').click();
    check(get('library').hidden && get('library-toggle').getAttribute('aria-expanded') === 'false' && canvas.clientWidth > initialCanvasWidth, 'Closing the library should expand the canvas.');
    check(get('save-state').textContent === 'Draft tersimpan', 'Toggling the library must not change the draft.');
    get('library-toggle').click();
    check(!get('library').hidden && get('library-toggle').getAttribute('aria-expanded') === 'true' && canvas.clientWidth === initialCanvasWidth, 'Opening the library should restore its layout.');
    get('zoom-reset').click();

    node('a').focus(); node('a').click();
    check(!get('inspector').hidden && get('inspector-toggle').getAttribute('aria-expanded') === 'true', 'Selecting a scene should reopen the inspector.');
    get('inspector-close').click();
    check(get('inspector').hidden && !get('inspector-toggle').disabled, 'Close control should hide the inspector without deselecting the scene.');
    get('inspector-toggle').click();
    check(!get('inspector').hidden && get('inspector-toggle').getAttribute('aria-expanded') === 'true', 'Toolbar toggle should reopen the selected scene inspector.');
    node('a').focus();
    check(doc.activeElement === node('a'), 'Clicking a scene must retain keyboard focus.');
    doc.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
    check(node('a').style.left === '90px', 'ArrowRight must move the clicked scene.');
    const movable = node('a'), nodeCapture = movable.setPointerCapture, nodeRelease = movable.releasePointerCapture;
    movable.setPointerCapture = () => {};
    movable.releasePointerCapture = () => {};
    try {
      pointer(movable.querySelector('.iv-node-handle'), 'pointerdown', 160, 160);
      pointer(movable, 'pointermove', 190, 180);
      pointer(movable, 'pointerup', 190, 180);
      check(node('a').style.left === '120px' && node('a').style.top === '100px', 'Dragging a header without Space must still move its scene.');
    } finally { movable.setPointerCapture = nodeCapture; movable.releasePointerCapture = nodeRelease; }
    await new Promise(resolve => setTimeout(resolve, 0));
    doc.querySelector('[data-connect="a"]').click(); node('c').click();
    check(doc.querySelectorAll('.iv-edge').length === 1, 'Connecting A to C must create one edge.');

    const originalNode = node('a'), originalEdge = doc.querySelector('.iv-edge');
    input(get('scene-title'), '<b>Start</b>');
    input(doc.querySelector('[data-choice-label="0"]'), 'To ending');
    check(node('a') === originalNode, 'Typing must not replace scene or thumbnail elements.');
    check(doc.querySelector('.iv-edge') === originalEdge, 'Typing must not rebuild edge paths.');
    check(originalNode.querySelector('.iv-node-info strong').children.length === 0, 'Scene titles must remain text, not HTML.');
    check(originalEdge.querySelector('title').textContent === '<b>Start</b> → To ending → C', 'Edge descriptions must update.');
    node('c').click();
    input(get('scene-title'), 'Ending C');
    check(doc.querySelector('.iv-edge title').textContent.endsWith('Ending C'), 'Renaming a target must update incoming edge descriptions.');

    get('scenes-tab').click();
    doc.querySelector('[data-id="c"][data-move="-1"]').click();
    check([...doc.querySelectorAll('[data-order]')].map(row => row.dataset.order).join(',') === 'a,c,b', 'The real reorder control must move C before B.');
    get('save').click();
    for (let i = 0; get('save').disabled && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    check(get('save-state').textContent === 'Draft tersimpan', 'Save must complete.');
    check(stored.startId === 'a' && stored.scenes[0].choices[0].target === 'c', 'Saving after reorder must retain start and branch IDs.');

    doc = await mount(stored); win = frame.contentWindow;
    check([...doc.querySelectorAll('[data-node]')].map(item => item.dataset.node).join(',') === 'a,c,b', 'Reload must retain scene order.');
    get('preview').click();
    doc.querySelector('[data-preview-choice="0"]').click();
    check(get('player-scene').textContent === 'Ending C', 'Preview after reload must follow A to C, not B.');
    get('preview-dialog').close();
    node('c').click(); get('delete-scene').click(); get('confirm-delete').click();
    check(doc.querySelectorAll('.iv-edge').length === 0, 'Deleting C must remove the incoming branch.');

    const sockets = {title:'Socket test', startId:'a', scenes:['a','b','c','d'].map((id, index) => ({
      id, title:id.toUpperCase(), mediaId:id === 'a' ? 77 : null, x:index % 2 ? 460 : 80, y:index < 2 ? 80 : 330,
      choices:id === 'a' ? [{label:'Keep this label', target:'b', timeSec:null}] : [],
    }))};
    const timerMedia = [{id:77, fileName:'timer.webm', fileAddress:'data:video/webm;base64,'}];
    doc = await mount(sockets, timerMedia); win = frame.contentWindow;
    const lazyLibraryVideo = doc.querySelector('.iv-media-thumb video'), lazyNodeVideo = node('a').querySelector('.iv-node-thumbnail video');
    check(!lazyLibraryVideo.hasAttribute('src') && lazyLibraryVideo.dataset.lazyVideo, 'Offscreen library thumbnails must defer media requests.');
    check(!lazyNodeVideo.hasAttribute('src') && lazyNodeVideo.dataset.lazyVideo, 'Offscreen scene thumbnails must defer media requests.');
    node('a').click();
    const mediaDropdown = get('scene-media').querySelector('[data-custom-select]');
    mediaDropdown.querySelector('[data-select-trigger]').click();
    input(mediaDropdown.querySelector('[data-option-search]'), 'timer');
    check(!mediaDropdown.querySelector('[data-option-value="77"]').hidden && mediaDropdown.querySelector('[data-option-value=""]').hidden, 'Video search should filter the custom dropdown.');
    input(mediaDropdown.querySelector('[data-option-search]'), '');
    mediaDropdown.querySelector('[data-option-value=""]').click();
    check(get('scene-media').querySelector('[data-custom-select]').dataset.value === '', 'Choosing no video must update the scene.');
    const replacementMediaDropdown = get('scene-media').querySelector('[data-custom-select]');
    replacementMediaDropdown.querySelector('[data-select-trigger]').click();
    replacementMediaDropdown.querySelector('[data-option-value="77"]').click();
    check(get('scene-media').querySelector('[data-custom-select]').dataset.value === '77', 'Choosing a video must retain the scene media selection behavior.');
    const targetDropdown = doc.querySelector('[data-custom-select][data-kind="target"]');
    targetDropdown.querySelector('[data-select-trigger]').click();
    const targetSearch = targetDropdown.querySelector('[data-option-search]');
    input(targetSearch, 'd');
    check(targetDropdown.querySelector('[data-option-value="c"]').hidden && !targetDropdown.querySelector('[data-option-value="d"]').hidden, 'Scene search should filter branch destinations.');
    targetSearch.dispatchEvent(new win.KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
    check(doc.activeElement === targetDropdown.querySelector('[data-option-value="d"]'), 'Arrow keys should navigate custom dropdown options.');
    targetDropdown.querySelector('[data-option-value="d"]').click();
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Choosing a custom destination must update the graph.');
    targetDropdown.querySelector('[data-select-trigger]').click();
    input(targetDropdown.querySelector('[data-option-search]'), '');
    targetDropdown.querySelector('[data-option-value="b"]').click();
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'b', 'Changing the custom destination must retain the existing graph behavior.');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', {key:'z', ctrlKey:true, bubbles:true, cancelable:true}));
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Ctrl+Z should undo the last graph change.');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', {key:'z', ctrlKey:true, shiftKey:true, bubbles:true, cancelable:true}));
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'b', 'Ctrl+Shift+Z should redo an undone graph change.');
    get('undo').click();
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd' && !get('redo').disabled, 'Undo button should update graph and enable redo.');
    get('redo').click();
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'b', 'Redo button should restore the graph change.');
    const timerInput = doc.querySelector('[data-choice-time="0"]'), inspectorVideo = get('inspector-video').querySelector('video');
    check(timerInput.disabled, 'Choice timer should wait for video duration metadata.');
    Object.defineProperty(inspectorVideo, 'duration', {configurable:true, value:30});
    inspectorVideo.dispatchEvent(new win.Event('loadedmetadata'));
    input(doc.querySelector('[data-choice-time="0"]'), '00:31');
    check(!doc.querySelector('[data-choice-time="0"]').checkValidity(), 'Choice timer must reject values beyond the video duration.');
    input(doc.querySelector('[data-choice-time="0"]'), '00:13');
    check(doc.querySelector('[data-choice-time="0"]').value === '00:13', 'Choice timer should use minute:second timecode.');
    get('save').click();
    for (let i = 0; get('save').disabled && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    check(stored.scenes[0].choices[0].timeSec === 13, 'Choice timecode must be saved as seconds for backward compatibility.');
    doc = await mount(stored, timerMedia); win = frame.contentWindow;
    get('preview').click();
    const player = get('player');
    player.dispatchEvent(new win.Event('play'));
    Object.defineProperty(player, 'paused', {configurable:true, value:false});
    Object.defineProperty(player, 'currentTime', {configurable:true, value:12.9});
    player.dispatchEvent(new win.Event('timeupdate'));
    check(!doc.querySelector('[data-preview-choice="0"]'), 'Timed choice must stay hidden before its configured second.');
    Object.defineProperty(player, 'currentTime', {configurable:true, value:13});
    player.dispatchEvent(new win.Event('timeupdate'));
    check(Boolean(doc.querySelector('[data-preview-choice="0"]')), 'Timed choice must appear when playback reaches its configured second.');
    check(!player.paused, 'Showing a timed choice must not pause video playback.');
    get('preview-dialog').close();
    doc = await mount(sockets, timerMedia); win = frame.contentWindow;
    const output = (id, index) => node(id).querySelector(index === undefined ? '.iv-output-port' : `[data-choice-port="${index}"]`);
    const incoming = id => doc.querySelector(`[data-input-port="${id}"]`);
    const center = element => { const box = element.getBoundingClientRect(); return {x:box.left + box.width / 2, y:box.top + box.height / 2}; };
    const socketPosition = port => {
      const point = center(port), world = get('world').getBoundingClientRect();
      return {x:(point.x - world.left) / scale(), y:(point.y - world.top) / scale()};
    };
    const sendWire = (target, type, point) => target.dispatchEvent(new win.PointerEvent(type, {pointerId:77, pointerType:'mouse', button:0, buttons:type === 'pointerup' ? 0 : 1, clientX:point.x, clientY:point.y, bubbles:true, cancelable:true}));
    async function dragSocket(port, target, inspect, ending = 'pointerup') {
      const canvas = get('canvas'), capture = canvas.setPointerCapture;
      const from = center(port), to = target.getBoundingClientRect ? center(target) : target;
      canvas.setPointerCapture = () => {};
      try {
        sendWire(port, 'pointerdown', from);
        sendWire(canvas, 'pointermove', to);
        inspect?.();
        const finishPoint = target.getBoundingClientRect ? center(target) : to;
        sendWire(canvas, ending, finishPoint);
        if (ending === 'pointerup' && port.isConnected) port.click();
      } finally { canvas.setPointerCapture = capture; }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await dragSocket(output('a', 0), incoming('d'), () => {
      check(!get('wire-preview').hasAttribute('hidden') && get('wire-preview').classList.contains('is-valid'), 'Dragging an output must show a valid wire preview.');
      check(node('d').classList.contains('is-snap-target'), 'A valid input must be highlighted for snapping.');
      check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'b', 'Rewiring must not discard the old connection before drop.');
      check(get('save-state').textContent === 'Draft tersimpan', 'A pending wire must not change the draft.');
      let expected = socketPosition(incoming('d')), end = get('wire-path').getPointAtLength(get('wire-path').getTotalLength());
      check(Math.hypot(end.x - expected.x, end.y - expected.y) < 1, 'Preview must dock at the input socket center.');
      get('zoom-out').click();
      sendWire(get('canvas'), 'pointermove', center(incoming('d')));
      expected = socketPosition(incoming('d')); end = get('wire-path').getPointAtLength(get('wire-path').getTotalLength());
      check(Math.hypot(end.x - expected.x, end.y - expected.y) < 1, 'Socket docking must stay correct when zoom changes during a wire drag.');
    });
    check(doc.querySelectorAll('.iv-edge').length === 1 && doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Dropping on an input must rewire the existing choice, not add another.');
    check(doc.querySelector('[data-choice-label="0"]').value === 'Keep this label', 'Rewiring must preserve the choice label.');
    check(get('wire-preview').hasAttribute('hidden'), 'The preview must disappear after a completed drop.');
    get('save').click();
    for (let i = 0; get('save').disabled && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    doc = await mount(stored); win = frame.contentWindow;
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Rewired target must survive save/reload.');

    await dragSocket(output('a', 0), incoming('a'), () => check(get('wire-preview').classList.contains('is-invalid'), 'Self-connections must show an invalid preview.'));
    await dragSocket(output('a'), incoming('d'), () => check(get('wire-preview').classList.contains('is-invalid'), 'Duplicate targets must show an invalid preview.'));
    check(doc.querySelectorAll('.iv-edge').length === 1 && doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Invalid drops must leave the original branch intact.');
    check(get('save-state').textContent === 'Draft tersimpan', 'Invalid drops must not dirty the draft.');
    await dragSocket(output('a', 0), incoming('b'), () => {
      doc.dispatchEvent(new win.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      check(get('wire-preview').hasAttribute('hidden'), 'Escape must cancel the dragged wire immediately.');
    });
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd' && !doc.querySelector('[data-output-port][aria-pressed="true"]'), 'Mouse release after Escape must not reconnect or restart the socket.');
    await dragSocket(output('a', 0), incoming('b'), null, 'pointercancel');
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'd', 'Pointer cancellation must preserve the old target.');
    output('a', 0).click(); incoming('b').click();
    check(doc.querySelector('.iv-edge').dataset.edgeTarget === 'b', 'Socket click/keyboard fallback must support rewiring.');
    await dragSocket(output('a'), incoming('d'));
    check(doc.querySelectorAll('.iv-edge').length === 2, 'The free output must create a new branch.');
    const connected = node('a'), connectedCapture = connected.setPointerCapture;
    connected.setPointerCapture = () => {};
    try {
      const from = center(connected.querySelector('.iv-node-handle'));
      sendWire(connected.querySelector('.iv-node-handle'), 'pointerdown', from);
      sendWire(connected, 'pointermove', {x:from.x + 30, y:from.y + 15});
      const edge = doc.querySelector('[data-edge-source="a"][data-edge-choice="0"]');
      const start = edge.getPointAtLength(0), expected = socketPosition(output('a', 0));
      check(Math.hypot(start.x - expected.x, start.y - expected.y) < 1, 'Moving a connected node must keep wires attached to its output socket.');
      sendWire(connected, 'pointerup', {x:from.x + 30, y:from.y + 15});
    } finally { connected.setPointerCapture = connectedCapture; }
    await new Promise(resolve => setTimeout(resolve, 0));

    const capped = clone(sockets);
    capped.scenes[0].choices = Array.from({length:8}, (_, index) => ({label:`Choice ${index}`, target:'b'}));
    doc = await mount(capped); win = frame.contentWindow;
    check(output('a').disabled, 'The free output must be disabled at eight branches.');
    await dragSocket(output('a', 3), incoming('b'), () => check(get('wire-preview').classList.contains('is-valid'), 'An existing choice may return to its unchanged target even when other labels share that target.'));
    check(get('save-state').textContent === 'Draft tersimpan', 'Returning a wire to its original socket must not change the draft.');
    await dragSocket(output('a', 3), incoming('d'));
    check(doc.querySelectorAll('.iv-edge').length === 8 && doc.querySelector('[data-edge-source="a"][data-edge-choice="3"]').dataset.edgeTarget === 'd', 'Existing sockets must still rewire when the branch limit is reached.');

    doc = await mount({title:'Growing canvas', startId:'a', scenes:[{...clone(sockets.scenes[0]), choices:[]}]}); win = frame.contentWindow;
    const growing = get('canvas'), originalWidth = parseFloat(get('world').style.width), originalHeight = parseFloat(get('world').style.height);
    const bounds = growing.getBoundingClientRect();
    await dragSocket(output('a'), {x:bounds.left + growing.clientWidth / 2, y:bounds.top + growing.clientHeight / 2}, () => {
      growing.scrollLeft = growing.scrollWidth - growing.clientWidth - 2;
      growing.scrollTop = growing.scrollHeight - growing.clientHeight - 2;
      const left = growing.scrollLeft, top = growing.scrollTop;
      sendWire(growing, 'pointermove', {x:bounds.left + growing.clientWidth - 2, y:bounds.top + growing.clientHeight - 2});
      check(parseFloat(get('world').style.width) > originalWidth && parseFloat(get('world').style.height) > originalHeight, 'The canvas must expand on both axes near its edges.');
      check(growing.scrollLeft > left && growing.scrollTop > top, 'Dragging a wire at an edge must auto-pan the viewport.');
    }, 'pointercancel');
    check(get('save-state').textContent === 'Draft tersimpan', 'Auto-expansion and cancelled connections must not change story data.');
    get('focus').click();
    const moving = node('a'), movingCapture = moving.setPointerCapture;
    moving.setPointerCapture = () => {};
    try {
      const from = center(moving.querySelector('.iv-node-handle')), bounds = growing.getBoundingClientRect();
      const to = {x:bounds.left + growing.clientWidth - 3, y:bounds.top + growing.clientHeight - 3};
      const noScrollX = parseFloat(moving.style.left) + (to.x - from.x) / scale();
      const noScrollY = parseFloat(moving.style.top) + (to.y - from.y) / scale();
      sendWire(moving.querySelector('.iv-node-handle'), 'pointerdown', from);
      sendWire(moving, 'pointermove', to);
      check(parseFloat(moving.style.left) > noScrollX + 10 && parseFloat(moving.style.top) > noScrollY + 10, 'Dragging a scene at the edge must follow the auto-panning viewport on both axes.');
      sendWire(moving, 'pointercancel', to);
    } finally { moving.setPointerCapture = movingCapture; }
    await new Promise(resolve => setTimeout(resolve, 0));
    const distantNode = node('a'), distantCapture = distantNode.setPointerCapture;
    distantNode.setPointerCapture = () => {};
    try {
      const from = center(distantNode.querySelector('.iv-node-handle'));
      sendWire(distantNode.querySelector('.iv-node-handle'), 'pointerdown', from);
      sendWire(distantNode, 'pointermove', {x:from.x + 5000 * scale(), y:from.y});
      sendWire(distantNode, 'pointerup', {x:from.x + 5000 * scale(), y:from.y});
    } finally { distantNode.setPointerCapture = distantCapture; }
    await new Promise(resolve => setTimeout(resolve, 0));
    const expandedWidth = parseFloat(get('world').style.width);
    check(expandedWidth > 5000, 'Moving a scene far away must expand the canvas automatically.');
    get('undo').click();
    check(parseFloat(get('world').style.width) >= expandedWidth, 'Moving a scene back must not collapse the expanded workspace.');

    doc = await mount({title:'Media drop', startId:null, scenes:[]}, [{id:77, fileName:'fixture.webm', fileAddress:'data:video/webm;base64,'}]); win = frame.contentWindow;
    const dropBounds = get('canvas').getBoundingClientRect(), transfer = new win.DataTransfer();
    transfer.setData('application/x-iv-media', '77');
    get('canvas').dispatchEvent(new win.DragEvent('drop', {bubbles:true, dataTransfer:transfer, clientX:dropBounds.left + 220, clientY:dropBounds.top + 160}));
    const dropped = doc.querySelector('[data-node]');
    check(dropped.style.left === '188px' && dropped.style.top === '128px' && get('scene-media').querySelector('[data-custom-select]').dataset.value === '77', 'Media drop coordinates must account for the socket margin without shifting the video scene.');

    doc = await mount({title:'Backward wire', startId:'a', scenes:[
      {id:'a', title:'Far right', mediaId:null, x:20000, y:80, choices:[{label:'Go back', target:'b'}]},
      {id:'b', title:'Left edge', mediaId:null, x:0, y:380, choices:[]},
    ]}); win = frame.contentWindow;
    const curve = doc.querySelector('.iv-edge').getBBox();
    check(curve.x >= 0 && curve.x + curve.width <= parseFloat(get('world').style.width), 'Backward wires must remain inside the expanded canvas instead of being clipped at its edges.');

    const large = {title:'Load test', startId:'s0', scenes:Array.from({length:100}, (_, index) => ({
      id:`s${index}`, title:`Scene ${index}`, mediaId:null, x:70 + index % 4 * 340, y:70 + Math.floor(index / 4) * 610,
      choices:Array.from({length:8}, (_, offset) => ({label:`Choice ${offset}`, target:`s${(index + offset + 1) % 100}`, timeSec:null})),
    }))};
    doc = await mount(large); win = frame.contentWindow;
    const firstHeight = node('s0').offsetHeight;
    get('arrange').click();
    check(parseFloat(node('s4').style.top) === 70 + firstHeight + 70, 'Arrange must space rows using actual scene height.');
    check(parseFloat(node('s99').style.top) <= 20000 && allVisible(), 'Arrange must keep large stories within position limits and frame the result.');
    check(doc.querySelectorAll('.iv-edge').length === 800, 'Arrange must preserve all connections.');
    get('undo').click();
    check(node('s4').style.top === '680px', 'Undo must restore positions before arranging.');
    node('s0').click();
    const nodes = [...doc.querySelectorAll('[data-node]')], edges = [...doc.querySelectorAll('.iv-edge')];
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now(); input(doc.querySelector('[data-choice-label="0"]'), `Choice ${i}`);
      times.push(Math.round(performance.now() - start));
    }
    check(nodes.every(item => item.isConnected) && edges.every(item => item.isConnected), 'Editing at 100 scenes / 800 edges must preserve existing graph elements.');
    get('fit').click();
    check(scale() < .4 && allVisible(), 'See all must fit a 100-scene graph, beyond the old 40% zoom limit.');
    win.scrollTo(0, 0);
    get('scenes-tab').click(); doc.querySelector('[data-select="s99"]').click();
    const focused = node('s99').getBoundingClientRect(), viewport = get('canvas').getBoundingClientRect();
    check(scale() > .4 && focused.top >= viewport.top - 1 && focused.bottom <= viewport.top + get('canvas').clientHeight + 1, 'Selecting a distant scene in the list must reveal it at a readable zoom.');
    check(win.scrollY === 0, 'Scene-list navigation must not jump the surrounding page.');
    get('fit').click(); get('canvas').focus();
    get('canvas').dispatchEvent(new win.KeyboardEvent('keydown', {key:'f', bubbles:true, cancelable:true}));
    check(scale() > .4, 'F must focus the selected scene.');
    get('canvas').dispatchEvent(new win.KeyboardEvent('keydown', {key:'0', bubbles:true, cancelable:true}));
    check(allVisible(), '0 must restore the complete overview.');
    get('focus').focus();
    get('focus').dispatchEvent(new win.KeyboardEvent('keydown', {key:'f', bubbles:true, cancelable:true}));
    check(scale() > .4, 'Navigation shortcuts must also work from the canvas toolbar controls.');
    const beforeTyping = scale();
    get('scene-title').focus();
    get('scene-title').dispatchEvent(new win.KeyboardEvent('keydown', {key:'0', bubbles:true, cancelable:true}));
    check(scale() === beforeTyping, 'Typing in the inspector must not trigger graph navigation shortcuts.');
    for (let i = 0; i < 60; i++) get('zoom-in').click();
    check(get('zoom-in').disabled && scale() === 2, 'Zoom in must stop at 200%.');
    for (let i = 0; i < 60; i++) get('zoom-out').click();
    check(get('zoom-out').disabled && scale() === .005, 'Zoom out must stop at 0.5%.');
    get('zoom-reset').click();
    check(scale() === 1 && !get('zoom-in').disabled && !get('zoom-out').disabled, 'Reset must restore 100% and enable both zoom controls.');

    doc = await mount({title:'Empty', startId:null, scenes:[]}); win = frame.contentWindow;
    check(get('fit').disabled && get('focus').disabled, 'An empty graph must disable scene navigation.');
    check(get('inspector').hidden && get('inspector-toggle').disabled, 'An empty graph must not open the inspector.');
    doc.querySelector('[data-iv-add]').click();
    check(!get('inspector').hidden && !get('inspector-toggle').disabled, 'Adding a scene must open its inspector.');
    get('undo').click();
    check(get('inspector').hidden && get('inspector-toggle').disabled, 'Undoing the last scene must close and disable the inspector.');
    frame.style.width = '375px';
    await new Promise(resolve => setTimeout(resolve, 100));
    check(doc.documentElement.scrollWidth <= win.innerWidth, 'Graph navigation controls must fit a narrow screen.');
    result.textContent = `${checks} browser checks passed.\n100-scene typing: ${times.join(', ')} ms per input.\nNo writes were sent to the server.`;
  } catch (error) {
    result.textContent = `FAILED after ${checks} checks: ${error.message}`;
    console.error(error);
  } finally {
    frame?.remove();
    run.disabled = false;
  }
});
