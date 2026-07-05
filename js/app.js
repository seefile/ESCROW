/* ==========================================================================
   KudiEscrow — shared utilities and server-backed state helper
   This prototype now persists state in Postgres and uses server-side sessions.
   ========================================================================== */

const KUDI = (function(){
  function apiSync(path, method = 'GET', body = null) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, path, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;
    xhr.send(body ? JSON.stringify(body) : null);
    if (xhr.status >= 400) {
      let message = xhr.statusText || 'Server error';
      try { const json = JSON.parse(xhr.responseText); if (json && json.error) message = json.error; } catch (e) {}
      throw new Error(message);
    }
    return xhr.responseText ? JSON.parse(xhr.responseText) : null;
  }

  function fmtMoney(n, cur='USD'){
    return new Intl.NumberFormat('en-US', { style:'currency', currency:cur, maximumFractionDigits:0 }).format(n);
  }
  function timeAgo(t){
    const s = Math.floor((Date.now()-t)/1000);
    if(s<60) return 'just now';
    if(s<3600) return Math.floor(s/60)+'m ago';
    if(s<86400) return Math.floor(s/3600)+'h ago';
    return Math.floor(s/86400)+'d ago';
  }
  function initialsOf(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

  function toast(msg, type=''){ 
    let stack = document.querySelector('.toast-stack');
    if(!stack){ stack = document.createElement('div'); stack.className='toast-stack'; document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = 'toast '+type;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3600);
  }

  function requireSession(redirectTo){
    try{
      const sess = getSession();
      if(!sess || !sess.userId){ 
        console.warn('No valid session found, redirecting to login');
        window.location.href = redirectTo || 'login.html'; 
        return null; 
      }
      console.log('Session valid for user:', sess.userId);
      return sess;
    }catch(e){ 
      console.error('Session check error:', e);
      window.location.href = redirectTo || 'login.html'; 
      return null; 
    }
  }

  function validateSessionReady(callback, maxAttempts = 40) {
    let attempts = 0;
    const checkSession = () => {
      try {
        const sess = getSession();
        if (sess && sess.userId) {
          if (callback) callback(sess);
          return;
        }
      } catch (e) {
        console.warn(`Session check attempt ${attempts + 1} failed:`, e && e.message ? e.message : e);
      }
      
      if (attempts < maxAttempts) {
        attempts++;
        // slightly longer interval to allow cookies to propagate behind proxies/load-balancers
        setTimeout(checkSession, 300);
      } else {
        console.error('Session validation failed after multiple attempts');
        window.location.href = 'login.html';
      }
    };
    
    checkSession();
  }

  function statusBadge(status){
    const map = {
      funded:   ['badge-pending','Funds Secured'],
      in_transit:['badge-transit','In Transit'],
      delivered:['badge-transit','Delivered'],
      released: ['badge-released','Released'],
      disputed: ['badge-dispute','Disputed'],
      refunded: ['badge-dispute','Refunded'],
    };
    const [cls,label] = map[status] || ['badge-pending', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  const NAV_BY_ROLE = {
    buyer: [
      { key:'overview', label:'Overview', href:'dashboard-buyer.html' },
      { key:'transactions', label:'Transactions', href:'dashboard-buyer.html#transactions' },
      { key:'tracking', label:'Shipment Tracking', href:'tracking.html' },
      { key:'wallet', label:'Wallet', href:'#' },
      { key:'reviews', label:'Reviews Given', href:'#' },
    ],
    seller: [
      { key:'overview', label:'Overview', href:'dashboard-seller.html' },
      { key:'transactions', label:'Orders / Escrow', href:'dashboard-seller.html#transactions' },
      { key:'tracking', label:'Shipment Tracking', href:'tracking.html' },
      { key:'wallet', label:'Wallet &amp; Payouts', href:'#' },
      { key:'trust', label:'Trust Score', href:'#' },
    ],
    logistics: [
      { key:'overview', label:'Overview', href:'dashboard-logistics.html' },
      { key:'shipments', label:'Shipments', href:'dashboard-logistics.html#shipments' },
      { key:'tracking', label:'Live Tracking', href:'tracking.html' },
      { key:'drivers', label:'Drivers &amp; Fleet', href:'#' },
      { key:'earnings', label:'Earnings', href:'#' },
    ],
    admin: [
      { key:'overview', label:'Overview', href:'dashboard-admin.html' },
      { key:'disputes', label:'Disputes', href:'dashboard-admin.html#disputes' },
      { key:'transactions', label:'All Transactions', href:'dashboard-admin.html#transactions' },
      { key:'users', label:'Users', href:'#' },
      { key:'fraud', label:'Fraud Monitoring', href:'#' },
      { key:'api', label:'API Management', href:'#' },
    ],
    support: [
      { key:'overview', label:'Overview', href:'dashboard-admin.html' },
      { key:'disputes', label:'Disputes', href:'dashboard-admin.html#disputes' },
    ],
  };

  function sidebar(role, activeKey){
    const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.buyer;
    const links = items.map(it => `<a class="side-link ${it.key===activeKey?'active':''}" href="${it.href}"><span class="dot"></span>${it.label}</a>`).join('');
    return `
      <div class="brand">
        <svg class="brand-mark" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="15" stroke="#B8863B" stroke-width="2"/><path d="M10 16.5l4 4 8-9" stroke="#B8863B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        KudiEscrow
      </div>
      <div class="side-section">
        <div class="side-label">Menu</div>
        ${links}
      </div>
      <div class="side-section">
        <div class="side-label">Account</div>
        <a class="side-link" href="index.html"><span class="dot"></span>Public Site</a>
        <a class="side-link" href="#" onclick="KUDI.clearSession(); location.href='login.html'; return false;"><span class="dot"></span>Log Out</a>
      </div>
    `;
  }

  function load(){
    return apiSync('/api/db');
  }

  function save(db){
    apiSync('/api/db', 'POST', { db });
  }

  function reset(){
    apiSync('/api/db/reset', 'POST');
    location.reload();
  }

  function getSession(){
    return apiSync('/api/session');
  }

  function clearSession(){
    try { apiSync('/api/auth/logout', 'POST'); } catch (e) {}
  }

  function login(email, password){
    return apiSync('/api/auth/login', 'POST', { email, password });
  }

  function loginRole(role){
    return apiSync('/api/auth/login', 'POST', { role });
  }

  function signup(payload){
    return apiSync('/api/auth/signup', 'POST', payload);
  }

  function logAudit(db, text, actor){
    db.auditLog = db.auditLog || [];
    db.auditLog.unshift({ text, t: Date.now(), actor: actor || 'Platform Admin' });
    save(db);
  }

  let wsConnection = null;
  function connectWebSocket(txId, onMessage) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.close();
    }
    try {
      const sess = getSession();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?txId=${txId}&userId=${sess.userId}`;
      wsConnection = new WebSocket(wsUrl);
      wsConnection.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (onMessage) onMessage(msg);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };
      wsConnection.onerror = (err) => {
        console.error('WebSocket error:', err);
        toast('Real-time connection lost. Using polling.', 'warning');
      };
      return wsConnection;
    } catch (err) {
      console.error('WebSocket connection error:', err);
      return null;
    }
  }

  function sendWebSocketMessage(txId, text, evidence = null) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({ text, evidence }));
    }
  }

  function closeWebSocket() {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.close();
    }
  }

  return {
    fmtMoney, timeAgo, initialsOf, toast, requireSession, statusBadge,
    sidebar, load, save, reset, getSession, clearSession,
    login, loginRole, signup, logAudit,
    connectWebSocket, sendWebSocketMessage, closeWebSocket,
    validateSessionReady,
  };
})();
