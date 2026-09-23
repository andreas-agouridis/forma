'use strict';

window.FormaConnection = (() => {
  const C = window.FormaCore;
  let token = '';
  let expiresAt = 0;
  let deviceController = null;
  let discovery;
  const dialog = document.querySelector('#connection-dialog');
  const status = document.querySelector('#connection-message');
  const $ = (selector) => document.querySelector(selector);

  function emit() { window.dispatchEvent(new CustomEvent('forma:connection', { detail: { connected: Boolean(getToken()) } })); }
  function getToken() {
    if (expiresAt && expiresAt <= Date.now()) { token = ''; expiresAt = 0; }
    return token;
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  }
  function stop() {
    deviceController?.abort();
    deviceController = null;
    $('#connect-provider').disabled = false;
    $('#use-token').disabled = false;
    $('#device-flow').hidden = true;
  }
  function open() {
    if (!dialog.open) dialog.showModal();
    $('#disconnect').hidden = !getToken();
    message(getToken() ? 'Connected for this page session. Your token is kept in memory only.' : 'Connect your own Pollinations account. Forma adds no usage fee. Provider credits and model limits apply.');
  }
  function disconnect() {
    stop(); token = ''; expiresAt = 0;
    $('#session-token').value = '';
    $('#disconnect').hidden = true;
    message('Disconnected. Reconnect whenever you are ready.');
    emit();
  }
  function accept(accessToken, lifetime) {
    if (typeof accessToken !== 'string' || !accessToken.startsWith('sk_')) throw new C.StudioError('The provider returned an invalid session token.', 'AUTH');
    token = accessToken;
    expiresAt = Number.isFinite(Number(lifetime)) && Number(lifetime) > 0 ? Date.now() + Number(lifetime) * 1000 : 0;
    stop(); emit(); dialog.close();
  }
  async function getDiscovery(signal) {
    if (discovery) return discovery;
    const data = await C.jsonRequest(`${C.AUTH}/.well-known/oauth-authorization-server`, {}, signal);
    for (const key of ['device_authorization_endpoint', 'token_endpoint', 'userinfo_endpoint']) {
      if (typeof data[key] !== 'string' || new URL(data[key]).origin !== C.AUTH) throw new C.StudioError('The provider returned unexpected connection endpoints.', 'AUTH');
    }
    discovery = data;
    return data;
  }

  async function connect() {
    if (navigator.onLine === false) return message('You are offline. Reconnect to the internet before signing in.', true);
    stop();
    const controller = new AbortController();
    deviceController = controller;
    $('#connect-provider').disabled = true;
    $('#use-token').disabled = true;
    message('Preparing a secure connection…');
    try {
      const endpoints = await getDiscovery(controller.signal);
      const body = {};
      const clientId = window.FORMA_CONFIG?.pollinationsClientId;
      if (clientId?.startsWith('pk_')) body.client_id = clientId;
      const device = await C.jsonRequest(endpoints.device_authorization_endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }, controller.signal);
      const verification = new URL(device.verification_uri_complete || device.verification_uri, C.AUTH);
      if (verification.origin !== C.AUTH || !device.device_code || !device.user_code) throw new C.StudioError('The provider could not prepare a sign-in code.', 'AUTH');
      $('#device-code').textContent = device.user_code;
      $('#authorize-device').href = verification.href;
      $('#device-flow').hidden = false;
      message('Open Pollinations below, approve the connection, then return here. This page checks automatically.');
      let interval = Math.max(5, Number(device.interval) || 5) * 1000;
      const deadline = Date.now() + Math.min(1800, Number(device.expires_in) || 600) * 1000;
      let networkFailures = 0;
      while (Date.now() < deadline) {
        await C.wait(interval, controller.signal);
        try {
          const result = await C.withTimeout(controller.signal, 15000, async (signal) => {
            const response = await fetch(endpoints.token_endpoint, {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: device.device_code }),
              signal, credentials: 'omit', referrerPolicy: 'no-referrer'
            });
            if (response.status === 429) return { error: 'slow_down' };
            if (response.status >= 500) throw C.httpError(response);
            return response.json();
          });
          networkFailures = 0;
          if (result.access_token) { accept(result.access_token, result.expires_in); return; }
          if (result.error === 'authorization_pending') continue;
          if (result.error === 'slow_down') { interval += 5000; continue; }
          if (result.error === 'access_denied') throw new C.StudioError('Connection was declined. You can try again whenever you like.', 'AUTH');
          if (result.error === 'expired_token') break;
          throw new C.StudioError('The sign-in session could not be completed. Please start a new connection.', 'AUTH');
        } catch (error) {
          if (controller.signal.aborted) throw C.abortError();
          if ((error instanceof TypeError || error.retryable) && ++networkFailures < 3) { interval = Math.max(interval, 10000); continue; }
          throw error;
        }
      }
      throw new C.StudioError('This sign-in code has expired. Connect again to get a new code.', 'AUTH');
    } catch (error) {
      if (error.name !== 'AbortError') message(error instanceof TypeError ? 'Could not reach Pollinations. Check your connection and try again.' : error.message, true);
    } finally {
      if (deviceController === controller) stop();
    }
  }

  $('#connect-provider').addEventListener('click', connect);
  $('#cancel-connect').addEventListener('click', () => { stop(); message('Connection cancelled.'); });
  $('#disconnect').addEventListener('click', disconnect);
  $('#connection-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { stop(); $('#session-token').value = ''; });
  $('#token-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = $('#session-token').value.trim();
    if (!value.startsWith('sk_') || /\s/.test(value)) return message('Paste a scoped session token starting with sk_, or use Connect Pollinations.', true);
    stop();
    const controller = new AbortController();
    deviceController = controller;
    $('#connect-provider').disabled = true;
    $('#use-token').disabled = true;
    message('Checking your session token…');
    try {
      const endpoints = await getDiscovery(controller.signal);
      await C.jsonRequest(endpoints.userinfo_endpoint, { headers: { Authorization: `Bearer ${value}` } }, controller.signal);
      accept(value);
    } catch (error) {
      if (error.name !== 'AbortError') message(error instanceof TypeError ? 'Could not verify the connection. Check your internet access.' : error.message, true);
    } finally { if (deviceController === controller) stop(); }
  });

  return { open, getToken, disconnect };
})();
