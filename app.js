var SURL = 'https://gyflqtysqpywikxgzxci.supabase.co';
var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5ZmxxdHlzcXB5d2lreGd6eGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxOTQsImV4cCI6MjA5Mjc1MjE5NH0.OUjtRRrKIHqLeWFiw1-CEZS3AAJrMTAeiQ8dNd21IP8';
var ATOKENS = ['a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0','35a85085a9ccd1440acb20cca15b78b0353f4f354bfcf8dd5d2f3d36734ca7be'];
var ADMIN_TOKEN = 'a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0';
var currentUser = {login:'', prenom:'', role:'user', token:''};
var SKEY2 = 'bus-auth-v1';
var articles = [], selectedCat = 'TOUT', editingNum = null, filtered = [], displayCount = 30, expandedNum = null, panier = [], _editPhoto = null, _editPhotos = [], _cats = [], _sortiesCount = {};

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function supa(method, path, body) {
  var opts = { method: method, headers: { 'apikey': SKEY, 'Authorization': 'Bearer ' + SKEY, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : '' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(SURL + '/rest/v1/' + path, opts).then(function(r) { if (!r.ok) return r.text().then(function(t) { throw new Error(t); }); if (r.status === 204 || r.headers.get('content-length') === '0') return null; return r.text().then(function(t) { if (!t || !t.trim()) return null; try { return JSON.parse(t); } catch(e) { return null; } }); });
}

async function hashStr(s) {
  var enc = new TextEncoder().encode(s);
  var buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}

function showLoading(show, msg) { var el = document.getElementById('loadingOverlay'); if (show) el.classList.remove('hidden'); else el.classList.add('hidden'); if (msg) document.getElementById('loadingText').textContent = msg; }
function showToast(msg, type) { var t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast ' + type + ' show'; setTimeout(function() { t.classList.remove('show'); }, 2500); }

async function checkAuth() {
  var stored = localStorage.getItem(SKEY2);
  if (ATOKENS.indexOf(stored) >= 0) {
    var cu = localStorage.getItem('currentUser');
    if (cu) { try { currentUser = JSON.parse(cu); } catch(e) {} }
    if (!currentUser.login) {
      currentUser = stored === ADMIN_TOKEN ? 
        {login:'Djulien', prenom:'Djulien', role:'admin', token:stored} :
        {login:'magasin2k', prenom:'Magasin', role:'magasinier', token:stored};
    }
    // Recharger le role depuis la base
    try {
      var data = await supa('GET', 'utilisateurs?login=eq.' + encodeURIComponent(currentUser.login) + '&select=prenom,role,actif');
      if (data && data.length) {
        currentUser.prenom = data[0].prenom;
        currentUser.role = data[0].role;
        if (!data[0].actif) { localStorage.removeItem(SKEY2); location.reload(); return; }
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    } catch(e) {}
    document.getElementById('loginOverlay').classList.add('hidden');
    initUI();
    loadArticles();
  }
}

document.getElementById('loginBtn').addEventListener('click', async function() {
  var u = document.getElementById('loginUser').value.trim().toLowerCase();
  var p = document.getElementById('loginPwd').value.trim();
  var err = document.getElementById('loginErr');
  if (!u || !p) { err.textContent = 'Remplis tous les champs.'; return; }
  var h = await hashStr(u + ':' + p);
  // Verifier D'ABORD dans la table utilisateurs
  try {
    var udata = await supa('GET', 'utilisateurs?login=eq.' + encodeURIComponent(u) + '&select=login,prenom,role,actif,password_hash');
    if (udata && udata.length) {
      var dbUser = udata[0];
      if (dbUser.password_hash !== h) { err.textContent = 'Mot de passe incorrect.'; document.getElementById('loginPwd').value = ''; return; }
      if (!dbUser.actif) { err.textContent = 'Compte desactive.'; return; }
      currentUser = {login:dbUser.login, prenom:dbUser.prenom, role:dbUser.role, token:h};
      if (ATOKENS.indexOf(h) < 0) ATOKENS.push(h);
      localStorage.setItem(SKEY2, h);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      document.getElementById('loginOverlay').classList.add('hidden');
      initUI();
      loadArticles();
      return;
    }
  } catch(e) { console.error('Erreur login table:', e); }
  // Fallback: verifier ATOKENS (Djulien et magasin2k par defaut)
  if (ATOKENS.indexOf(h) >= 0) {
    currentUser = h === ADMIN_TOKEN ? 
      {login:'Djulien', prenom:'Djulien', role:'admin', token:h} :
      {login:'magasin2k', prenom:'Magasin', role:'magasinier', token:h};
    localStorage.setItem(SKEY2, h);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('loginOverlay').classList.add('hidden');
    initUI();
    loadArticles();
  }
  else { err.textContent = 'Identifiants incorrects.'; document.getElementById('loginPwd').value = ''; }
});

document.getElementById('loginPwd').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem(SKEY2); localStorage.removeItem('currentUser'); currentUser = {login:'',prenom:'',role:'user',token:''}; location.reload(); });

// ── MOT DE PASSE OUBLIE ──
document.getElementById('forgotLink').addEventListener('click', function() {
  var panel = document.getElementById('resetPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  document.getElementById('resetErr').textContent = '';
  document.getElementById('resetLogin').value = '';
});

document.getElementById('resetBtn').addEventListener('click', async function() {
  var login = document.getElementById('resetLogin').value.trim().toLowerCase();
  var err = document.getElementById('resetErr');
  if (!login) { err.textContent = 'Saisis ton login.'; return; }
  // Verifier que le login existe
  try {
    var udata = await supa('GET', 'utilisateurs?login=eq.' + encodeURIComponent(login) + '&select=login,actif');
    if (!udata || !udata.length) { err.textContent = 'Login inconnu.'; return; }
    if (!udata[0].actif) { err.textContent = 'Compte desactive.'; return; }
    // Verifier pas de demande deja en attente
    var existing = await supa('GET', 'demandes_reset?login=eq.' + encodeURIComponent(login) + '&traitee=eq.false&select=id');
    if (existing && existing.length) { err.textContent = 'Demande deja envoyee, patiente.'; return; }
    // Creer la demande
    await supa('POST', 'demandes_reset', [{login:login, traitee:false}]);
    err.style.color = '#2ecc71';
    err.textContent = 'Demande envoyee ! L\'admin va te recontacter.';
    document.getElementById('resetLogin').value = '';
    setTimeout(function() { err.textContent = ''; err.style.color = '#e74c3c'; document.getElementById('resetPanel').style.display = 'none'; }, 3000);
  } catch(e) { err.textContent = 'Erreur, reessaie.'; console.error(e); }
});

async function loadArticles() {
  showLoading(true, 'Chargement...');
  try {
    var all = [], page = 0;
    while (true) {
      var data = await supa('GET', 'articles?select=*&order=nom.asc&limit=1000&offset=' + (page * 1000));
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      page++;
    }
    articles = all;
    document.getElementById('totalCount').textContent = articles.length;
    await loadSorties();
    buildPills(); doSearch();
    updateBadgeAttente();
  } catch(e) { console.error('Erreur:', e); showToast('Erreur connexion', 'err'); }
  finally { showLoading(false); }
}

function initUI() {
  var role = currentUser.role;
  
  // Onglet Admin - admin seulement
  var t4 = document.getElementById('t4');
  if (t4) { t4.style.display = role === 'admin' ? 'flex' : 'none'; t4.style.justifyContent = 'center'; t4.style.alignItems = 'center'; }
  
  // Onglet Ajouter - admin + magasinier
  var t2 = document.getElementById('t2');
  if (t2) { t2.style.display = (role === 'admin' || role === 'magasinier') ? 'flex' : 'none'; t2.style.justifyContent = 'center'; t2.style.alignItems = 'center'; }
  
  // Boutons Modifier/Supprimer - caches pour agent
  window._canEdit = (role === 'admin' || role === 'magasinier');

  // Bouton son - visible pour magasinier et admin
  var btnSound = document.getElementById('btnSound');
  if (btnSound) {
    if (role === 'admin' || role === 'magasinier') {
      btnSound.style.display = 'flex';
      btnSound.textContent = _soundEnabled ? '🔔' : '🔕';
      btnSound.title = _soundEnabled ? 'Son activé — cliquer pour couper' : 'Son coupé — cliquer pour activer';
      btnSound.style.color = _soundEnabled ? 'var(--ac)' : 'var(--mu)';
    } else {
      btnSound.style.display = 'none';
    }
  }
  // Onglet Ajouter outillage
  var ot2 = document.getElementById('ot2');
  if (ot2) ot2.style.display = window._canEdit ? '' : 'none';
  if (agentField) agentField.classList.toggle('hidden', role !== 'agent');

  // Historique bons - cache pour agent
  var histoSection = document.getElementById('histoSection');
  if (histoSection) histoSection.style.display = (role === 'agent') ? 'none' : 'block';

  // Prenom dans le header
  var userInfo = document.getElementById('userInfo');
  if (userInfo) {
    var badge = role === 'admin' ? '👑' : (role === 'magasinier' ? '🔧' : '👷');
    userInfo.textContent = badge + ' ' + currentUser.prenom;
  }
}

function getCats() { var c = {}; for (var i = 0; i < articles.length; i++) { var x = articles[i].categorie || ''; if (x) c[x] = true; } return Object.keys(c).sort(); }

function buildPills() {
  _cats = ['TOUT'].concat(getCats());
  var h = '';
  for (var i = 0; i < _cats.length; i++) h += '<div class="pill' + (_cats[i] === selectedCat ? ' active' : '') + '" data-i="' + i + '">' + esc(_cats[i]) + '</div>';
  document.getElementById('catsScroll').innerHTML = h;
  document.querySelectorAll('.pill').forEach(function(el) { el.addEventListener('click', function() { selectedCat = _cats[parseInt(this.getAttribute('data-i'))]; displayCount = 30; expandedNum = null; buildPills(); doSearch(); }); });
}

function showCatSugg(inputId, suggId) {
  var val = document.getElementById(inputId).value.trim().toLowerCase();
  var matches = getCats().filter(function(c) { return !val || c.toLowerCase().indexOf(val) >= 0; });
  var sugg = document.getElementById(suggId);
  if (!matches.length) { sugg.innerHTML = ''; return; }
  sugg.innerHTML = matches.map(function(c) { return '<div class="cat-sugg-item" data-val="' + esc(c) + '" data-input="' + inputId + '" data-sugg="' + suggId + '">' + esc(c) + '</div>'; }).join('');
  sugg.querySelectorAll('.cat-sugg-item').forEach(function(el) { el.addEventListener('mousedown', function() { document.getElementById(this.getAttribute('data-input')).value = this.getAttribute('data-val'); document.getElementById(this.getAttribute('data-sugg')).innerHTML = ''; }); });
}

['addCat','editCat'].forEach(function(id) {
  var sugg = id === 'addCat' ? 'addCatSugg' : 'editCatSugg';
  document.getElementById(id).addEventListener('input', function() { showCatSugg(id, sugg); });
  document.getElementById(id).addEventListener('focus', function() { showCatSugg(id, sugg); });
  document.getElementById(id).addEventListener('blur', function() { setTimeout(function() { document.getElementById(sugg).innerHTML = ''; }, 200); });
});

document.getElementById('si').addEventListener('input', function() { displayCount = 30; expandedNum = null; doSearch(); var clr = document.getElementById('clearSearch'); if (clr) clr.style.display = this.value ? 'block' : 'none'; });
document.getElementById('clearSearch') && document.getElementById('clearSearch').addEventListener('click', function() { document.getElementById('si').value = ''; this.style.display = 'none'; displayCount = 30; expandedNum = null; doSearch(); });

async function loadSorties() {
  try {
    var data = await supa('GET', 'bons_commande?select=articles&statut=eq.valide');
    _sortiesCount = {};
    if (data) {
      for (var i = 0; i < data.length; i++) {
        var arts = data[i].articles || [];
        for (var j = 0; j < arts.length; j++) {
          var n = arts[j].num;
          _sortiesCount[n] = (_sortiesCount[n] || 0) + 1;
        }
      }
    }
  } catch(e) { _sortiesCount = {}; }
}

function normalize(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function doSearch() {
  var q = normalize(document.getElementById('si').value.trim());
  filtered = [];
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    if (selectedCat !== 'TOUT' && a.categorie !== selectedCat) continue;
    if (q && (normalize(a.nom) + '|' + normalize(a.num) + '|' + normalize(a.tags) + '|' + normalize(a.location)).indexOf(q) < 0) continue;
    filtered.push(a);
  }
  if (Object.keys(_sortiesCount).length > 0) {
    filtered.sort(function(a, b) { return (_sortiesCount[b.num]||0) - (_sortiesCount[a.num]||0); });
  }
  document.getElementById('rc').textContent = (q || selectedCat !== 'TOUT') ? (filtered.length + ' resultat(s)') : (articles.length + ' articles au total');
  renderList(q);
}

function hl(txt, q) {
  if (!q || !txt) return esc(txt || '');
  var out = '', t = normalize(txt), i = 0;
  while (i < txt.length) { var j = t.indexOf(q, i); if (j < 0) { out += esc(txt.slice(i)); break; } out += esc(txt.slice(i,j)) + '<span class="hl">' + esc(txt.slice(j, j+q.length)) + '</span>'; i = j + q.length; }
  return out;
}

function renderList(q) {
  var con = document.getElementById('res'), lm = document.getElementById('lm');
  if (!filtered.length) { con.innerHTML = '<div class="empty"><div class="ei">?</div>Aucun article.</div>'; lm.style.display = 'none'; return; }
  var h = '', n = Math.min(filtered.length, displayCount);
  for (var i = 0; i < n; i++) {
    var a = filtered[i], exp = (expandedNum === a.num) ? ' exp' : '';
    var loc = a.location ? esc(a.location) : '<span class="nl">Non renseigne</span>';
        var cleanTags = (a.tags||'').split(',').map(function(t){return t.trim();}).filter(function(t){return t && t.indexOf('bus ')<0 && t.indexOf('produit chimique')<0 && t.indexOf('piece interne')<0;}).join(', ');
    var trow = cleanTags ? '<div class="dp"><div class="dl">Mots-cles</div><div class="dv">' + esc(cleanTags) + '</div></div>' : '';
    var npfrow = (a.npf && window._canEdit) ? '<div class="dp"><div class="dl">NPF</div><div class="dv">' + esc(a.npf) + '</div></div>' : '';
    var fourrow = (a.fournisseur && window._canEdit) ? '<div class="dp"><div class="dl">Fournisseur</div><div class="dv">' + esc(a.fournisseur) + '</div></div>' : '';
    var minmax = (window._canEdit && (a.min || a.max)) ? '<div class="dp"><div class="dl">Min/Max</div><div class="dv">' + (a.min||0) + '/' + (a.max||0) + '</div></div>' : '';
    var internerow = a.interne ? '<div class="dp"><div class="dl">Type</div><div class="dv" style="color:#9b59b6;font-weight:600;">&#x1F527; Interne</div></div>' : '';
    var busrow = '';
    if (a.bus_art || a.bus_std || a.chimique) {
      busrow = '<div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
      if (a.bus_std) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(46,204,113,0.1);border:1px solid #2ecc71;border-radius:6px;padding:3px 8px;"><svg width=\"28\" height=\"14\" viewBox=\"0 0 60 28\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"2\" y=\"2\" width=\"52\" height=\"18\" rx=\"4\" fill=\"#2ecc71\" opacity=\"0.2\" stroke=\"#2ecc71\" stroke-width=\"2\"/><rect x=\"6\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><rect x=\"16\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><rect x=\"26\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><circle cx=\"12\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#2ecc71\" stroke-width=\"2\"/><circle cx=\"44\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#2ecc71\" stroke-width=\"2\"/></svg><span style="color:#2ecc71;font-size:11px;font-weight:600;">STD</span></div>';
      if (a.bus_art) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(240,165,0,0.1);border:1px solid #f0a500;border-radius:6px;padding:3px 8px;"><svg width=\"42\" height=\"14\" viewBox=\"0 0 90 28\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"2\" y=\"2\" width=\"38\" height=\"18\" rx=\"4\" fill=\"#f0a500\" opacity=\"0.2\" stroke=\"#f0a500\" stroke-width=\"2\"/><rect x=\"40\" y=\"6\" width=\"6\" height=\"10\" rx=\"1\" fill=\"#f0a500\" opacity=\"0.4\"/><line x1=\"41\" y1=\"6\" x2=\"41\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><line x1=\"43\" y1=\"6\" x2=\"43\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><line x1=\"45\" y1=\"6\" x2=\"45\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><rect x=\"46\" y=\"2\" width=\"38\" height=\"18\" rx=\"4\" fill=\"#f0a500\" opacity=\"0.2\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"34\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"56\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"78\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/></svg><span style="color:#f0a500;font-size:11px;font-weight:600;">ART</span></div>';
      if (a.chimique) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(231,76,60,0.1);border:1px solid #e74c3c;border-radius:6px;padding:3px 8px;"><span style="font-size:12px;">&#x2697;</span><span style="color:#e74c3c;font-size:11px;font-weight:600;">Chimique</span></div>';
      busrow += '</div>';
    }
    var minmax = (a.min || a.max) ? '<div class="dp"><div class="dl">Min/Max</div><div class="dv">' + (a.min||0) + '/' + (a.max||0) + '</div></div>' : '';
    var photoRow = '';
    if (a.photo) {
      var photos = a.photo.split(',').filter(function(u){return u.trim();});
      if (photos.length === 1) {
        photoRow = '<div style="width:100%;margin-top:6px"><img src="' + photos[0] + '" class="photo-preview" data-num="' + esc(a.num) + '"/></div>';
      } else if (photos.length > 1) {
        photoRow = '<div style="width:100%;margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">';
        for (var pi = 0; pi < photos.length; pi++) {
          photoRow += '<img src="' + photos[pi] + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--br);cursor:pointer;background:#fff;" onclick="event.stopPropagation();document.getElementById(&quot;photoFull&quot;).src=this.src;document.getElementById(&quot;photoOverlay&quot;).classList.remove(&quot;hidden&quot;)"/>';
        }
        photoRow += '</div>';
      }
    }
    var snum = esc(a.num);
    var editBtns = window._canEdit ? '<div class="cbtns"><div class="bedit" data-num="' + snum + '">Modifier</div><div class="bdel" data-num="' + snum + '">Supprimer</div></div>' : '';
    h += '<div class="card' + exp + '" data-num="' + snum + '"><div class="ct"><div><div class="cn">' + hl(a.nom,q) + '</div><div class="cc">' + esc(a.categorie||'') + '</div></div><div class="cnum">' + hl(a.num,q) + '</div></div><div class="det"><div class="dp"><div class="dl">N SAP</div><div class="dv">' + snum + '</div></div><div class="dp"><div class="dl">Categorie</div><div class="dv">' + esc(a.categorie||'--') + '</div></div><div class="dp"><div class="dl">Emplacement</div><div class="dv">' + loc + '</div></div>' + minmax + trow + npfrow + fourrow + internerow + busrow + photoRow + editBtns + '<div class="btn-panier" data-num="' + snum + '">Ajouter au panier</div></div></div>';
  }
  con.innerHTML = h;
  con.querySelectorAll('.card').forEach(function(el) { el.addEventListener('click', function(e) { if (e.target.classList.contains('bedit')||e.target.classList.contains('bdel')||e.target.classList.contains('btn-panier')||e.target.classList.contains('photo-preview')) return; var n = this.getAttribute('data-num'); expandedNum = (expandedNum === n) ? null : n; renderList(document.getElementById('si').value.trim().toLowerCase()); }); });
  con.querySelectorAll('.bedit').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); openEdit(this.getAttribute('data-num')); }); });
  con.querySelectorAll('.bdel').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); delArticle(this.getAttribute('data-num')); }); });
  con.querySelectorAll('.btn-panier').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); ajouterPanier(this.getAttribute('data-num')); }); });
  con.querySelectorAll('.photo-preview').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('photoFull').src = this.src; document.getElementById('photoOverlay').classList.remove('hidden'); }); });
  if (filtered.length > displayCount) { lm.style.display = 'block'; lm.textContent = 'Afficher plus (' + (filtered.length - displayCount) + ' restants)'; } else lm.style.display = 'none';
}

document.getElementById('lm').addEventListener('click', function() { displayCount += 30; renderList(document.getElementById('si').value.trim().toLowerCase()); });
document.getElementById('photoCloseBtn').addEventListener('click', function() { document.getElementById('photoOverlay').classList.add('hidden'); });

document.getElementById('addBtn').addEventListener('click', async function() {
  var num = document.getElementById('addNum').value.trim(), nom = document.getElementById('addNom').value.trim();
  if (!num || !nom) { showToast('Numero et designation obligatoires', 'err'); return; }
  for (var i = 0; i < articles.length; i++) { if (articles[i].num === num) { showToast('Article deja existant', 'err'); return; } }
  var busStd = document.getElementById('addBusStd').checked;
  var busArt = document.getElementById('addBusArt').checked;
  var chimique = document.getElementById('addChimique').checked;
  var reparable = document.getElementById('addReparable').checked;
  var npf = document.getElementById('addNpf').value.trim();
  var fournisseur = document.getElementById('addFournisseur').value.trim();
  var a = {num:num,nom:nom,categorie:document.getElementById('addCat').value.trim(),tags:document.getElementById('addTags').value.trim(),location:document.getElementById('addLoc').value.trim(),min:parseInt(document.getElementById('addMin').value)||0,max:parseInt(document.getElementById('addMax').value)||0,photo:null,npf:npf,fournisseur:fournisseur,bus_std:busStd,bus_art:busArt,chimique:chimique,reparable:reparable,interne:false,stock_securite:0};
  try { await supa('POST', 'articles', [a]); articles.push(a); ['addNum','addNom','addCat','addTags','addLoc','addMin','addMax','addNpf','addFournisseur'].forEach(function(id) { document.getElementById(id).value = ''; });
  setBusBtn('addBusStd','addBusStdBtn',false);
  setBusBtn('addBusArt','addBusArtBtn',false);
  setBusBtn('addChimique','addChimiqueBtn',false);
  setBusBtn('addReparable','addReparableBtn',false); document.getElementById('totalCount').textContent = articles.length; showToast('Article enregistre!', 'success'); buildPills(); switchTab('search'); doSearch(); } catch(e) { showToast('Erreur sauvegarde', 'err'); console.error(e); }
});

async function delArticle(num) {
  if (!confirm('Supprimer?')) return;
  try { await supa('DELETE', 'articles?num=eq.' + encodeURIComponent(num)); articles = articles.filter(function(a) { return a.num !== num; }); expandedNum = null; document.getElementById('totalCount').textContent = articles.length; buildPills(); doSearch(); showToast('Supprime', 'success'); } catch(e) { showToast('Erreur', 'err'); console.error(e); }
}

function openEdit(num) {
  for (var i = 0; i < articles.length; i++) {
    if (articles[i].num === num) {
      var a = articles[i]; editingNum = num;
      document.getElementById('editNum').value = a.num;
      document.getElementById('editNom').value = a.nom;
      document.getElementById('editCat').value = a.categorie||'';
      var cleanEditTags = (a.tags||'').split(',').map(function(t){return t.trim();}).filter(function(t){return t && t.indexOf('bus ')< 0 && t.indexOf('produit chimique')<0 && t.indexOf('piece interne')<0;}).join(', ');
      document.getElementById('editTags').value = cleanEditTags;
      document.getElementById('editLoc').value = a.location||'';
      document.getElementById('editMin').value = a.min||0;
      document.getElementById('editMax').value = a.max||0;
      if(document.getElementById('editNpf')) document.getElementById('editNpf').value = a.npf||'';
      if(document.getElementById('editFournisseur')) document.getElementById('editFournisseur').value = a.fournisseur||'';
      setBusBtn('editBusStd','editBusStdBtn',a.bus_std||false);
      setBusBtn('editBusArt','editBusArtBtn',a.bus_art||false);
      setBusBtn('editChimique','editChimiqueBtn',a.chimique||false);
      setBusBtn('editReparable','editReparableBtn',a.reparable||false);
      _editPhotos = a.photo ? a.photo.split(',').filter(function(u){return u.trim();}) : [];
      _editPhoto = a.photo || null;
      document.getElementById('editPhotoPreview').style.display = 'none';
      renderEditPhotos();
      document.getElementById('mo').classList.remove('hidden'); return;
    }
  }
}

document.getElementById('cancelEditBtn').addEventListener('click', function() { document.getElementById('mo').classList.add('hidden'); editingNum = null; });
document.getElementById('saveEditBtn').addEventListener('click', async function() {
  if (!editingNum) return;
  var newNum = document.getElementById('editNum').value.trim(), nom = document.getElementById('editNom').value.trim();
  if (!nom) { showToast('Designation obligatoire', 'err'); return; }
  var updated = {num:newNum,nom:nom,categorie:document.getElementById('editCat').value.trim(),tags:document.getElementById('editTags').value.trim(),location:document.getElementById('editLoc').value.trim(),min:parseInt(document.getElementById('editMin').value)||0,max:parseInt(document.getElementById('editMax').value)||0,photo:_editPhoto||null,npf:document.getElementById('editNpf').value.trim(),fournisseur:document.getElementById('editFournisseur').value.trim(),bus_std:document.getElementById('editBusStd').checked,bus_art:document.getElementById('editBusArt').checked,chimique:document.getElementById('editChimique').checked,reparable:document.getElementById('editReparable').checked,interne:false,stock_securite:0};
  try {
    if (newNum !== editingNum) { await supa('DELETE', 'articles?num=eq.' + encodeURIComponent(editingNum)); await supa('POST', 'articles', [updated]); }
    else { await supa('PATCH', 'articles?num=eq.' + encodeURIComponent(editingNum), updated); }
    for (var i = 0; i < articles.length; i++) { if (articles[i].num === editingNum) { articles[i] = updated; break; } }
    document.getElementById('mo').classList.add('hidden'); editingNum = null; buildPills(); doSearch(); showToast('Modifie!', 'success');
  } catch(e) { showToast('Erreur', 'err'); console.error(e); }
});

document.getElementById('editPhotoBtn').addEventListener('click', function() { document.getElementById('editPhotoInput').click(); });
document.getElementById('editPhotoInput').addEventListener('change', async function(event) {
  var file = event.target.files[0]; if (!file) return;
  if (!editingNum) { showToast('Erreur: pas d article selectionne', 'err'); return; }
  showToast('Upload en cours...', 'success');
  try {
    // Compresser l image
    var compressed = await compressImage(file);
    // Generer un nom unique
    var ext = file.name.split('.').pop() || 'jpg';
    var timestamp = Date.now();
    var path = editingNum + '/' + timestamp + '.' + ext;
    // Uploader dans Supabase Storage
    var res = await fetch(SURL + '/storage/v1/object/photos-articles/' + path, {
      method: 'POST',
      headers: { 'apikey': SKEY, 'Authorization': 'Bearer ' + SKEY, 'Content-Type': compressed.type || 'image/jpeg' },
      body: compressed
    });
    if (!res.ok) throw new Error('Upload failed');
    var url = SURL + '/storage/v1/object/public/photos-articles/' + path;
    // Ajouter a la liste des photos
    if (!_editPhotos) _editPhotos = [];
    _editPhotos.push(url);
    _editPhoto = _editPhotos.join(',');
    renderEditPhotos();
    showToast('Photo ajoutee!', 'success');
  } catch(e) { showToast('Erreur upload photo', 'err'); console.error(e); }
  document.getElementById('editPhotoInput').value = '';
});
document.getElementById('editPhotoRemove').addEventListener('click', function() { _editPhoto = null; _editPhotos = []; document.getElementById('editPhotoPreview').src = ''; document.getElementById('editPhotoPreview').style.display = 'none'; document.getElementById('editPhotoRemove').style.display = 'none'; document.getElementById('editPhotoInput').value = ''; });

async function compressImage(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var ms = 1200, w = img.width, h = img.height;
        if (w > ms) { h = h*ms/w; w = ms; }
        if (h > ms) { w = w*ms/h; h = ms; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderEditPhotos() {
  var container = document.getElementById('editPhotoContainer');
  if (!container) return;
  container.innerHTML = '';
  if (!_editPhotos || !_editPhotos.length) {
    document.getElementById('editPhotoRemove').style.display = 'none';
    return;
  }
  document.getElementById('editPhotoRemove').style.display = 'block';
  for (var i = 0; i < _editPhotos.length; i++) {
    var url = _editPhotos[i];
    var div = document.createElement('div');
    div.style.cssText = 'position:relative;display:inline-block;margin:4px;';
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--br);cursor:pointer;';
    img.onclick = (function(u) { return function() { document.getElementById('photoFull').src = u; document.getElementById('photoOverlay').classList.remove('hidden'); }; })(url);
    var del = document.createElement('div');
    del.style.cssText = 'position:absolute;top:-4px;right:-4px;background:var(--rd);color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:bold;';
    del.textContent = 'x';
    del.onclick = (function(idx) { return function() { _editPhotos.splice(idx,1); _editPhoto = _editPhotos.join(','); renderEditPhotos(); }; })(i);
    div.appendChild(img); div.appendChild(del);
    container.appendChild(div);
  }
}

function ajouterPanier(num) {
  var a = articles.filter(function(x) { return x.num === num; })[0]; if (!a) return;
  var ex = panier.filter(function(x) { return x.num === num; })[0];
  if (ex) { ex.qty++; showToast('Quantite mise a jour!', 'success'); } else { panier.push({num:a.num,nom:a.nom,location:a.location||'',qty:1,reparable:a.reparable||false,interne:a.interne||false}); showToast('Ajoute au panier!', 'success'); }
  updateBadge();
}

function toggleBon(el) {
  var detail = el.parentElement.querySelector('.bon-detail');
  var arrow = el.querySelector('div[style*="font-size:18px"]');
  if (detail.style.display === 'none') {
    detail.style.display = 'block';
    if (arrow) arrow.textContent = '▲';
  } else {
    detail.style.display = 'none';
    if (arrow) arrow.textContent = '▼';
  }
}

function updateBadge() { var badge = document.getElementById('panierBadge'), total = panier.reduce(function(s,x) { return s+x.qty; }, 0); if (total > 0) { badge.style.display = 'flex'; badge.textContent = total; } else badge.style.display = 'none'; }

function renderPanier() {
  var list = document.getElementById('panierList');
  if (!panier.length) { list.innerHTML = '<div class="panier-empty"><div class="ei">?</div>Panier vide</div>'; return; }
  var h = '';
  for (var i = 0; i < panier.length; i++) { var p = panier[i]; h += '<div class="panier-item"><div class="panier-item-info"><div class="panier-item-num" style="font-size:22px">' + esc(p.num) + '</div><div class="panier-item-nom">' + esc(p.nom) + '</div>' + (p.location ? '<div class="panier-item-loc">' + esc(p.location) + '</div>' : '') + '</div><div class="panier-qty"><div class="qty-btn" data-i="' + i + '" data-d="-1">-</div><div class="qty-val">' + p.qty + '</div><div class="qty-btn" data-i="' + i + '" data-d="1">+</div></div><div class="panier-remove" data-i="' + i + '">X</div></div>'; }
  list.innerHTML = h;
  list.querySelectorAll('.qty-btn').forEach(function(el) { el.addEventListener('click', function() { var i = parseInt(this.getAttribute('data-i')), d = parseInt(this.getAttribute('data-d')); panier[i].qty += d; if (panier[i].qty <= 0) panier.splice(i,1); updateBadge(); renderPanier(); }); });
  list.querySelectorAll('.panier-remove').forEach(function(el) { el.addEventListener('click', function() { panier.splice(parseInt(this.getAttribute('data-i')),1); updateBadge(); renderPanier(); }); });
}

document.getElementById('viderBtn').addEventListener('click', function() { if (!confirm('Vider?')) return; panier = []; updateBadge(); renderPanier(); });
document.getElementById('validerBtn').addEventListener('click', async function() {
  var num = document.getElementById('numeroOrdre').value.trim();
  if (!num) { showToast('Saisis un numero ordre', 'err'); return; }
  if (!/^\d{8}$/.test(num)) { showToast('Le numero ordre doit avoir 8 chiffres', 'err'); return; }
  if (!panier.length) { showToast('Panier vide', 'err'); return; }
  var numAgent = '';
  if (currentUser.role === 'agent') {
    numAgent = document.getElementById('numeroAgent').value.trim();
    if (!numAgent) { showToast('Saisis ton numero d\'agent', 'err'); return; }
  }
  try { await supa('POST', 'bons_commande', [{numero_ordre:num,statut:'valide',articles:panier,login:currentUser.login||'',numero_agent:numAgent||null}]);
    var nbArts = panier.length;
    var totalQty = panier.reduce(function(s,x){return s+x.qty;},0);
    panier = []; document.getElementById('numeroOrdre').value = '';
    if (currentUser.role === 'agent') document.getElementById('numeroAgent').value = '';
    updateBadge(); renderPanier(); loadHistorique();
    if (currentUser.role === 'agent') {
      showConfirmAgent(num, nbArts, totalQty);
    } else {
      showToast('Bon sauvegarde!', 'success');
    }
  } catch(e) { showToast('Erreur', 'err'); console.error(e); }
});

function showConfirmAgent(ordre, nbArts, totalQty) {
  var el = document.getElementById('confirmAgent');
  if (!el) {
    el = document.createElement('div');
    el.id = 'confirmAgent';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,17,23,0.92);display:flex;align-items:center;justify-content:center;z-index:800;padding:24px;';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="background:#1a1d27;border:2px solid #2ecc71;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;">'
    + '<div style="font-size:48px;margin-bottom:12px;">✅</div>'
    + '<div style="font-size:20px;font-weight:700;color:#2ecc71;margin-bottom:8px;">Commande envoyée !</div>'
    + '<div style="font-size:14px;color:#e8eaf0;margin-bottom:6px;">Le magasin a bien reçu ta demande.</div>'
    + '<div style="font-size:13px;color:#7a8099;margin-bottom:20px;">Ordre <strong style="color:#f0a500;">' + esc(ordre) + '</strong> · ' + nbArts + ' article(s) · ' + totalQty + ' pièce(s)</div>'
    + '<div style="font-size:12px;color:#7a8099;margin-bottom:20px;">Un magasinier va préparer ta commande. Merci !</div>'
    + '<div onclick="document.getElementById(\'confirmAgent\').style.display=\'none\'" style="background:#2ecc71;color:#111;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;">OK</div>'
    + '</div>';
  el.style.display = 'flex';
}

var _histoFiltre = 'today';

async function loadHistorique() {
  try {
    var data = await supa('GET', 'bons_commande?select=*&order=date_creation.desc&limit=200');
    var list = document.getElementById('historiqueList');

    // Heure belge = UTC+2 (heure d'été)
    var OFFSET = 2 * 60 * 60 * 1000;

    // Date du jour en heure belge (yyyy-mm-dd)
    function dateBelge(ts) {
      var d = new Date(ts + OFFSET);
      return d.toISOString().slice(0, 10); // "2026-05-03"
    }

    var maintenant = Date.now();
    var aujourdhui = dateBelge(maintenant);

    // Lundi de la semaine en cours
    var nowBelge = new Date(maintenant + OFFSET);
    var jourSemaine = nowBelge.getUTCDay(); // 0=dim
    var offsetLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
    var lundiTs = maintenant + offsetLundi * 86400000;
    var lundi = dateBelge(lundiTs);

    var filtered = (data || []).filter(function(b) {
      var dateBon = dateBelge(new Date(b.date_creation).getTime());
      if (_histoFiltre === 'today') return dateBon === aujourdhui;
      if (_histoFiltre === 'week')  return dateBon >= lundi;
      return true;
    });

    // Onglets filtre
    var tabs = '<div style="display:flex;gap:6px;margin-bottom:12px;">'
      + ['today','week','all'].map(function(f, i) {
          var label = f === 'today' ? "Aujourd'hui" : f === 'week' ? 'Cette semaine' : 'Tout';
          var active = _histoFiltre === f;
          return '<div class="histo-tab" data-f="' + f + '" style="flex:1;text-align:center;padding:8px 6px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid ' + (active ? 'var(--ac)' : 'var(--br)') + ';color:' + (active ? 'var(--ac)' : 'var(--mu)') + ';background:' + (active ? 'rgba(240,165,0,0.08)' : 'var(--sf)') + ';">' + label + '</div>';
        }).join('')
      + '</div>';

    if (!filtered.length) {
      list.innerHTML = tabs + '<div class="panier-empty" style="padding:20px">Aucun bon</div>';
      list.querySelectorAll('.histo-tab').forEach(function(el) { el.addEventListener('click', function() { _histoFiltre = this.getAttribute('data-f'); loadHistorique(); }); });
      return;
    }

    var h = tabs;
    for (var i = 0; i < filtered.length; i++) {
      var b = filtered[i], arts = b.articles||[];
      var dt = new Date(b.date_creation);
      // Forcer heure belge : UTC+2 (heure d'ete) = +120 minutes
      var dtBrussels = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
      var dateStr = dtBrussels.toLocaleDateString('fr-FR') + ' ' + dtBrussels.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
      var sapDone = b.sap_effectue || false;

      var detailRows = '';
      for (var j = 0; j < arts.length; j++) {
        var art = arts[j];
        detailRows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--br);">'
          + '<div><div style="font-size:16px;font-weight:700;color:var(--ac);">' + esc(art.num) + (art.reparable ? ' <span style="font-size:12px;background:rgba(155,89,182,0.15);border:1px solid #9b59b6;border-radius:4px;padding:1px 6px;color:#9b59b6;vertical-align:middle;">🔧 Réparable</span>' : '') + '</div>'
          + '<div style="font-size:14px;font-weight:500;color:var(--tx);margin-top:2px;">' + esc(art.nom) + '</div>'
          + (art.location ? '<div style="font-size:13px;color:var(--mu);margin-top:2px;">📍 ' + esc(art.location) + '</div>' : '')
          + '</div>'
          + '<div style="font-size:16px;font-weight:700;color:var(--gn);background:rgba(46,204,113,0.1);border:1px solid var(--gn);border-radius:6px;padding:4px 10px;">x' + art.qty + '</div>'
          + '</div>';
      }

      h += '<div class="histo-item" style="' + (sapDone ? 'opacity:0.6;' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:start;cursor:pointer;" onclick="toggleBon(this)">'
          + '<div>'
            + '<div class="histo-num">Ordre ' + esc(b.numero_ordre) + '</div>'
            + '<div class="histo-date">' + dateStr + '</div>'
            + (b.login ? '<div style="font-size:11px;color:var(--ac);margin-top:2px;">👤 ' + esc(b.login) + '</div>' : '')
            + (b.numero_agent ? '<div style="font-size:11px;color:var(--gn);margin-top:2px;">🪪 Agent: ' + esc(b.numero_agent) + '</div>' : '')
            + '<div class="histo-count">' + arts.length + ' article(s)</div>'
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">'
            + '<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:' + (sapDone ? 'var(--gn)' : 'var(--mu)') + ';cursor:pointer;white-space:nowrap;" onclick="event.stopPropagation()">'
              + '<input type="checkbox" class="chk-sap" data-id="' + b.id + '" ' + (sapDone ? 'checked' : '') + ' style="width:15px;height:15px;accent-color:var(--gn);cursor:pointer;"/>'
              + 'SAP fait'
            + '</label>'
            + '<div style="color:var(--mu);font-size:18px;">▼</div>'
            + '<div class="btn-copy-sap" data-id="' + b.id + '" style="background:rgba(46,204,113,0.15);border:1px solid var(--gn);color:var(--gn);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;">📋 Copier</div>'
            + '<div class="btn-dl" data-id="' + b.id + '">Excel</div>'
            + '<div class="btn-del-bon" data-id="' + b.id + '" data-sap="' + (sapDone ? 'true' : 'false') + '" style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Supprimer</div>'
          + '</div>'
        + '</div>'
        + '<div class="bon-detail" style="display:none;margin-top:8px;border-top:1px solid var(--br);border-radius:0 0 8px 8px;overflow:hidden;">'
          + detailRows
        + '</div>'
      + '</div>';
    }

    list.innerHTML = h;
    list.querySelectorAll('.histo-tab').forEach(function(el) { el.addEventListener('click', function() { _histoFiltre = this.getAttribute('data-f'); loadHistorique(); }); });
    list.querySelectorAll('.btn-dl').forEach(function(el) { el.addEventListener('click', function() { exportBon(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.btn-del-bon').forEach(function(el) {
      el.addEventListener('click', async function() {
        var id = this.getAttribute('data-id');
        var sapFait = this.getAttribute('data-sap') === 'true';
        var msg = sapFait ? 'Supprimer ce bon?' : '⚠️ Ce bon n\'a pas encore été sorti sur SAP !\nSupprimer quand même ?';
        if (!confirm(msg)) return;
        try {
          await supa('DELETE', 'bons_commande?id=eq.' + id);
          showToast('Bon supprime!', 'success');
          loadHistorique();
          updateBadgeAttente();
        } catch(e) { showToast('Erreur', 'err'); console.error(e); }
      });
    });
    list.querySelectorAll('.btn-copy-sap').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); copySAP(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.chk-sap').forEach(function(el) { el.addEventListener('change', async function() { var id = this.getAttribute('data-id'), val = this.checked; try { await supa('PATCH', 'bons_commande?id=eq.' + id, {sap_effectue:val}); showToast(val ? 'SAP marque fait ✓' : 'SAP marque non fait', 'success'); loadHistorique(); updateBadgeAttente(); } catch(e) { showToast('Erreur', 'err'); } }); });
  } catch(e) { console.error(e); }
}

function buildSapText(numeroOrdre, arts) {
  var lines = [];
  for (var i = 0; i < arts.length; i++) {
    var a = arts[i];
    if (a.interne) continue;  // articles internes exclus du format SAP
    lines.push(a.num + '\t' + a.qty + '\t' + '\t' + '2K' + '\t' + '\t' + numeroOrdre + '\t' + '10');
  }
  return esc(lines.join('\n'));
}

async function copySAP(id) {
  try {
    var data = await supa('GET', 'bons_commande?id=eq.' + id + '&select=*');
    if (!data || !data.length) return;
    var bon = data[0], arts = bon.articles||[];
    var lines = [];
    for (var i = 0; i < arts.length; i++) {
      var a = arts[i];
      if (a.interne) continue;  // articles internes exclus de la copie SAP
      lines.push(a.num + '\t' + a.qty + '\t' + '\t' + '2K' + '\t' + '\t' + bon.numero_ordre + '\t' + '10');
    }
    var txt = lines.join('\n');
    // Methode moderne (HTTPS requis - GitHub Pages OK)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(txt);
      showToast('Copie! Colle dans SAP', 'success');
    } else {
      // Fallback ancien
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copie! Colle dans SAP', 'success');
    }
  } catch(e) { showToast('Erreur copie', 'err'); console.error(e); }
}

async function exportBon(id) {
  try {
    var data = await supa('GET', 'bons_commande?id=eq.' + id + '&select=*');
    if (!data || !data.length) return;
    var bon = data[0], arts = bon.articles||[], nl = '\n', sep = ';';
    var csv = '\ufeff;article;quantite;;magasin;;ordre;op' + nl;
    for (var i = 0; i < arts.length; i++) {
      var a = arts[i];
      csv += ';' + a.num + ';' + a.qty + ';;2K;;' + bon.numero_ordre + ';10' + nl;
    }
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'bon_' + bon.numero_ordre + '.csv'; link.click(); URL.revokeObjectURL(url);
    showToast('Export OK!', 'success');
  } catch(e) { showToast('Erreur export', 'err'); console.error(e); }
}

document.getElementById('t1').addEventListener('click', function() { switchTab('search'); });
document.getElementById('t2').addEventListener('click', function() { switchTab('add'); });
document.getElementById('t3').addEventListener('click', function() { switchTab('panier'); });
if (document.getElementById('t4')) document.getElementById('t4').addEventListener('click', function() { switchTab('admin'); });

function switchTab(tab) {
  ['t1','t2','t3','t4'].forEach(function(id,i) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('active', tab === ['search','add','panier','admin'][i]);
  });
  document.getElementById('p1').style.display = tab === 'search' ? 'block' : 'none';
  document.getElementById('p2').style.display = tab === 'add' ? 'block' : 'none';
  document.getElementById('p3').style.display = tab === 'panier' ? 'block' : 'none';
  var p4 = document.getElementById('p4');
  if (p4) p4.style.display = tab === 'admin' ? 'block' : 'none';
  if (tab === 'panier') { renderPanier(); if (currentUser.role !== 'agent') loadHistorique(); }
  if (tab === 'admin' && currentUser.role === 'admin') { loadAdminPage(); }
}


function toggleBusBtn(checkId, btnId, color) {
  var cb = document.getElementById(checkId);
  var btn = document.getElementById(btnId);
  var checkSpan = document.getElementById(checkId + 'Check');
  cb.checked = !cb.checked;
  if (cb.checked) {
    btn.style.opacity = '1';
    btn.style.boxShadow = '0 0 8px ' + color + '66';
    if (checkSpan) checkSpan.style.display = 'block';
  } else {
    btn.style.opacity = '0.7';
    btn.style.boxShadow = 'none';
    if (checkSpan) checkSpan.style.display = 'none';
  }
}

function setBusBtn(checkId, btnId, checked) {
  var cb = document.getElementById(checkId);
  var btn = document.getElementById(btnId);
  var checkSpan = document.getElementById(checkId + 'Check');
  if (!cb || !btn) return;
  cb.checked = checked;
  if (checked) {
    btn.style.opacity = '1';
    btn.style.boxShadow = 'none';
    if (checkSpan) checkSpan.style.display = 'block';
  } else {
    btn.style.opacity = '0.7';
    btn.style.boxShadow = 'none';
    if (checkSpan) checkSpan.style.display = 'none';
  }
}


// ── REALTIME SUPABASE ──
var _lastBonId = null;
var _lastBonCreatedAt = null;
var _pollingInterval = null;
var _notifCooldown = false;

function initRealtime() {
  // Mémoriser le dernier bon ET sa date au démarrage
  supa('GET', 'bons_commande?select=id,date_creation&order=date_creation.desc&limit=1')
    .then(function(data) {
      if (data && data.length) {
        _lastBonId = data[0].id;
        _lastBonCreatedAt = data[0].date_creation;
      }
    }).catch(function() {});

  try {
    var ws = new WebSocket(
      SURL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SKEY + '&vsn=1.0.0'
    );
    ws.onopen = function() {
      ws.send(JSON.stringify({ topic: 'realtime:public:bons_commande', event: 'phx_join', payload: {}, ref: '1' }));
      ws.send(JSON.stringify({ topic: 'realtime:public:articles', event: 'phx_join', payload: {}, ref: '2' }));
    };
    ws.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.event === 'phx_reply') return;
        if (msg.topic && msg.topic.indexOf('bons_commande') >= 0) {
          if (document.getElementById('p3') && document.getElementById('p3').style.display !== 'none') {
            loadHistorique();
          }
          updateBadgeAttente();
        }
        if (msg.topic && msg.topic.indexOf('articles') >= 0) { loadArticlesSilent(); }
      } catch(err) {}
    };
    ws.onclose = function() { setTimeout(initRealtime, 3000); };
    ws.onerror = function() { ws.close(); };
  } catch(e) {}

  if (_pollingInterval) clearInterval(_pollingInterval);
  _pollingInterval = setInterval(async function() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'magasinier') return;
    try {
      var data = await supa('GET', 'bons_commande?select=id,login,numero_agent,numero_ordre,articles,date_creation&order=date_creation.desc&limit=1');
      if (data && data.length) {
        var latest = data[0];
        // Nouveau bon = ID différent ET date plus récente que le dernier connu
        // La date plus récente évite de notifier quand on supprime un bon
        // et que l'ancien remonte en premier
        var isNewer = _lastBonCreatedAt === null || latest.date_creation > _lastBonCreatedAt;
        if (_lastBonId !== null && latest.id !== _lastBonId && isNewer) {
          _lastBonId = latest.id;
          _lastBonCreatedAt = latest.date_creation;
          onNouveauBon(latest);
        } else {
          if (_lastBonId === null) {
            _lastBonId = latest.id;
            _lastBonCreatedAt = latest.date_creation;
          }
          updateBadgeAttente();
        }
      } else {
        updateBadgeAttente();
      }
    } catch(e) {}
  }, 12000);
}

function onNouveauBon(record) {
  if (currentUser.role !== 'admin' && currentUser.role !== 'magasinier') return;
  // Ignorer si on n'a pas les vraies données (record fantôme du WebSocket)
  if (!record || !record.id || !record.numero_ordre) return;
  // Ne pas notifier si c'est soi-même qui a créé le bon
  if (record.login && record.login === currentUser.login) {
    updateBadgeAttente();
    if (document.getElementById('p3') && document.getElementById('p3').style.display !== 'none') {
      loadHistorique();
    }
    return;
  }
  // Anti-doublon — ignorer si déjà notifié dans les 5 dernières secondes
  if (_notifCooldown) return;
  _notifCooldown = true;
  setTimeout(function() { _notifCooldown = false; }, 5000);

  if (document.getElementById('p3') && document.getElementById('p3').style.display !== 'none') {
    loadHistorique();
  }
  playDing();
  showNotifCommande(record);
  updateBadgeAttente();
}

async function loadArticlesSilent() {
  try {
    var all = [], page = 0;
    while (true) {
      var data = await supa('GET', 'articles?select=*&order=nom.asc&limit=1000&offset=' + (page * 1000));
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      page++;
    }
    if (all.length > 0) {
      articles = all;
      document.getElementById('totalCount').textContent = articles.length;
      buildPills();
      doSearch();
    }
  } catch(e) {}
}


// ── PAGE ADMIN ──
async function loadAdminPage() {
  await loadDemandes();
  await loadUtilisateurs();
  await loadHistoriqueActions();
}

async function loadDemandes() {
  try {
    var data = await supa('GET', 'demandes_reset?traitee=eq.false&order=created_at.asc&select=*');
    var section = document.getElementById('resetDemandesSection');
    var badge = document.getElementById('badgeDemandes');
    var list = document.getElementById('demandesList');
    if (!data || !data.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    badge.style.display = 'inline-flex';
    badge.textContent = data.length;
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var date = new Date(d.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
        + '<div>'
          + '<div style="font-size:15px;font-weight:700;color:var(--tx);">👤 ' + esc(d.login) + '</div>'
          + '<div style="font-size:11px;color:var(--mu);margin-top:2px;">Demande le ' + date + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;align-items:center;">'
          + '<div style="background:rgba(46,204,113,0.1);border:1px solid var(--gn);color:var(--gn);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:600;" onclick="ouvrirResetModal(\'' + esc(d.id) + '\',\'' + esc(d.login) + '\')">🔑 Reinit</div>'
          + '<div style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" onclick="ignorerDemande(\'' + esc(d.id) + '\')">Ignorer</div>'
        + '</div>'
      + '</div>';
    }
    list.innerHTML = h;
  } catch(e) { console.error(e); }
}

function ouvrirResetModal(id, login) {
  document.getElementById('resetUserId').value = id;
  document.getElementById('resetUserLogin').value = login;
  document.getElementById('resetUserLoginLabel').textContent = login;
  document.getElementById('resetNouveauPwd').value = '';
  document.getElementById('resetPwdErr').textContent = '';
  document.getElementById('resetPwdModal').classList.remove('hidden');
}

async function ignorerDemande(id) {
  try {
    await supa('PATCH', 'demandes_reset?id=eq.' + id, {traitee:true});
    loadDemandes();
  } catch(e) { showToast('Erreur', 'err'); }
}

async function validerResetPwd() {
  var id = document.getElementById('resetUserId').value;
  var login = document.getElementById('resetUserLogin').value;
  var pwd = document.getElementById('resetNouveauPwd').value.trim();
  var err = document.getElementById('resetPwdErr');
  if (!pwd || pwd.length < 4) { err.textContent = 'Mot de passe trop court (min 4 caracteres).'; return; }
  var hash = await hashStr(login + ':' + pwd);
  try {
    await supa('PATCH', 'utilisateurs?login=eq.' + encodeURIComponent(login), {password_hash:hash});
    await supa('PATCH', 'demandes_reset?id=eq.' + id, {traitee:true});
    ATOKENS.push(hash);
    document.getElementById('resetPwdModal').classList.add('hidden');
    showToast('Mot de passe reinitialise pour ' + login + '!', 'success');
    logAction('Reset mot de passe: ' + login);
    loadDemandes();
    loadUtilisateurs();
  } catch(e) { err.textContent = 'Erreur, reessaie.'; console.error(e); }
}

function fermerResetModal() {
  document.getElementById('resetPwdModal').classList.add('hidden');
}

async function loadUtilisateurs() {
  try {
    var data = await supa('GET', 'utilisateurs?select=*&order=prenom.asc');
    var list = document.getElementById('usersList');
    if (!data || !data.length) {
      list.innerHTML = '<div style="color:var(--mu);padding:20px;text-align:center;">Aucun utilisateur</div>';
      return;
    }
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var u = data[i];
      h += '<div style="background:var(--cd);border:1px solid var(--br);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
        + '<div>'
          + '<div style="font-size:15px;font-weight:600;color:var(--tx);">' + esc(u.prenom) + '</div>'
          + '<div style="font-size:12px;color:var(--mu);">Login: ' + esc(u.login) + '</div>'
          + '<div style="font-size:11px;color:' + (u.role==='admin'?'var(--ac)':'var(--gn)') + ';margin-top:2px;">' + (u.role==='admin'?'👑 Admin':'👤 User') + (u.actif?'':' — Inactif') + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;">'
          + '<div style="background:rgba(240,165,0,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" data-id="' + u.id + '" onclick="editUser(this)">✏️</div>'
          + (u.login !== 'Djulien' ? '<div style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" data-id="' + u.id + '" onclick="deleteUser(this)">🗑</div>' : '')
        + '</div>'
      + '</div>';
    }
    list.innerHTML = h;
  } catch(e) { console.error(e); }
}

async function createUser() {
  var prenom = document.getElementById('newPrenom').value.trim();
  var login = document.getElementById('newLogin').value.trim().toLowerCase();
  var pwd = document.getElementById('newPwd').value.trim();
  var role = document.getElementById('newRole').value;
  if (!prenom || !login || !pwd) { showToast('Tous les champs sont obligatoires', 'err'); return; }
  if (pwd.length < 4) { showToast('Mot de passe trop court (min 4 caracteres)', 'err'); return; }
  
  var hash = await hashStr(login + ':' + pwd);
  try {
    await supa('POST', 'utilisateurs', [{prenom:prenom, login:login, password_hash:hash, role:role, actif:true}]);
    // Ajouter dans ATOKENS dynamiquement
    ATOKENS.push(hash);
    document.getElementById('newPrenom').value = '';
    document.getElementById('newLogin').value = '';
    document.getElementById('newPwd').value = '';
    showToast('Utilisateur cree!', 'success');
    loadUtilisateurs();
    logAction('Cree utilisateur: ' + login);
  } catch(e) { showToast('Erreur creation', 'err'); console.error(e); }
}

async function deleteUser(el) {
  var id = el.getAttribute('data-id');
  if (!confirm('Supprimer cet utilisateur?')) return;
  try {
    await supa('DELETE', 'utilisateurs?id=eq.' + id);
    showToast('Utilisateur supprime', 'success');
    loadUtilisateurs();
  } catch(e) { showToast('Erreur suppression', 'err'); }
}

async function editUser(el) {
  var id = el.getAttribute('data-id');
  try {
    var data = await supa('GET', 'utilisateurs?id=eq.' + id + '&select=*');
    if (!data || !data.length) return;
    var u = data[0];
    // Remplir le formulaire de modif
    document.getElementById('editUserId').value = u.id;
    document.getElementById('editUserPrenom').value = u.prenom;
    document.getElementById('editUserLogin').value = u.login;
    document.getElementById('editUserPwd').value = '';
    document.getElementById('editUserRole').value = u.role;
    document.getElementById('editUserActif').checked = u.actif;
    document.getElementById('editUserModal').classList.remove('hidden');
  } catch(e) { showToast('Erreur', 'err'); console.error(e); }
}

async function saveEditUser() {
  var id = document.getElementById('editUserId').value;
  var prenom = document.getElementById('editUserPrenom').value.trim();
  var login = document.getElementById('editUserLogin').value.trim().toLowerCase();
  var pwd = document.getElementById('editUserPwd').value.trim();
  var role = document.getElementById('editUserRole').value;
  var actif = document.getElementById('editUserActif').checked;
  
  if (!prenom || !login) { showToast('Prenom et login obligatoires', 'err'); return; }
  
  var updates = {prenom:prenom, login:login, role:role, actif:actif};
  
  if (pwd) {
    updates.password_hash = await hashStr(login + ':' + pwd);
    // Mettre a jour ATOKENS
    var oldData = await supa('GET', 'utilisateurs?id=eq.' + id + '&select=password_hash');
    if (oldData && oldData.length) {
      var oldHash = oldData[0].password_hash;
      var idx = ATOKENS.indexOf(oldHash);
      if (idx >= 0) ATOKENS[idx] = updates.password_hash;
      else ATOKENS.push(updates.password_hash);
    }
  }
  
  try {
    await supa('PATCH', 'utilisateurs?id=eq.' + id, updates);
    document.getElementById('editUserModal').classList.add('hidden');
    showToast('Utilisateur modifie!', 'success');
    logAction('Modifie utilisateur: ' + login);
    loadUtilisateurs();
  } catch(e) { showToast('Erreur modification', 'err'); console.error(e); }
}

function closeEditUser() {
  document.getElementById('editUserModal').classList.add('hidden');
}

async function loadHistoriqueActions() {
  try {
    var data = await supa('GET', 'historique_actions?select=*&order=created_at.desc&limit=50');
    var list = document.getElementById('actionsList');
    if (!data || !data.length) {
      list.innerHTML = '<div style="color:var(--mu);padding:20px;text-align:center;">Aucune action</div>';
      return;
    }
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var a = data[i];
      var date = new Date(a.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      h += '<div style="background:var(--cd);border:1px solid var(--br);border-radius:8px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'
        + '<div>'
          + '<div style="font-size:13px;font-weight:600;color:var(--ac);">' + esc(a.prenom) + '</div>'
          + '<div style="font-size:12px;color:var(--tx);">' + esc(a.action) + '</div>'
          + (a.details ? '<div style="font-size:11px;color:var(--mu);">' + esc(a.details) + '</div>' : '')
        + '</div>'
        + '<div style="font-size:11px;color:var(--mu);white-space:nowrap;">' + date + '</div>'
      + '</div>';
    }
    list.innerHTML = h;
  } catch(e) { console.error(e); }
}

async function logAction(action, details) {
  if (!currentUser.login) return;
  try {
    await supa('POST', 'historique_actions', [{
      login: currentUser.login,
      prenom: currentUser.prenom,
      action: action,
      details: details || ''
    }]);
  } catch(e) {}
}

// ── NOTIFICATIONS COMMANDES ──────────────────────────────────────
var _soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
var _audioCtx = null;

// Initialiser l'AudioContext au premier geste utilisateur
document.addEventListener('click', function initAudio() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(function() {});
  }
}, { once: false });

function playDing() {
  if (!_soundEnabled) return;
  try {
    if (!_audioCtx) return; // pas encore de geste utilisateur
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    var o = _audioCtx.createOscillator();
    var g = _audioCtx.createGain();
    o.connect(g); g.connect(_audioCtx.destination);
    o.frequency.setValueAtTime(880, _audioCtx.currentTime);
    o.frequency.setValueAtTime(1100, _audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, _audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.6);
    o.start(_audioCtx.currentTime);
    o.stop(_audioCtx.currentTime + 0.6);
  } catch(e) {}
}

function showNotifCommande(record) {
  var login = record ? (record.login || '?') : '?';
  var agent = record ? (record.numero_agent || '') : '';
  var ordre = record ? (record.numero_ordre || '?') : '?';
  var arts  = record && record.articles ? record.articles.length : '?';

  var el = document.getElementById('notifCommande');
  if (!el) {
    el = document.createElement('div');
    el.id = 'notifCommande';
    el.style.cssText = 'position:fixed;top:-120px;left:50%;transform:translateX(-50%);z-index:850;transition:top 0.4s cubic-bezier(0.34,1.56,0.64,1);width:calc(100% - 32px);max-width:420px;';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="background:#1a1d27;border:2px solid #f0a500;border-radius:14px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      + '<div>'
        + '<div style="font-size:13px;font-weight:700;color:#f0a500;margin-bottom:4px;">🔔 Nouvelle commande reçue !</div>'
        + '<div style="font-size:12px;color:#e8eaf0;">👤 ' + esc(login) + (agent ? ' · 🪪 Agent ' + esc(agent) : '') + '</div>'
        + '<div style="font-size:12px;color:#7a8099;margin-top:2px;">Ordre <strong style="color:#f0a500;">' + esc(ordre) + '</strong> · ' + arts + ' article(s)</div>'
      + '</div>'
      + '<div onclick="fermerNotif()" style="color:#7a8099;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;">✕</div>'
    + '</div>'
  + '</div>';
  el.style.top = '16px';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { fermerNotif(); }, 6000);
  updateBadgeAttente();
}

function fermerNotif() {
  var el = document.getElementById('notifCommande');
  if (el) el.style.top = '-120px';
}

async function updateBadgeAttente() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'magasinier') return;
  try {
    var data = await supa('GET', 'bons_commande?sap_effectue=eq.false&select=id');
    var nb = data ? data.length : 0;
    var badge = document.getElementById('badgeAttente');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'badgeAttente';
      badge.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:800;cursor:pointer;';
      badge.onclick = function() { switchTab('panier'); };
      document.body.appendChild(badge);
    }
    if (nb > 0) {
      badge.innerHTML = '<div style="background:#f0a500;color:#111;border-radius:14px;padding:10px 16px;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(240,165,0,0.4);display:flex;align-items:center;gap:8px;">'
        + '<span style="font-size:16px;">📋</span>'
        + nb + ' commande' + (nb > 1 ? 's' : '') + ' en attente SAP'
        + '</div>';
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) {}
}

function toggleSound() {
  _soundEnabled = !_soundEnabled;
  localStorage.setItem('soundEnabled', _soundEnabled ? 'true' : 'false');
  var btn = document.getElementById('btnSound');
  if (btn) {
    btn.textContent = _soundEnabled ? '🔔' : '🔕';
    btn.title = _soundEnabled ? 'Son activé — cliquer pour couper' : 'Son coupé — cliquer pour activer';
    btn.style.color = _soundEnabled ? 'var(--ac)' : 'var(--mu)';
  }
  showToast(_soundEnabled ? 'Son activé' : 'Son coupé', 'success');
}

// ── SECTION NAVIGATION ──────────────────────────────────────────
var _currentSection = 'pieces';

function switchSection(section) {
  _currentSection = section;
  var isPieces = section === 'pieces';
  document.getElementById('sectionPieces').style.display = isPieces ? '' : 'none';
  document.getElementById('sectionOutillage').style.display = isPieces ? 'none' : '';
  var navP = document.getElementById('navPieces');
  var navO = document.getElementById('navOutillage');
  navP.style.color = isPieces ? 'var(--ac)' : 'var(--mu)';
  navP.style.borderBottom = isPieces ? '3px solid var(--ac)' : '3px solid transparent';
  navO.style.color = isPieces ? 'var(--mu)' : 'var(--ac)';
  navO.style.borderBottom = isPieces ? '3px solid transparent' : '3px solid var(--ac)';
  if (!isPieces && outillage.length === 0) loadOutillage();
}

// ── OUTILLAGE ────────────────────────────────────────────────────
var outillage = [];
var _outilPhoto = null;
var _outilEditPhoto = null;

async function loadOutillage() {
  try {
    var data = await supa('GET', 'outillage?select=*&order=nom.asc');
    outillage = data || [];
    doOutilSearch();
    var tab2 = document.getElementById('ot2');
    if (tab2) tab2.style.display = window._canEdit ? '' : 'none';
  } catch(e) { showToast('Erreur chargement outillage', 'err'); }
}

function normalize(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

function doOutilSearch() {
  var q = normalize(document.getElementById('outilSearch').value.trim());
  var filtered = outillage.filter(function(o) {
    if (!q) return true;
    return (normalize(o.nom) + '|' + normalize(o.location||'') + '|' + normalize(o.tags||'')).indexOf(q) >= 0;
  });
  var count = document.getElementById('outilCount');
  if (count) count.textContent = filtered.length + ' outil(s)';
  var res = document.getElementById('outilRes');
  if (!res) return;
  if (!filtered.length) { res.innerHTML = '<div class="empty"><div class="ei">🔧</div>Aucun outil trouvé</div>'; return; }

  res.innerHTML = filtered.map(function(o) {
    var photoHtml = o.photo ? '<img src="' + esc(o.photo) + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:pointer;" onclick="openPhoto(\'' + esc(o.photo) + '\')">' : '';
    return '<div class="card" style="border-left:4px solid var(--ac);">'
      + '<div class="ct">'
        + '<div class="cnum" style="background:rgba(155,89,182,0.12);color:#9b59b6;border-color:#9b59b6;">🔧</div>'
        + '<div style="flex:1;min-width:0;">'
          + '<div class="cn">' + esc(o.nom) + '</div>'
          + (o.location ? '<div class="cc">📍 ' + esc(o.location) + '</div>' : '')
        + '</div>'
        + (window._canEdit ? '<div style="display:flex;gap:6px;">'
          + '<div onclick="openOutilEdit(\'' + o.id + '\')" style="background:rgba(240,165,0,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">✏️</div>'
          + '<div onclick="deleteOutil(\'' + o.id + '\')" style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">🗑</div>'
          + '</div>' : '')
      + '</div>'
      + photoHtml
      + '</div>';
  }).join('');
}

function switchOutilTab(id) {
  ['ot1','ot2'].forEach(function(t) {
    var el = document.getElementById(t);
    if (el) el.classList.toggle('active', t === id);
  });
  document.getElementById('op1').style.display = id === 'ot1' ? '' : 'none';
  document.getElementById('op2').style.display = id === 'ot2' ? '' : 'none';
}

// Ajouter outil
document.addEventListener('DOMContentLoaded', function() {
  // Navigation Pièces / Outillage
  var navP = document.getElementById('navPieces');
  var navO = document.getElementById('navOutillage');
  if (navP) navP.addEventListener('click', function() { switchSection('pieces'); });
  if (navO) navO.addEventListener('click', function() { switchSection('outillage'); });

  // Onglets outillage
  var ot1 = document.getElementById('ot1');
  var ot2 = document.getElementById('ot2');
  if (ot1) ot1.addEventListener('click', function() { switchOutilTab('ot1'); });
  if (ot2) ot2.addEventListener('click', function() { switchOutilTab('ot2'); });

  var addBtn = document.getElementById('outilAddBtn');
  if (addBtn) addBtn.addEventListener('click', async function() {
    var nom = (document.getElementById('outilNom').value||'').trim();
    if (!nom) { showToast('Désignation obligatoire', 'err'); return; }
    var loc = (document.getElementById('outilLoc').value||'').trim();
    var tags = (document.getElementById('outilTags').value||'').trim();
    var obj = { nom: nom, location: loc, tags: tags, photo: _outilPhoto || null };
    try {
      await supa('POST', 'outillage', [obj]);
      showToast('Outil enregistré!', 'success');
      document.getElementById('outilNom').value = '';
      document.getElementById('outilLoc').value = '';
      document.getElementById('outilTags').value = '';
      _outilPhoto = null;
      document.getElementById('outilPhotoContainer').innerHTML = '';
      loadOutillage();
      switchOutilTab('ot1');
    } catch(e) { showToast('Erreur', 'err'); }
  });

  // Photo ajout
  var photoInput = document.getElementById('outilPhotoInput');
  if (photoInput) photoInput.addEventListener('change', async function() {
    var file = this.files[0]; if (!file) return;
    var url = await uploadPhoto(file, 'outillage');
    if (url) {
      _outilPhoto = url;
      document.getElementById('outilPhotoContainer').innerHTML = '<img src="' + url + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">';
    }
  });

  // Photo edit
  var editPhotoInput = document.getElementById('outilEditPhotoInput');
  if (editPhotoInput) editPhotoInput.addEventListener('change', async function() {
    var file = this.files[0]; if (!file) return;
    var url = await uploadPhoto(file, 'outillage');
    if (url) {
      _outilEditPhoto = url;
      document.getElementById('outilEditPhotoContainer').innerHTML = '<img src="' + url + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">';
      document.getElementById('outilEditPhotoRemove').style.display = 'block';
    }
  });

  var removeBtn = document.getElementById('outilEditPhotoRemove');
  if (removeBtn) removeBtn.addEventListener('click', function() {
    _outilEditPhoto = null;
    document.getElementById('outilEditPhotoContainer').innerHTML = '';
    this.style.display = 'none';
  });

  // Sauvegarder edit
  var saveBtn = document.getElementById('outilEditSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async function() {
    var id = document.getElementById('outilEditId').value;
    var nom = (document.getElementById('outilEditNom').value||'').trim();
    if (!nom) { showToast('Désignation obligatoire', 'err'); return; }
    var obj = {
      nom: nom,
      location: (document.getElementById('outilEditLoc').value||'').trim(),
      tags: (document.getElementById('outilEditTags').value||'').trim(),
      photo: _outilEditPhoto
    };
    try {
      await supa('PATCH', 'outillage?id=eq.' + id, obj);
      showToast('Outil modifié!', 'success');
      closeOutilEdit();
      loadOutillage();
    } catch(e) { showToast('Erreur', 'err'); }
  });
});

async function uploadPhoto(file, bucket) {
  try {
    var ext = file.name.split('.').pop();
    var path = Date.now() + '.' + ext;
    var resp = await fetch(SURL + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SKEY, 'Content-Type': file.type },
      body: file
    });
    if (!resp.ok) throw new Error();
    return SURL + '/storage/v1/object/public/' + bucket + '/' + path;
  } catch(e) { showToast('Erreur upload photo', 'err'); return null; }
}

function openOutilEdit(id) {
  var o = outillage.filter(function(x) { return x.id === id; })[0];
  if (!o) return;
  document.getElementById('outilEditId').value = o.id;
  document.getElementById('outilEditNom').value = o.nom || '';
  document.getElementById('outilEditLoc').value = o.location || '';
  document.getElementById('outilEditTags').value = o.tags || '';
  _outilEditPhoto = o.photo || null;
  var container = document.getElementById('outilEditPhotoContainer');
  container.innerHTML = o.photo ? '<img src="' + esc(o.photo) + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">' : '';
  document.getElementById('outilEditPhotoRemove').style.display = o.photo ? 'block' : 'none';
  document.getElementById('outilEditModal').classList.remove('hidden');
}

function closeOutilEdit() {
  document.getElementById('outilEditModal').classList.add('hidden');
}

async function deleteOutil(id) {
  if (!confirm('Supprimer cet outil ?')) return;
  try {
    await supa('DELETE', 'outillage?id=eq.' + id);
    showToast('Outil supprimé', 'success');
    loadOutillage();
  } catch(e) { showToast('Erreur', 'err'); }
}

initRealtime();
checkAuth();
