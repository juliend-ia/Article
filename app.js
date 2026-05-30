var SURL = 'https://gyflqtysqpywikxgzxci.supabase.co';
var SKEY = 'sb_publishable_F0Gcdx4mHDbvAAcuXwYbhA_QSlPD8aC';
var ATOKENS = ['a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0','35a85085a9ccd1440acb20cca15b78b0353f4f354bfcf8dd5d2f3d36734ca7be'];
var ADMIN_TOKEN = 'a92be39b486c2c2736d20f3b6e7a7d64b519c564ad44e4d266fdebe5b6c03ff0';
var currentUser = {login:'',prenom:'',role:'user',token:''};
var SKEY2 = 'bus-auth-v1';
var articles = [], selectedCat = 'TOUT', editingNum = null, filtered = [], displayCount = 30, panier = [], _busFilter = '';
var _editPhoto = null, _editPhotos = [], _sortiesCount = {};
var _borneAgentNum = ''; // numéro agent saisi sur la borne

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
        currentUser.role = currentUser.login === 'borne' ? 'borne' : data[0].role;
        currentUser.peut_modifier = data[0].peut_modifier !== false;
        if (!data[0].actif) { localStorage.removeItem(SKEY2); location.reload(); return; }
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    } catch(e) {}
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');
    initKioskMode();
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
      var role = dbUser.login === 'borne' ? 'borne' : dbUser.role;
      currentUser = {login:dbUser.login,prenom:dbUser.prenom,role:role,token:h,peut_modifier:dbUser.peut_modifier!==false};
      if (ATOKENS.indexOf(h)<0) ATOKENS.push(h);
      localStorage.setItem(SKEY2,h); localStorage.setItem('currentUser',JSON.stringify(currentUser));
      document.getElementById('loginOverlay').classList.add('hidden');
      document.getElementById('appRoot').classList.remove('hidden');
      initKioskMode(); initUI(); loadArticles(); return;
    }
  } catch(e) { console.error(e); }
  if (ATOKENS.indexOf(h)>=0) {
    currentUser = h===ADMIN_TOKEN ? {login:'Djulien',prenom:'Djulien',role:'admin',token:h} : {login:'magasin2k',prenom:'Magasin',role:'magasinier',token:h};
    localStorage.setItem(SKEY2,h); localStorage.setItem('currentUser',JSON.stringify(currentUser));
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');
    initKioskMode(); initUI(); loadArticles();
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
  _soundEnabled = localStorage.getItem('soundEnabled_'+currentUser.login) !== 'false';
  var btnSound = document.getElementById('btnSound');
  if (btnSound) {
    if (role !== 'agent' && role !== 'borne') { btnSound.style.display='flex'; btnSound.textContent=_soundEnabled?'🔔':'🔕'; }
    else btnSound.style.display='none';
  }

  // Admin
  var navAdmin = document.getElementById('navAdmin');
  if (navAdmin) navAdmin.style.display = role==='admin'?'block':'none';
  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.addEventListener('click', function() { switchSection('admin'); });

  // Bouton "Changer d'agent" (borne uniquement)
  var btnBorne = document.getElementById('btnChangerAgent');
  if (btnBorne) btnBorne.style.display = role==='borne' ? 'flex' : 'none';

  // Agent / borne
  var agentField = document.getElementById('agentField');
  if (agentField) agentField.classList.add('hidden'); // toujours caché (géré par borne overlay)

  var messageField = document.getElementById('messageField');
  if (messageField) messageField.style.display = (role==='agent' || role==='brigadier' || role==='borne') ? '' : 'none';

  // Historique
  var histoSection = document.getElementById('histoSection');
  if (histoSection) histoSection.style.display = 'block';

  // Infos user header
  document.getElementById('userInfo').textContent = role==='borne' ? 'Borne' : (currentUser.prenom||'');
  var roleEl = document.getElementById('userRole');
  if (roleEl) {
    var roles = {admin:'Admin',magasinier:'Magasinier',brigadier:'Brigadier',agent:'Agent',borne:'Borne'};
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

  // Borne → afficher l'écran de saisie agent
  if (role === 'borne') {
    showBorneEntry();
  }
}

// ── SCANNER CODE-BARRE ──
var _scannerStream = null, _scannerInterval = null;

async function startBarcodeScanner() {
  var overlay = document.getElementById('scannerOverlay');
  var video = document.getElementById('scannerVideo');
  var status = document.getElementById('scannerStatus');
  var result = document.getElementById('scannerResult');
  if (!overlay || !video) return;

  // Vérifier support BarcodeDetector
  if (!('BarcodeDetector' in window)) {
    showToast('Scanner non supporté — saisis le numéro manuellement','err');
    return;
  }

  result.textContent = '';
  status.textContent = 'Démarrage caméra...';
  overlay.classList.remove('hidden');

  try {
    _scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: {ideal:1280}, height: {ideal:720} }
    });
    video.srcObject = _scannerStream;

    var detector = new BarcodeDetector({ formats: ['code_128','code_39','ean_13','ean_8','itf','codabar'] });
    status.textContent = 'Pointez vers le code-barre de la feuille de route';

    _scannerInterval = setInterval(async function() {
      if (video.readyState < 2) return;
      try {
        var barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          var val = barcodes[0].rawValue.trim();
          result.textContent = '✓ ' + val;
          status.textContent = 'Code-barre détecté !';
          // Remplir le champ numéro d'ordre
          var input = document.getElementById('numeroOrdre');
          if (input) input.value = val;
          // Fermer après 1 seconde
          setTimeout(function() { stopBarcodeScanner(); }, 900);
        }
      } catch(e) {}
    }, 400);

  } catch(e) {
    status.textContent = 'Erreur caméra — vérifie les permissions';
    showToast('Accès caméra refusé','err');
  }
}

function stopBarcodeScanner() {
  clearInterval(_scannerInterval); _scannerInterval = null;
  if (_scannerStream) { _scannerStream.getTracks().forEach(function(t){t.stop();}); _scannerStream = null; }
  var overlay = document.getElementById('scannerOverlay');
  if (overlay) overlay.classList.add('hidden');
  var video = document.getElementById('scannerVideo');
  if (video) video.srcObject = null;
}

// ── BORNE ──
function showBorneEntry() {
  _borneAgentNum = '';
  panier = []; updateBadge(); renderPanier();
  var hList = document.getElementById('historiqueList');
  if (hList) hList.innerHTML = '';
  var overlay = document.getElementById('borneOverlay');
  if (overlay) overlay.classList.remove('hidden');
  var input = document.getElementById('borneAgentInput');
  if (input) { input.value = ''; setTimeout(function(){ input.focus(); }, 400); }
  var err = document.getElementById('borneErr');
  if (err) err.textContent = '';
  var ui = document.getElementById('userInfo');
  if (ui) ui.textContent = 'Borne';
  switchSection('pieces');
}

// ── SORTIE SECRÈTE KIOSQUE ──
var _logoClicks = 0, _logoTimer = null;
function secretLogoClick() {
  if (currentUser.role !== 'borne') return;
  _logoClicks++;
  clearTimeout(_logoTimer);
  _logoTimer = setTimeout(function() { _logoClicks = 0; }, 2000);
  if (_logoClicks >= 5) {
    _logoClicks = 0;
    var pwd = prompt('🔐 Code administrateur :');
    if (!pwd) return;
    hashStr('Djulien:' + pwd).then(function(h) {
      if (ATOKENS.indexOf(h) >= 0 || h === ADMIN_TOKEN) {
        document.exitFullscreen && document.exitFullscreen();
        // Afficher le bouton déconnexion pour permettre de se reconnecter en admin
        var logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'block';
        showToast('Mode admin déverrouillé', 'success');
        // Déconnecter et recharger pour permettre un autre login
        setTimeout(function() {
          localStorage.removeItem(SKEY2); localStorage.removeItem('currentUser');
          location.reload();
        }, 1500);
      } else {
        showToast('Code incorrect', 'err');
      }
    });
  }
}

// ── MODE KIOSQUE : protection clavier ──
function initKioskMode() {
  // Bloquer les raccourcis qui permettraient de sortir
  document.addEventListener('keydown', function(e) {
    if (currentUser.role !== 'borne') return;
    var blocked = [
      e.key === 'F5',                              // Rafraîchir
      e.key === 'F11',                             // Sortir plein écran
      e.key === 'Escape' && !e.target.closest('input,textarea'), // Escape hors champ
      (e.ctrlKey || e.metaKey) && e.key === 'r',  // Ctrl+R
      (e.ctrlKey || e.metaKey) && e.key === 'w',  // Ctrl+W (fermer onglet)
      (e.ctrlKey || e.metaKey) && e.key === 't',  // Ctrl+T (nouvel onglet)
      (e.ctrlKey || e.metaKey) && e.key === 'l',  // Ctrl+L (barre adresse)
      (e.ctrlKey || e.metaKey) && e.key === 'n',  // Ctrl+N (nouvelle fenêtre)
      e.altKey && e.key === 'F4',                  // Alt+F4
      e.altKey && e.key === 'Tab',                 // Alt+Tab partiel
    ];
    if (blocked.some(Boolean)) { e.preventDefault(); }
  }, true);

  // Bloquer clic droit
  document.addEventListener('contextmenu', function(e) {
    if (currentUser.role === 'borne') e.preventDefault();
  });

  // Reprendre le plein écran si l'agent en sort (ex: touche Escape)
  document.addEventListener('fullscreenchange', function() {
    if (currentUser.role === 'borne' && !document.fullscreenElement) {
      setTimeout(function() {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      }, 500);
    }
  });
}

function confirmBorneAgent() {
  var input = document.getElementById('borneAgentInput');
  var val = (input ? input.value.trim() : '');
  var err = document.getElementById('borneErr');
  if (!val || val.length < 2) {
    if (err) err.textContent = 'Numéro invalide — réessaie';
    return;
  }
  _borneAgentNum = val;
  var overlay = document.getElementById('borneOverlay');
  if (overlay) overlay.classList.add('hidden');
  // Plein écran depuis un vrai clic utilisateur
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
  var ui = document.getElementById('userInfo');
  if (ui) ui.textContent = 'Agent ' + val;
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
    // Tous les bons (valide + archive) pour un tri de tout temps
    var all = [], page = 0;
    while (true) {
      var data = await supa('GET','bons_commande?select=articles&statut=in.(valide,archive)&limit=1000&offset='+(page*1000));
      if (!data||!data.length) break;
      all = all.concat(data);
      if (data.length<1000) break;
      page++;
    }
    _sortiesCount = {};
    for (var i=0;i<all.length;i++) {
      var arts = all[i].articles||[];
      for (var j=0;j<arts.length;j++) { var n=arts[j].num; _sortiesCount[n]=(_sortiesCount[n]||0)+arts[j].qty; }
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
  var mobile = window.innerWidth <= 700;
  var cats = ['TOUT'].concat(getCats());
  var counts = {TOUT: articles.length};
  for (var i=0;i<articles.length;i++) { var cat=articles[i].categorie||''; if (cat) counts[cat]=(counts[cat]||0)+1; }

  if (mobile) {
    // ── MODE MOBILE : sidebar cachée, barre horizontale dans main-content ──
    var sb = document.getElementById('sidebarCats');
    if (sb) sb.style.display = 'none';

    // Forcer sectionPieces en colonne pour que main-content prenne 100%
    var sp = document.getElementById('sectionPieces');
    if (sp) sp.style.flexDirection = 'column';

    // Cacher le bouton Ajouter de la sidebar (il sera accessible via Admin sur mobile)
    var sf = document.getElementById('sidebarFooter');
    if (sf) sf.style.display = 'none';

    var bar = document.getElementById('mobileCatsBar');
    if (!bar) return;
    bar.style.display = 'flex';

    var h = '';
    for (var i=0;i<cats.length;i++) {
      var c=cats[i], on=(c===selectedCat);
      h += '<div data-cat="'+esc(c)+'" style="display:inline-flex;flex-direction:column;align-items:center;padding:8px 14px 6px;cursor:pointer;border-bottom:3px solid '+(on?'var(--ac)':'transparent')+';flex-shrink:0;gap:3px;">'
        +'<div style="width:30px;height:30px;border-radius:8px;background:'+(on?'rgba(240,165,0,0.12)':'#1a1d2e')+';border:1px solid '+(on?'rgba(240,165,0,0.3)':'#1e2235')+';display:flex;align-items:center;justify-content:center;font-size:13px;">'+getCatIcon(c)+'</div>'
        +'<div style="font-size:10px;font-weight:700;color:'+(on?'var(--ac)':'#6a6d82')+';margin-top:1px;">'+esc(c==='TOUT'?'Tout':c)+'</div>'
        +'<div style="font-size:9px;color:#4a5068;">'+(counts[c]||0)+'</div>'
        +'</div>';
    }
    bar.innerHTML = h;
    bar.querySelectorAll('[data-cat]').forEach(function(el) {
      el.addEventListener('click', function() {
        selectedCat = this.getAttribute('data-cat');
        displayCount = 30;
        buildSidebar();
        doSearch();
      });
    });

    // Grille 1 colonne
    var grid = document.getElementById('p1');
    if (grid) { grid.style.gridTemplateColumns='1fr'; grid.style.padding='10px 12px'; grid.style.gap='8px'; }

  } else {
    // ── MODE DESKTOP : sidebar verticale, barre mobile cachée ──
    var bar = document.getElementById('mobileCatsBar');
    if (bar) bar.style.display = 'none';

    var sb = document.getElementById('sidebarCats');
    var inAdmin = (_currentSection==='admin' || _currentSection==='ajouter');
    if (sb) sb.style.display = inAdmin ? 'none' : '';

    var sp = document.getElementById('sectionPieces');
    if (sp) sp.style.flexDirection = 'row';

    var sf = document.getElementById('sidebarFooter');
    if (sf) sf.style.display = inAdmin ? 'none' : '';

    var h = '';
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
}

// ── RECHERCHE ──
function normalize(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

// \u2500\u2500 RECHERCHE INTELLIGENTE \u2500\u2500

// Dictionnaire synonymes / abr\u00e9viations m\u00e9canicien bus
var SYNO = {
  'frein':['plaquette','disque','sabot','machoire','etrier','abs'],
  'plaquette':['frein','disque','sabot','brake'],
  'disque':['frein','plaquette','rotor'],
  'amortisseur':['suspension','ressort','amor','choc'],
  'suspension':['amortisseur','ressort','silent','silentbloc'],
  'ressort':['suspension','amortisseur','lame'],
  'essuie':['balai','wiper','essuie-glace','raclette'],
  'balai':['essuie','wiper','essuie-glace'],
  'filtre':['filtration','cartouche'],
  'huile':['lubrifiant','graisse','oil'],
  'graisse':['lubrifiant','huile'],
  'joint':['etancheite','seal','garniture','bague'],
  'courroie':['distribution','belt','chaine'],
  'chaine':['distribution','courroie'],
  'phare':['feu','lumiere','led','optique','eclairage'],
  'feu':['phare','lumiere','led','clignotant','eclairage'],
  'clignotant':['feu','indicateur','tournant'],
  'ampoule':['led','lampe','feu','eclairage'],
  'moteur':['engine','bloc','culasse'],
  'carburant':['gasoil','diesel','fuel','essence'],
  'gasoil':['carburant','diesel','fuel','essence'],
  'diesel':['gasoil','carburant','fuel'],
  'turbo':['turbocompresseur','suralimentation','turbine'],
  'radiateur':['refroidissement','cooling','echangeur'],
  'alternateur':['dynamo','generateur','charge'],
  'demarreur':['starter','demarrage'],
  'starter':['demarreur'],
  'batterie':['accumulateur','12v','24v'],
  'porte':['portiere','ouverture','vantail'],
  'vitre':['vitrage','glace','pare-brise','fenetre'],
  'pare-brise':['vitre','vitrage','glace'],
  'pneu':['pneumatique','roue','gomme','tire'],
  'roue':['pneu','pneumatique','jante'],
  'adblue':['ad blue','uree','addblue'],
  'blue':['adblue','ad blue','uree'],
  'caoutchouc':['joint','rubber','soufflet'],
  'soufflet':['caoutchouc','joint','manchon'],
  'pompe':['pump','injection','circuit'],
  'soupape':['valve','clapet','admission'],
  'courroie':['belt','distribution','alternateur'],
  'marteau':['secours','urgence'],
  'extincteur':['incendie'],
  'klaxon':['avertisseur','klax','horn'],
  'ldr':['direction','assistee','liquide direction'],
  'direction':['volant','ldr','steering'],
  'embrayage':['clutch','disque embrayage'],
  'boite':['transmission','vitesse','gearbox'],
  'intercooler':['echangeur','refroidisseur air'],
  'coussin':['air','pneumatique','suspension'],
  'silentbloc':['silent','bloc','caoutchouc'],
};

// Distance de Levenshtein (fautes de frappe)
function levenshtein(a, b) {
  if (a===b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var dp=[], i, j;
  for (i=0;i<=a.length;i++) dp[i]=[i];
  for (j=0;j<=b.length;j++) dp[0][j]=j;
  for (i=1;i<=a.length;i++) {
    for (j=1;j<=b.length;j++) {
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// V\u00e9rifie si un mot correspond \u00e0 l'article (exact, synonyme ou fuzzy)
function matchMot(artWords, artText, mot) {
  // 1. Correspondance directe (substring)
  if (artText.indexOf(mot) >= 0) return 'exact';
  // 2. Synonymes
  var syns = SYNO[mot] || [];
  for (var s=0; s<syns.length; s++) {
    if (artText.indexOf(normalize(syns[s])) >= 0) return 'syno';
  }
  // 3. Fuzzy (seulement pour mots \u2265 4 lettres)
  if (mot.length >= 4) {
    var maxDist = mot.length >= 7 ? 2 : 1;
    for (var w=0; w<artWords.length; w++) {
      var aw = artWords[w];
      if (aw.length < 3) continue;
      if (levenshtein(mot, aw) <= maxDist) return 'fuzzy';
    }
  }
  return null;
}

// Calcule un score de pertinence pour trier les r\u00e9sultats
function scoreRecherche(a, words, artWords, artText) {
  var score = 0;
  words.forEach(function(mot) {
    var m = matchMot(artWords, artText, mot);
    if (m==='exact') score += 10;
    else if (m==='syno') score += 5;
    else if (m==='fuzzy') score += 2;
  });
  return score;
}


function toggleBusFilter(f) {
  _busFilter = (_busFilter === f) ? '' : f;
  displayCount = 30;
  doSearch();
}

function doSearch() {
  var rawQ = normalize(document.getElementById('si').value.trim());
  var words = rawQ ? rawQ.split(/\s+/).filter(Boolean) : [];
  filtered = [];
  var scored = [];

  for (var i=0;i<articles.length;i++) {
    var a=articles[i];
    if (selectedCat!=='TOUT' && a.categorie!==selectedCat) continue;
    if (_busFilter==='std' && !a.bus_std) continue;
    if (_busFilter==='art' && !a.bus_art) continue;
    if (!words.length) { filtered.push(a); continue; }

    var artText = normalize(a.nom)+'|'+normalize(a.num)+'|'+normalize(a.tags||'')+'|'+normalize(a.location||'')+'|'+normalize(a.npf||'')+'|'+normalize(a.categorie||'')+'|'+normalize(a.fournisseur||'');
    var artWords = artText.split(/[|\s,]+/).filter(function(w){return w.length>1;});

    // Chaque mot de la query doit matcher (AND)
    var allMatch = words.every(function(mot) { return matchMot(artWords, artText, mot) !== null; });
    if (!allMatch) continue;

    var score = scoreRecherche(a, words, artWords, artText);
    scored.push({a:a, score:score});
  }

  // Trier : d'abord par score de recherche, ensuite par popularité
  if (words.length) {
    scored.sort(function(x,y) {
      if (y.score !== x.score) return y.score - x.score;
      return (_sortiesCount[y.a.num]||0) - (_sortiesCount[x.a.num]||0);
    });
    filtered = scored.map(function(x){return x.a;});
  } else if (Object.keys(_sortiesCount).length>0) {
    filtered.sort(function(a,b) { return (_sortiesCount[b.num]||0)-(_sortiesCount[a.num]||0); });
  }
  var hasFilter = rawQ || selectedCat!=='TOUT' || _busFilter;
  document.getElementById('rc').textContent = hasFilter ? (filtered.length+' résultat(s)') : (articles.length+' articles au total');
  // Mettre à jour l'état visuel des boutons filtres bus
  ['std','art'].forEach(function(f) {
    var btn=document.getElementById('busFilter-'+f);
    if (btn) btn.classList.toggle('on', _busFilter===f);
  });
  renderGrid(rawQ);
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
    // Tags (overlay sur photo)
    var tags = '';
    if (a.bus_std) tags += '<span class="tag tag-std">STD</span>';
    if (a.bus_art) tags += '<span class="tag tag-art">ART</span>';
    if (a.chimique) tags += '<span class="tag tag-chim">CHIM.</span>';
    if (a.reparable) tags += '<span class="tag tag-rep">🔧 RÉP.</span>';
    if (a.interne) tags += '<span class="tag tag-int">INTERNE</span>';
    var badgeHtml = tags ? '<div class="card-photo-badge">'+tags+'</div>' : '';
    // Zone image 170px — photo si dispo, placeholder sinon
    var photoHtml = '';
    if (a.photo) {
      var firstPhoto = a.photo.split(',')[0].trim();
      photoHtml = '<div class="card-photo-wrap">'
        +'<img src="'+esc(firstPhoto)+'" data-num="'+esc(a.num)+'" alt="" loading="lazy"/>'
        +badgeHtml
        +'</div>';
    } else {
      photoHtml = '<div class="card-photo-placeholder">'
        +'<div style="font-size:36px;opacity:0.12;">'+getCatIcon(a.categorie)+'</div>'
        +'<div style="font-size:8px;color:var(--mu);text-transform:uppercase;letter-spacing:2px;font-weight:700;opacity:0.5;">'+esc(a.categorie||'')+'</div>'
        +badgeHtml
        +'</div>';
    }
    var extra = '';
    // Boutons bas de card : panier + icônes modifier/supprimer
    var editIconBtns = window._canEdit
      ? '<div class="btn-edit-card" data-num="'+esc(a.num)+'">✏️</div>'
        +'<div class="btn-del-card" data-num="'+esc(a.num)+'">🗑</div>'
      : '';
    var bottomRow = '<div class="card-bottom-row">'
      +'<div class="btn-add-panier" data-num="'+esc(a.num)+'">+ Ajouter au panier</div>'
      +editIconBtns
      +'</div>';
    // Badges infos
    var extraItems = '';
    if (a.categorie) extraItems += '<span class="card-extra-badge">'+esc(a.categorie)+'</span>';
    if (window._canEdit) {
      if (a.npf) extraItems += '<span class="card-extra-badge">NPF <b>'+esc(a.npf)+'</b></span>';
      if (a.fournisseur) extraItems += '<span class="card-extra-badge">'+esc(a.fournisseur)+'</span>';
      extraItems += '<span class="card-extra-badge">'+(a.min||0)+'/'+(a.max||0)+'</span>';
    }
    if (extraItems) extra = '<div class="card-extra">'+extraItems+'</div>';
    h += '<div class="piece-card" data-num="'+esc(a.num)+'">'
      + photoHtml
      +'<div class="card-body">'
        +'<div class="card-num">'+hl(a.num,q)+'</div>'
        +'<div class="card-name">'+hl(a.nom,q)+'</div>'
        +(a.location?'<div class="card-loc">📍 '+esc(a.location)+'</div>':'')
        +extra
        +bottomRow
      +'</div>'
    +'</div>';
  }
  grid.innerHTML = h;

  // Grille 1 colonne sur mobile
  if (window.innerWidth <= 700) {
    grid.style.gridTemplateColumns = '1fr';
    grid.style.padding = '10px 12px';
    grid.style.gap = '8px';
  }

  // Ajouter au panier
  grid.querySelectorAll('.btn-add-panier').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); ajouterPanier(this.getAttribute('data-num')); });
  });
  grid.querySelectorAll('.btn-edit-card').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); openEdit(this.getAttribute('data-num')); });
  });
  grid.querySelectorAll('.btn-del-card').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); delArticle(this.getAttribute('data-num')); });
  });
  // Clic photo : tous les img dans les cards pièces
  grid.querySelectorAll('img[data-num]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var num = this.getAttribute('data-num');
      var a = articles.filter(function(x){return x.num===num;})[0];
      if (a && a.photo) { var photos=a.photo.split(',').map(function(u){return u.trim();}).filter(Boolean); openPhoto(photos[0], photos); }
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
  ['sectionPieces','sectionPanier','sectionOutillage'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display='none';
  });
  ['navPieces','navOutillage','navPanier'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('on');
  });
  // Bottom nav sync
  ['bnPieces','bnOutillage','bnPanier'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('on');
  });
  var bnMap = {pieces:'bnPieces', ajouter:'bnPieces', admin:'bnPieces', outillage:'bnOutillage', panier:'bnPanier'};
  var bnEl = document.getElementById(bnMap[section]||'bnPieces');
  if (bnEl) bnEl.classList.add('on');

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
    loadHistorique();
  } else if (section==='outillage') {
    document.getElementById('sectionOutillage').style.display='flex';
    document.getElementById('navOutillage').classList.add('on');
    loadOutillage();
  }
  // Boutons flottants (FAB) — visibles uniquement sur mobile
  var isMobile = window.innerWidth <= 700;
  var fab=document.getElementById('outilFab');
  if (fab) fab.style.display=(section==='outillage' && window._canEdit)?'flex':'none';
  var artFab=document.getElementById('articleFab');
  if (artFab) artFab.style.display=(section==='pieces' && window._canEdit && isMobile)?'flex':'none';
}

function showPiecesTab(tab) {
  var p1=document.getElementById('p1'), lm=document.getElementById('lm');
  var p2=document.getElementById('p2'), p4=document.getElementById('p4');
  var sb=document.getElementById('searchbarRow');
  var sidebar=document.getElementById('sidebarCats');
  p1.style.display='none'; if(lm) lm.classList.add('hidden');
  p2.classList.add('hidden'); p4.classList.add('hidden');
  if (tab==='search') {
    p1.style.display=''; sb.style.display='flex';
    sidebar.style.display = window.innerWidth > 700 ? 'flex' : 'none';
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
    entretien:document.getElementById('addEntretien').checked,
    interne:false, stock_securite:0
  };
  try {
    await supa('POST','articles',[a]); articles.push(a);
    ['addNum','addNom','addCat','addTags','addLoc','addMin','addMax','addNpf','addFournisseur'].forEach(function(id) { document.getElementById(id).value=''; });
    setBusBtn('addBusStd','addBusStdBtn',false); setBusBtn('addBusArt','addBusArtBtn',false);
    setBusBtn('addChimique','addChimiqueBtn',false); setBusBtn('addReparable','addReparableBtn',false);
    setBusBtn('addEntretien','addEntretienBtn',false);
    logAction('Ajout article: '+num, 'Nom: '+nom+(a.categorie?' | Cat: '+a.categorie:''));
    showToast('Article enregistré !','success'); buildSidebar(); switchSection('pieces'); doSearch();
  } catch(e) { showToast('Erreur sauvegarde','err'); console.error(e); }
});

async function delArticle(num) {
  if (!confirm('Supprimer cet article ?')) return;
  var art = articles.filter(function(a){return a.num===num;})[0];
  try {
    await supa('DELETE','articles?num=eq.'+encodeURIComponent(num));
    articles=articles.filter(function(a) { return a.num!==num; });
    logAction('Suppression article: '+num, art?art.nom:'');
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
      setBusBtn('editEntretien','editEntretienBtn',a.entretien||false);
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
    entretien:document.getElementById('editEntretien')?document.getElementById('editEntretien').checked:false,
    interne:false, stock_securite:0
  };
  try {
    if (newNum!==editingNum) { await supa('DELETE','articles?num=eq.'+encodeURIComponent(editingNum)); await supa('POST','articles',[updated]); }
    else { await supa('PATCH','articles?num=eq.'+encodeURIComponent(editingNum),updated); }
    for (var i=0;i<articles.length;i++) { if (articles[i].num===editingNum) { articles[i]=updated; break; } }
    logAction('Modification article: '+newNum, 'Nom: '+nom+(updated.categorie?' | Cat: '+updated.categorie:'')+(newNum!==editingNum?' | Ancien N°: '+editingNum:''));
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
    logAction('Ajout photo article: '+editingNum);
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
  else { panier.push({num:a.num,nom:a.nom,location:a.location||'',qty:1,reparable:a.reparable||false,interne:a.interne||false,entretien:a.entretien||false}); showToast('Ajouté au panier !','success'); }
  updateBadge();
}

function updateBadge() {
  var total=panier.reduce(function(s,x){return s+x.qty;},0);
  var badge=document.getElementById('panierBadge');
  if (badge) {
    if (total>0) { badge.classList.remove('hidden'); badge.textContent=total; }
    else badge.classList.add('hidden');
  }
  var bnDot=document.getElementById('bnDotPanier');
  if (bnDot) { if (total>0) { bnDot.classList.remove('hidden'); bnDot.textContent=total; } else bnDot.classList.add('hidden'); }
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
        +(p.entretien?'<div style="margin-top:4px;background:rgba(52,152,219,0.12);border:1px solid #3498db;border-radius:5px;padding:3px 8px;font-size:10px;font-weight:800;color:#3498db;display:inline-block;">⚙ Sortie en ZLMM2</div>':'')
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
  try {
    var msgInput = document.getElementById('panierMessage');
    var msg = msgInput ? msgInput.value.trim() : '';
    var busInput = document.getElementById('numeroBus');
    var bus = busInput ? busInput.value.trim().toUpperCase() : '';
    var fullMsg = bus ? '[BUS:'+bus+']'+(msg?' '+msg:'') : (msg||null);
    var agentNum = currentUser.role==='borne' ? _borneAgentNum : currentUser.login;
    await supa('POST','bons_commande',[{numero_ordre:num,statut:'valide',articles:panier,login:currentUser.login||'',numero_agent:agentNum||null,message:fullMsg,preparation_statut:'en_prep'}]);
    if (msgInput) msgInput.value = '';
    if (busInput) busInput.value = '';
    var nbArts=panier.length, totalQty=panier.reduce(function(s,x){return s+x.qty;},0);
    panier=[]; document.getElementById('numeroOrdre').value='';
    updateBadge(); renderPanier(); loadHistorique();
    if (currentUser.role==='agent' || currentUser.role==='borne') showConfirmAgent(num,nbArts,totalQty);
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
    +(currentUser.role==='borne'
      ? '<div onclick="document.getElementById(\'confirmAgent\').style.display=\'none\';showBorneEntry();" style="background:#2ecc71;color:#111;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;">OK — Prochain agent</div>'
      : '<div onclick="document.getElementById(\'confirmAgent\').style.display=\'none\'" style="background:#2ecc71;color:#111;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;">OK</div>'
    )
    +'</div>';
  el.style.display='flex';
}

// ── HISTORIQUE ──
var _histoFiltre='today';

async function autoArchiverBons() {
  try {
    var limite = new Date(Date.now() - 7*86400000).toISOString();
    await supa('PATCH', 'bons_commande?sap_effectue=eq.true&statut=eq.valide&date_creation=lt.'+limite, {statut:'archive'});
  } catch(e) {}
}

async function loadHistorique() {
  try {
    if (currentUser.role==='admin' || currentUser.role==='magasinier') autoArchiverBons();
    // Agents : seulement leurs propres bons
    var url = 'bons_commande?select=*&order=date_creation.desc&limit=200';
    if (currentUser.role === 'agent' || currentUser.role === 'brigadier') {
      var il30j = new Date(Date.now()-30*86400000).toISOString();
      url = 'bons_commande?login=eq.'+encodeURIComponent(currentUser.login)+'&date_creation=gte.'+il30j+'&select=*&order=date_creation.desc&limit=200';
    } else if (currentUser.role === 'borne') {
      var today = new Date(); today.setHours(0,0,0,0);
      url = 'bons_commande?login=eq.'+encodeURIComponent(currentUser.login)+'&date_creation=gte.'+today.toISOString()+'&select=*&order=date_creation.desc&limit=50';
    }
    var data=await supa('GET', url);
    var list=document.getElementById('historiqueList');
    // Utiliser le fuseau local du navigateur (gère heure d'été/hiver automatiquement)
    function dateLocale(ts) {
      var d=new Date(ts);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }
    var maintenant=Date.now(), aujourdhui=dateLocale(maintenant);
    var now=new Date(), jourSemaine=now.getDay();
    var offsetLundi=jourSemaine===0?-6:1-jourSemaine;
    var lundi=dateLocale(maintenant+offsetLundi*86400000);

    var filtrés=(data||[]).filter(function(b) {
      if (b.statut==='annule' || b.statut==='archive') return false;
      var dateBon=dateLocale(new Date(b.date_creation).getTime());
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
      var dtBrussels=new Date(b.date_creation);
      var dateStr=dtBrussels.toLocaleDateString('fr-FR')+' '+dtBrussels.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      var sapDone=b.sap_effectue||false;
      var prepStatut = b.preparation_statut || 'en_prep';
      var statutCfg = {
        'en_attente': {label:'🔧 En préparation', bg:'rgba(52,152,219,0.1)',  border:'#3498db', color:'#3498db'},
        'en_prep':    {label:'🔧 En préparation', bg:'rgba(52,152,219,0.1)',  border:'#3498db', color:'#3498db'},
        'pret':       {label:'✅ Prête !',         bg:'rgba(46,204,113,0.1)', border:'#2ecc71', color:'#2ecc71'},
      };
      var sc = statutCfg[prepStatut] || statutCfg['en_prep'];

      // Boutons statut — uniquement pour magasinier/admin
      var canChangeStatut = currentUser.role==='admin' || currentUser.role==='magasinier';
      var statutBtns = '';
      if (canChangeStatut) {
        var statuts = ['en_prep','pret'];
        var labels  = ['🔧','✅'];
        var titles  = ['En préparation','Prête'];
        statutBtns = '<div style="display:flex;gap:4px;margin-bottom:8px;">';
        for (var si=0;si<statuts.length;si++) {
          var isActive = prepStatut === statuts[si] || (si===0 && prepStatut==='en_attente');
          var activeSc = statutCfg[statuts[si]];
          statutBtns += '<div class="btn-statut" data-id="'+b.id+'" data-statut="'+statuts[si]+'" '
            +'style="flex:1;text-align:center;padding:7px 4px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;'
            +'border:1.5px solid '+(isActive?activeSc.border:'var(--br)')+';'
            +'background:'+(isActive?activeSc.bg:'var(--sf)')+';'
            +'color:'+(isActive?activeSc.color:'var(--mu)')+';">'
            +labels[si]+' '+titles[si]
            +'</div>';
        }
        statutBtns += '</div>';
      }

      var detailRows='';
      for (var j=0;j<arts.length;j++) {
        var art=arts[j];
        // Chercher la photo dans le catalogue
        var artData = articles.filter(function(a){return a.num===art.num;})[0];
        var photoUrl = artData && artData.photo ? artData.photo.split(',')[0].trim() : null;
        var photosAll = artData && artData.photo ? artData.photo.split(',').map(function(u){return u.trim();}).filter(Boolean) : [];
        var photoBtn = photoUrl
          ? '<div onclick="event.stopPropagation();openPhoto(\''+photoUrl.replace(/'/g,"\\'")+'\',[\''+photosAll.join("','")+'\'  ])" style="width:32px;height:32px;border-radius:6px;overflow:hidden;flex-shrink:0;cursor:pointer;border:1px solid var(--br);"><img src="'+esc(photoUrl)+'" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>'
          : '<div style="width:32px;height:32px;border-radius:6px;background:var(--sf);border:1px solid var(--br);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;color:var(--mu);">📷</div>';
        detailRows+='<div class="bon-detail-row">'
          +photoBtn
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-size:14px;font-weight:800;color:var(--ac);">'+esc(art.num)+(art.reparable?' <span style="font-size:11px;background:rgba(155,89,182,0.15);border:1px solid #9b59b6;border-radius:4px;padding:1px 6px;color:#9b59b6;">🔧 Rép.</span>':'')+'</div>'
            +'<div style="font-size:13px;color:var(--tx);margin-top:2px;">'+esc(art.nom)+'</div>'
            +(art.location?'<div style="font-size:11px;color:var(--mu);margin-top:1px;">📍 '+esc(art.location)+'</div>':'')
          +'</div>'
          +'<div class="bon-qty">×'+art.qty+'</div>'
          +'</div>';
      }

      // Badges entretien / réparable détectés dans le bon
      var hasEntretien = arts.some(function(a){return a.entretien;});
      var hasReparable = arts.some(function(a){return a.reparable;});
      var alertBadges = '';
      if (hasEntretien) alertBadges += '<div style="background:rgba(52,152,219,0.12);border:1.5px solid #3498db;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;color:#3498db;display:flex;align-items:center;gap:8px;margin-bottom:6px;">⚙ Certains articles doivent être sortis en <strong>ZLMM2</strong></div>';
      if (hasReparable) alertBadges += '<div style="background:rgba(155,89,182,0.12);border:1.5px solid #9b59b6;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:800;color:#9b59b6;display:flex;align-items:center;gap:8px;margin-bottom:6px;">🔧 Certains articles sont réparables — sortie en réparable</div>';

      h+='<div class="histo-item" style="'+(sapDone?'opacity:0.55;':'')+'">'
        +'<div style="display:flex;justify-content:space-between;align-items:start;cursor:pointer;" onclick="toggleBon(this)">'
          +'<div>'
            +'<div class="histo-num">Ordre '+esc(b.numero_ordre)+'</div>'
            +'<div class="histo-date">'+dateStr+'</div>'
            +(b.login?'<div style="font-size:11px;color:var(--ac);margin-top:2px;">👤 '+esc(b.login)+(b.numero_agent&&b.numero_agent!==b.login?' · 🪪 Agent '+esc(b.numero_agent):'')+'</div>':'')
            +(function(){var bus=(b.message||'').match(/^\[BUS:([^\]]+)\]/);return bus?'<div style="margin-top:3px;display:inline-flex;align-items:center;gap:5px;background:rgba(52,152,219,0.12);border:1px solid rgba(52,152,219,0.35);border-radius:6px;padding:2px 8px;font-size:12px;font-weight:800;color:#3498db;">🚌 '+esc(bus[1])+'</div>':'';}())
            +'<div class="histo-count">'+arts.length+' article(s)</div>'
            +(function(){var rest=(b.message||'').replace(/^\[BUS:[^\]]+\]\s*/,'');return rest?'<div style="margin-top:5px;background:rgba(240,165,0,0.08);border-left:2px solid var(--ac);padding:4px 8px;border-radius:0 6px 6px 0;font-size:11px;color:var(--tx);font-style:italic;">💬 '+esc(rest)+'</div>':'';}())
          +'</div>'
          +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">'
            +'<div style="color:var(--mu);font-size:16px;">▼</div>'
            +'<div class="statut-badge" style="background:'+sc.bg+';border:1.5px solid '+sc.border+';border-radius:8px;padding:4px 10px;font-size:11px;font-weight:800;color:'+sc.color+';">'+sc.label+'</div>'
          +'</div>'
        +'</div>'
        +statutBtns
        +alertBadges
        +(currentUser.role==='agent' || currentUser.role==='brigadier' ? '' :
          '<div class="histo-btns">'
            +'<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:'+(sapDone?'var(--gn)':'var(--mu)')+';cursor:pointer;" onclick="event.stopPropagation()">'
              +'<input type="checkbox" class="chk-sap" data-id="'+b.id+'" '+(sapDone?'checked':'')+' style="width:15px;height:15px;accent-color:var(--gn);cursor:pointer;"/>'
              +'SAP fait'
            +'</label>'
            +'<div class="histo-btn histo-btn-copy btn-copy-sap" data-id="'+b.id+'">📋 Copier</div>'
            +'<div class="histo-btn histo-btn-excel btn-dl" data-id="'+b.id+'" style="background:rgba(100,149,237,0.1);border-color:#6495ed;color:#6495ed;">🖨️ Bon</div>'
            +'<div class="histo-btn histo-btn-reopen btn-reopen" data-id="'+b.id+'" data-sap="'+(sapDone?'true':'false')+'">✏️ Modifier</div>'
            +'<div class="histo-btn histo-btn-del btn-del-bon" data-id="'+b.id+'" data-sap="'+(sapDone?'true':'false')+'">Supprimer</div>'
          +'</div>'
        )
        +'<div class="bon-detail">'+detailRows+'</div>'
      +'</div>';
    }

    list.innerHTML=h;
    list.querySelectorAll('.histo-tab').forEach(function(el) { el.addEventListener('click', function() { _histoFiltre=this.getAttribute('data-f'); loadHistorique(); }); });
    list.querySelectorAll('.btn-dl').forEach(function(el) { el.addEventListener('click', function() { exportBon(this.getAttribute('data-id')); }); });
    list.querySelectorAll('.btn-statut').forEach(function(el) {
      el.addEventListener('click', async function(e) {
        e.stopPropagation();
        var id=this.getAttribute('data-id'), statut=this.getAttribute('data-statut');
        // Mise à jour visuelle immédiate
        var item = this.closest('.histo-item');
        var allBtns = item.querySelectorAll('.btn-statut');
        var cfgMap = {
          'en_attente':{label:'🔧 En préparation', bg:'rgba(52,152,219,0.1)',  border:'#3498db',color:'#3498db'},
          'en_prep':   {label:'🔧 En préparation', bg:'rgba(52,152,219,0.1)',  border:'#3498db',color:'#3498db'},
          'pret':      {label:'✅ Prête !',         bg:'rgba(46,204,113,0.1)', border:'#2ecc71',color:'#2ecc71'},
        };
        var sc = cfgMap[statut]||cfgMap['en_attente'];
        // Reset tous les boutons du bon
        allBtns.forEach(function(b) {
          b.style.color='var(--mu)'; b.style.background='var(--sf)'; b.style.borderColor='var(--br)';
        });
        // Activer le bouton cliqué
        this.style.color=sc.color; this.style.background=sc.bg; this.style.borderColor=sc.border;
        // Mettre à jour le badge statut en haut du bon
        var badge = item.querySelector('.statut-badge');
        if (badge) { badge.style.background=sc.bg; badge.style.borderColor=sc.border; badge.style.color=sc.color; badge.textContent=sc.label; }
        // Envoyer en base
        try {
          await supa('PATCH','bons_commande?id=eq.'+id,{preparation_statut:statut});
          if (statut==='pret') showToast('✅ Commande marquée prête !','success');
          else if (statut==='en_prep') showToast('🔧 En préparation','success');
          else showToast('🔧 En préparation','success');
          updateBadgeAttente();
        } catch(e2) { showToast('Erreur','err'); }
      });
    });
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
        try {
          var patch = {sap_effectue:val};
          if (val) patch.preparation_statut = 'pret';
          await supa('PATCH','bons_commande?id=eq.'+id, patch);
          showToast(val?'SAP fait ✓ — Commande marquée Prête !':'SAP non fait','success');
          loadHistorique(); updateBadgeAttente();
        } catch(e) { showToast('Erreur','err'); }
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
    panier=(bon.articles||[]).map(function(a) { return {num:a.num,nom:a.nom,location:a.location||'',qty:a.qty,reparable:a.reparable||false,interne:a.interne||false,entretien:a.entretien||false}; });
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
    var bon=data[0], arts=bon.articles||[];

    // Date heure belge
    var dtBelge=new Date(bon.date_creation);
    var dateStr=dtBelge.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
    var heureStr=dtBelge.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});

    // Lignes articles
    var lignes='';
    var hasEntretien=false;
    for (var i=0;i<arts.length;i++) {
      var a=arts[i];
      if (a.entretien) hasEntretien=true;
      var special='';
      if (a.chimique) special='<div style="color:#e74c3c;font-size:11px;margin-top:3px;font-weight:600;">⚠ Produit chimique — manipulation avec précaution</div>';
      if (a.reparable) special='<div style="color:#9b59b6;font-size:11px;margin-top:3px;font-weight:600;">🔧 Réparable — retour atelier requis</div>';
      if (a.entretien) special+='<div style="color:#3498db;font-size:11px;margin-top:3px;font-weight:600;">⚙ Sortie en ZLMM2</div>';
      lignes+='<tr style="border-bottom:1px solid #e8e8e8;">'
        +'<td style="padding:10px 8px;font-weight:700;font-family:monospace;font-size:13px;color:#111;white-space:nowrap;">'+esc(a.num)+'</td>'
        +'<td style="padding:10px 8px;"><div style="font-weight:700;font-size:13px;color:#111;">'+esc(a.nom)+'</div>'+special+'</td>'
        +'<td style="padding:10px 8px;font-size:12px;color:#555;font-family:monospace;">'+esc(a.location||'—')+'</td>'
        +'<td style="padding:10px 8px;text-align:center;font-weight:800;font-size:15px;color:#111;">'+a.qty+'</td>'
        +'</tr>';
    }

    var totalQty=arts.reduce(function(s,x){return s+x.qty;},0);
    var sapStatut=bon.sap_effectue?'<span style="color:#2ecc71;font-weight:700;">✓ Effectué</span>':'<span style="color:#e74c3c;font-weight:700;">En attente</span>';

    var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bon '+esc(bon.numero_ordre)+'</title>'
      +'<style>'
      +'*{box-sizing:border-box;margin:0;padding:0;}'
      +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#111;padding:32px;}'
      +'@media print{'
        +'body{padding:16px;}'
        +'.no-print{display:none!important;}'
        +'@page{margin:1cm;size:A4;}'
      +'}'
      +'</style></head><body>'

      // Bouton imprimer
      +'<div class="no-print" style="margin-bottom:24px;text-align:right;">'
        +'<button onclick="window.print()" style="background:#f0a500;color:#111;border:none;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:800;cursor:pointer;">🖨️ Imprimer</button>'
        +'<button onclick="window.close()" style="margin-left:10px;background:#eee;color:#555;border:none;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer;">✕ Fermer</button>'
      +'</div>'

      // En-tête
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">'
        +'<div>'
          +'<div style="font-size:26px;font-weight:900;color:#f0a500;letter-spacing:1px;">MAGASIN 2K</div>'
          +'<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-top:2px;">Dépôt Bus Citaro</div>'
        +'</div>'
        +'<div style="text-align:right;">'
          +'<div style="font-size:20px;font-weight:900;color:#111;text-transform:uppercase;">Bon de commande</div>'
          +'<div style="font-size:14px;color:#555;margin-top:4px;">Ordre <strong style="color:#f0a500;font-size:18px;">'+esc(bon.numero_ordre)+'</strong></div>'
        +'</div>'
      +'</div>'
      +'<div style="height:3px;background:#f0a500;border-radius:2px;margin-bottom:20px;"></div>'

      // Métadonnées
      +'<div style="display:flex;gap:12px;margin-bottom:20px;">'
        +'<div style="flex:1;background:#f7f7f7;border-left:3px solid #f0a500;border-radius:4px;padding:10px 14px;">'
          +'<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date</div>'
          +'<div style="font-size:15px;font-weight:700;">'+dateStr+'</div>'
          +'<div style="font-size:11px;color:#888;">'+heureStr+' — heure belge</div>'
        +'</div>'
        +'<div style="flex:1;background:#f7f7f7;border-left:3px solid #f0a500;border-radius:4px;padding:10px 14px;">'
          +'<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Agent</div>'
          +'<div style="font-size:15px;font-weight:700;">'+esc(bon.login||'—')+'</div>'
          +(bon.numero_agent?'<div style="font-size:11px;color:#888;">N° '+esc(bon.numero_agent)+'</div>':'')
        +'</div>'
        +'<div style="flex:1;background:#f7f7f7;border-left:3px solid #f0a500;border-radius:4px;padding:10px 14px;">'
          +'<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">SAP</div>'
          +'<div style="font-size:14px;font-weight:700;">'+sapStatut+'</div>'
        +'</div>'
      +'</div>'

      // Alerte ZLMM2 si entretien
      +(hasEntretien?'<div style="background:#eaf4fd;border:1px solid #3498db;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#2471a3;font-weight:600;">⚙ Certains articles doivent être sortis en <strong>ZLMM2</strong> — voir détail ci-dessous.</div>':'')

      // Tableau
      +'<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">'
        +'<thead>'
          +'<tr style="background:#111;color:#f0a500;">'
            +'<th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:4px 0 0 0;">N° SAP</th>'
            +'<th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Désignation</th>'
            +'<th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Emplacement</th>'
            +'<th style="padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:0 4px 0 0;">Qté</th>'
          +'</tr>'
        +'</thead>'
        +'<tbody>'+lignes+'</tbody>'
      +'</table>'

      // Pied
      +'<div style="display:flex;justify-content:space-between;align-items:flex-end;">'
        +'<div style="font-size:12px;color:#888;">'
          +'Total articles : <strong style="color:#111;">'+arts.length+'</strong>'
          +' &nbsp;·&nbsp; Total pièces : <strong style="color:#111;">'+totalQty+'</strong>'
        +'</div>'
        +'<div style="text-align:right;">'
          +'<div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px;">Signature magasinier</div>'
          +'<div style="width:180px;border-top:1.5px solid #bbb;"></div>'
        +'</div>'
      +'</div>'

      +'</body></html>';

    var w=window.open('','_blank','width=900,height=700');
    w.document.write(html);
    w.document.close();
  } catch(e) { showToast('Erreur','err'); console.error(e); }
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
var _soundEnabled=true;
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
  _soundEnabled=!_soundEnabled;
  localStorage.setItem('soundEnabled_'+currentUser.login, _soundEnabled?'true':'false');
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
  var badgeSAP = document.getElementById('badgeSAP');
  if (!badgeSAP) return;

  // Magasinier / admin — commandes SAP en attente
  if (currentUser.role==='admin' || currentUser.role==='magasinier') {
    try {
      var data=await supa('GET','bons_commande?sap_effectue=eq.false&statut=eq.valide&select=id');
      var nb=data?data.length:0;
      if (nb>0) {
        var v=document.getElementById('badgeSAPVal'); if(v) v.textContent=nb;
        badgeSAP.classList.remove('hidden');
        var bnSAP=document.getElementById('bnDotSAP'); if(bnSAP){bnSAP.textContent=nb;bnSAP.className='bn-dot bn-dot-orange';}
      } else {
        badgeSAP.classList.add('hidden');
        var bnSAP=document.getElementById('bnDotSAP'); if(bnSAP) bnSAP.className='bn-dot hidden';
      }
    } catch(e) {}
  }

  // Agent / brigadier — commande prête à retirer
  if (currentUser.role==='agent' || currentUser.role==='brigadier') {
    try {
      var data=await supa('GET','bons_commande?login=eq.'+encodeURIComponent(currentUser.login)+'&preparation_statut=eq.pret&sap_effectue=eq.false&select=id');
      var nb=data?data.length:0;
      if (nb>0) {
        var v=document.getElementById('badgeSAPVal'); if(v) v.textContent='✓ Prêt';
        badgeSAP.classList.remove('hidden');
        var bnSAP=document.getElementById('bnDotSAP'); if(bnSAP){bnSAP.textContent='✓';bnSAP.className='bn-dot bn-dot-green';}
      } else {
        badgeSAP.classList.add('hidden');
        var bnSAP=document.getElementById('bnDotSAP'); if(bnSAP) bnSAP.className='bn-dot hidden';
      }
    } catch(e) {}
  }
}

// ── ADMIN ──
function exportArticlesExcel() {
  var BOM = '﻿';
  var headers = [
    'N° SAP','Désignation','Catégorie','Emplacement',
    'NPF','Fournisseur',
    'Bus STD','Bus ART','Chimique','Réparable','Entretien',
    'Min','Max',
    'Photo','Mots-clés'
  ];
  var rows = articles.map(function(a) {
    return [
      a.num||'',
      a.nom||'',
      a.categorie||'',
      a.location||'',
      a.npf||'',
      a.fournisseur||'',
      a.bus_std?'OUI':'',
      a.bus_art?'OUI':'',
      a.chimique?'OUI':'',
      a.reparable?'OUI':'',
      a.entretien?'OUI':'',
      a.min||0,
      a.max||0,
      a.photo?'OUI':'',
      a.tags||''
    ].map(function(v) {
      var s = String(v);
      if (s.indexOf(';')>=0||s.indexOf('"')>=0||s.indexOf('\n')>=0) s='"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(';');
  });
  var csv = BOM + headers.join(';') + '\n' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var d = new Date();
  a.download = 'articles_magasin2k_'+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export téléchargé !','success');
  logAction('Export articles Excel — '+articles.length+' articles');
}

var _adminTabLoaded = {};

function switchAdminTab(tab) {
  // Mettre à jour les onglets visuels
  document.querySelectorAll('.admin-tab').forEach(function(el) {
    el.classList.toggle('on', el.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.admin-tab-content').forEach(function(el) {
    el.classList.add('hidden');
  });
  var content = document.getElementById('adminTab-'+tab);
  if (content) content.classList.remove('hidden');

  // Chargement lazy : charger seulement si pas encore chargé
  if (!_adminTabLoaded[tab]) {
    _adminTabLoaded[tab] = true;
    if (tab === 'dashboard') { loadAdminDashboard(); }
    else if (tab === 'users') { loadDemandes(); loadDemandesCompte(); loadUtilisateurs(); }
    else if (tab === 'bons') { loadAdminHistoBons(); }
    else if (tab === 'modifs') { loadAdminModifArticles(); }
    else if (tab === 'actions') { loadHistoriqueActions(); }
  }
}

async function loadAdminPage() {
  _adminTabLoaded = {}; // Reset pour forcer rechargement
  // Charger seulement le tableau de bord par défaut
  switchAdminTab('dashboard');
  // Charger les badges demandes en arrière-plan
  loadDemandes(); loadDemandesCompte();
}

async function loadAdminModifArticles() {
  var el = document.getElementById('adminModifArticles');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--mu);font-size:12px;">Chargement...</div>';
  try {
    // Récupérer les actions liées aux articles (ajout photo, modification, catégorisation)
    var data = await supa('GET','historique_actions?select=*&order=created_at.desc&limit=200');
    if (!data||!data.length) { el.innerHTML='<div style="color:var(--mu);padding:16px;text-align:center;">Aucune modification</div>'; return; }

    // Filtrer uniquement les actions liées aux articles
    var motsCles = ['modifi','ajout','supprim','photo','catégor','categor','article','outillage','outil'];
    var filtres = data.filter(function(a) {
      var txt = ((a.action||'')+(a.details||'')).toLowerCase();
      return motsCles.some(function(m){ return txt.indexOf(m)>=0; });
    });

    // Filtres rapides
    var _filtre = 'all';
    function renderModifs(filtre) {
      var liste = filtre==='all' ? filtres : filtres.filter(function(a){ return ((a.action||'')+(a.details||'')).toLowerCase().indexOf(filtre)>=0; });
      var h = '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">';
      [['all','Tout'],['photo','📷 Photo'],['modifi','✏️ Modif'],['catégor','📦 Catégor'],['ajout','➕ Ajout'],['supprim','🗑 Supprim'],['outil','🔧 Outillage']].forEach(function(f) {
        h += '<div onclick="adminModifFiltre(\''+f[0]+'\')" style="padding:4px 12px;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid '+(filtre===f[0]?'var(--ac)':'var(--br)')+';color:'+(filtre===f[0]?'var(--ac)':'var(--mu)')+';background:'+(filtre===f[0]?'rgba(240,165,0,0.08)':'var(--sf)')+';">'+f[1]+'</div>';
      });
      h += '</div>';
      if (!liste.length) { h += '<div style="color:var(--mu);text-align:center;padding:20px;">Aucune action trouvée</div>'; el.innerHTML=h; return; }
      liste.forEach(function(a) {
        var dt = new Date(a.created_at);
        var dateStr = dt.toLocaleDateString('fr-FR')+' '+dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        var isPhoto = ((a.action||'')+(a.details||'')).toLowerCase().indexOf('photo')>=0;
        var isCat   = ((a.action||'')+(a.details||'')).toLowerCase().indexOf('catégor')>=0 || ((a.action||'')+(a.details||'')).toLowerCase().indexOf('categor')>=0;
        var icon = isPhoto ? '📷' : isCat ? '📦' : '✏️';
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--br);">'
          +'<div style="font-size:18px;flex-shrink:0;margin-top:1px;">'+icon+'</div>'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-size:12px;font-weight:700;color:var(--ac);">'+esc(a.prenom||a.login)+'</div>'
            +'<div style="font-size:12px;color:var(--tx);margin-top:1px;">'+esc(a.action||'')+'</div>'
            +(a.details?'<div style="font-size:11px;color:var(--mu);margin-top:2px;">'+esc(a.details)+'</div>':'')
          +'</div>'
          +'<div style="font-size:10px;color:var(--mu);white-space:nowrap;flex-shrink:0;">'+dateStr+'</div>'
        +'</div>';
      });
      el.innerHTML = h;
      el._filtreCourant = filtre;
    }
    window.adminModifFiltre = function(f) { renderModifs(f); };
    renderModifs(_filtre);
  } catch(e) { el.innerHTML='<div style="color:var(--rd);font-size:12px;">Erreur chargement</div>'; console.error(e); }
}

async function loadAdminDashboard() {
  var el = document.getElementById('adminDashboard');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--mu);font-size:12px;">Chargement...</div>';
  try {
    function dateBelge(ts) {
      var d=new Date(ts);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }
    var now = Date.now();
    var dow = new Date(now).getDay();
    var offsetLundi = dow===0?-6:1-dow;
    var lundi = dateBelge(now+offsetLundi*86400000);

    // Bons des 4 dernières semaines
    var depuis4s = new Date(now - 28*86400000).toISOString();
    var data = await supa('GET','bons_commande?date_creation=gte.'+depuis4s+'&select=*&order=date_creation.asc');
    data = data||[];

    // ── Compteurs articles ──
    var artCount = {};
    data.forEach(function(b) {
      (b.articles||[]).forEach(function(a) {
        artCount[a.nom] = (artCount[a.nom]||0) + a.qty;
      });
    });
    var topArts = Object.keys(artCount).map(function(n){return {nom:n,qty:artCount[n]};})
      .sort(function(a,b){return b.qty-a.qty;}).slice(0,5);

    // ── Bons par semaine (4 semaines) ──
    var semaines = [];
    for (var w=3;w>=0;w--) {
      var debutS = dateBelge(now+(offsetLundi-w*7)*86400000);
      var finS   = dateBelge(now+(offsetLundi-w*7+6)*86400000);
      var label  = w===0?'Cette sem.':'S-'+(w);
      var count  = data.filter(function(b) {
        var d = dateBelge(new Date(b.date_creation).getTime());
        return d>=debutS && d<=finS;
      }).length;
      semaines.push({label:label, count:count});
    }
    var maxS = Math.max.apply(null, semaines.map(function(s){return s.count;})) || 1;

    // ── Agents actifs (cette semaine) ──
    var bonsSemaine = data.filter(function(b){ return dateBelge(new Date(b.date_creation).getTime())>=lundi; });
    var agentsActifs = {};
    bonsSemaine.forEach(function(b){ agentsActifs[b.login]=(agentsActifs[b.login]||0)+1; });
    var nbAgents = Object.keys(agentsActifs).length;

    var h = '';

    // Compteurs KPI
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">';
    [{v:data.length,l:'Bons (4 sem.)',c:'f0a500'},{v:bonsSemaine.length,l:'Cette semaine',c:'2ecc71'},{v:nbAgents,l:'Agents actifs',c:'6495ed'}].forEach(function(s){
      h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;text-align:center;">'
        +'<div style="font-size:26px;font-weight:900;color:#'+s.c+';">'+s.v+'</div>'
        +'<div style="font-size:10px;color:var(--mu);margin-top:3px;text-transform:uppercase;letter-spacing:1px;">'+s.l+'</div>'
        +'</div>';
    });
    h += '</div>';

    // Graphe barres semaines
    h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;margin-bottom:14px;">'
      +'<div style="font-size:10px;color:var(--mu);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Bons par semaine</div>'
      +'<div style="display:flex;align-items:flex-end;gap:8px;height:70px;">';
    semaines.forEach(function(s){
      var pct = Math.round((s.count/maxS)*100);
      h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">'
        +'<div style="font-size:10px;color:var(--ac);font-weight:700;">'+s.count+'</div>'
        +'<div style="width:100%;background:rgba(240,165,0,0.15);border-radius:4px 4px 0 0;height:'+Math.max(pct*0.5,4)+'px;border-top:2px solid var(--ac);"></div>'
        +'<div style="font-size:9px;color:var(--mu);">'+s.label+'</div>'
        +'</div>';
    });
    h += '</div></div>';

    // Top 5 articles
    if (topArts.length) {
      h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;margin-bottom:14px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
          +'<div style="font-size:10px;color:var(--mu);text-transform:uppercase;letter-spacing:1px;">Top articles commandés (4 sem.)</div>'
        +'</div>';
      var maxQ = topArts[0].qty || 1;
      topArts.forEach(function(a,i){
        var pct = Math.round((a.qty/maxQ)*100);
        h += '<div style="margin-bottom:8px;">'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">'
            +'<span style="color:var(--tx);font-weight:600;">'+['🥇','🥈','🥉','4.','5.'][i]+' '+esc(a.nom)+'</span>'
            +'<span style="color:var(--ac);font-weight:700;">×'+a.qty+'</span>'
          +'</div>'
          +'<div style="height:4px;background:var(--br);border-radius:2px;">'
            +'<div style="height:4px;width:'+pct+'%;background:var(--ac);border-radius:2px;"></div>'
          +'</div></div>';
      });
      h += '</div>';
    }

    // Bouton export semaine

    el.innerHTML = h;
  } catch(e) { el.innerHTML='<div style="color:var(--rd);font-size:12px;">Erreur chargement dashboard</div>'; console.error(e); }
}


// ── ADMIN : Historique complet des bons ──
async function loadAdminHistoBons() {
  var el = document.getElementById('adminHistoBons');
  if (!el) return;
  try {
    var data = await supa('GET','bons_commande?select=*&order=date_creation.desc&limit=500');
    if (!data||!data.length) { el.innerHTML='<div style="color:var(--mu);padding:16px;text-align:center;">Aucun bon</div>'; return; }

    // Stats rapides
    var total = data.length;
    var sapFait = data.filter(function(b){return b.sap_effectue;}).length;
    var prets = data.filter(function(b){return b.preparation_statut==='pret';}).length;
    var parAgent = {};
    data.forEach(function(b) { parAgent[b.login]=(parAgent[b.login]||0)+1; });
    var topAgent = Object.entries(parAgent).sort(function(a,b){return b[1]-a[1];}).slice(0,3);

    var h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">';
    [
      {v:total,      l:'Bons total',      c:'f0a500'},
      {v:sapFait,    l:'SAP effectués',   c:'2ecc71'},
      {v:total-sapFait, l:'En attente SAP', c:'e74c3c'},
    ].forEach(function(s) {
      h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;text-align:center;">'
        +'<div style="font-size:28px;font-weight:900;color:#'+s.c+';">'+s.v+'</div>'
        +'<div style="font-size:10px;color:var(--mu);margin-top:3px;text-transform:uppercase;letter-spacing:1px;">'+s.l+'</div>'
        +'</div>';
    });
    h += '</div>';


    // Filtres
    h += '<div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;">'
      +'<div class="admin-bon-filter on" data-f="all" style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--ac);background:rgba(240,165,0,0.08);border:1.5px solid var(--ac);white-space:nowrap;">Tous ('+total+')</div>'
      +'<div class="admin-bon-filter" data-f="attente" style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--mu);background:var(--sf);border:1.5px solid var(--br);white-space:nowrap;">En attente SAP</div>'
      +'<div class="admin-bon-filter" data-f="fait" style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--mu);background:var(--sf);border:1.5px solid var(--br);white-space:nowrap;">SAP fait</div>'
      +'</div>';

    // Liste bons
    h += '<div id="adminBonsList">';
    data.slice(0,50).forEach(function(b) {
      var arts = b.articles||[];
      var dt = new Date(b.date_creation);
      var dateStr = dt.toLocaleDateString('fr-FR')+' '+dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      var sapDone = b.sap_effectue;
      var sc = {en_attente:{c:'f0a500',l:'⏳'},en_prep:{c:'3498db',l:'🔧'},pret:{c:'2ecc71',l:'✅'}}[b.preparation_statut||'en_attente']||{c:'f0a500',l:'⏳'};
      h += '<div style="background:var(--sf);border:1px solid var(--br);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'
        +'<div>'
          +'<div style="font-size:13px;font-weight:700;color:var(--ac);">Ordre '+esc(b.numero_ordre)+'</div>'
          +'<div style="font-size:10px;color:var(--mu);">'+dateStr+' · 👤 '+esc(b.login)+'</div>'
          +'<div style="font-size:10px;color:var(--mu);">'+arts.length+' article(s)</div>'
        +'</div>'
        +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">'
          +'<div style="font-size:10px;color:#'+sc.c+';">'+sc.l+'</div>'
          +(sapDone?'<div style="font-size:10px;color:var(--gn);font-weight:700;">✓ SAP</div>':'<div style="font-size:10px;color:var(--rd);">SAP en attente</div>')
        +'</div>'
        +'</div>';
    });
    h += '</div>';
    el.innerHTML = h;

    // Filtres clics
    el.querySelectorAll('.admin-bon-filter').forEach(function(btn) {
      btn.addEventListener('click', function() {
        el.querySelectorAll('.admin-bon-filter').forEach(function(b){ b.style.color='var(--mu)'; b.style.background='var(--sf)'; b.style.borderColor='var(--br)'; b.classList.remove('on'); });
        this.style.color='var(--ac)'; this.style.background='rgba(240,165,0,0.08)'; this.style.borderColor='var(--ac)'; this.classList.add('on');
        var f = this.getAttribute('data-f');
        var filtered = f==='attente' ? data.filter(function(b){return !b.sap_effectue;}) : f==='fait' ? data.filter(function(b){return b.sap_effectue;}) : data;
        var list = el.querySelector('#adminBonsList');
        list.innerHTML = filtered.slice(0,50).map(function(b) {
          var arts=b.articles||[];
          var dt=new Date(b.date_creation);
          var dateStr=dt.toLocaleDateString('fr-FR')+' '+dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
          var sc={en_attente:{c:'f0a500',l:'⏳'},en_prep:{c:'3498db',l:'🔧'},pret:{c:'2ecc71',l:'✅'}}[b.preparation_statut||'en_attente']||{c:'f0a500',l:'⏳'};
          return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'
            +'<div><div style="font-size:13px;font-weight:700;color:var(--ac);">Ordre '+esc(b.numero_ordre)+'</div>'
            +'<div style="font-size:10px;color:var(--mu);">'+dateStr+' · 👤 '+esc(b.login)+'</div>'
            +'<div style="font-size:10px;color:var(--mu);">'+arts.length+' article(s)</div></div>'
            +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">'
            +'<div style="font-size:10px;color:#'+sc.c+';">'+sc.l+'</div>'
            +(b.sap_effectue?'<div style="font-size:10px;color:var(--gn);font-weight:700;">✓ SAP</div>':'<div style="font-size:10px;color:var(--rd);">SAP en attente</div>')
            +'</div></div>';
        }).join('');
      });
    });
  } catch(e) { console.error(e); }
}

// ── ADMIN : Historique outils ──
async function loadAdminHistoOutillage() {
  var el = document.getElementById('adminHistoOutil');
  if (!el) return;
  try {
    var data = await supa('GET','outillage?select=*&order=nom.asc');
    if (!data||!data.length) { el.innerHTML='<div style="color:var(--mu);padding:16px;text-align:center;">Aucun outil</div>'; return; }
    var enPret = data.filter(function(o){return o.agent_pret;});
    var dispo = data.filter(function(o){return !o.agent_pret;});

    var h = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">';
    [{v:data.length,l:'Outils total',c:'6495ed'},{v:enPret.length,l:'En prêt',c:'e74c3c'}].forEach(function(s){
      h+='<div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px;text-align:center;">'
        +'<div style="font-size:28px;font-weight:900;color:#'+s.c+';">'+s.v+'</div>'
        +'<div style="font-size:10px;color:var(--mu);margin-top:3px;text-transform:uppercase;letter-spacing:1px;">'+s.l+'</div>'
        +'</div>';
    });
    h += '</div>';

    if (enPret.length) {
      h += '<div style="background:rgba(231,76,60,0.06);border:1.5px solid #e74c3c;border-radius:10px;padding:12px;margin-bottom:12px;">'
        +'<div style="font-size:11px;color:#e74c3c;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔴 Outils actuellement en prêt</div>';
      enPret.forEach(function(o) {
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(231,76,60,0.15);">'
          +'<div><div style="font-size:12px;font-weight:700;color:var(--tx);">'+esc(o.nom)+'</div>'
          +(o.location?'<div style="font-size:10px;color:var(--mu);">📍 '+esc(o.location)+'</div>':'')+'</div>'
          +'<div style="text-align:right;"><div style="font-size:11px;color:#e74c3c;font-weight:700;">Agent '+esc(o.agent_pret)+'</div>'
          +(o.date_pret?'<div style="font-size:10px;color:var(--mu);">Depuis '+new Date(o.date_pret).toLocaleDateString('fr-FR')+'</div>':'')
          +'</div></div>';
      });
      h += '</div>';
    }

    h += '<div style="font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Tous les outils</div>';
    data.forEach(function(o) {
      var isPret = !!o.agent_pret;
      h += '<div style="background:var(--sf);border:1px solid '+(isPret?'#e74c3c':'var(--br)')+';border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:12px;font-weight:700;color:var(--tx);">'+esc(o.nom)+'</div>'
        +(o.location?'<div style="font-size:10px;color:var(--mu);">📍 '+esc(o.location)+'</div>':'')+'</div>'
        +'<div style="font-size:11px;font-weight:700;color:'+(isPret?'#e74c3c':'#2ecc71')+';text-align:right;">'
        +(isPret?'🔴 Agent '+esc(o.agent_pret):'🟢 Disponible')+'</div>'
        +'</div>';
    });
    el.innerHTML = h;
  } catch(e) { console.error(e); }
}

async function loadDemandesCompte() {
  try {
    var data=await supa('GET','demandes_compte?statut=eq.en_attente&order=created_at.asc&select=*');
    var section=document.getElementById('demandesCompteSection'), badge=document.getElementById('badgeDemandesCompte'), list=document.getElementById('demandesCompteList');
    if (!section||!list) return;
    if (!data||!data.length) { if(section) section.style.display='none'; return; }
    if(section) section.style.display=''; if(badge){badge.style.display='inline-flex'; badge.textContent=data.length;}
    var h='';
    for (var i=0;i<data.length;i++) {
      var d=data[i], date=new Date(d.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
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
    if (!data||!data.length) { if(section) section.style.display='none'; return; }
    if(section) section.style.display=''; if(badge){badge.style.display='inline-flex'; badge.textContent=data.length;}
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
    outillage=data||[];
    // Compter les prêts depuis historique_actions
    try {
      var histo = await supa('GET','historique_actions?action=like.Pret+outillage*&select=action');
      if (histo && histo.length) {
        var counts = {};
        histo.forEach(function(h) {
          var nom = (h.action||'').replace(/^Pret outillage:\s*/i,'').trim();
          if (nom) counts[nom] = (counts[nom]||0)+1;
        });
        outillage.forEach(function(o) { o.nb_prets = counts[o.nom] || 0; });
      }
    } catch(e) {}
    doOutilSearch(); updateBadgePretsOutillage();
    var fab=document.getElementById('outilFab');
    if (fab) fab.style.display=window._canEdit?'flex':'none';
  } catch(e) { showToast('Erreur chargement outillage','err'); }
}

function showOutilAddForm() {
  document.getElementById('outilRes').style.display='none';
  document.getElementById('outilAddPanel').classList.remove('hidden');
}

function hideOutilAddForm() {
  document.getElementById('outilRes').style.display='';
  document.getElementById('outilAddPanel').classList.add('hidden');
  doOutilSearch();
}

function doOutilSearch() {
  var q=normalize(document.getElementById('outilSearch').value.trim());
  var fil=outillage.filter(function(o) {
    if (!q) return true;
    return (normalize(o.nom)+'|'+normalize(o.location||'')+'|'+normalize(o.tags||'')).indexOf(q)>=0;
  });
  // Réservés en haut
  fil.sort(function(a,b) {
    // 1. En prêt en premier
    var ap = a.agent_pret ? 1 : 0, bp = b.agent_pret ? 1 : 0;
    if (bp !== ap) return bp - ap;
    // 2. Parmi les en-prêt : le plus ancien prêt en premier (attente la plus longue)
    if (ap && bp) {
      var da = a.date_pret ? new Date(a.date_pret) : 0;
      var db = b.date_pret ? new Date(b.date_pret) : 0;
      return da - db;
    }
    // 3. Parmi les disponibles : par nb_prets desc si dispo, sinon alpha
    var na = a.nb_prets || 0, nb2 = b.nb_prets || 0;
    if (nb2 !== na) return nb2 - na;
    return (a.nom||'').localeCompare(b.nom||'');
  });
  var count=document.getElementById('outilCount');
  var enPret=outillage.filter(function(o){return o.agent_pret;}).length;
  if (count) count.textContent=fil.length+' outil(s)'+(enPret?' · ⚠️ '+enPret+' en prêt':'');
  var res=document.getElementById('outilRes'); if (!res) return;
  if (!fil.length) { res.innerHTML='<div style="text-align:center;color:var(--mu);padding:40px 20px;grid-column:1/-1;"><div style="font-size:36px;margin-bottom:10px;">🔧</div>Aucun outil trouvé</div>'; return; }

  res.innerHTML=fil.map(function(o) {
    var isPret=!!o.agent_pret;
    var canRetour=currentUser.role==='admin'||currentUser.role==='magasinier'||currentUser.role==='brigadier';
    // Photo — zone fixe 100px
    var photoHtml='';
    if (o.photo) {
      photoHtml='<div style="width:100%;height:100px;overflow:hidden;border-radius:10px 10px 0 0;flex-shrink:0;cursor:pointer;" onclick="event.stopPropagation();openPhoto(\''+esc(o.photo)+'\',[\''+esc(o.photo)+'\'])">'
        +'<img src="'+esc(o.photo)+'" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;"/>'
        +'</div>';
    } else {
      photoHtml='<div style="width:100%;height:100px;border-radius:10px 10px 0 0;flex-shrink:0;background:#0d0f18;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--br);">'
        +'<div style="font-size:28px;opacity:0.15;">🔧</div>'
        +'</div>';
    }
    // Badge statut prêt
    var pretBadge=isPret
      ?'<div style="background:rgba(231,76,60,0.12);border:1px solid #e74c3c;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;color:#e74c3c;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:6px;" onclick="event.stopPropagation()">'
          +'<div>🔴 EN PRÊT<br><span style="font-size:9px;color:var(--mu);">Agent '+esc(o.agent_pret)+(o.date_pret?' · '+formatDateBelge(o.date_pret):'')+'</span></div>'
          +(canRetour?'<div onclick="retourOutil(\''+o.id+'\')" style="background:#2ecc71;color:#111;border-radius:5px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;">✓ Retour</div>':'')
        +'</div>'
      :'';
    // Panneau enregistrer prêt
    var pretPanel=isPret?''
      :'<div id="pretPanel-'+o.id+'" style="display:none;background:var(--sf);border:1px solid var(--ac);border-radius:6px;padding:7px;margin-bottom:6px;" onclick="event.stopPropagation()">'
          +'<div style="display:flex;gap:6px;align-items:center;">'
            +'<input type="text" id="pret-'+o.id+'" placeholder="N° agent..." style="flex:1;background:var(--bg);border:1px solid var(--br2);border-radius:5px;padding:6px 8px;font-size:12px;color:var(--tx);-webkit-appearance:none;outline:none;" inputmode="numeric"/>'
            +'<div onclick="confirmerPret(\''+o.id+'\')" style="background:#e74c3c;color:#fff;border-radius:5px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">OK</div>'
            +'<div onclick="document.getElementById(\'pretPanel-'+o.id+'\').style.display=\'none\'" style="color:var(--mu);cursor:pointer;font-size:14px;">✕</div>'
          +'</div></div>';
    // Boutons action
    var pretBtnAction=isPret?'':'togglePretPanel(\''+o.id+'\')';
    var pretBtnStyle='background:rgba('+(isPret?'231,76,60':'46,204,113')+',0.1);border:1px solid '+(isPret?'#e74c3c':'#2ecc71')+';';
    var editBtns=window._canEdit
      ?'<div class="card-edit-btns" onclick="event.stopPropagation()">'
          +'<div onclick="'+pretBtnAction+'" style="'+pretBtnStyle+'color:'+(isPret?'#e74c3c':'#2ecc71')+';border-radius:6px;padding:6px;font-size:11px;font-weight:700;text-align:center;cursor:pointer;flex:1;">'+(isPret?'🔴 Prêt':'🟢 Prêt')+'</div>'
          +'<div onclick="event.stopPropagation();openOutilEdit(\''+o.id+'\')" style="background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.25);color:var(--ac);border-radius:6px;padding:6px;font-size:10px;font-weight:700;text-align:center;cursor:pointer;flex:1;">✏️ Modifier</div>'
          +'<div onclick="event.stopPropagation();deleteOutil(\''+o.id+'\')" style="background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);color:var(--rd);border-radius:6px;padding:6px;font-size:10px;font-weight:700;text-align:center;cursor:pointer;flex:1;">🗑 Suppr.</div>'
        +'</div>'
      :'';
    return '<div class="piece-card" style="border-left:3px solid '+(isPret?'#e74c3c':'var(--br)')+';cursor:default;">'
      +photoHtml
      +'<div class="card-body">'
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">'
          +'<div class="card-name" style="margin-bottom:0;">'+esc(o.nom)+'</div>'
        +'</div>'
        +(o.location&&currentUser.role!=='agent'?'<div class="card-loc">📍 '+esc(o.location)+'</div>':'')
        +(o.tags?'<div style="font-size:10px;color:var(--mu);margin-bottom:6px;">'+esc(o.tags)+'</div>':'')
        +pretBadge
        +pretPanel
        +editBtns
      +'</div>'
    +'</div>';
  }).join('');
  updateBadgePretsOutillage();
}

function formatDateBelge(ts) { var d=new Date(ts); return d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

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
  var o=outillage.filter(function(x){return x.id===id;})[0];
  try {
    await supa('PATCH','outillage?id=eq.'+id,{agent_pret:agent,date_pret:new Date().toISOString()});
    logAction('Pret outillage: '+(o?o.nom:id),'Agent: '+agent);
    showToast('Prêt enregistré — Agent '+agent,'success'); await loadOutillage();
  } catch(e) { showToast('Erreur','err'); }
}
async function retourOutil(id) {
  if (!confirm('Confirmer le retour ?')) return;
  var o=outillage.filter(function(x){return x.id===id;})[0];
  try {
    await supa('PATCH','outillage?id=eq.'+id,{agent_pret:null,date_pret:null});
    logAction('Retour outillage: '+(o?o.nom:id));
    showToast('Retour enregistré ✓','success'); await loadOutillage();
  } catch(e) { showToast('Erreur','err'); }
}

function updateBadgePretsOutillage() {
  if (currentUser.role!=='admin'&&currentUser.role!=='magasinier') return;
  var nb=outillage.filter(function(o){return o.agent_pret;}).length;
  var badge=document.getElementById('badgeOutil');
  if (!badge) return;
  if (nb>0) {
    var v=document.getElementById('badgeOutilVal'); if(v) v.textContent=nb;
    badge.classList.remove('hidden');
    var bnO=document.getElementById('bnDotOutil'); if(bnO){bnO.textContent=nb;bnO.classList.remove('hidden');}
  } else {
    badge.classList.add('hidden');
    var bnO=document.getElementById('bnDotOutil'); if(bnO) bnO.classList.add('hidden');
  }
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
async function deleteOutil(id) {
  var o=outillage.filter(function(x){return x.id===id;})[0];
  if (!confirm('Supprimer cet outil ?')) return;
  try {
    await supa('DELETE','outillage?id=eq.'+id);
    logAction('Suppression outillage: '+(o?o.nom:id));
    showToast('Outil supprimé','success'); loadOutillage();
  } catch(e) { showToast('Erreur','err'); }
}

async function uploadPhoto(file, bucket) {
  try {
    var ext=file.name.split('.').pop(), path=Date.now()+'.'+ext;
    var b=bucket||'outillage';
    var resp=await fetch(SURL+'/storage/v1/object/'+b+'/'+path,{method:'POST',headers:{'apikey':SKEY,'Authorization':'Bearer '+SKEY,'Content-Type':file.type||'image/jpeg'},body:file});
    if (!resp.ok) { var t=await resp.text(); throw new Error(t); }
    return SURL+'/storage/v1/object/public/'+b+'/'+path;
  } catch(e) { showToast('Erreur upload photo','err'); return null; }
}

document.addEventListener('DOMContentLoaded', function() {
  var outilSearchEl=document.getElementById('outilSearch');
  var clearOutilEl=document.getElementById('clearOutilSearch');
  if (outilSearchEl) outilSearchEl.addEventListener('input', function(){ doOutilSearch(); if (clearOutilEl) clearOutilEl.style.display=this.value?'block':'none'; });
  if (clearOutilEl) clearOutilEl.addEventListener('click', function(){ if (outilSearchEl) outilSearchEl.value=''; doOutilSearch(); this.style.display='none'; });

  var addBtn=document.getElementById('outilAddBtn');
  if (addBtn) addBtn.addEventListener('click', async function() {
    var nom=(document.getElementById('outilNom').value||'').trim(); if (!nom) { showToast('Désignation obligatoire','err'); return; }
    var obj={nom:nom,location:(document.getElementById('outilLoc').value||'').trim(),tags:(document.getElementById('outilTags').value||'').trim(),photo:_outilPhoto||null};
    try {
      await supa('POST','outillage',[obj]);
      logAction('Ajout outillage: '+nom, obj.location?'Emplacement: '+obj.location:'');
      showToast('Outil enregistré !','success');
      document.getElementById('outilNom').value=''; document.getElementById('outilLoc').value=''; document.getElementById('outilTags').value='';
      _outilPhoto=null; document.getElementById('outilPhotoContainer').innerHTML='';
      await loadOutillage(); hideOutilAddForm();
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
    try { await supa('PATCH','outillage?id=eq.'+id,obj); logAction('Modification outillage: '+nom, obj.location?'Emplacement: '+obj.location:''); showToast('Outil modifié !','success'); closeOutilEdit(); loadOutillage(); } catch(e) { showToast('Erreur','err'); }
  });
});

// ── LAYOUT MOBILE ──
function applyMobileLayout() {
  if (window.innerWidth > 700) return;
  // Outillage grille 1 col
  var or2 = document.getElementById('outilRes');
  if (or2) or2.style.gridTemplateColumns = '1fr';
}

window.addEventListener('resize', function() { buildSidebar(); doSearch(); });

// ── SERVICE WORKER (PWA) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/Article/sw.js').catch(function() {});
  });
}

initRealtime();
checkAuth();
