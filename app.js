var SURL = 'https://gyflqtysqpywikxgzxci.supabase.co';
var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5ZmxxdHlzcXB5d2lreGd6eGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzYxOTQsImV4cCI6MjA5Mjc1MjE5NH0.OUjtRRrKIHqLeWFiw1-CEZS3AAJrMTAeiQ8dNd21IP8';
var ATOKENS = ['a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0','35a85085a9ccd1440acb20cca15b78b0353f4f354bfcf8dd5d2f3d36734ca7be'];
var ADMIN_TOKEN = 'a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0';
var currentUser = {login:'',prenom:'',role:'user',token:''};
var SKEY2 = 'bus-auth-v1';
var articles = [], selectedCat = 'TOUT', editingNum = null, filtered = [], displayCount = 30, panier = [];
var _editPhoto = null, _editPhotos = [], _sortiesCount = {};

// ── ICÔNES PAR CATÉGORIE ──
var CAT_ICONS = {
  'MOTEUR':'⚙','FREINAGE':'⬤','AEROSOL':'▲','AÉROSOL':'▲','ELECTRIQUE':'⚡','ÉLECTRIQUE':'⚡',
  'SUSPENSION':'◉','CARROSSERIE':'◻','FILTRES':'▣','FILTRE':'▣','HUILES':'◈','HUILE':'◈',
  'JOINTS':'◯','JOINT':'◯','ECLAIRAGE':'✦','ÉCLAIRAGE':'✦','DEFAULT':'◆'
};
function getCatIcon(cat) {
  if (!cat) return CAT_ICONS['DEFAULT'];
  var u = cat.toUpperCase();
  for (var k in CAT_ICONS) { if (u.indexOf(k) >= 0) return CAT_ICONS[k]; }
  return CAT_ICONS['DEFAULT'];
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function supa(method, path, body) {
  var opts = {method:method, headers:{'apikey':SKEY,'Authorization':'Bearer '+SKEY,'Content-Type':'application/json','Prefer':method==='POST'?'resolution=merge-duplicates':''}};
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(SURL+'/rest/v1/'+path, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    if (r.status === 204 || r.headers.get('content-length') === '0') return null;
    return r.text().then(function(t) { if (!t||!t.trim()) return null; try { return JSON.parse(t); } catch(e) { return null; } });
  });
}

async function hashStr(s) {
  var enc = new TextEncoder().encode(s);
  var buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
}

function showLoading(show, msg) {
  var el = document.getElementById('loadingOverlay');
  if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
  if (msg) document.getElementById('loadingText').textContent = msg;
}

function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+type+' show';
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ── AUTH ──
async function checkAuth() {
  var stored = localStorage.getItem(SKEY2);
  if (ATOKENS.indexOf(stored) >= 0) {
    var cu = localStorage.getItem('currentUser');
    if (cu) { try { currentUser = JSON.parse(cu); } catch(e) {} }
    if (!currentUser.login) {
      currentUser = stored === ADMIN_TOKEN ?
        {login:'Djulien',prenom:'Djulien',role:'admin',token:stored} :
        {login:'magasin2k',prenom:'Magasin',role:'magasinier',token:stored};
    }
    try {
      var data = await supa('GET','utilisateurs?login=eq.'+encodeURIComponent(currentUser.login)+'&select=prenom,role,actif,peut_modifier');
      if (data && data.length) {
        currentUser.prenom = data[0].prenom;
        currentUser.role = data[0].role;
        currentUser.peut_modifier = data[0].peut_modifier !== false;
        if (!data[0].actif) { localStorage.removeItem(SKEY2); location.reload(); return; }
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    } catch(e) {}
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');
    initUI();
    loadArticles();
  }
}

document.getElementById('loginBtn').addEventListener('click', async function() {
  var u = document.getElementById('loginUser').value.trim().toLowerCase();
  var p = document.getElementById('loginPwd').value.trim();
  var err = document.getElementById('loginErr');
  if (!u||!p) { err.textContent='Remplis tous les champs.'; return; }
  var h = await hashStr(u+':'+p);
  try {
    var udata = await supa('GET','utilisateurs?login=eq.'+encodeURIComponent(u)+'&select=login,prenom,role,actif,password_hash,peut_modifier');
    if (udata && udata.length) {
      var dbUser = udata[0];
      if (dbUser.password_hash !== h) { err.textContent='Mot de passe incorrect.'; document.getElementById('loginPwd').value=''; return; }
      if (!dbUser.actif) { err.textContent='Compte désactivé.'; return; }
      currentUser = {login:dbUser.login,prenom:dbUser.prenom,role:dbUser.role,token:h,peut_modifier:dbUser.peut_modifier!==false};
      if (ATOKENS.indexOf(h)<0) ATOKENS.push(h);
      localStorage.setItem(SKEY2,h); localStorage.setItem('currentUser',JSON.stringify(currentUser));
      document.getElementById('loginOverlay').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('hidden');
      initUI(); loadArticles(); return;
    }
  } catch(e) { console.error(e); }
  if (ATOKENS.indexOf(h)>=0) {
    currentUser = h===ADMIN_TOKEN ? {login:'Djulien',prenom:'Djulien',role:'admin',token:h} : {login:'magasin2k',prenom:'Magasin',role:'magasinier',token:h};
    localStorage.setItem(SKEY2,h); localStorage.setItem('currentUser',JSON.stringify(currentUser));
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');
    initUI(); loadArticles();
  } else { err.textContent='Identifiants incorrects.'; document.getElementById('loginPwd').value=''; }
});

document.getElementById('loginPwd').addEventListener('keydown', function(e) { if (e.key==='Enter') document.getElementById('loginBtn').click(); });
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem(SKEY2); localStorage.removeItem('currentUser'); location.reload(); });

// MOT DE PASSE OUBLIÉ
document.getElementById('forgotLink').addEventListener('click', function() {
  var p = document.getElementById('resetPanel');
  p.style.display = p.style.display==='none'?'block':'none';
  document.getElementById('resetErr').textContent=''; document.getElementById('resetLogin').value='';
});
document.getElementById('resetBtn').addEventListener('click', async function() {
  var login = document.getElementById('resetLogin').value.trim().toLowerCase();
  var err = document.getElementById('resetErr');
  if (!login) { err.textContent='Saisis ton login.'; return; }
  try {
    var udata = await supa('GET','utilisateurs?login=eq.'+encodeURIComponent(login)+'&select=login,actif');
    if (!udata||!udata.length) { err.textContent='Login inconnu.'; return; }
    if (!udata[0].actif) { err.textContent='Compte désactivé.'; return; }
    var existing = await supa('GET','demandes_reset?login=eq.'+encodeURIComponent(login)+'&traitee=eq.false&select=id');
    if (existing&&existing.length) { err.textContent='Demande déjà envoyée.'; return; }
    await supa('POST','demandes_reset',[{login:login,traitee:false}]);
    err.style.color='#2ecc71'; err.textContent='Demande envoyée !';
    setTimeout(function() { err.textContent=''; err.style.color='#e74c3c'; document.getElementById('resetPanel').style.display='none'; },3000);
  } catch(e) { err.textContent='Erreur, réessaie.'; }
});

// CRÉER UN COMPTE
var createLink = document.getElementById('createAccountLink');
if (createLink) createLink.addEventListener('click', function() {
  var p = document.getElementById('createAccountPanel');
  p.style.display = p.style.display==='none'?'block':'none';
});
var createBtn = document.getElementById('createAccountBtn');
if (createBtn) createBtn.addEventListener('click', async function() {
  var matricule = (document.getElementById('newMatricule').value||'').trim();
  var prenom = (document.getElementById('newPrenomCompte').value||'').trim();
  var pwd = (document.getElementById('newPwdCompte').value||'').trim();
  var err = document.getElementById('createAccountErr');
  err.textContent=''; err.style.color='#e74c3c';
  if (!matricule) { err.textContent='Matricule obligatoire.'; return; }
  if (!prenom) { err.textContent='Prénom obligatoire.'; return; }
  if (!pwd||pwd.length<4) { err.textContent='Mot de passe trop court (min 4 car.).'; return; }
  try {
    var existing = await supa('GET','utilisateurs?login=eq.'+encodeURIComponent(matricule)+'&select=id');
    if (existing&&existing.length) { err.textContent='Ce matricule existe déjà.'; return; }
    var existDemande = await supa('GET','demandes_compte?matricule=eq.'+encodeURIComponent(matricule)+'&statut=eq.en_attente&select=id');
    if (existDemande&&existDemande.length) { err.textContent='Demande déjà envoyée.'; return; }
    var hash = await hashStr(matricule+':'+pwd);
    await supa('POST','demandes_compte',[{matricule:matricule,prenom:prenom,password_hash:hash}]);
    err.style.color='#2ecc71'; err.textContent='✓ Demande envoyée !';
    document.getElementById('newMatricule').value=''; document.getElementById('newPrenomCompte').value=''; document.getElementById('newPwdCompte').value='';
  } catch(e) { err.textContent='Erreur, réessaie.'; console.error(e); }
});

// ── INIT UI ──
function initUI() {
  var role = currentUser.role;
  var peutModifier = currentUser.peut_modifier !== false;
  window._canEdit = (role==='admin') || ((role==='magasinier'||role==='brigadier') && peutModifier);

  // Afficher onglet Ajouter
  var navAjouter = document.getElementById('navAjouter');
  if (navAjouter) navAjouter.style.display = window._canEdit ? '' : 'none';

  // Son
  var btnSound = document.getElementById('btnSound');
  if (btnSound) {
    if (role !== 'agent') { btnSound.style.display='flex'; btnSound.textContent=_soundEnabled?'🔔':'🔕'; }
    else btnSound.style.display='none';
  }

  // Admin
  var navAdmin = document.getElementById('navAdmin');
  if (navAdmin) navAdmin.style.display = role==='admin'?'block':'none';
  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.addEventListener('click', function() { switchSection('admin'); });

  // Agent
  var agentField = document.getElementById('agentField');
  if (agentField) agentField.classList.toggle('hidden', role!=='agent');

  // Historique caché pour agent
  var histoSection = document.getElementById('histoSection');
  if (histoSection) histoSection.style.display = role==='agent'?'none':'block';

  // Infos user header
  document.getElementById('userInfo').textContent = currentUser.prenom||'';
  var roleEl = document.getElementById('userRole');
  if (roleEl) {
    var roles = {admin:'Admin',magasinier:'Magasinier',brigadier:'Brigadier',agent:'Agent'};
    roleEl.textContent = roles[role]||role;
  }

  // Navigation topbar
  document.getElementById('navPieces').addEventListener('click', function() { switchSection('pieces'); });
  document.getElementById('navOutillage').addEventListener('click', function() { switchSection('outillage'); });
  document.getElementById('navPanier').addEventListener('click', function() { switchSection('panier'); });

  // Onglet Ajouter dans sidebar
  var sidebarFooter = document.getElementById('sidebarFooter');
  if (!sidebarFooter) {
    sidebarFooter = document.createElement('div');
    sidebarFooter.id = 'sidebarFooter';
    sidebarFooter.style.cssText = 'padding:12px;border-top:1px solid var(--br);margin-top:auto;';
    document.getElementById('sidebarCats').parentElement.appendChild(sidebarFooter);
  }
  if (window._canEdit) {
    sidebarFooter.innerHTML = '<div onclick="switchSection(\'ajouter\')" style="display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;border-left:3px solid var(--ac);background:rgba(240,165,0,0.06);"><div style="width:32px;height:32px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;">&#x2795;</div><div style="font-size:12px;font-weight:700;color:var(--ac);">Ajouter article</div></div>';
  } else sidebarFooter.innerHTML = '';
  updateBadgeAttente();
}

// ── CHARGEMENT ARTICLES ──
async function loadArticles() {
  showLoading(true,'Chargement...');
  try {
    var all = [], page = 0;
    while (true) {
      var data = await supa('GET','articles?select=*&order=nom.asc&limit=1000&offset='+(page*1000));
      if (!data||!data.length) break;
      all = all.concat(data);
      if (data.length<1000) break;
      page++;
    }
    articles = all;
    await loadSorties();
    buildSidebar();
    doSearch();
    updateBadgeAttente();
  } catch(e) { console.error(e); showToast('Erreur connexion','err'); }
  finally { showLoading(false); }
}

async function loadSorties() {
  try {
    var data = await supa('GET','bons_commande?select=articles&statut=eq.valide');
    _sortiesCount = {};
    if (data) {
      for (var i=0;i<data.length;i++) {
        var arts = data[i].articles||[];
        for (var j=0;j<arts.length;j++) { var n=arts[j].num; _sortiesCount[n]=(_sortiesCount[n]||0)+1; }
      }
    }
  } catch(e) { _sortiesCount={}; }
}

// ── SIDEBAR CATÉGORIES ──
function getCats() {
  var c={};
  for (var i=0;i<articles.length;i++) { var x=articles[i].categorie||''; if (x) c[x]=true; }
  return Object.keys(c).sort();
}

function buildSidebar() {
  var cats = ['TOUT'].concat(getCats());
  var counts = {TOUT: articles.length};
  for (var i=0;i<articles.length;i++) { var cat=articles[i].categorie||''; if (cat) counts[cat]=(counts[cat]||0)+1; }
  var h='';
  for (var i=0;i<cats.length;i++) {
    var c=cats[i], on=(c===selectedCat);
    h += '<div class="cat-item'+(on?' on':'')+'" data-cat="'+esc(c)+'">'
      +'<div class="cat-icon">'+getCatIcon(c)+'</div>'
      +'<div class="cat-info"><div class="cat-label">'+esc(c==='TOUT'?'Tout':c)+'</div><div class="cat-count">'+(counts[c]||0)+'</div></div>'
      +'</div>';
    if (i===0) h+='<div class="cat-sep"></div>';
  }
  document.getElementById('catsList').innerHTML = h;
  document.querySelectorAll('.cat-item').forEach(function(el) {
    el.addEventListener('click', function() {
      selectedCat = this.getAttribute('data-cat');
      displayCount = 30;
      buildSidebar();
      doSearch();
      switchSection('pieces');
    });
  });
}

// ── RECHERCHE ──
function normalize(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

function doSearch() {
  var q = normalize(document.getElementById('si').value.trim());
  filtered = [];
  for (var i=0;i<articles.length;i++) {
    var a=articles[i];
    if (selectedCat!=='TOUT' && a.categorie!==selectedCat) continue;
    if (q && (normalize(a.nom)+'|'+normalize(a.num)+'|'+normalize(a.tags)+'|'+normalize(a.location)).indexOf(q)<0) continue;
    filtered.push(a);
  }
  if (Object.keys(_sortiesCount).length>0) {
    filtered.sort(function(a,b) { return (_sortiesCount[b.num]||0)-(_sortiesCount[a.num]||0); });
  }
  document.getElementById('rc').textContent = (q||selectedCat!=='TOUT') ? (filtered.length+' résultat(s)') : (articles.length+' articles au total');
  renderGrid(q);
}

function hl(txt, q) {
  if (!q||!txt) return esc(txt||'');
  var out='', t=normalize(txt), i=0;
  while (i<txt.length) {
    var j=t.indexOf(q,i);
    if (j<0) { out+=esc(txt.slice(i)); break; }
    out+=esc(txt.slice(i,j))+'<span class="hl">'+esc(txt.slice(j,j+q.length))+'</span>';
    i=j+q.length;
  }
  return out;
}

// ── RENDU GRILLE ──
function renderGrid(q) {
  var grid = document.getElementById('p1');
  var lm = document.getElementById('lm');
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mu);padding:60px 20px;font-size:14px;"><div style="font-size:40px;margin-bottom:12px;">🔍</div>Aucun article trouvé</div>';
    lm.classList.add('hidden'); return;
  }
  var n = Math.min(filtered.length, displayCount);
  var h = '';
  for (var i=0;i<n;i++) {
    var a = filtered[i];
    // Thumbnail
    var thumb = '';
    if (a.photo) {
      var firstPhoto = a.photo.split(',')[0].trim();
      if (firstPhoto) thumb = '<img class="card-thumb-photo" src="'+esc(firstPhoto)+'" alt="" loading="lazy"/>';
    }
    if (!thumb) thumb = '<div class="card-thumb-icon">'+getCatIcon(a.categorie)+'</div>';
    // Tags
    var tags = '';
    if (a.bus_std) tags += '<span class="tag tag-std">STD</span>';
    if (a.bus_art) tags += '<span class="tag tag-art">ART</span>';
    if (a.chimique) tags += '<span class="tag tag-chim">CHIM.</span>';
    if (a.reparable) tags += '<span class="tag tag-rep">🔧 RÉP.</span>';
    if (a.interne) tags += '<span class="tag tag-int">INTERNE</span>';
    // Edit btns
    var editBtns = window._canEdit
      ? '<div class="card-edit-btns"><div class="btn-edit-card" data-num="'+esc(a.num)+'">✏️ Modifier</div><div class="btn-del-card" data-num="'+esc(a.num)+'">🗑 Supprimer</div></div>'
      : '';
    // NPF / Fournisseur (canEdit seulement)
    var extra = '';
    if (window._canEdit) {
      if (a.npf) extra += '<div style="font-size:10px;color:var(--mu);margin-bottom:3px;">NPF: <span style="color:var(--mu2);">'+esc(a.npf)+'</span></div>';
      if (a.fournisseur) extra += '<div style="font-size:10px;color:var(--mu);margin-bottom:4px;">'+esc(a.fournisseur)+'</div>';
      if (a.min||a.max) extra += '<div style="font-size:10px;color:var(--mu);margin-bottom:4px;">Min/Max: <span style="color:var(--mu2);">'+(a.min||0)+'/'+(a.max||0)+'</span></div>';
    }
    h += '<div class="piece-card" data-num="'+esc(a.num)+'">'
      +'<div class="card-thumb">'+thumb+'<div class="card-thumb-cat">'+esc(a.categorie||'')+'</div></div>'
      +'<div class="card-body">'
        +'<div class="card-num">'+hl(a.num,q)+'</div>'
        +'<div class="card-name">'+hl(a.nom,q)+'</div>'
        +(a.location?'<div class="card-loc">📍 '+esc(a.location)+'</div>':'')
        +(tags?'<div class="card-tags">'+tags+'</div>':'')
        +extra
        +'<div class="btn-add-panier" data-num="'+esc(a.num)+'">+ Ajouter au panier</div>'
        +editBtns
      +'</div>'
    +'</div>';
  }
  grid.innerHTML = h;

  // Events
  grid.querySelectorAll('.btn-add-panier').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); ajouterPanier(this.getAttribute('data-num')); });
  });
  grid.querySelectorAll('.btn-edit-card').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); openEdit(this.getAttribute('data-num')); });
  });
  grid.querySelectorAll('.btn-del-card').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); delArticle(this.getAttribute('data-num')); });
  });
  // Clic photo sur la card
  grid.querySelectorAll('.card-thumb-photo').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var card = this.closest('.piece-card');
      var a = articles.filter(function(x) { return x.num===card.getAttribute('data-num'); })[0];
      if (a&&a.photo) { var photos=a.photo.split(',').filter(function(u){return u.trim();}); openPhoto(photos[0],photos); }
    });
  });

  if (filtered.length>displayCount) {
    lm.classList.remove('hidden');
    lm.textContent='Afficher plus ('+(filtered.length-displayCount)+' restants)';
  } else lm.classList.add('hidden');
}

document.getElementById('si').addEventListener('input', function() {
  displayCount=30; doSearch();
  var clr=document.getElementById('clearSearch');
  if (clr) clr.style.display=this.value?'block':'none';
});
document.getElementById('clearSearch').addEventListener('click', function() {
  document.getElementById('si').value=''; this.style.display='none'; displayCount=30; doSearch();
});
document.getElementById('lm').addEventListener('click', function() {
  displayCount+=30; renderGrid(normalize(document.getElementById('si').value.trim()));
});

// ── AUTOCOMPLÉTION CATÉGORIE ──
function showCatSugg(inputId, suggId) {
  var val = document.getElementById(inputId).value.trim().toLowerCase();
  var matches = getCats().filter(function(c) { return !val||c.toLowerCase().indexOf(val)>=0; });
  var sugg = document.getElementById(suggId);
  if (!matches.length) { sugg.innerHTML=''; return; }
  sugg.innerHTML = matches.map(function(c) { return '<div class="cat-sugg-item" data-val="'+esc(c)+'" data-input="'+inputId+'" data-sugg="'+suggId+'">'+esc(c)+'</div>'; }).join('');
  sugg.querySelectorAll('.cat-sugg-item').forEach(function(el) {
    el.addEventListener('mousedown', function() {
      document.getElementById(this.getAttribute('data-input')).value=this.getAttribute('data-val');
      document.getElementById(this.getAttribute('data-sugg')).innerHTML='';
    });
  });
}
['addCat','editCat'].forEach(function(id) {
  var sugg = id==='addCat'?'addCatSugg':'editCatSugg';
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', function() { showCatSugg(id,sugg); });
  el.addEventListener('focus', function() { showCatSugg(id,sugg); });
  el.addEventListener('blur', function() { setTimeout(function() { var s=document.getElementById(sugg); if(s) s.innerHTML=''; },200); });
});

// ── NAVIGATION SECTIONS ──
var _currentSection = 'pieces';

function switchSection(section) {
  _currentSection = section;
  // Masquer tout
  ['sectionPieces','sectionPanier','sectionOutillage'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display='none';
  });
  // Nav active
  ['navPieces','navOutillage','navPanier'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('on');
  });

  if (section==='pieces') {
    document.getElementById('sectionPieces').style.display='flex';
    document.getElementById('navPieces').classList.add('on');
    // Afficher recherche, cacher add/admin
    showPiecesTab('search');
  } else if (section==='ajouter') {
    document.getElementById('sectionPieces').style.display='flex';
    document.getElementById('navPieces').classList.add('on');
    showPiecesTab('add');
  } else if (section==='admin') {
    document.getElementById('sectionPieces').style.display='flex';
    document.getElementById('navPieces').classList.add('on');
    showPiecesTab('admin');
    loadAdminPage();
  } else if (section==='panier') {
    document.getElementById('sectionPanier').style.display='flex';
    document.getElementById('navPanier').classList.add('on');
    renderPanier();
    if (currentUser.role!=='agent') loadHistorique();
  } else if (section==='outillage') {
    document.getElementById('sectionOutillage').style.display='flex';
    document.getElementById('navOutillage').classList.add('on');
    loadOutillage();
  }
}

function showPiecesTab(tab) {
  var p1=document.getElementById('p1'), lm=document.getElementById('lm');
  var p2=document.getElementById('p2'), p4=document.getElementById('p4');
  var sb=document.getElementById('searchbarRow');
  var sidebar=document.getElementById('sidebarCats');
  p1.style.display='none'; if(lm) lm.classList.add('hidden');
  p2.classList.add('hidden'); p4.classList.add('hidden');
  if (tab==='search') {
    p1.style.display=''; sb.style.display='flex'; sidebar.style.display='flex';
    renderGrid(normalize(document.getElementById('si').value.trim()));
    var lmEl=document.getElementById('lm');
    if (filtered.length>displayCount) lmEl.classList.remove('hidden');
  } else if (tab==='add') {
    p2.classList.remove('hidden'); sb.style.display='none'; sidebar.style.display='none';
  } else if (tab==='admin') {
    p4.classList.remove('hidden'); sb.style.display='none'; sidebar.style.display='none';
  }
}

// ── AJOUTER ARTICLE ──
document.getElementById('addBtn').addEventListener('click', async function() {
  var num=document.getElementById('addNum').value.trim(), nom=document.getElementById('addNom').value.trim();
  if (!num||!nom) { showToast('Numéro et désignation obligatoires','err'); return; }
  for (var i=0;i<articles.length;i++) { if (articles[i].num===num) { showToast('Article déjà existant','err'); return; } }
  var a = {
    num:num, nom:nom,
    categorie:document.getElementById('addCat').value.trim(),
    tags:document.getElementById('addTags').value.trim(),
    location:document.getElementById('addLoc').value.trim(),
    min:parseInt(document.getElementById('addMin').value)||0,
    max:parseInt(document.getElementById('addMax').value)||0,
    photo:null,
    npf:document.getElementById('addNpf').value.trim(),
    fournisseur:document.getElementById('addFournisseur').value.trim(),
    bus_std:document.getElementById('addBusStd').checked,
    bus_art:document.getElementById('addBusArt').checked,
    chimique:document.getElementById('addChimique').checked,
    reparable:document.getElementById('addReparable').checked,
    interne:false, stock_securite:0
  };
  try {
    await supa('POST','articles',[a]); articles.push(a);
    ['addNum','addNom','addCat','addTags','addLoc','addMin','addMax','addNpf','addFournisseur'].forEach(function(id) { document.getElementById(id).value=''; });
    setBusBtn('addBusStd','addBusStdBtn',false); setBusBtn('addBusArt','addBusArtBtn',false);
    setBusBtn('addChimique','addChimiqueBtn',false); setBusBtn('addReparable','addReparableBtn',false);
    showToast('Article enregistré !','success'); buildSidebar(); switchSection('pieces'); doSearch();
  } catch(e) { showToast('Erreur sauvegarde','err'); console.error(e); }
});

async function delArticle(num) {
  if (!confirm('Supprimer cet article ?')) return;
  try {
    await supa('DELETE','articles?num=eq.'+encodeURIComponent(num));
    articles=articles.filter(function(a) { return a.num!==num; });
    buildSidebar(); doSearch(); showToast('Supprimé','success');
  } catch(e) { showToast('Erreur','err'); }
}

// ── MODIFIER ARTICLE ──
function openEdit(num) {
  for (var i=0;i<articles.length;i++) {
    if (articles[i].num===num) {
      var a=articles[i]; editingNum=num;
      document.getElementById('editNum').value=a.num;
      document.getElementById('editNom').value=a.nom;
      document.getElementById('editCat').value=a.categorie||'';
      var cleanTags=(a.tags||'').split(',').map(function(t){return t.trim();}).filter(function(t){return t&&t.indexOf('bus ')<0&&t.indexOf('produit chimique')<0&&t.indexOf('piece interne')<0;}).join(', ');
      document.getElementById('editTags').value=cleanTags;
      document.getElementById('editLoc').value=a.location||'';
      document.getElementById('editMin').value=a.min||0;
      document.getElementById('editMax').value=a.max||0;
      if (document.getElementById('editNpf')) document.getElementById('editNpf').value=a.npf||'';
      if (document.getElementById('editFournisseur')) document.getElementById('editFournisseur').value=a.fournisseur||'';
      setBusBtn('editBusStd','editBusStdBtn',a.bus_std||false);
      setBusBtn('editBusArt','editBusArtBtn',a.bus_art||false);
      setBusBtn('editChimique','editChimiqueBtn',a.chimique||false);
      setBusBtn('editReparable','editReparableBtn',a.reparable||false);
      _editPhotos=a.photo?a.photo.split(',').filter(function(u){return u.trim();}):[]; _editPhoto=a.photo||null;
      document.getElementById('editPhotoPreview').style.display='none';
      renderEditPhotos();
      document.getElementById('mo').classList.remove('hidden'); return;
    }
  }
}

document.getElementById('cancelEditBtn').addEventListener('click', function() { document.getElementById('mo').classList.add('hidden'); editingNum=null; });
document.getElementById('saveEditBtn').addEventListener('click', async function() {
  if (!editingNum) return;
  var newNum=document.getElementById('editNum').value.trim(), nom=document.getElementById('editNom').value.trim();
  if (!nom) { showToast('Désignation obligatoire','err'); return; }
  var updated = {
    num:newNum, nom:nom,
    categorie:document.getElementById('editCat').value.trim(),
    tags:document.getElementById('editTags').value.trim(),
    location:document.getElementById('editLoc').value.trim(),
    min:parseInt(document.getElementById('editMin').value)||0,
    max:parseInt(document.getElementById('editMax').value)||0,
    photo:_editPhoto||null,
    npf:document.getElementById('editNpf').value.trim(),
    fournisseur:document.getElementById('editFournisseur').value.trim(),
    bus_std:document.getElementById('editBusStd').checked,
    bus_art:document.getElementById('editBusArt').checked,
    chimique:document.getElementById('editChimique').checked,
    reparable:document.getElementById('editReparable').checked,
    interne:false, stock_securite:0
  };
  try {
    if (newNum!==editingNum) { await supa('DELETE','articles?num=eq.'+encodeURIComponent(editingNum)); await supa('POST','articles',[updated]); }
    else { await supa('PATCH','articles?num=eq.'+encodeURIComponent(editingNum),updated); }
    for (var i=0;i<articles.length;i++) { if (articles[i].num===editingNum) { articles[i]=updated; break; } }
    document.getElementById('mo').classList.add('hidden'); editingNum=null;
    buildSidebar(); doSearch(); showToast('Modifié !','success');
  } catch(e) { showToast('Erreur','err'); console.error(e); }
});

document.getElementById('editPhotoBtn').addEventListener('click', function() { document.getElementById('editPhotoInput').click(); });
document.getElementById('editPhotoInput').addEventListener('change', async function(event) {
  var file=event.target.files[0]; if (!file) return;
  if (!editingNum) { showToast('Erreur: pas d\'article sélectionné','err'); return; }
  showToast('Upload en cours...','success');
  try {
    var compressed=await compressImage(file);
    var ext=file.name.split('.').pop()||'jpg';
    var path=editingNum+'/'+Date.now()+'.'+ext;
    var res=await fetch(SURL+'/storage/v1/object/photos-articles/'+path,{method:'POST',headers:{'apikey':SKEY,'Authorization':'Bearer '+SKEY,'Content-Type':compressed.type||'image/jpeg'},body:compressed});
    if (!res.ok) throw new Error();
    var url=SURL+'/storage/v1/object/public/photos-articles/'+path;
    if (!_editPhotos) _editPhotos=[];
    _editPhotos.push(url); _editPhoto=_editPhotos.join(',');
    renderEditPhotos(); showToast('Photo ajoutée !','success');
  } catch(e) { showToast('Erreur upload photo','err'); }
  document.getElementById('editPhotoInput').value='';
});
document.getElementById('editPhotoRemove').addEventListener('click', function() {
  _editPhoto=null; _editPhotos=[];
  document.getElementById('editPhotoPreview').src=''; document.getElementById('editPhotoPreview').style.display='none';
  document.getElementById('editPhotoRemove').style.display='none';
});

async function compressImage(file) {
  return new Promise(function(resolve) {
    var reader=new FileReader();
    reader.onload=function(e) {
      var img=new Image();
      img.onload=function() {
        var canvas=document.createElement('canvas'), ms=1200, w=img.width, h=img.height;
        if (w>ms) { h=h*ms/w; w=ms; } if (h>ms) { w=w*ms/h; h=ms; }
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(function(blob) { resolve(blob); },'image/jpeg',0.8);
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderEditPhotos() {
  var container=document.getElementById('editPhotoContainer'); if (!container) return;
  container.innerHTML='';
  if (!_editPhotos||!_editPhotos.length) { document.getElementById('editPhotoRemove').style.display='none'; return; }
  document.getElementById('editPhotoRemove').style.display='block';
  for (var i=0;i<_editPhotos.length;i++) {
    var url=_editPhotos[i];
    var div=document.createElement('div'); div.style.cssText='position:relative;display:inline-block;margin:4px;';
    var img=document.createElement('img'); img.src=url; img.style.cssText='width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--br);cursor:pointer;';
    img.onclick=(function(u) { return function() { openPhoto(u,_editPhotos); }; })(url);
    var del=document.createElement('div'); del.style.cssText='position:absolute;top:-4px;right:-4px;background:var(--rd);color:#fff;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:bold;';
    del.textContent='✕';
    del.onclick=(function(idx) { return function() { _editPhotos.splice(idx,1); _editPhoto=_editPhotos.join(','); renderEditPhotos(); }; })(i);
    div.appendChild(img); div.appendChild(del); container.appendChild(div);
  }
}

// ── PANIER ──
function ajouterPanier(num) {
  var a=articles.filter(function(x) { return x.num===num; })[0]; if (!a) return;
  var ex=panier.filter(function(x) { return x.num===num; })[0];
  if (ex) { ex.qty++; showToast('Quantité mise à jour !','success'); }
  else { panier.push({num:a.num,nom:a.nom,location:a.location||'',qty:1,reparable:a.reparable||false,interne:a.interne||false}); showToast('Ajouté au panier !','success'); }
  updateBadge();
}

function updateBadge() {
  var badge=document.getElementById('panierBadge');
  var total=panier.reduce(function(s,x){return s+x.qty;},0);
  if (total>0) { badge.classList.remove('hidden'); badge.textContent=total; }
  else badge.classList.add('hidden');
}

function renderPanier() {
  var list=document.getElementById('panierList');
  if (!panier.length) { list.innerHTML='<div class="panier-empty"><div style="font-size:40px;margin-bottom:10px;">🛒</div>Panier vide</div>'; return; }
  var h='';
  for (var i=0;i<panier.length;i++) {
    var p=panier[i];
    h+='<div class="panier-item">'
      +'<div class="panier-item-info">'
        +'<div class="panier-item-num">'+esc(p.num)+'</div>'
        +'<div class="panier-item-nom">'+esc(p.nom)+'</div>'
        +(p.location?'<div class="panier-item-loc">📍 '+esc(p.location)+'</div>':'')
      +'</div>'
      +'<div class="qty-wrap">'
        +'<div class="qty-btn" data-i="'+i+'" data-d="-1">−</div>'
        +'<div class="qty-val">'+p.qty+'</div>'
        +'<div class="qty-btn" data-i="'+i+'" data-d="1">+</div>'
      +'</div>'
      +'<div class="panier-remove" data-i="'+i+'">✕</div>'
    +'</div>';
  }
  list.innerHTML=h;
  list.querySelectorAll('.qty-btn').forEach(function(el) {
    el.addEventListener('click', function() {
      var i=parseInt(this.getAttribute('data-i')), d=parseInt(this.getAttribute('data-d'));
      panier[i].qty+=d; if (panier[i].qty<=0) panier.splice(i,1);
      updateBadge(); renderPanier();
    });
  });
  list.querySelectorAll('.panier-remove').forEach(function(el) {
    el.addEventListener('click', function() { panier.splice(parseInt(this.getAttribute('data-i')),1); updateBadge(); renderPanier(); });
  });
}

document.getElementById('viderBtn').addEventListener('click', function() { if (!confirm('Vider le panier ?')) return; panier=[]; updateBadge(); renderPanier(); });
document.getElementById('validerBtn').addEventListener('click', async function() {
  var num=document.getElementById('numeroOrdre').value.trim();
  if (!num) { showToast('Saisis un numéro d\'ordre','err'); return; }
  if (!/^\d{8}$/.test(num)) { showToast('Le numéro doit avoir 8 chiffres','err'); return; }
  if (!panier.length) { showToast('Panier vide','err'); return; }
  var numAgent='';
  if (currentUser.role==='agent') {
    numAgent=document.getElementById('numeroAgent').value.trim();
    if (!numAgent) { showToast('Saisis ton numéro d\'agent','err'); return; }
  }
  try {
    await supa('POST','bons_commande',[{numero_ordre:num,statut:'valide',articles:panier,login:currentUser.login||'',numero_agent:numAgent||null}]);
    var nbArts=panier.length, totalQty=panier.reduce(function(s,x){return s+x.qty;},0);
    panier=[]; document.getElementById('numeroOrdre').value='';
    if (currentUser.role==='agent') document.getElementById('numeroAgent').value='';
    updateBadge(); renderPanier(); loadHistorique();
    if (currentUser.role==='agent') showConfirmAgent(num,nbArts,totalQty);
    else showToast('Bon sauvegardé !','success');
  } catch(e) { showToast('Erreur','err'); console.error(e); }
});

function showConfirmAgent(ordre, nbArts, totalQty) {
  var el=document.getElementById('confirmAgent');
  if (!el) { el=document.createElement('div'); el.id='confirmAgent'; el.style.cssText='position:fixed;inset:0;background:rgba(15,17,23,0.92);display:flex;align-items:center;justify-content:center;z-index:800;padding:24px;'; document.body.appendChild(el); }
  el.innerHTML='<div style="background:#1a1d27;border:2px solid #2ecc71;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;">'
    +'<div style="font-size:48px;margin-bottom:12px;">✅</div>'
    +'<div style="font-size:20px;font-weight:700;color:#2ecc71;margin-bottom:8px;">Commande envoyée !</div>'
    +'<div style="font-size:14px;color:#e8eaf0;margin-bottom:6px;">Le magasin a bien reçu ta demande.</div>'
    +'<div style="font-size:13px;color:#7a8099;margin-bottom:20px;">Ordre <strong style="color:#f0a500;">'+esc(ordre)+'</strong> · '+nbArts+' article(s) · '+totalQty+' pièce(s)</div>'
    +'<div onclick="document.getElementById(\'confirmAgent\').style.display=\'none\'" style="background:#2ecc71;color:#111;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;">OK</div>'
    +'</div>';
  el.style.display='flex';
}

// ── HISTORIQUE ──
var _histoFiltre='today';

async function loadHistorique() {
  try {
    var data=await supa('GET','bons_commande?select=*&order=date_creation.desc&limit=200');
    var list=document.getElementById('historiqueList');
    var OFFSET=2*60*60*1000;
    function dateBelge(ts) { return new Date(ts+OFFSET).toISOString().slice(0,10); }
    var maintenant=Date.now(), aujourdhui=dateBelge(maintenant);
    var nowBelge=new Date(maintenant+OFFSET), jourSemaine=nowBelge.getUTCDay();
    var offsetLundi=jourSemaine===0?-6:1-jourSemaine;
    var lundi=dateBelge(maintenant+offsetLundi*86400000);

    var filtrés=(data||[]).filter(function(b) {
      if (b.statut==='annule') return false;
      var dateBon=dateBelge(new Date(b.date_creation).getTime());
      if (_histoFiltre==='today') return dateBon===aujourdhui;
      if (_histoFiltre==='week') return dateBon>=lundi;
      return true;
    });

    var tabs='<div class="histo-tabs">'
      +['today','week','all'].map(function(f) {
          var label=f==='today'?"Aujourd'hui":f==='week'?'Cette semaine':'Tout';
          return '<div class="histo-tab'+(f===_histoFiltre?' on':'')+'" data-f="'+f+'">'+label+'</div>';
        }).join('')
      +'</div>';

    if (!filtrés.length) {
      list.innerHTML=tabs+'<div class="panier-empty">Aucun bon</div>';
      list.querySelectorAll('.histo-tab').forEach(function(el) { el.addEventListener('click', function() { _histoFiltre=this.getAttribute('data-f'); loadHistorique(); }); });
      return;
    }

    var h=tabs;
    for (var i=0;i<filtrés.length;i++) {
      var b=filtrés[i], arts=b.articles||[];
      var dtBrussels=new Date(new Date(b.date_creation).getTime()+2*60*60*1000);
      var dateStr=dtBrussels.toLocaleDateString('fr-FR')+' '+dtBrussels.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      var sapDone=b.sap_effectue||false;

      var detailRows='';
      for (var j=0;j<arts.length;j++) {
        var art=arts[j];
        detailRows+='<div class="bon-detail-row">'
          +'<div><div style="font-size:14px;font-weight:800;color:var(--ac);">'+esc(art.num)+(art.reparable?' <span style="font-size:11px;background:rgba(155,89,182,0.15);border:1px solid #9b59b6;border-radius:4px;padding:1px 6px;color:#9b59b6;">🔧 Rép.</span>':'')+'</div>'
          +'<div style="font-size:13px;color:var(--tx);margin-top:2px;">'+esc(art.nom)+'</div>'
          +(art.location?'<div style="font-size:11px;color:var(--mu);margin-top:1px;">📍 '+esc(art.location)+'</div>':'')
          +'</div>'
          +'<div class="bon-qty">×'+art.qty+'</div>'
          +'</div>';
      }

      h+='<div class="histo-item" style="'+(sapDone?'opacity:0.55;':'')+'">'
        +'<div style="display:flex;justify-content:space-between;align-items:start;cursor:pointer;" onclick="toggleBon(this)">'
          +'<div>'
            +'<div class="histo-num">Ordre '+esc(b.numero_ordre)+'</div>'
            +'<div class="histo-date">'+dateStr+'</div>'
            +(b.login?'<div style="font-size:11px;color:var(--ac);margin-top:2px;">👤 '+esc(b.login)+'</div>':'')
            +(b.numero_agent?'<div style="font-size:11px;color:var(--gn);margin-top:2px;">🪪 Agent: '+esc(b.numero_agent)+'</div>':'')
            +'<div class="histo-count">'+arts.length+' article(s)</div>'
          +'</div>'
          +'<div style="color:var(--mu);font-size:16px;padding-top:2px;">▼</div>'
        +'</div>'
        +'<div class="histo-btns">'
          +'<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:'+(sapDone?'var(--gn)':'var(--mu)')+';cursor:pointer;" onclick="event.stopPropagation()">'
            +'<input type="checkbox" class="chk-sap" data-id="'+b.id+'" '+(sapDone?'checked':'')+' style="width:15px;height:15px;accent-color:var(--gn);cursor:pointer;"/>'
            +'SAP fait'
          +'</label>'
          +'<div class="histo-btn histo-btn-copy btn-copy-sap" data-id="'+b.id+'">📋 Copier</div>'
          +'<div class="histo-btn histo-btn-excel btn-dl" data-id="'+b.id+'">Excel</div>'
          +'<div class="histo-btn histo-btn-reopen btn-reopen" data-id="'+b.id+'" data-sap="'+(sapDone?'true':'false')+'">✏️ Modifier</div>'
          +'<div class="histo-btn histo-btn-del btn-del-bon" data-id="'+b.id+'" data-sap="'+(sapDone?'true':'false')+'">Supprimer</div>'
        +'</div>'
        +'<div class="bon-detail">'+detailRows+'</div>'
      +'</div>';
    }

    list.innerHTML=h;
    list.querySelectorAll('.histo-tab').forEach(function(el) { el.addEventListener('click', function() { _histoFiltre=this.getAttribute('data-f'); loadHistorique(); }); });
    list.querySelectorAll('.btn-dl').forEach(function(el) { el.addEventListener('click', function() { exportBon(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.btn-del-bon').forEach(function(el) {
      el.addEventListener('click', async function() {
        var id=this.getAttribute('data-id'), sapFait=this.getAttribute('data-sap')==='true';
        var msg=sapFait?'Supprimer ce bon ?':'⚠️ Ce bon n\'a pas encore été sorti sur SAP !\nSupprimer quand même ?';
        if (!confirm(msg)) return;
        try { await supa('DELETE','bons_commande?id=eq.'+id); showToast('Bon supprimé !','success'); loadHistorique(); updateBadgeAttente(); } catch(e) { showToast('Erreur','err'); }
      });
    });
    list.querySelectorAll('.btn-copy-sap').forEach(function(el) { el.addEventListener('click', function(e) { e.stopPropagation(); copySAP(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.chk-sap').forEach(function(el) {
      el.addEventListener('change', async function() {
        var id=this.getAttribute('data-id'), val=this.checked;
        try { await supa('PATCH','bons_commande?id=eq.'+id,{sap_effectue:val}); showToast(val?'SAP fait ✓':'SAP non fait','success'); loadHistorique(); updateBadgeAttente(); } catch(e) { showToast('Erreur','err'); }
      });
    });
    list.querySelectorAll('.btn-reopen').forEach(function(el) {
      el.addEventListener('click', function(e) { e.stopPropagation(); rouvrirBon(this.getAttribute('data-id'),this.getAttribute('data-sap')==='true'); });
    });
  } catch(e) { console.error(e); }
}

function toggleBon(el) {
  var detail=el.parentElement.querySelector('.bon-detail');
  var arrow=el.querySelector('div[style*="font-size:16px"]');
  if (detail.style.display==='none'||!detail.style.display) {
    detail.style.display='block'; if (arrow) arrow.textContent='▲';
  } else {
    detail.style.display='none'; if (arrow) arrow.textContent='▼';
  }
}

async function rouvrirBon(id, sapFait) {
  var msg=sapFait?'⚠️ Ce bon a déjà été sorti sur SAP !\nModifier peut créer une incohérence.\nContinuer ?':'Rouvrir ce bon dans le panier pour le modifier ?';
  if (!confirm(msg)) return;
  try {
    var data=await supa('GET','bons_commande?id=eq.'+id+'&select=*');
    if (!data||!data.length) { showToast('Bon introuvable','err'); return; }
    var bon=data[0];
    panier=(bon.articles||[]).map(function(a) { return {num:a.num,nom:a.nom,location:a.location||'',qty:a.qty,reparable:a.reparable||false,interne:a.interne||false}; });
    document.getElementById('numeroOrdre').value=bon.numero_ordre||'';
    var agentInput=document.getElementById('numeroAgent');
    if (agentInput&&bon.numero_agent) agentInput.value=bon.numero_agent;
    await supa('DELETE','bons_commande?id=eq.'+id);
    updateBadge(); switchSection('panier'); renderPanier(); loadHistorique(); updateBadgeAttente();
    showToast('Bon rechargé dans le panier !','success');
  } catch(e) { showToast('Erreur','err'); console.error(e); }
}

async function copySAP(id) {
  try {
    var data=await supa('GET','bons_commande?id=eq.'+id+'&select=*');
    if (!data||!data.length) return;
    var bon=data[0], arts=bon.articles||[];
    var lines=[];
    for (var i=0;i<arts.length;i++) { var a=arts[i]; if (a.interne) continue; lines.push(a.num+'\t'+a.qty+'\t\t2K\t\t'+bon.numero_ordre+'\t10'); }
    var txt=lines.join('\n');
    if (navigator.clipboard&&navigator.clipboard.writeText) { await navigator.clipboard.writeText(txt); showToast('Copié ! Colle dans SAP','success'); }
    else { var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Copié ! Colle dans SAP','success'); }
  } catch(e) { showToast('Erreur copie','err'); }
}

async function exportBon(id) {
  try {
    var data=await supa('GET','bons_commande?id=eq.'+id+'&select=*');
    if (!data||!data.length) return;
    var bon=data[0], arts=bon.articles||[], csv='\ufeff;article;quantite;;magasin;;ordre;op\n';
    for (var i=0;i<arts.length;i++) { var a=arts[i]; csv+=';'+a.num+';'+a.qty+';;2K;;'+bon.numero_ordre+';10\n'; }
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url; link.download='bon_'+bon.numero_ordre+'.csv'; link.click(); URL.revokeObjectURL(url);
    showToast('Export OK !','success');
  } catch(e) { showToast('Erreur export','err'); }
}

// ── PHOTO LIGHTBOX ──
var _lightboxPhotos=[], _lightboxIndex=0;
function openPhoto(url, allPhotos) {
  var overlay=document.getElementById('photoOverlay');
  _lightboxPhotos=allPhotos&&allPhotos.length?allPhotos:[url];
  _lightboxIndex=_lightboxPhotos.indexOf(url); if (_lightboxIndex<0) _lightboxIndex=0;
  document.getElementById('photoFull').src=_lightboxPhotos[_lightboxIndex];
  overlay.classList.remove('hidden');
  var multi=_lightboxPhotos.length>1;
  document.getElementById('photoArrowLeft').style.display=multi?'flex':'none';
  document.getElementById('photoArrowRight').style.display=multi?'flex':'none';
  document.getElementById('photoCounter').style.display=multi?'block':'none';
  if (multi) document.getElementById('photoCounter').textContent=(_lightboxIndex+1)+' / '+_lightboxPhotos.length;
}
function navigatePhoto(dir) {
  _lightboxIndex=(_lightboxIndex+dir+_lightboxPhotos.length)%_lightboxPhotos.length;
  document.getElementById('photoFull').src=_lightboxPhotos[_lightboxIndex];
  document.getElementById('photoCounter').textContent=(_lightboxIndex+1)+' / '+_lightboxPhotos.length;
}
function closePhoto() { document.getElementById('photoOverlay').classList.add('hidden'); }
function closePhotoOverlay(e) { if (e.target===document.getElementById('photoOverlay')) closePhoto(); }
document.addEventListener('keydown', function(e) {
  var o=document.getElementById('photoOverlay'); if (o.classList.contains('hidden')) return;
  if (e.key==='ArrowLeft') navigatePhoto(-1); else if (e.key==='ArrowRight') navigatePhoto(1); else if (e.key==='Escape') closePhoto();
});

// ── BUS BTNS ──
function toggleBusBtn(checkId, btnId, color) {
  var cb=document.getElementById(checkId), btn=document.getElementById(btnId), checkSpan=document.getElementById(checkId+'Check');
  cb.checked=!cb.checked;
  btn.style.opacity=cb.checked?'1':'0.6';
  if (checkSpan) checkSpan.style.display=cb.checked?'block':'none';
}
function setBusBtn(checkId, btnId, checked) {
  var cb=document.getElementById(checkId), btn=document.getElementById(btnId), checkSpan=document.getElementById(checkId+'Check');
  if (!cb||!btn) return;
  cb.checked=checked;
  btn.style.opacity=checked?'1':'0.6';
  if (checkSpan) checkSpan.style.display=checked?'block':'none';
}

// ── SWITCHES ──
function toggleSwitch(toggleId, inputId) {
  var input=document.getElementById(inputId), toggle=document.getElementById(toggleId); if (!input||!toggle) return;
  var isOn=input.value==='true'; isOn=!isOn;
  input.value=isOn?'true':'false';
  toggle.style.background=isOn?'#2ecc71':'#e74c3c';
  var dot=toggle.querySelector('.toggle-sw-dot'); if (dot) dot.style.left=isOn?'24px':'2px';
}
function setSwitch(toggleId, inputId, value) {
  var input=document.getElementById(inputId), toggle=document.getElementById(toggleId); if (!input||!toggle) return;
  input.value=value?'true':'false';
  toggle.style.background=value?'#2ecc71':'#e74c3c';
  var dot=toggle.querySelector('.toggle-sw-dot'); if (dot) dot.style.left=value?'24px':'2px';
}

// ── NOTIFICATIONS ──
var _soundEnabled=localStorage.getItem('soundEnabled')!=='false';
var _audioCtx=null;
document.addEventListener('click', function() {
  if (!_audioCtx) { try { _audioCtx=new (window.AudioContext||window.webkitAudioContext)(); } catch(e) {} }
  if (_audioCtx&&_audioCtx.state==='suspended') _audioCtx.resume().catch(function(){});
}, {once:false});

function playDing() {
  if (!_soundEnabled||!_audioCtx) return;
  try {
    if (_audioCtx.state==='suspended') _audioCtx.resume();
    var o=_audioCtx.createOscillator(), g=_audioCtx.createGain();
    o.connect(g); g.connect(_audioCtx.destination);
    o.frequency.setValueAtTime(880,_audioCtx.currentTime); o.frequency.setValueAtTime(1100,_audioCtx.currentTime+0.1);
    g.gain.setValueAtTime(0.3,_audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,_audioCtx.currentTime+0.6);
    o.start(_audioCtx.currentTime); o.stop(_audioCtx.currentTime+0.6);
  } catch(e) {}
}

function toggleSound() {
  _soundEnabled=!_soundEnabled; localStorage.setItem('soundEnabled',_soundEnabled?'true':'false');
  var btn=document.getElementById('btnSound');
  if (btn) { btn.textContent=_soundEnabled?'🔔':'🔕'; btn.style.color=_soundEnabled?'var(--ac)':'var(--mu)'; }
  showToast(_soundEnabled?'Son activé':'Son coupé','success');
}

function showNotifCommande(record) {
  var login=record?(record.login||'?'):'?', agent=record?(record.numero_agent||''):'';
  var ordre=record?(record.numero_ordre||'?'):'?', arts=record&&record.articles?record.articles.length:'?';
  var el=document.getElementById('notifCommande');
  if (!el) { el=document.createElement('div'); el.id='notifCommande'; el.style.cssText='position:fixed;top:-120px;left:50%;transform:translateX(-50%);z-index:850;transition:top 0.4s cubic-bezier(0.34,1.56,0.64,1);width:calc(100% - 32px);max-width:420px;'; document.body.appendChild(el); }
  el.innerHTML='<div style="background:#1a1d27;border:2px solid #f0a500;border-radius:14px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      +'<div><div style="font-size:13px;font-weight:700;color:#f0a500;margin-bottom:4px;">🔔 Nouvelle commande !</div>'
        +'<div style="font-size:12px;color:#e8eaf0;">👤 '+esc(login)+(agent?' · 🪪 Agent '+esc(agent):'')+'</div>'
        +'<div style="font-size:12px;color:#7a8099;margin-top:2px;">Ordre <strong style="color:#f0a500;">'+esc(ordre)+'</strong> · '+arts+' article(s)</div></div>'
      +'<div onclick="fermerNotif()" style="color:#7a8099;font-size:18px;cursor:pointer;padding:0 4px;">✕</div>'
    +'</div></div>';
  el.style.top='16px';
  clearTimeout(el._timer); el._timer=setTimeout(function(){fermerNotif();},6000);
}
function fermerNotif() { var el=document.getElementById('notifCommande'); if (el) el.style.top='-120px'; }

async function updateBadgeAttente() {
  if (currentUser.role!=='admin'&&currentUser.role!=='magasinier') return;
  try {
    var data=await supa('GET','bons_commande?sap_effectue=eq.false&statut=eq.valide&select=id');
    var nb=data?data.length:0;
    var badge=document.getElementById('badgeAttente');
    if (!badge) {
      badge=document.createElement('div'); badge.id='badgeAttente';
      badge.style.cssText='position:fixed;bottom:24px;right:16px;z-index:800;cursor:pointer;';
      badge.onclick=function() { switchSection('panier'); };
      document.body.appendChild(badge);
    }
    if (nb>0) {
      badge.innerHTML='<div style="background:#f0a500;color:#111;border-radius:14px;padding:10px 16px;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(240,165,0,0.4);display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">📋</span>'+nb+' commande'+(nb>1?'s':'')+' en attente SAP</div>';
      badge.style.display='block';
    } else badge.style.display='none';
  } catch(e) {}
}

// ── ADMIN ──
async function loadAdminPage() {
  await loadDemandes(); await loadDemandesCompte(); await loadUtilisateurs(); await loadHistoriqueActions();
}

async function loadDemandesCompte() {
  try {
    var data=await supa('GET','demandes_compte?statut=eq.en_attente&order=created_at.asc&select=*');
    var section=document.getElementById('demandesCompteSection'), badge=document.getElementById('badgeDemandesCompte'), list=document.getElementById('demandesCompteList');
    if (!section||!list) return;
    if (!data||!data.length) { section.style.display='none'; return; }
    section.style.display='block'; badge.style.display='inline-flex'; badge.textContent=data.length;
    var h='';
    for (var i=0;i<data.length;i++) {
      var d=data[i], date=new Date(new Date(d.created_at).getTime()+2*60*60*1000).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      h+='<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;margin-bottom:10px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
          +'<div><div style="font-size:14px;font-weight:700;">👤 '+esc(d.prenom)+' — Matricule '+esc(d.matricule)+'</div><div style="font-size:11px;color:var(--mu);margin-top:3px;">Demande le '+date+'</div></div>'
          +'<div style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" onclick="refuserCompte(\''+esc(d.id)+'\')">✕ Refuser</div>'
        +'</div>'
        +'<div style="margin-top:10px;background:var(--cd);border-radius:8px;padding:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
          +'<div style="font-size:12px;color:var(--mu);flex:1;">Rôle :</div>'
          +'<select id="role-'+d.id+'" style="background:var(--sf);border:1px solid var(--br);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--tx);">'
            +'<option value="agent">Agent</option><option value="magasinier">Magasinier</option><option value="brigadier">Brigadier</option>'
          +'</select>'
          +'<div onclick="validerCompte(\''+esc(d.id)+'\',\''+esc(d.matricule)+'\',\''+esc(d.prenom)+'\',\''+esc(d.password_hash)+'\')" style="background:rgba(46,204,113,0.1);border:1px solid var(--gn);color:var(--gn);border-radius:6px;padding:7px 14px;font-size:12px;cursor:pointer;font-weight:700;">✓ Valider</div>'
        +'</div></div>';
    }
    list.innerHTML=h;
  } catch(e) { console.error(e); }
}

async function validerCompte(id, matricule, prenom, pwdHash) {
  var role=document.getElementById('role-'+id); var roleVal=role?role.value:'agent';
  try {
    await supa('POST','utilisateurs',[{login:matricule,prenom:prenom,password_hash:pwdHash,role:roleVal,actif:true}]);
    await supa('PATCH','demandes_compte?id=eq.'+id,{statut:'valide'});
    showToast('Compte créé pour '+prenom,'success'); logAction('Creation compte: '+prenom+' / '+matricule+' / '+roleVal);
    loadDemandesCompte(); loadUtilisateurs();
  } catch(e) { showToast('Erreur — login déjà existant ?','err'); }
}

async function refuserCompte(id) {
  if (!confirm('Refuser cette demande ?')) return;
  try { await supa('PATCH','demandes_compte?id=eq.'+id,{statut:'refuse'}); showToast('Demande refusée','success'); loadDemandesCompte(); } catch(e) { showToast('Erreur','err'); }
}

async function loadDemandes() {
  try {
    var data=await supa('GET','demandes_reset?traitee=eq.false&order=created_at.asc&select=*');
    var section=document.getElementById('resetDemandesSection'), badge=document.getElementById('badgeDemandes'), list=document.getElementById('demandesList');
    if (!data||!data.length) { section.style.display='none'; return; }
    section.style.display='block'; badge.style.display='inline-flex'; badge.textContent=data.length;
    var h='';
    for (var i=0;i<data.length;i++) {
      var d=data[i], date=new Date(d.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      h+='<div style="background:var(--sf);border:1px solid var(--br);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:14px;font-weight:700;">👤 '+esc(d.login)+'</div><div style="font-size:11px;color:var(--mu);margin-top:2px;">'+date+'</div></div>'
        +'<div style="display:flex;gap:6px;">'
          +'<div style="background:rgba(46,204,113,0.1);border:1px solid var(--gn);color:var(--gn);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:600;" onclick="ouvrirResetModal(\''+esc(d.id)+'\',\''+esc(d.login)+'\')">🔑 Réinit</div>'
          +'<div style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" onclick="ignorerDemande(\''+esc(d.id)+'\')">Ignorer</div>'
        +'</div></div>';
    }
    list.innerHTML=h;
  } catch(e) { console.error(e); }
}

function ouvrirResetModal(id, login) {
  document.getElementById('resetUserId').value=id; document.getElementById('resetUserLogin').value=login;
  document.getElementById('resetUserLoginLabel').textContent=login; document.getElementById('resetNouveauPwd').value='';
  document.getElementById('resetPwdErr').textContent=''; document.getElementById('resetPwdModal').classList.remove('hidden');
}
async function ignorerDemande(id) { try { await supa('PATCH','demandes_reset?id=eq.'+id,{traitee:true}); loadDemandes(); } catch(e) { showToast('Erreur','err'); } }
async function validerResetPwd() {
  var id=document.getElementById('resetUserId').value, login=document.getElementById('resetUserLogin').value;
  var pwd=document.getElementById('resetNouveauPwd').value.trim(), err=document.getElementById('resetPwdErr');
  if (!pwd||pwd.length<4) { err.textContent='Mot de passe trop court.'; return; }
  var hash=await hashStr(login+':'+pwd);
  try {
    await supa('PATCH','utilisateurs?login=eq.'+encodeURIComponent(login),{password_hash:hash});
    await supa('PATCH','demandes_reset?id=eq.'+id,{traitee:true});
    ATOKENS.push(hash); document.getElementById('resetPwdModal').classList.add('hidden');
    showToast('Mot de passe réinitialisé !','success'); logAction('Reset MDP: '+login); loadDemandes(); loadUtilisateurs();
  } catch(e) { err.textContent='Erreur, réessaie.'; }
}
function fermerResetModal() { document.getElementById('resetPwdModal').classList.add('hidden'); }

async function loadUtilisateurs() {
  try {
    var data=await supa('GET','utilisateurs?select=*&order=prenom.asc');
    var list=document.getElementById('usersList');
    if (!data||!data.length) { list.innerHTML='<div style="color:var(--mu);padding:20px;text-align:center;">Aucun utilisateur</div>'; return; }
    var h='';
    for (var i=0;i<data.length;i++) {
      var u=data[i];
      h+='<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:14px;font-weight:600;">'+esc(u.prenom)+'</div><div style="font-size:11px;color:var(--mu);">'+esc(u.login)+' · '+(u.role==='admin'?'<span style="color:var(--ac);">Admin</span>':esc(u.role))+'</div>'+(u.actif?'':'<div style="font-size:10px;color:var(--rd);">Inactif</div>')+'</div>'
        +'<div style="display:flex;gap:6px;">'
          +'<div style="background:rgba(240,165,0,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" data-id="'+u.id+'" onclick="editUser(this)">✏️</div>'
          +(u.login!=='Djulien'?'<div style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;" data-id="'+u.id+'" onclick="deleteUser(this)">🗑</div>':'')
        +'</div></div>';
    }
    list.innerHTML=h;
  } catch(e) { console.error(e); }
}

async function createUser() {
  var prenom=document.getElementById('newPrenom').value.trim(), login=document.getElementById('newLogin').value.trim().toLowerCase();
  var pwd=document.getElementById('newPwd').value.trim(), role=document.getElementById('newRole').value;
  var peutModifier=document.getElementById('newPeutModifier')?document.getElementById('newPeutModifier').checked:true;
  if (!prenom||!login||!pwd) { showToast('Tous les champs sont obligatoires','err'); return; }
  if (pwd.length<4) { showToast('Mot de passe trop court','err'); return; }
  var hash=await hashStr(login+':'+pwd);
  try {
    await supa('POST','utilisateurs',[{prenom:prenom,login:login,password_hash:hash,role:role,actif:true,peut_modifier:peutModifier}]);
    ATOKENS.push(hash); document.getElementById('newPrenom').value=''; document.getElementById('newLogin').value=''; document.getElementById('newPwd').value='';
    showToast('Utilisateur créé !','success'); loadUtilisateurs(); logAction('Créé utilisateur: '+login);
  } catch(e) { showToast('Erreur création','err'); }
}

async function deleteUser(el) {
  var id=el.getAttribute('data-id'); if (!confirm('Supprimer cet utilisateur ?')) return;
  try { await supa('DELETE','utilisateurs?id=eq.'+id); showToast('Utilisateur supprimé','success'); loadUtilisateurs(); } catch(e) { showToast('Erreur','err'); }
}

async function editUser(el) {
  var id=el.getAttribute('data-id');
  try {
    var data=await supa('GET','utilisateurs?id=eq.'+id+'&select=*'); if (!data||!data.length) return;
    var u=data[0];
    document.getElementById('editUserId').value=u.id; document.getElementById('editUserPrenom').value=u.prenom||'';
    document.getElementById('editUserLogin').value=u.login||''; document.getElementById('editUserPwd').value='';
    document.getElementById('editUserRole').value=u.role||'agent';
    setSwitch('toggleActif','editUserActif',u.actif===true);
    setSwitch('togglePeutModifier','editUserPeutModifier',u.peut_modifier!==false);
    document.getElementById('editUserModal').classList.remove('hidden');
  } catch(e) { showToast('Erreur','err'); }
}

async function saveEditUser() {
  var id=document.getElementById('editUserId').value, prenom=document.getElementById('editUserPrenom').value.trim();
  var login=document.getElementById('editUserLogin').value.trim().toLowerCase(), pwd=document.getElementById('editUserPwd').value.trim();
  var role=document.getElementById('editUserRole').value;
  var actif=document.getElementById('editUserActif').value==='true';
  var peutModifier=document.getElementById('editUserPeutModifier').value==='true';
  if (!prenom||!login) { showToast('Prénom et login obligatoires','err'); return; }
  var updates={prenom:prenom,login:login,role:role,actif:actif,peut_modifier:peutModifier};
  if (pwd) {
    updates.password_hash=await hashStr(login+':'+pwd);
    var oldData=await supa('GET','utilisateurs?id=eq.'+id+'&select=password_hash');
    if (oldData&&oldData.length) { var oldHash=oldData[0].password_hash; var idx=ATOKENS.indexOf(oldHash); if (idx>=0) ATOKENS[idx]=updates.password_hash; else ATOKENS.push(updates.password_hash); }
  }
  try {
    await supa('PATCH','utilisateurs?id=eq.'+id,updates);
    document.getElementById('editUserModal').classList.add('hidden'); showToast('Modifié !','success'); logAction('Modifié utilisateur: '+login); loadUtilisateurs();
  } catch(e) { showToast('Erreur','err'); }
}
function closeEditUser() { document.getElementById('editUserModal').classList.add('hidden'); }

async function loadHistoriqueActions() {
  try {
    var data=await supa('GET','historique_actions?select=*&order=created_at.desc&limit=50');
    var list=document.getElementById('actionsList');
    if (!data||!data.length) { list.innerHTML='<div style="color:var(--mu);padding:20px;text-align:center;">Aucune action</div>'; return; }
    var h='';
    for (var i=0;i<data.length;i++) {
      var a=data[i], date=new Date(a.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      h+='<div style="background:var(--sf);border:1px solid var(--br);border-radius:8px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:12px;font-weight:700;color:var(--ac);">'+esc(a.prenom)+'</div><div style="font-size:12px;color:var(--tx);">'+esc(a.action)+'</div>'+(a.details?'<div style="font-size:11px;color:var(--mu);">'+esc(a.details)+'</div>':'')+'</div>'
        +'<div style="font-size:11px;color:var(--mu);white-space:nowrap;">'+date+'</div></div>';
    }
    list.innerHTML=h;
  } catch(e) { console.error(e); }
}

async function logAction(action, details) {
  if (!currentUser.login) return;
  try { await supa('POST','historique_actions',[{login:currentUser.login,prenom:currentUser.prenom,action:action,details:details||''}]); } catch(e) {}
}

// ── REALTIME ──
var _lastBonId=null, _lastBonCreatedAt=null, _pollingInterval=null, _notifCooldown=false;

function initRealtime() {
  supa('GET','bons_commande?select=id,date_creation&order=date_creation.desc&limit=1').then(function(data) {
    if (data&&data.length) { _lastBonId=data[0].id; _lastBonCreatedAt=data[0].date_creation; }
  }).catch(function(){});

  try {
    var ws=new WebSocket(SURL.replace('https://','wss://')+'/realtime/v1/websocket?apikey='+SKEY+'&vsn=1.0.0');
    ws.onopen=function() {
      ws.send(JSON.stringify({topic:'realtime:public:bons_commande',event:'phx_join',payload:{},ref:'1'}));
      ws.send(JSON.stringify({topic:'realtime:public:articles',event:'phx_join',payload:{},ref:'2'}));
      ws.send(JSON.stringify({topic:'realtime:public:outillage',event:'phx_join',payload:{},ref:'3'}));
    };
    ws.onmessage=function(e) {
      try {
        var msg=JSON.parse(e.data); if (msg.event==='phx_reply') return;
        if (msg.topic&&msg.topic.indexOf('bons_commande')>=0) { updateBadgeAttente(); if (_currentSection==='panier') loadHistorique(); }
        if (msg.topic&&msg.topic.indexOf('articles')>=0) { loadArticlesSilent(); }
        if (msg.topic&&msg.topic.indexOf('outillage')>=0) {
          if (_currentSection==='outillage') loadOutillage();
          else supa('GET','outillage?select=*&order=nom.asc').then(function(data){if(data){outillage=data;updateBadgePretsOutillage();}}).catch(function(){});
        }
      } catch(err) {}
    };
    ws.onclose=function() { setTimeout(initRealtime,3000); };
    ws.onerror=function() { ws.close(); };
  } catch(e) {}

  if (_pollingInterval) clearInterval(_pollingInterval);
  _pollingInterval=setInterval(async function() {
    if (currentUser.role!=='admin'&&currentUser.role!=='magasinier') return;
    try {
      var data=await supa('GET','bons_commande?select=id,login,numero_agent,numero_ordre,articles,date_creation&order=date_creation.desc&limit=1');
      if (data&&data.length) {
        var latest=data[0];
        var isNewer=_lastBonCreatedAt===null||latest.date_creation>_lastBonCreatedAt;
        if (_lastBonId!==null&&latest.id!==_lastBonId&&isNewer) {
          _lastBonId=latest.id; _lastBonCreatedAt=latest.date_creation; onNouveauBon(latest);
        } else { if (_lastBonId===null) { _lastBonId=latest.id; _lastBonCreatedAt=latest.date_creation; } updateBadgeAttente(); }
      } else updateBadgeAttente();
    } catch(e) {}
  },12000);
}

function onNouveauBon(record) {
  if (currentUser.role!=='admin'&&currentUser.role!=='magasinier') return;
  if (!record||!record.id||!record.numero_ordre) return;
  if (record.login&&record.login===currentUser.login) { updateBadgeAttente(); if (_currentSection==='panier') loadHistorique(); return; }
  if (_notifCooldown) return;
  _notifCooldown=true; setTimeout(function(){_notifCooldown=false;},5000);
  if (_currentSection==='panier') loadHistorique();
  playDing(); showNotifCommande(record); updateBadgeAttente();
}

async function loadArticlesSilent() {
  try {
    var all=[],page=0;
    while (true) {
      var data=await supa('GET','articles?select=*&order=nom.asc&limit=1000&offset='+(page*1000));
      if (!data||!data.length) break; all=all.concat(data); if (data.length<1000) break; page++;
    }
    if (all.length>0) { articles=all; buildSidebar(); doSearch(); }
  } catch(e) {}
}

// ── OUTILLAGE ──
var outillage=[], _outilPhoto=null, _outilEditPhoto=null;

async function loadOutillage() {
  try {
    var data=await supa('GET','outillage?select=*&order=nom.asc');
    outillage=data||[]; doOutilSearch(); updateBadgePretsOutillage();
    var tab2=document.getElementById('ot2'); if (tab2) tab2.style.display=window._canEdit?'':'none';
  } catch(e) { showToast('Erreur chargement outillage','err'); }
}

function doOutilSearch() {
  var q=normalize(document.getElementById('outilSearch').value.trim());
  var fil=outillage.filter(function(o) { if (!q) return true; return (normalize(o.nom)+'|'+normalize(o.location||'')+'|'+normalize(o.tags||'')).indexOf(q)>=0; });
  var count=document.getElementById('outilCount');
  var enPret=outillage.filter(function(o){return o.agent_pret;}).length;
  if (count) count.textContent=fil.length+' outil(s)'+(enPret?' · ⚠️ '+enPret+' en prêt':'');
  var res=document.getElementById('outilRes'); if (!res) return;
  if (!fil.length) { res.innerHTML='<div style="text-align:center;color:var(--mu);padding:40px 20px;"><div style="font-size:36px;margin-bottom:10px;">🔧</div>Aucun outil trouvé</div>'; return; }

  res.innerHTML=fil.map(function(o) {
    var isPret=!!o.agent_pret, borderColor=isPret?'#e74c3c':'var(--br)';
    var canRetour=currentUser.role==='admin'||currentUser.role==='magasinier'||currentUser.role==='brigadier';
    var pretPanel=isPret
      ?'<div style="background:rgba(231,76,60,0.1);border:1px solid #e74c3c;border-radius:8px;padding:8px 12px;margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;" onclick="event.stopPropagation()">'
        +'<div><div style="font-size:12px;font-weight:700;color:#e74c3c;">🔴 EN PRÊT — Agent '+esc(o.agent_pret)+'</div>'
        +(o.date_pret?'<div style="font-size:10px;color:var(--mu);margin-top:2px;">Depuis le '+formatDateBelge(o.date_pret)+'</div>':'')
        +'</div>'+(canRetour?'<div onclick="retourOutil(\''+o.id+'\')" style="background:#2ecc71;color:#111;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">✓ Retour</div>':'')
        +'</div>'
      :'<div id="pretPanel-'+o.id+'" style="display:none;background:var(--sf);border:1px solid var(--ac);border-radius:8px;padding:8px 12px;margin-top:8px;">'
        +'<div style="display:flex;gap:8px;align-items:center;">'
          +'<input type="text" id="pret-'+o.id+'" placeholder="N° agent..." style="flex:1;background:var(--bg);border:1px solid var(--br2);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--tx);-webkit-appearance:none;outline:none;" inputmode="numeric"/>'
          +'<div onclick="confirmerPret(\''+o.id+'\')" style="background:#e74c3c;color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Confirmer prêt</div>'
          +'<div onclick="document.getElementById(\'pretPanel-'+o.id+'\').style.display=\'none\'" style="color:var(--mu);cursor:pointer;padding:4px 8px;font-size:16px;">✕</div>'
        +'</div></div>';
    var photoHtml=o.photo?'<img src="'+esc(o.photo)+'" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:pointer;display:none;" class="outil-photo" onclick="event.stopPropagation();openPhoto(\''+esc(o.photo)+'\',[\''+esc(o.photo)+'\'])">':'';
    var pretBtnAction=isPret?'':'togglePretPanel(\''+o.id+'\')';
    return '<div class="outil-card'+(isPret?' pret':'')+'" style="border-left:4px solid '+borderColor+';" onclick="toggleOutilCard(this)">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-size:14px;font-weight:700;color:var(--tx);">'+esc(o.nom)+(o.photo?' <span style="font-size:12px;color:var(--mu);">📷</span>':'')+'</div>'
          +(o.location&&currentUser.role!=='agent'?'<div style="font-size:11px;color:var(--mu);margin-top:3px;font-family:monospace;">📍 '+esc(o.location)+'</div>':'')
          +(o.tags?'<div style="font-size:10px;color:var(--mu);margin-top:2px;">'+esc(o.tags)+'</div>':'')
        +'</div>'
        +(window._canEdit?'<div style="display:flex;gap:5px;flex-shrink:0;" onclick="event.stopPropagation()">'
          +'<div onclick="'+pretBtnAction+'" style="background:rgba('+(isPret?'231,76,60':'46,204,113')+',0.1);border:1px solid '+(isPret?'#e74c3c':'#2ecc71')+';border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">'+(isPret?'🔴':'🟢')+'</div>'
          +'<div onclick="openOutilEdit(\''+o.id+'\')" style="background:rgba(240,165,0,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">✏️</div>'
          +'<div onclick="deleteOutil(\''+o.id+'\')" style="background:rgba(231,76,60,0.1);border:1px solid var(--rd);color:var(--rd);border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;">🗑</div>'
          +'</div>':'')
      +'</div>'+pretPanel+photoHtml+'</div>';
  }).join('');
  updateBadgePretsOutillage();
}

function formatDateBelge(ts) { var d=new Date(new Date(ts).getTime()+2*60*60*1000); return d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

function toggleOutilCard(card) {
  var photo=card.querySelector('.outil-photo'), isOpen=card.classList.contains('exp');
  card.classList.toggle('exp',!isOpen); if (photo) photo.style.display=isOpen?'none':'block';
}
function togglePretPanel(id) {
  var panel=document.getElementById('pretPanel-'+id); if (!panel) return;
  panel.style.display=panel.style.display==='none'?'':'none';
  if (panel.style.display!=='none') { var input=document.getElementById('pret-'+id); if (input) input.focus(); }
}
async function confirmerPret(id) {
  var input=document.getElementById('pret-'+id), agent=input?input.value.trim():'';
  if (!agent) { showToast('Saisir un numéro d\'agent','err'); return; }
  try { await supa('PATCH','outillage?id=eq.'+id,{agent_pret:agent,date_pret:new Date().toISOString()}); showToast('Prêt enregistré — Agent '+agent,'success'); await loadOutillage(); } catch(e) { showToast('Erreur','err'); }
}
async function retourOutil(id) {
  if (!confirm('Confirmer le retour ?')) return;
  try { await supa('PATCH','outillage?id=eq.'+id,{agent_pret:null,date_pret:null}); showToast('Retour enregistré ✓','success'); await loadOutillage(); } catch(e) { showToast('Erreur','err'); }
}

function updateBadgePretsOutillage() {
  if (currentUser.role!=='admin'&&currentUser.role!=='magasinier') return;
  var nb=outillage.filter(function(o){return o.agent_pret;}).length;
  var badge=document.getElementById('badgePrets');
  if (!badge) {
    badge=document.createElement('div'); badge.id='badgePrets'; badge.style.cssText='position:fixed;bottom:76px;right:16px;z-index:800;cursor:pointer;';
    badge.onclick=function(){switchSection('outillage');}; document.body.appendChild(badge);
  }
  if (nb>0) { badge.innerHTML='<div style="background:#e74c3c;color:#fff;border-radius:14px;padding:10px 16px;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(231,76,60,0.4);display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">🔧</span>'+nb+' outil'+(nb>1?'s':'')+' en prêt</div>'; badge.style.display='block'; }
  else badge.style.display='none';
}

function switchOutilTab(id) {
  ['ot1','ot2'].forEach(function(t) {
    var el=document.getElementById(t); if (!el) return;
    el.style.color=t===id?'var(--ac)':'var(--mu)';
    el.style.borderBottom=t===id?'2px solid var(--ac)':'2px solid transparent';
  });
  document.getElementById('op1').style.display=id==='ot1'?'flex':'none';
  document.getElementById('op2').style.display=id==='ot2'?'flex':'none';
}

function openOutilEdit(id) {
  var o=outillage.filter(function(x){return x.id===id;})[0]; if (!o) return;
  document.getElementById('outilEditId').value=o.id; document.getElementById('outilEditNom').value=o.nom||'';
  document.getElementById('outilEditLoc').value=o.location||''; document.getElementById('outilEditTags').value=o.tags||'';
  _outilEditPhoto=o.photo||null;
  var container=document.getElementById('outilEditPhotoContainer');
  container.innerHTML=o.photo?'<img src="'+esc(o.photo)+'" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">':'';
  document.getElementById('outilEditPhotoRemove').style.display=o.photo?'block':'none';
  document.getElementById('outilEditModal').classList.remove('hidden');
}
function closeOutilEdit() { document.getElementById('outilEditModal').classList.add('hidden'); }
async function deleteOutil(id) { if (!confirm('Supprimer cet outil ?')) return; try { await supa('DELETE','outillage?id=eq.'+id); showToast('Outil supprimé','success'); loadOutillage(); } catch(e) { showToast('Erreur','err'); } }

async function uploadPhoto(file, bucket) {
  try {
    var ext=file.name.split('.').pop(), path=Date.now()+'.'+ext;
    var resp=await fetch(SURL+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers:{'Authorization':'Bearer '+SKEY,'Content-Type':file.type},body:file});
    if (!resp.ok) throw new Error();
    return SURL+'/storage/v1/object/public/'+bucket+'/'+path;
  } catch(e) { showToast('Erreur upload photo','err'); return null; }
}

document.addEventListener('DOMContentLoaded', function() {
  var ot1=document.getElementById('ot1'), ot2=document.getElementById('ot2');
  if (ot1) ot1.addEventListener('click', function(){switchOutilTab('ot1');});
  if (ot2) ot2.addEventListener('click', function(){switchOutilTab('ot2');});

  var addBtn=document.getElementById('outilAddBtn');
  if (addBtn) addBtn.addEventListener('click', async function() {
    var nom=(document.getElementById('outilNom').value||'').trim(); if (!nom) { showToast('Désignation obligatoire','err'); return; }
    var obj={nom:nom,location:(document.getElementById('outilLoc').value||'').trim(),tags:(document.getElementById('outilTags').value||'').trim(),photo:_outilPhoto||null};
    try {
      await supa('POST','outillage',[obj]); showToast('Outil enregistré !','success');
      document.getElementById('outilNom').value=''; document.getElementById('outilLoc').value=''; document.getElementById('outilTags').value='';
      _outilPhoto=null; document.getElementById('outilPhotoContainer').innerHTML='';
      loadOutillage(); switchOutilTab('ot1');
    } catch(e) { showToast('Erreur','err'); }
  });

  var photoInput=document.getElementById('outilPhotoInput');
  if (photoInput) photoInput.addEventListener('change', async function() {
    var file=this.files[0]; if (!file) return;
    var url=await uploadPhoto(file,'outillage');
    if (url) { _outilPhoto=url; document.getElementById('outilPhotoContainer').innerHTML='<img src="'+url+'" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">'; }
  });

  var editPhotoInput=document.getElementById('outilEditPhotoInput');
  if (editPhotoInput) editPhotoInput.addEventListener('change', async function() {
    var file=this.files[0]; if (!file) return;
    var url=await uploadPhoto(file,'outillage');
    if (url) { _outilEditPhoto=url; document.getElementById('outilEditPhotoContainer').innerHTML='<img src="'+url+'" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">'; document.getElementById('outilEditPhotoRemove').style.display='block'; }
  });

  var removeBtn=document.getElementById('outilEditPhotoRemove');
  if (removeBtn) removeBtn.addEventListener('click', function(){_outilEditPhoto=null;document.getElementById('outilEditPhotoContainer').innerHTML='';this.style.display='none';});

  var saveBtn=document.getElementById('outilEditSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async function() {
    var id=document.getElementById('outilEditId').value, nom=(document.getElementById('outilEditNom').value||'').trim();
    if (!nom) { showToast('Désignation obligatoire','err'); return; }
    var obj={nom:nom,location:(document.getElementById('outilEditLoc').value||'').trim(),tags:(document.getElementById('outilEditTags').value||'').trim(),photo:_outilEditPhoto};
    try { await supa('PATCH','outillage?id=eq.'+id,obj); showToast('Outil modifié !','success'); closeOutilEdit(); loadOutillage(); } catch(e) { showToast('Erreur','err'); }
  });
});

// Onglet Ajouter dans la sidebar (bouton spécial pour canEdit)
document.addEventListener('DOMContentLoaded', function() {
  // Injecter bouton Ajouter dans la sidebar quand canEdit
  // Géré via initUI après auth
});

initRealtime();
checkAuth();
