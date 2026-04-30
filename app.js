var SURL = 'https://gyflqtysqpywikxgzxci.supabase.co';
var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5ZmxxdHlzcXB5d2lreGd6eGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxOTQsImV4cCI6MjA5Mjc1MjE5NH0.OUjtRRrKIHqLeWFiw1-CEZS3AAJrMTAeiQ8dNd21IP8';
var ATOKENS = ['a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0','35a85085a9ccd1440acb20cca15b78b0353f4f354bfcf8dd5d2f3d36734ca7be'];
var ADMIN_TOKEN = 'a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0';
var currentUser = {login:'', prenom:'', role:'user', token:''};
var SKEY2 = 'bus-auth-v1';
var articles = [], selectedCat = 'TOUT', editingNum = null, filtered = [], displayCount = 30, expandedNum = null, panier = [], _editPhoto = null, _cats = [];

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
    buildPills(); doSearch();
  } catch(e) { console.error('Erreur:', e); showToast('Erreur connexion', 'err'); }
  finally { showLoading(false); }
}

function initUI() {
  var role = currentUser.role;
  
  // Onglet Admin - admin seulement
  var t4 = document.getElementById('t4');
  if (t4) t4.style.display = role === 'admin' ? 'flex' : 'none';
  
  // Onglet Ajouter - admin + magasinier
  var t2 = document.getElementById('t2');
  if (t2) t2.style.display = (role === 'admin' || role === 'magasinier') ? 'flex' : 'none';
  
  // Boutons Modifier/Supprimer - caches pour agent
  window._canEdit = (role === 'admin' || role === 'magasinier');
  
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

function doSearch() {
  var q = document.getElementById('si').value.trim().toLowerCase();
  filtered = [];
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    if (selectedCat !== 'TOUT' && a.categorie !== selectedCat) continue;
    if (q && ((a.nom||'').toLowerCase() + '|' + (a.num||'').toLowerCase() + '|' + (a.tags||'').toLowerCase() + '|' + (a.location||'').toLowerCase()).indexOf(q) < 0) continue;
    filtered.push(a);
  }
  document.getElementById('rc').textContent = (q || selectedCat !== 'TOUT') ? (filtered.length + ' resultat(s)') : (articles.length + ' articles au total');
  renderList(q);
}

function hl(txt, q) {
  if (!q || !txt) return esc(txt || '');
  var out = '', t = txt.toLowerCase(), i = 0;
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
    var npfrow = a.npf ? '<div class="dp"><div class="dl">NPF</div><div class="dv">' + esc(a.npf) + '</div></div>' : '';
    var fourrow = a.fournisseur ? '<div class="dp"><div class="dl">Fournisseur</div><div class="dv">' + esc(a.fournisseur) + '</div></div>' : '';
    var busrow = '';
    if (a.bus_art || a.bus_std || a.chimique || a.interne) {
      busrow = '<div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
      if (a.bus_std) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(46,204,113,0.1);border:1px solid #2ecc71;border-radius:6px;padding:3px 8px;"><svg width=\"28\" height=\"14\" viewBox=\"0 0 60 28\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"2\" y=\"2\" width=\"52\" height=\"18\" rx=\"4\" fill=\"#2ecc71\" opacity=\"0.2\" stroke=\"#2ecc71\" stroke-width=\"2\"/><rect x=\"6\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><rect x=\"16\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><rect x=\"26\" y=\"6\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2ecc71\" opacity=\"0.6\"/><circle cx=\"12\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#2ecc71\" stroke-width=\"2\"/><circle cx=\"44\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#2ecc71\" stroke-width=\"2\"/></svg><span style="color:#2ecc71;font-size:11px;font-weight:600;">STD</span></div>';
      if (a.bus_art) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(240,165,0,0.1);border:1px solid #f0a500;border-radius:6px;padding:3px 8px;"><svg width=\"42\" height=\"14\" viewBox=\"0 0 90 28\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"2\" y=\"2\" width=\"38\" height=\"18\" rx=\"4\" fill=\"#f0a500\" opacity=\"0.2\" stroke=\"#f0a500\" stroke-width=\"2\"/><rect x=\"40\" y=\"6\" width=\"6\" height=\"10\" rx=\"1\" fill=\"#f0a500\" opacity=\"0.4\"/><line x1=\"41\" y1=\"6\" x2=\"41\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><line x1=\"43\" y1=\"6\" x2=\"43\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><line x1=\"45\" y1=\"6\" x2=\"45\" y2=\"16\" stroke=\"#f0a500\" stroke-width=\"1\"/><rect x=\"46\" y=\"2\" width=\"38\" height=\"18\" rx=\"4\" fill=\"#f0a500\" opacity=\"0.2\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"34\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"56\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/><circle cx=\"78\" cy=\"24\" r=\"3\" fill=\"none\" stroke=\"#f0a500\" stroke-width=\"2\"/></svg><span style="color:#f0a500;font-size:11px;font-weight:600;">ART</span></div>';
      if (a.chimique) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(231,76,60,0.1);border:1px solid #e74c3c;border-radius:6px;padding:3px 8px;"><span style="font-size:12px;">&#x2697;</span><span style="color:#e74c3c;font-size:11px;font-weight:600;">Chimique</span></div>';
      if (a.interne) busrow += '<div style="display:flex;align-items:center;gap:4px;background:rgba(155,89,182,0.1);border:1px solid #9b59b6;border-radius:6px;padding:3px 8px;"><span style="font-size:12px;">&#x1F527;</span><span style="color:#9b59b6;font-size:11px;font-weight:600;">Interne</span></div>';
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
    h += '<div class="card' + exp + '" data-num="' + snum + '"><div class="ct"><div><div class="cn">' + hl(a.nom,q) + '</div><div class="cc">' + esc(a.categorie||'') + '</div></div><div class="cnum">' + hl(a.num,q) + '</div></div><div class="det"><div class="dp"><div class="dl">N SAP</div><div class="dv">' + snum + '</div></div><div class="dp"><div class="dl">Categorie</div><div class="dv">' + esc(a.categorie||'--') + '</div></div><div class="dp"><div class="dl">Emplacement</div><div class="dv">' + loc + '</div></div>' + minmax + trow + npfrow + fourrow + busrow + photoRow + '+ (window._canEdit ? '<div class="cbtns"><div class="bedit" data-num="' + snum + '">Modifier</div><div class="bdel" data-num="' + snum + '">Supprimer</div></div>' : '') + '<div class="btn-panier" data-num="' + snum + '">Ajouter au panier</div></div></div>';
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
  var npf = document.getElementById('addNpf').value.trim();
  var a = {num:num,nom:nom,categorie:document.getElementById('addCat').value.trim(),tags:document.getElementById('addTags').value.trim(),location:document.getElementById('addLoc').value.trim(),min:parseInt(document.getElementById('addMin').value)||0,max:parseInt(document.getElementById('addMax').value)||0,photo:null,npf:npf,bus_std:busStd,bus_art:busArt,chimique:chimique,interne:false,npf:'',stock_securite:0};
  try { await supa('POST', 'articles', [a]); articles.push(a); ['addNum','addNom','addCat','addTags','addLoc','addMin','addMax','addNpf'].forEach(function(id) { document.getElementById(id).value = ''; });
  setBusBtn('addBusStd','addBusStdBtn',false);
  setBusBtn('addBusArt','addBusArtBtn',false);
  setBusBtn('addChimique','addChimiqueBtn',false); document.getElementById('totalCount').textContent = articles.length; showToast('Article enregistre!', 'success'); buildPills(); switchTab('search'); doSearch(); } catch(e) { showToast('Erreur sauvegarde', 'err'); console.error(e); }
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
      setBusBtn('editBusStd','editBusStdBtn',a.bus_std||false);
      setBusBtn('editBusArt','editBusArtBtn',a.bus_art||false);
      setBusBtn('editChimique','editChimiqueBtn',a.chimique||false);
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
  var updated = {num:newNum,nom:nom,categorie:document.getElementById('editCat').value.trim(),tags:document.getElementById('editTags').value.trim(),location:document.getElementById('editLoc').value.trim(),min:parseInt(document.getElementById('editMin').value)||0,max:parseInt(document.getElementById('editMax').value)||0,photo:_editPhoto||null,npf:document.getElementById('editNpf').value.trim(),bus_std:document.getElementById('editBusStd').checked,bus_art:document.getElementById('editBusArt').checked,chimique:document.getElementById('editChimique').checked,interne:false,stock_securite:0};
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
  if (ex) { ex.qty++; showToast('Quantite mise a jour!', 'success'); } else { panier.push({num:a.num,nom:a.nom,location:a.location||'',qty:1}); showToast('Ajoute au panier!', 'success'); }
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
  try { await supa('POST', 'bons_commande', [{numero_ordre:num,statut:'valide',articles:panier,login:currentUser.login||''}]); showToast('Bon sauvegarde!', 'success'); panier = []; document.getElementById('numeroOrdre').value = ''; updateBadge(); renderPanier(); loadHistorique(); } catch(e) { showToast('Erreur', 'err'); console.error(e); }
});

async function loadHistorique() {
  try {
    var data = await supa('GET', 'bons_commande?select=*&order=date_creation.desc&limit=20');
    var list = document.getElementById('historiqueList');
    if (!data || !data.length) { list.innerHTML = '<div class="panier-empty" style="padding:20px">Aucun bon</div>'; return; }
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var b = data[i], arts = b.articles||[], date = new Date(b.date_creation).toLocaleDateString('fr-FR');
      var detailRows = '';
      for (var j = 0; j < arts.length; j++) {
        var art = arts[j];
        detailRows += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--br);">'
          + '<div><div style="font-size:16px;font-weight:700;color:var(--ac);">' + esc(art.num) + '</div>'
          + '<div style="font-size:14px;font-weight:500;color:var(--tx);margin-top:2px;">' + esc(art.nom) + '</div>'
          + (art.location ? '<div style="font-size:13px;color:var(--mu);margin-top:2px;">📍 ' + esc(art.location) + '</div>' : '')
          + '</div>'
          + '<div style="font-size:16px;font-weight:700;color:var(--gn);background:rgba(46,204,113,0.1);border:1px solid var(--gn);border-radius:6px;padding:4px 10px;">x' + art.qty + '</div>'
          + '</div>';
      }
      h += '<div class="histo-item">'
        + '<div style="display:flex;justify-content:space-between;align-items:start;cursor:pointer;" onclick="toggleBon(this)">'
          + '<div>'
            + '<div class="histo-num">Ordre ' + esc(b.numero_ordre) + '</div>'
            + '<div class="histo-date">' + date + '</div>'
            + (b.login ? '<div style="font-size:11px;color:var(--ac);margin-top:2px;">👤 ' + esc(b.login) + '</div>' : '')
            + '<div class="histo-count">' + arts.length + ' article(s)</div>'
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:center">'
            + '<div style="color:var(--mu);font-size:18px;">▼</div>'
            + '<div class="btn-dl" data-id="' + b.id + '">Excel</div>'
            + '<div class="btn-del-bon" data-id="' + b.id + '" style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Supprimer</div>'
          + '</div>'
        + '</div>'
        + '<div class="bon-detail" style="display:none;margin-top:8px;border-top:1px solid var(--br);border-radius:0 0 8px 8px;overflow:hidden;">'
          + detailRows
        + '</div>'
      + '</div>';
    }
    list.innerHTML = h;
    list.querySelectorAll('.btn-dl').forEach(function(el) { el.addEventListener('click', function() { exportBon(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.btn-del-bon').forEach(function(el) { el.addEventListener('click', async function() { if (!confirm('Supprimer ce bon?')) return; try { await supa('DELETE', 'bons_commande?id=eq.' + this.getAttribute('data-id')); showToast('Bon supprime!', 'success'); loadHistorique(); } catch(e) { showToast('Erreur', 'err'); console.error(e); } }); });
  } catch(e) { console.error(e); }
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
  if (tab === 'panier') { renderPanier(); loadHistorique(); }
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
function initRealtime() {
  try {
    var ws = new WebSocket(
      SURL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SKEY + '&vsn=1.0.0'
    );

    ws.onopen = function() {
      // S'abonner aux changements de la table bons_commande
      ws.send(JSON.stringify({
        topic: 'realtime:public:bons_commande',
        event: 'phx_join',
        payload: {},
        ref: '1'
      }));
      // S'abonner aux changements des articles
      ws.send(JSON.stringify({
        topic: 'realtime:public:articles',
        event: 'phx_join',
        payload: {},
        ref: '2'
      }));
    };

    ws.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.event === 'phx_reply') return;
        if (msg.topic && msg.topic.indexOf('bons_commande') >= 0) {
          // Nouveau bon de commande ou modification
          if (document.getElementById('p3').style.display !== 'none') {
            loadHistorique();
          }
        }
        if (msg.topic && msg.topic.indexOf('articles') >= 0) {
          // Article modifie - recharger silencieusement
          loadArticlesSilent();
        }
      } catch(err) {}
    };

    ws.onclose = function() {
      // Reconnexion automatique apres 3 secondes
      setTimeout(initRealtime, 3000);
    };

    ws.onerror = function() {
      ws.close();
    };
  } catch(e) {
    console.log('Realtime non disponible');
  }
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
  await loadUtilisateurs();
  await loadHistoriqueActions();
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

initRealtime();
checkAuth();
