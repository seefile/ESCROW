/* ==========================================================================
   KudiEscrow — shared mock data layer & utilities
   This is a front-end prototype: all "backend" state lives in localStorage
   so the demo persists across pages and reloads without a real server.
   Swap KUDI.db for real API calls when wiring up a backend.
   ========================================================================== */

const KUDI = (function(){

  const DB_KEY = 'kudi_db_v1';
  const SESSION_KEY = 'kudi_session_v1';

  function seed(){
    return {
      users: [
        { id:'u_buyer',   name:'Amara Chen',      role:'buyer',      email:'amara@buyer.test',   trust:96, initials:'AC' },
        { id:'u_seller',  name:'Obi Trading Co.',  role:'seller',     email:'obi@seller.test',    trust:91, initials:'OT' },
        { id:'u_logi',    name:'SwiftHaul Logistics', role:'logistics', email:'ops@swifthaul.test', trust:88, initials:'SH' },
        { id:'u_support', name:'Ada Nwosu',       role:'support',    email:'ada@kudiescrow.test', trust:100, initials:'AN' },
        { id:'u_admin',   name:'Platform Admin',  role:'admin',      email:'admin@kudiescrow.test', trust:100, initials:'PA' },
      ],
      transactions: [
        {
          id:'tx_10234', ref:'KDE-2026-10234',
          buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
          item:'200x Ceramic Tile Pallets (Grade A)', amount: 18400, currency:'USD',
          status:'in_transit', // funded, in_transit, delivered, released, disputed, refunded
          createdAt: Date.now() - 1000*60*60*24*6,
          stages:['Funded','Shipped','In Transit','Delivered','Released'],
          stageIndex: 2,
          shipmentId:'sh_5521',
        },
        {
          id:'tx_10235', ref:'KDE-2026-10235',
          buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
          item:'Bulk Order — Cashew Nuts, 2 Metric Tons', amount: 6250, currency:'USD',
          status:'disputed',
          createdAt: Date.now() - 1000*60*60*24*11,
          stages:['Funded','Shipped','In Transit','Delivered','Released'],
          stageIndex: 3,
          shipmentId:'sh_5522',
        },
        {
          id:'tx_10236', ref:'KDE-2026-10236',
          buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
          item:'Industrial Sewing Machines x12', amount: 9800, currency:'USD',
          status:'released',
          createdAt: Date.now() - 1000*60*60*24*20,
          stages:['Funded','Shipped','In Transit','Delivered','Released'],
          stageIndex: 4,
          shipmentId:'sh_5519',
        },
        {
          id:'tx_10237', ref:'KDE-2026-10237',
          buyerId:'u_buyer', sellerId:'u_seller', logisticsId:'u_logi',
          item:'Solar Panel Kits, 40 Units', amount: 15300, currency:'USD',
          status:'funded',
          createdAt: Date.now() - 1000*60*60*8,
          stages:['Funded','Shipped','In Transit','Delivered','Released'],
          stageIndex: 0,
          shipmentId:'sh_5523',
        },
      ],
      shipments: [
        { id:'sh_5521', txId:'tx_10234', mode:'sea', origin:'Lagos, NG', destination:'Rotterdam, NL',
          progress: 0.55, eta: 'Jul 14, 2026',
          checkpoints:[
            {label:'Picked up — Lagos Warehouse', date:'Jun 29', done:true},
            {label:'Departed Port — Apapa', date:'Jul 01', done:true},
            {label:'Customs Clearance — Origin', date:'Jul 02', done:true},
            {label:'In Transit — Atlantic Route', date:'Jul 05', done:true, current:true},
            {label:'Customs — Rotterdam', date:'Jul 12', done:false},
            {label:'Out for Delivery', date:'Jul 14', done:false},
          ]},
        { id:'sh_5522', txId:'tx_10235', mode:'air', origin:'Accra, GH', destination:'London, UK',
          progress: 0.8, eta: 'Delayed — under review',
          checkpoints:[
            {label:'Picked up — Accra Depot', date:'Jun 24', done:true},
            {label:'Departed — Kotoka Intl', date:'Jun 25', done:true},
            {label:'Arrived — Heathrow', date:'Jun 26', done:true},
            {label:'Customs Hold — Documentation', date:'Jun 27', done:true, current:true},
            {label:'Delivery', date:'Pending dispute resolution', done:false},
          ]},
        { id:'sh_5519', txId:'tx_10236', mode:'road', origin:'Kano, NG', destination:'Abuja, NG',
          progress: 1, eta: 'Delivered Jun 18, 2026',
          checkpoints:[
            {label:'Picked up — Kano Facility', date:'Jun 16', done:true},
            {label:'In Transit', date:'Jun 17', done:true},
            {label:'Delivered & Signed', date:'Jun 18', done:true, current:true},
          ]},
        { id:'sh_5523', txId:'tx_10237', mode:'sea', origin:'Guangzhou, CN', destination:'Lagos, NG',
          progress: 0.05, eta:'Aug 02, 2026',
          checkpoints:[
            {label:'Order Confirmed', date:'Jul 05', done:true, current:true},
            {label:'Pickup Scheduled', date:'Jul 07', done:false},
            {label:'Departed Port', date:'Jul 10', done:false},
            {label:'In Transit', date:'—', done:false},
            {label:'Arrival & Customs', date:'—', done:false},
          ]},
      ],
      messages: {
        tx_10234: [
          { from:'u_seller', text:'Shipment has cleared origin customs, on the water now.', t: Date.now()-1000*60*60*70 },
          { from:'u_buyer', text:'Great, thank you for the update!', t: Date.now()-1000*60*60*69 },
          { from:'system', text:'Tracking updated: In Transit — Atlantic Route', t: Date.now()-1000*60*60*20 },
        ],
        tx_10235: [
          { from:'u_buyer', text:'The delivered quantity is short by 4 bags versus the invoice.', t: Date.now()-1000*60*60*40 },
          { from:'u_seller', text:'We packed the full order — please share photos of the received pallets.', t: Date.now()-1000*60*60*39 },
          { from:'system', text:'Dispute opened by buyer. Escrow funds frozen.', t: Date.now()-1000*60*60*38, dispute:true },
          { from:'u_support', text:'Support has joined this conversation to help resolve the dispute. Please upload any evidence (photos, weighbridge tickets) here.', t: Date.now()-1000*60*60*37 },
          { from:'u_buyer', text:'Uploaded delivery photos and the warehouse weight slip.', t: Date.now()-1000*60*60*30 },
        ],
        tx_10236: [
          { from:'system', text:'Delivery confirmed by buyer. Funds released to seller.', t: Date.now()-1000*60*60*24*2 },
        ],
        tx_10237: [
          { from:'system', text:'Escrow funded. Seller notified to begin fulfilment.', t: Date.now()-1000*60*60*8 },
        ],
      },
      auditLog: [
        { text:'Admin PA verified seller "Obi Trading Co." business documents.', t: Date.now()-1000*60*60*24*30, actor:'Platform Admin' },
        { text:'Support AN assigned to dispute on KDE-2026-10235.', t: Date.now()-1000*60*60*37, actor:'Ada Nwosu' },
        { text:'Escrow released for KDE-2026-10236 to Obi Trading Co.', t: Date.now()-1000*60*60*24*2, actor:'System' },
      ],
      notifications: [
        { text:'Escrow funded for KDE-2026-10237', t: Date.now()-1000*60*60*8, read:false },
        { text:'New evidence uploaded on KDE-2026-10235', t: Date.now()-1000*60*60*30, read:false },
        { text:'Tracking update: KDE-2026-10234 in transit', t: Date.now()-1000*60*60*20, read:true },
      ],
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      if(!raw){ const s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s; }
      return JSON.parse(raw);
    }catch(e){ const s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s; }
  }
  function save(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function reset(){ localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); location.reload(); }

  function getSession(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null; }
  }
  function setSession(userId){ localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: Date.now() })); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

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
    const sess = getSession();
    if(!sess){ window.location.href = redirectTo || 'login.html'; return null; }
    return sess;
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

  function logAudit(db, text, actor){
    db.auditLog = db.auditLog || [];
    db.auditLog.unshift({ text, t: Date.now(), actor: actor || 'Platform Admin' });
    save(db);
  }

  return {
    seed, load, save, reset,
    getSession, setSession, clearSession,
    fmtMoney, timeAgo, initialsOf, toast, requireSession, statusBadge,
    sidebar, logAudit,
  };
})();
