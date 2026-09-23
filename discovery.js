'use strict';

// Keeps rendered metadata accurate on any static host. publish.html also stamps
// these URLs into the original HTML for crawlers that do not execute JavaScript.
(() => {
  if (!['https:', 'http:'].includes(location.protocol)) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return;
  const base = new URL('./', location.href);
  const page = location.pathname.split('/').pop();
  let url = canonical.getAttribute('href');
  if (!/^https?:\/\//.test(url)) {
    const configured = window.FORMA_CONFIG?.canonicalUrl;
    try {
      const site = configured ? new URL(configured) : base;
      if (!['http:', 'https:'].includes(site.protocol)) return;
      url = new URL(!page || page === 'index.html' ? './' : page, site.href.endsWith('/') ? site : `${site.href}/`).href;
    } catch { return; }
  }
  canonical.href = url;
  let og = document.querySelector('meta[property="og:url"]');
  if (!og) { og = document.createElement('meta'); og.setAttribute('property', 'og:url'); document.head.append(og); }
  og.content = url;
})();
