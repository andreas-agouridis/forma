'use strict';

(() => {
  const C = window.FormaCore;
  const Store = window.FormaStore;
  const Connection = window.FormaConnection;
  const $ = (selector) => document.querySelector(selector);
  const promptInput = $('#prompt');
  const form = $('#generate-form');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const inspirations = [
    { style: 'art', prompt: 'A secluded alpine lake reflecting a tiny wooden cabin and towering mountains, otherworldly emerald water, soft morning mist, a dreamlike sense of stillness, cinematic wide angle' },
    { style: 'photo', prompt: 'Sunbeams filtering through an ancient mossy forest, tiny ferns and dewdrops in the foreground, atmospheric golden light, rich green tones, peaceful editorial nature photography' },
    { style: 'art', prompt: 'A luminous nebula shaped like an enormous flower blooming in deep space, lavender and amber cosmic dust, countless delicate stars, ethereal light, awe-inspiring cinematic digital art' },
    { style: '3d', prompt: 'A miniature landscape of rolling emerald hills and whimsical rounded trees, soft clay materials, a tiny winding path, warm afternoon light, isometric 3D diorama on a cream background' }
  ];
  const surprises = [
    'A tiny glass greenhouse on a floating island, lush miniature plants, dreamy peach clouds, soft morning light, intricate details',
    'A translucent jade espresso machine in a minimalist Japanese cafe, warm sunlight, soft shadows, editorial product composition',
    'An astronaut tending a small flower garden on the moon, Earth rising behind them, nostalgic pastel colors, quiet and whimsical',
    'An impossible library growing inside a giant ancient tree, spiral staircases, warm lanterns, magical fireflies, cinematic atmosphere',
    'A sculptural chair made of folded sea-green glass, a sunlit architectural courtyard, soft caustic reflections, minimalist design'
  ];
  let selectedStyle = 'none';
  let operation = null;
  let currentImage = null;
  let creations = [];
  let lastFailed = null;
  let previousPrompt = null;
  let catalog = null;
  let catalogFailed = false;
  let catalogController = null;
  let toastTimer;
  let draftTimer;
  let storageAvailable = true;

  function scrollTo(element, block = 'center') { element.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block }); }
  function toast(text) {
    clearTimeout(toastTimer);
    $('#toast').textContent = text;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
  }
  function updatePrompt() {
    promptInput.setCustomValidity('');
    $('#char-count').textContent = `${promptInput.value.length} / 1600`;
    const words = promptInput.value.trim().split(/\s+/).filter(Boolean).length;
    $('#prompt-feedback').textContent = !words ? 'Give your idea a starting point.' : words < 8 ? 'Try adding a setting or a material.' : words < 20 ? 'A lighting detail can make a difference.' : 'Nice detail. Ready to explore.';
    $('#undo-refine').hidden = previousPrompt === null;
  }
  function setPrompt(value) { promptInput.value = value.slice(0, 1600); updatePrompt(); scheduleDraft(); }
  function selectStyle(style) {
    selectedStyle = Object.hasOwn(C.styles, style) ? style : 'none';
    document.querySelectorAll('[data-style]').forEach((button) => {
      const selected = button.dataset.style === selectedStyle;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    scheduleDraft();
  }
  function settings(randomize = true) {
    const supportsSeed = C.models.find((entry) => entry.id === $('#model').value)?.seed;
    return {
      prompt: promptInput.value.trim(), style: selectedStyle, model: $('#model').value, ratio: $('#ratio').value,
      quality: $('#quality').value, seed: randomize && (!supportsSeed || $('#seed').value === '') ? C.randomSeed() : $('#seed').value === '' ? '' : Number($('#seed').value),
      lighting: $('#lighting').value, composition: $('#composition').value, exclude: $('#exclude').value.trim(), polish: $('#polish').checked
    };
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    $('#draft-status').textContent = Store.saveDraft(settings(false)) ? 'Draft saved on this device' : 'Draft kept for this page session';
  }
  function scheduleDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 250); }
  function applySettings(value) {
    if (!value || typeof value !== 'object') return;
    previousPrompt = null;
    if (typeof value.prompt === 'string') setPrompt(value.prompt);
    selectStyle(value.style);
    for (const key of ['model', 'ratio', 'quality', 'lighting', 'composition']) {
      const select = $(`#${key}`);
      if ([...select.options].some((option) => option.value === value[key])) select.value = value[key];
    }
    $('#seed').value = Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 2147483647 ? value.seed : '';
    $('#exclude').value = typeof value.exclude === 'string' ? value.exclude.slice(0, 240) : '';
    $('#polish').checked = value.polish !== false;
    updateModel();
    scheduleDraft();
  }
  function updateConnection() {
    const connected = Boolean(Connection.getToken());
    $('#connection-label').textContent = connected ? 'AI connected' : 'Connect AI';
    document.body.classList.toggle('is-connected', connected);
  }
  function updateModel() {
    const model = C.models.find((entry) => entry.id === $('#model').value);
    if (!model) return;
    $('#model-description').textContent = model.description;
    $('#quality').disabled = !model.quality;
    $('#quality').options[0].textContent = model.quality ? 'Medium · balanced' : 'Model default';
    $('#quality-note').textContent = model.quality ? 'Higher quality can use more provider credits. Exact dimensions may vary by model.' : 'This model sets its own quality. Exact dimensions may vary by model.';
    $('#seed').disabled = !model.seed;
    $('#seed-note').textContent = model.seed ? 'A repeat seed can produce similar results; exact reproduction is not guaranteed.' : 'This model ignores the seed; results can vary.';
    const live = catalog?.find((entry) => entry.name === model.id || entry.aliases?.includes(model.id));
    let state = catalogFailed ? 'Catalog unavailable · using documented models' : catalog ? 'Not in the current catalog · choose another model' : 'Checking the provider’s model catalog…';
    if (live) {
      const parts = ['Listed by provider'];
      if (live.health?.status === 'degraded') parts.push('some provider requests are failing');
      if (live.health?.status === 'unavailable' || live.health?.status === 'down') parts.push('provider reports an outage');
      if (live.paid_only) parts.push('paid balance required');
      else if (live.flat_rate && !live.pricing_adjustments?.length && Number(live.pricing?.completionImageTokens) > 0) parts.push(`${Number(live.pricing.completionImageTokens)} Pollen / image`);
      else parts.push('usage-based provider pricing');
      state = parts.join(' · ');
    }
    $('#model-status').textContent = state;
  }
  async function refreshModels() {
    if (catalogController) return;
    const controller = new AbortController();
    catalogController = controller;
    $('#refresh-models').disabled = true;
    $('#model-status').textContent = 'Refreshing the provider’s model catalog…';
    try {
      if (navigator.onLine === false) throw new Error('Offline');
      const data = await C.jsonRequest(`${C.API}/image/models`, {}, controller.signal, 12000);
      if (!Array.isArray(data) || !data.some((entry) => typeof entry.name === 'string')) throw new Error('Invalid catalog');
      catalog = data.filter((entry) => entry.category === 'image' || entry.output_modalities?.includes('image'));
      catalogFailed = false;
      for (const option of $('#model').options) option.disabled = !catalog.some((entry) => entry.name === option.value || entry.aliases?.includes(option.value));
    } catch { catalogFailed = true; }
    finally { catalogController = null; $('#refresh-models').disabled = false; updateModel(); }
  }
  function setBusy(kind, controller) {
    operation = kind ? { kind, controller } : null;
    $('#controls').disabled = Boolean(kind);
    $('#clear-history').disabled = Boolean(kind);
    document.querySelectorAll('[data-connect]').forEach((button) => { button.disabled = Boolean(kind); });
    $('#reuse').disabled = Boolean(kind);
    $('#retry').disabled = Boolean(kind);
    $('#refine-progress').hidden = kind !== 'refine';
    $('#refine').setAttribute('aria-busy', String(kind === 'refine'));
    $('#generate-label').textContent = kind === 'generate' ? 'Creating your image…' : 'Generate image';
    if (!kind) updateModel();
  }
  function displayError(error, failedSettings = null) {
    let text = error instanceof TypeError ? 'Could not reach Pollinations. Check your connection or content blocker, then retry.' : error.message;
    if (error.code === 'TIMEOUT') text = 'The provider did not finish in time. Your prompt is saved. Retry the same request or try another model.';
    if (error.retryAfter > 60000) text += ` Wait at least ${Math.ceil(error.retryAfter / 1000)} seconds before retrying.`;
    if (error.status === 401) { Connection.disconnect(); updateConnection(); }
    $('#error-copy').textContent = text;
    $('#error-message').hidden = false;
    lastFailed = failedSettings ? { ...failedSettings } : null;
    $('#retry').hidden = !lastFailed;
  }
  function readyToRequest() {
    if (operation) return false;
    if (navigator.onLine === false) { displayError(new Error('You are offline. Reconnect to the internet and try again.')); return false; }
    if (!Connection.getToken()) { updateConnection(); Connection.open(); return false; }
    return true;
  }
  function restoreCanvas() {
    $('#result-image').hidden = !currentImage;
    $('#empty-state').hidden = Boolean(currentImage);
    $('#result-actions').hidden = !currentImage;
    $('#preview-status').textContent = currentImage ? 'Made from imagination' : 'Ready to imagine';
    $('#image-meta').textContent = currentImage ? resultMeta(currentImage) : 'A little prompt. A whole new perspective.';
  }
  function resultMeta(item) {
    const model = C.models.find((entry) => entry.id === item.settings.model);
    return `${item.width} × ${item.height} · ${model?.name || 'AI image'}${model?.seed ? ` · Seed ${item.settings.seed}` : ''}`;
  }
  function showResult(item) {
    if (currentImage && !creations.includes(currentImage) && currentImage !== item) URL.revokeObjectURL(currentImage.url);
    currentImage = item;
    $('#result-image').src = item.url;
    $('#result-image').alt = item.settings.prompt;
    $('#error-message').hidden = true;
    restoreCanvas();
  }
  function tiltCard(button) {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    button.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches) return;
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      button.style.transform = `perspective(700px) rotateX(${-y * 6}deg) rotateY(${x * 7}deg) translateY(-3px)`;
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  }
  function renderHistory() {
    $('#history-grid').replaceChildren(...creations.map((item) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'inspiration-card history-card';
      button.setAttribute('aria-label', `View creation: ${item.settings.prompt}`);
      const image = new Image();
      image.src = item.url; image.alt = item.settings.prompt; image.loading = 'lazy'; image.decoding = 'async'; image.width = item.width; image.height = item.height;
      const tag = document.createElement('span'); tag.className = 'card-tag'; tag.textContent = C.styles[item.settings.style]?.name || 'Auto';
      const bottom = document.createElement('span'); bottom.className = 'card-bottom';
      const title = document.createElement('strong'); title.textContent = item.settings.prompt;
      const meta = document.createElement('span'); meta.textContent = `${item.width} × ${item.height} · View creation ↗`;
      bottom.append(title, meta); button.append(image, tag, bottom);
      button.addEventListener('click', () => {
        if (operation) return toast('Let your current request finish first.');
        showResult(item); scrollTo($('#canvas'));
      });
      tiltCard(button);
      return button;
    }));
    $('#creation-count').textContent = String(creations.length);
    $('#history-empty').hidden = creations.length > 0;
    $('#clear-history').hidden = !creations.length;
  }
  async function loadHistory() {
    try {
      const records = await Store.list();
      for (const record of records) {
        if (!(record.blob instanceof Blob) || !record.blob.type.startsWith('image/') || !record.settings || typeof record.settings.prompt !== 'string') continue;
        creations.push({ ...record, url: URL.createObjectURL(record.blob) });
      }
      $('#history-storage').textContent = 'Latest 12 images stored on this device. Download favorites to keep a separate copy.';
    } catch {
      storageAvailable = false;
      $('#history-storage').textContent = 'Browser storage is unavailable. Images are kept for this page session; download favorites before leaving.';
    }
    renderHistory();
  }
  const historyReady = loadHistory();

  async function generateImage(requestSettings) {
    if (!readyToRequest()) return;
    try { C.validateSettings(requestSettings); } catch (error) { displayError(error); return; }
    if (catalog && !catalog.some((entry) => entry.name === requestSettings.model || entry.aliases?.includes(requestSettings.model))) {
      displayError(new Error('This model is absent from the current provider catalog. Select another model or refresh the list.')); return;
    }
    saveDraft();
    const controller = new AbortController();
    setBusy('generate', controller);
    $('#canvas').setAttribute('aria-busy', 'true');
    $('#empty-state').hidden = true;
    $('#result-image').hidden = true;
    $('#result-actions').hidden = true;
    $('#loading-state').hidden = false;
    $('#error-message').hidden = true;
    $('#preview-status').textContent = 'Creating your image';
    $('#image-meta').textContent = 'Your settings are locked in for this creation.';
    $('#elapsed').textContent = '0s';
    const started = Date.now();
    let phase = 'generating';
    let retryAt = 0;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      $('#elapsed').textContent = `${seconds}s`;
      if (phase === 'retrying') $('#elapsed').textContent += ` · retry in ${Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))}s`;
      if (phase === 'generating' && seconds > 45 && seconds % 30 === 0) $('#loading-copy').textContent = 'The model is still working. You can keep waiting or cancel.';
    }, 1000);
    try {
      const item = await C.generate(requestSettings, Connection.getToken(), controller.signal, (status) => {
        phase = status.phase;
        if (phase === 'retrying') {
          retryAt = Date.now() + status.delay;
          $('#loading-copy').textContent = `Temporary provider issue. Retrying the same request (${status.attempt}/3)…`;
        } else $('#loading-copy').textContent = phase === 'decoding' ? 'Checking your image and preparing the canvas…' : `Your image is being created${status.attempt > 1 ? ` · attempt ${status.attempt}/3` : ''}…`;
      });
      await historyReady;
      if (controller.signal.aborted) { URL.revokeObjectURL(item.url); throw C.abortError(); }
      creations.unshift(item);
      showResult(item);
      if (creations.length > 12) URL.revokeObjectURL(creations.pop().url);
      renderHistory();
      if (storageAvailable) {
        try { await Store.save(item); }
        catch { $('#history-storage').textContent = 'This image could not be saved to browser storage. Download it before leaving this page.'; }
      }
      lastFailed = null;
      toast('Your idea, brought to life. Make it yours.');
    } catch (error) {
      restoreCanvas();
      if (error.name === 'AbortError') toast('Stopped waiting. Your prompt is still here.');
      else displayError(error, requestSettings);
    } finally {
      clearInterval(timer);
      setBusy(null);
      $('#loading-state').hidden = true;
      $('#canvas').setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!promptInput.value.trim()) {
      promptInput.setCustomValidity('Describe the image you would like to create.'); promptInput.reportValidity(); return;
    }
    generateImage(settings());
  });
  $('#retry').addEventListener('click', () => { if (lastFailed) generateImage({ ...lastFailed }); });
  $('#cancel').addEventListener('click', () => operation?.controller.abort());
  $('#cancel-refine').addEventListener('click', () => operation?.controller.abort());
  $('#refine').addEventListener('click', async () => {
    if (!promptInput.value.trim()) { promptInput.focus(); return toast('Give the assistant an idea to work with first.'); }
    if (!readyToRequest()) return;
    const controller = new AbortController();
    const original = promptInput.value;
    const snapshot = settings();
    setBusy('refine', controller);
    $('#error-message').hidden = true;
    try {
      const refined = await C.refinePrompt(snapshot, Connection.getToken(), controller.signal);
      if (controller.signal.aborted) throw C.abortError();
      previousPrompt = original;
      setPrompt(refined);
      toast('Your prompt has a little more direction. Review it before creating.');
    } catch (error) {
      if (error.name === 'AbortError') toast('Refinement cancelled. Your original prompt is unchanged.');
      else displayError(error);
    } finally { setBusy(null); }
  });
  $('#undo-refine').addEventListener('click', () => {
    if (previousPrompt === null) return;
    const original = previousPrompt; previousPrompt = null; setPrompt(original); toast('Original prompt restored.');
  });
  promptInput.addEventListener('input', () => { previousPrompt = null; updatePrompt(); scheduleDraft(); });
  form.addEventListener('change', () => { updateModel(); scheduleDraft(); });
  promptInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!operation) form.requestSubmit(); }
  });
  document.querySelectorAll('[data-style]').forEach((button) => button.addEventListener('click', () => selectStyle(button.dataset.style)));
  function surprise() {
    if (operation) return toast('Let your current request finish first.');
    const choices = surprises.filter((value) => value !== promptInput.value);
    previousPrompt = null; setPrompt(choices[Math.floor(Math.random() * choices.length)]);
    promptInput.focus({ preventScroll: true }); scrollTo(form);
  }
  $('#surprise').addEventListener('click', surprise);
  $('#sidebar-surprise').addEventListener('click', surprise);
  document.querySelectorAll('[data-inspiration]').forEach((button) => {
    tiltCard(button);
    button.addEventListener('click', () => {
      if (operation) return toast('Let your current request finish first.');
      const item = inspirations[Number(button.dataset.inspiration)];
      previousPrompt = null; setPrompt(item.prompt); selectStyle(item.style);
      promptInput.focus({ preventScroll: true }); scrollTo(form);
      toast('A little inspiration, ready for your own twist.');
    });
    button.querySelector('img').addEventListener('error', (event) => { event.target.hidden = true; button.classList.add('image-fallback'); });
  });
  document.querySelectorAll('[data-connect]').forEach((button) => button.addEventListener('click', () => Connection.open()));
  window.addEventListener('forma:connection', updateConnection);
  $('#refresh-models').addEventListener('click', refreshModels);
  $('#reuse').addEventListener('click', () => {
    if (!currentImage || operation) return;
    applySettings(currentImage.settings); scrollTo(form); toast('Prompt and settings restored. Change a detail to explore.');
  });
  $('#copy-prompt').addEventListener('click', async () => {
    if (!currentImage) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(currentImage.fullPrompt); toast('Generation prompt copied.');
    } catch {
      // Local-file browsers may disallow the Clipboard API; expose selectable text instead.
      const area = document.createElement('textarea');
      area.value = currentImage.fullPrompt; area.className = 'clipboard-fallback'; area.setAttribute('aria-label', 'Generation prompt to copy');
      $('#result-actions').after(area); area.focus(); area.select();
      toast('Select the prompt below the image and copy it manually.');
      area.addEventListener('blur', () => area.remove(), { once: true });
    }
  });
  $('#download').addEventListener('click', () => {
    if (!currentImage) return;
    const extension = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[currentImage.blob.type] || 'png';
    const slug = currentImage.settings.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'creation';
    const link = document.createElement('a');
    link.href = currentImage.url; link.download = `forma-${slug}-${currentImage.settings.seed}.${extension}`;
    document.body.append(link); link.click(); link.remove();
    toast('Original-size image ready to download.');
  });
  $('#expand').addEventListener('click', () => {
    if (!currentImage) return;
    $('#large-image').src = currentImage.url; $('#large-image').alt = currentImage.settings.prompt;
    $('#image-dialog').showModal();
  });
  $('#close-image').addEventListener('click', () => $('#image-dialog').close());
  $('#image-dialog').addEventListener('close', () => $('#large-image').removeAttribute('src'));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  }));
  $('#clear-history').addEventListener('click', async () => {
    if (operation) return;
    $('#clear-history').disabled = true;
    try {
      if (storageAvailable) await Store.clear();
      creations.forEach((item) => { if (item !== currentImage) URL.revokeObjectURL(item.url); });
      creations = []; renderHistory(); toast('Local history cleared. Your current canvas is still available.');
    } catch { toast('Browser storage could not be cleared. Try again.'); }
    finally { $('#clear-history').disabled = false; }
  });
  function updateOnline() {
    $('#offline-banner').hidden = navigator.onLine !== false;
    if (navigator.onLine && catalogFailed) refreshModels();
  }
  window.addEventListener('offline', updateOnline);
  window.addEventListener('online', updateOnline);
  window.addEventListener('pagehide', () => { saveDraft(); operation?.controller.abort(); });
  applySettings(Store.readDraft());
  updatePrompt(); updateModel(); updateConnection(); updateOnline();
  $('#controls').disabled = false;
  refreshModels();
})();
