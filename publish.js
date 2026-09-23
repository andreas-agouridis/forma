'use strict';

(() => {
  const sourceNames = ['index.html', 'guide.html', 'privacy.html', 'style.css', 'site-config.js', 'discovery.js', 'studio-core.js', 'connection.js', 'storage.js', 'script.js', 'publish.html', 'publish.js'];
  const pages = ['index.html', 'guide.html', 'privacy.html'];
  const encoder = new TextEncoder();
  let downloadURL;
  const $ = (selector) => document.querySelector(selector);

  function siteURL(input) {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use a public HTTP(S) URL without credentials, query strings or fragments.');
    url.pathname = url.pathname.replace(/index\.html$/, '');
    if (/\.[a-z0-9]+$/i.test(url.pathname)) throw new Error('Enter the site folder URL rather than an HTML filename.');
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
  }
  function meta(doc, key, content, property = false) {
    const attribute = property ? 'property' : 'name';
    let element = doc.querySelector(`meta[${attribute}="${key}"]`);
    if (!element) { element = doc.createElement('meta'); element.setAttribute(attribute, key); doc.head.append(element); }
    element.content = content;
  }
  function stampHTML(source, filename, base) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const url = new URL(filename === 'index.html' ? './' : filename, base).href;
    doc.querySelector('link[rel="canonical"]').setAttribute('href', url);
    meta(doc, 'og:url', url, true);
    meta(doc, 'og:image', new URL('social-preview.png', base).href, true);
    meta(doc, 'og:image:width', '1200', true);
    meta(doc, 'og:image:height', '630', true);
    meta(doc, 'og:image:type', 'image/png', true);
    meta(doc, 'og:image:alt', 'Forma AI Image Studio — Ideas into images. Just like magic.', true);
    meta(doc, 'twitter:image', new URL('social-preview.png', base).href);
    meta(doc, 'twitter:image:alt', 'Forma AI Image Studio — Ideas into images. Just like magic.');
    const favicon = doc.querySelector('link[rel="icon"]');
    favicon.href = new URL('favicon.png', base).href;
    favicon.setAttribute('type', 'image/png');
    favicon.setAttribute('sizes', '64x64');
    const touch = doc.querySelector('link[rel="apple-touch-icon"]') || doc.createElement('link');
    touch.rel = 'apple-touch-icon'; touch.href = new URL('apple-touch-icon.png', base).href;
    doc.head.append(touch);
    const script = doc.querySelector('#structured-data');
    const data = JSON.parse(script.textContent);
    const entities = data['@graph'] || [data];
    for (const entity of entities) {
      if (entity['@id']?.startsWith('#')) entity['@id'] = url + entity['@id'];
      entity.url = entity['@type'] === 'WebSite' || entity['@type'] === 'WebApplication' ? base.href : url;
      if (entity['@type'] === 'Article') entity.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
    }
    script.textContent = '\n' + JSON.stringify(data, null, 2).replace(/</g, '\\u003c') + '\n';
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML + '\n';
  }
  async function png(canvas) {
    return new Uint8Array(await (await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create preview artwork.')), 'image/png'))).arrayBuffer());
  }
  async function artwork() {
    await document.fonts.ready;
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101113'; ctx.fillRect(0, 0, 1200, 630);
    const glow = ctx.createRadialGradient(970, 280, 20, 970, 280, 420);
    glow.addColorStop(0, '#354525'); glow.addColorStop(1, '#101113');
    ctx.fillStyle = glow; ctx.fillRect(700, 0, 500, 630);
    ctx.strokeStyle = '#d4f78a'; ctx.lineWidth = 1;
    for (let x = 800; x < 1200; x += 35) { ctx.globalAlpha = .07; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(985, 315);
    for (const angle of [-.6, .6, 1.7]) {
      ctx.save(); ctx.rotate(angle);
      const ring = ctx.createLinearGradient(-100, -120, 100, 120);
      ring.addColorStop(0, '#e1ffb3'); ring.addColorStop(.45, '#adc881'); ring.addColorStop(1, '#526839');
      ctx.strokeStyle = ring; ctx.lineWidth = 38; ctx.shadowColor = '#0008'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 12;
      ctx.beginPath(); ctx.ellipse(0, 0, 76, 153, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#d4f78a'; ctx.font = '800 40px Manrope, sans-serif'; ctx.fillText('forma.', 70, 91);
    ctx.fillStyle = '#b3bea6'; ctx.font = '500 15px "DM Sans", sans-serif'; ctx.fillText('YOUR IDEAS DESERVE TO BE SEEN', 70, 171);
    ctx.fillStyle = '#f0f1ec'; ctx.font = '600 76px Manrope, sans-serif'; ctx.fillText('Ideas into images.', 65, 283);
    ctx.fillStyle = '#d4f78a'; ctx.fillText('Just like magic.', 65, 381);
    ctx.fillStyle = '#b5bdb0'; ctx.font = '400 22px "DM Sans", sans-serif'; ctx.fillText('Your free-to-use AI creative studio.', 70, 454);
    ctx.strokeStyle = '#38402f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(70, 530); ctx.lineTo(1130, 530); ctx.stroke();
    ctx.fillStyle = '#abb89c'; ctx.font = '400 16px "DM Sans", sans-serif'; ctx.fillText('Text to image  /  Five aesthetics  /  Your imagination', 70, 572);
    ctx.font = '400 13px "DM Sans", sans-serif'; ctx.fillText('Provider credits apply', 979, 572);
    const files = new Map([['social-preview.png', await png(canvas)]]);
    for (const [name, size] of [['favicon.png', 64], ['apple-touch-icon.png', 180]]) {
      canvas.width = size; canvas.height = size;
      ctx.fillStyle = '#d4f78a'; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#101113'; ctx.font = `800 ${Math.round(size * .83)}px Manrope, sans-serif`;
      ctx.fillText('f', size * .3, size * .8);
      files.set(name, await png(canvas));
    }
    return files;
  }
  const xmlEscape = (value) => value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
  function readableContent(source) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return [...doc.querySelectorAll('.prose h2, .prose h3, .prose p, .prose li, .prose blockquote')].map((node) => {
      const prefix = node.tagName === 'H2' ? '## ' : node.tagName === 'H3' ? '### ' : node.tagName === 'LI' ? '- ' : node.tagName === 'BLOCKQUOTE' ? '> ' : '';
      return prefix + node.textContent.trim().replace(/\s+/g, ' ');
    }).join('\n\n');
  }
  function crawlerFiles(files, base) {
    files.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map((name) => `  <url><loc>${xmlEscape(new URL(name === 'index.html' ? './' : name, base).href)}</loc></url>`).join('\n') + '\n</urlset>\n');
    files.set('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`);
    const summary = `# Forma AI Image Studio\n\n> Forma is a free-to-use browser interface for text-to-image generation through a user's Pollinations account. Provider credits, model access and usage limits apply.\n\n## Public pages\n- [Image studio](${base.href}): Create images with five visual styles, five curated model choices, four aspect ratios, AI prompt refinement and original-size downloads.\n- [Prompt guide](${new URL('guide.html', base).href}): Prompt examples, model comparisons, settings and troubleshooting.\n- [Privacy and local data](${new URL('privacy.html', base).href}): Browser storage, provider requests and deleting local history.\n\n## Product facts\n- Generation requires an internet connection and Pollinations authorization.\n- The interface is free; generation and AI refinement can consume provider credits.\n- Models: Z-Image Turbo, FLUX.1 Schnell, FLUX.2 Klein, FLUX.2 Pro, GPT Image 1 Mini. Availability may change.\n- Styles: Auto, Realistic, 3D render, Anime, Digital art.\n- Drafts and up to 12 recent images are stored in the browser when storage is available. Access tokens remain in page memory.\n- The inspiration gallery contains reference photographs, not generated results.\n- Forma is an independent interface and does not host or train its own image models.\n\n## Provider sources\n- [API documentation](https://gen.pollinations.ai/docs)\n- [Live image model catalog](https://gen.pollinations.ai/image/models)\n- [Account connection guide](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md)\n`;
    files.set('llms.txt', summary);
    files.set('llms-full.txt', `${summary}\n---\n\n# Prompt guide\nSource: ${new URL('guide.html', base).href}\n\n${readableContent(files.get('guide.html'))}\n\n---\n\n# Privacy and local data\nSource: ${new URL('privacy.html', base).href}\n\n${readableContent(files.get('privacy.html'))}\n`);
  }

  // A small ZIP writer using STORE entries. No third-party code or build tooling.
  const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    return value >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const parts = []; const central = []; let offset = 0;
    for (const [name, content] of files) {
      const filename = encoder.encode(name); const data = typeof content === 'string' ? encoder.encode(content) : content;
      const crc = crc32(data);
      const header = new Uint8Array(30 + filename.length); const local = new DataView(header.buffer);
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x800, true); local.setUint16(12, 33, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, filename.length, true); header.set(filename, 30);
      parts.push(header, data);
      const entry = new Uint8Array(46 + filename.length); const view = new DataView(entry.buffer);
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x800, true); view.setUint16(14, 33, true);
      view.setUint32(16, crc, true); view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, filename.length, true); view.setUint32(42, offset, true); entry.set(filename, 46);
      central.push(entry); offset += header.length + data.length;
    }
    const centralSize = central.reduce((total, entry) => total + entry.length, 0);
    const end = new Uint8Array(22); const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.size, true); view.setUint16(10, files.size, true); view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }

  $('#publish-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#build-package').disabled = true;
    const status = $('#publish-status'); status.textContent = 'Preparing your publishing kit…';
    try {
      const base = siteURL($('#site-url').value.trim());
      const files = new Map();
      const selected = [...$('#source-files').files];
      if (selected.length) {
        for (const file of selected) if (sourceNames.includes(file.name)) files.set(file.name, await file.text());
      } else if (['http:', 'https:'].includes(location.protocol)) {
        await Promise.all(sourceNames.map(async (name) => {
          const response = await fetch(new URL(name, location.href), { cache: 'no-cache' });
          if (!response.ok) throw new Error(`Could not load ${name}. Select the project source files manually.`);
          files.set(name, await response.text());
        }));
      }
      const missing = sourceNames.filter((name) => !files.has(name));
      if (missing.length) throw new Error(`Select the source files first. Missing: ${missing.join(', ')}`);
      for (const name of pages) files.set(name, stampHTML(files.get(name), name, base));
      crawlerFiles(files, base);
      for (const [name, data] of await artwork()) files.set(name, data);
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(zip(files));
      const link = document.createElement('a'); link.href = downloadURL; link.download = 'forma-publish.zip'; document.body.append(link); link.click(); link.remove();
      status.textContent = `Your ${files.size}-file publishing kit is ready for ${base.href} Unzip it into your hosting folder. Place robots.txt at the domain root.`;
    } catch (error) { status.textContent = error.message || 'Could not prepare the publishing kit. Check your source files and URL.'; }
    finally { $('#build-package').disabled = false; }
  });
  if (['http:', 'https:'].includes(location.protocol) && !['localhost', '127.0.0.1'].includes(location.hostname)) $('#site-url').value = new URL('./', location.href).href;
})();
