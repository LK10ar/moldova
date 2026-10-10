(() => {
'use strict';
const API = window.MD_API || 'https://back-moldova-xjyz.onrender.com'; // URL de l'API Render : modifiable dans config.js
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LG = ['fr', 'en', 'es', 'ro', 'ru'];
const LGN = { fr: 'Français', en: 'English', es: 'Español', ro: 'Română', ru: 'Русский' };
let token = sessionStorage.getItem('md_t') || '';
const S0 = { homeTab: 'look' };

/* ---------------------------------------------------------------- réseau */
async function call(path, opt = {}) {
  const r = await fetch(API + '/api/admin/' + path, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } });
  if (r.status === 401) { logout(); throw new Error('Session expirée, reconnecte-toi.'); }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) { const er = new Error((data && data.error) || ('Erreur ' + r.status)); er.quota = !!(data && data.quota); er.status = r.status; throw er; }
  return data;
}
function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('toasts').append(t); setTimeout(() => t.remove(), type === 'err' ? 6000 : 2800);
}

/* ---------------------------------------------------------------- configuration des rubriques */
const COLS = {
  circuits: { label: 'Circuits', icon: '🚌', fields: [
    { k: 'region', t: 'select', l: 'Région', o: ['centre', 'nord', 'sud', 'gagaouzie', 'transnistrie'] },
    { k: 'days', t: 'number', l: 'Jours' }, { k: 'nights', t: 'number', l: 'Nuits' },
    { k: 'groupMin', t: 'number', l: 'Groupe minimum' }, { k: 'priceFrom', t: 'number', l: 'Prix à partir de (€)' },
    { k: 'transport', t: 'select', l: 'Transport', o: ['bus', 'velo', 'pied'] },
    { k: 'lodging', t: 'multi', l: 'Hébergement', o: ['hotel', 'pension', 'habitant', 'auberge'] },
    { k: 'st', t: 'text', l: 'Étapes', h: 'Séparées par « · » (ex : Chișinău · Cricova · Orheiul Vechi)' } ] },
  activities: { label: 'Activités', icon: '🥾', fields: [
    { k: 'category', t: 'text', l: 'Catégorie' },
    { k: 'wilaya', t: 'text', l: 'District', h: 'Écris « transnistrie » pour ranger la fiche dans la section Transnistrie' } ] },
  restaurants: { label: 'Vin & gastronomie', icon: '🍷', fields: [
    { k: 'type', t: 'text', l: 'Type', h: '« vin » pour un domaine / une cave, « plat » pour un plat' },
    { k: 'reg', t: 'text', l: 'Région viticole', h: 'Clé de la région (ex : codru)' },
    { k: 'address', t: 'text', l: 'Adresse' },
    { k: 'wilaya', t: 'text', l: 'District', h: 'Écris « transnistrie » pour la section Transnistrie' } ] },
  heritage: { label: 'Histoire & culture', icon: '🏛️', fields: [
    { k: 'kind', t: 'text', l: 'Type', h: 'monastère, forteresse, musée…' },
    { k: 'period', t: 'text', l: 'Période' },
    { k: 'wilaya', t: 'text', l: 'District', h: 'Écris « transnistrie » pour la section Transnistrie' } ] },
  news: { label: 'Actualités & événements', icon: '📰', fields: [
    { k: 'tags', t: 'tags', l: 'Étiquettes', h: 'Ajoute « event » pour que la fiche apparaisse dans Événements' },
    { k: 'publishedAt', t: 'date', l: 'Date de publication' },
    { k: 'when', t: 'i18n', l: 'Date / période affichée (événements)' } ] }
};
const BASE_KEYS = ['_id', '__v', 'createdAt', 'updatedAt', 'slug', 'status', 'cover', 'title', 'gallery', 'location', 'summary', 'videos', 'links', 'sub', 'w', 'trace'];
const MENU = [
  { h: "Page d'accueil" }, { id: 'home', icon: '🏠', label: 'Accueil du site' }, { id: 'langs', icon: '🌍', label: 'Langues' },
  { h: 'Contenu' }, ...Object.entries(COLS).map(([id, c]) => ({ id, icon: c.icon, label: c.label })),
  { h: 'À valider' }, { id: 'candidates', icon: '✨', label: 'Propositions auto' }
];
const DEF_CARDS = {
  c: { n: '01 · Circuits', t: 'Circuits clé en main', d: 'Itinéraires de 2 à 3 jours à travers le centre, le nord, le sud et la Gagaouzie.', g: 'linear-gradient(135deg,#2f5d3a,#14301f)' },
  g: { n: '02 · Vin & gastronomie', t: 'Vin & gastronomie', d: 'Caves souterraines, domaines des Codri, mămăligă et plăcinte : la Moldavie se déguste.', g: 'linear-gradient(135deg,#1fa37a,#0b2f36)' },
  h: { n: '03 · Histoire & culture', t: 'Histoire & culture', d: 'Orheiul Vechi, Soroca, Țipova, Căpriana : des monastères rupestres aux forteresses du Dniestr.', g: 'linear-gradient(135deg,#8a5a00,#3b2600)' },
  t: { n: '04 · Transnistrie', t: 'Transnistrie', d: 'Bender, Tiraspol, Chițcani : héritage soviétique et forteresse ottomane. Passeport requis au poste de contrôle.', g: 'linear-gradient(135deg,#1d4f9c,#0d2450)' }
};

/* ---------------------------------------------------------------- état */
const S = { view: '', list: [], filter: 'all', q: '', home: null, homeErr: '', dirty: false, homeTab: 'look', cands: [], candCount: 0 };
const normHome = d => ({ gallery: d.gallery || [], cards: d.cards || {}, cardOrder: d.cardOrder || [], sections: d.sections || [], theme: d.theme || {}, texts: d.texts || {}, heroImage: d.heroImage || '', heroVideo: d.heroVideo || '', bg: d.bg || {}, video: d.video || {}, filters: d.filters || {} });
const bg = u => u ? `style="background-image:url(&quot;${esc(u)}&quot;)"` : '';
const isUrl = v => /^https?:\/\//i.test(String(v || '').trim());

/* ---------------------------------------------------------------- connexion */
function logout() { token = ''; sessionStorage.removeItem('md_t'); closeDrawer(true); show(); }
function show() {
  $('login').classList.toggle('hide', !!token); $('app').classList.toggle('hide', !token);
  if (token) (async () => { try { await loadLangs(); } catch {} buildMenu(); go(S.view || 'home'); loadCandCount(); })();
}
async function login() {
  $('err').textContent = ''; const b = $('go'); b.disabled = true;
  try {
    const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('em').value.trim(), password: $('pw').value }) });
    if (r.status === 429) { $('err').textContent = 'Trop de tentatives, réessaie dans 15 min.'; return; }
    if (!r.ok) { $('err').textContent = 'Identifiants incorrects.'; return; }
    token = (await r.json()).token; sessionStorage.setItem('md_t', token); show();
  } catch { $('err').textContent = 'Serveur injoignable (il se réveille peut-être, réessaie dans 30 s) ou CORS refusé.'; }
  finally { b.disabled = false; }
}
$('go').onclick = login;
$('pw').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('em').addEventListener('keydown', e => { if (e.key === 'Enter') $('pw').focus(); });
$('btnOut').onclick = () => { if (!S.dirty || confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) { S.dirty = false; logout(); } };
window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------------------------------------------------------- menu + routeur */
function buildMenu() {
  $('menu').innerHTML = MENU.map(m => m.h ? `<h4>${esc(m.h)}</h4>` :
    `<button class="mi" data-go="${m.id}"><span class="ic">${m.icon}</span>${esc(m.label)}${m.id === 'candidates' ? `<span class="cnt ${S.candCount ? 'alert' : ''}" id="candBadge">${S.candCount || 0}</span>` : ''}</button>`).join('');
}
$('menu').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
async function loadCandCount() {
  try { const c = await call('candidates'); S.candCount = c.length; const b = $('candBadge'); if (b) { b.textContent = c.length; b.classList.toggle('alert', !!c.length); } } catch {}
}
function go(id) {
  if (S.dirty && S.view === 'home' && id !== 'home' && !confirm("Des modifications de l'accueil ne sont pas enregistrées. Les abandonner ?")) return;
  if (S.view === 'home' && id !== 'home') S.dirty = false;
  S.view = id; S.filter = 'all'; S.q = '';
  document.querySelectorAll('.mi').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  window.scrollTo(0, 0);
  if (id === 'home') return showHome();
  if (id === 'langs') return showLangs();
  if (id === 'candidates') return showCands();
  return showCol(id);
}
$('btnSeed').onclick = async () => {
  if (!confirm('Copier dans la base toutes les fiches codées en dur dans le site (sans doublon ni écrasement) ?')) return;
  const b = $('btnSeed'); b.disabled = true;
  try { const d = await call('seed', { method: 'POST' }); toast(d.added ? d.added + ' fiche(s) importée(s)' : 'Rien de nouveau : tout est déjà importé.'); if (COLS[S.view]) showCol(S.view); }
  catch (e) { toast(e.message, 'err'); }
  b.disabled = false;
};

/* ---------------------------------------------------------------- liste d'une rubrique */
async function showCol(id) {
  const C = COLS[id];
  $('topbar').innerHTML = `<h2>${C.icon} ${esc(C.label)}<small id="cnt">Chargement…</small></h2><button class="btn pri" id="newBtn">＋ Nouvelle fiche</button>`;
  $('content').innerHTML = `<div class="tools"><div class="search"><input id="q" placeholder="Rechercher une fiche (ex : kara gani)…" aria-label="Rechercher"></div><div class="seg" id="seg"></div></div><div class="list" id="list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('newBtn').onclick = () => openEditor(id, null);
  $('q').oninput = e => { S.q = e.target.value; drawList(); };
  try { S.list = await call(id); } catch (e) { $('list').innerHTML = `<div class="empty"><b>Impossible de charger</b>${esc(e.message)}</div>`; $('cnt').textContent = ''; return; }
  drawList();
}
function drawList() {
  const id = S.view, C = COLS[id]; if (!C) return;
  const q = S.q.trim().toLowerCase();
  const counts = { all: S.list.length, published: S.list.filter(x => x.status === 'published').length, draft: S.list.filter(x => x.status !== 'published').length };
  $('cnt').textContent = counts.all + ' fiche' + (counts.all > 1 ? 's' : '') + ' · ' + counts.published + ' publiée' + (counts.published > 1 ? 's' : '');
  $('seg').innerHTML = [['all', 'Toutes'], ['published', 'Publiées'], ['draft', 'Brouillons']].map(([k, l]) => `<button data-st="${k}" class="${S.filter === k ? 'on' : ''}">${l} (${counts[k]})</button>`).join('');
  const rows = S.list.filter(x => (S.filter === 'all' || (S.filter === 'published') === (x.status === 'published')) &&
    (!q || ((x.title && x.title.fr) || '').toLowerCase().includes(q) || (x.slug || '').toLowerCase().includes(q) || ((x.title && x.title.en) || '').toLowerCase().includes(q)));
  if (!rows.length) { $('list').innerHTML = `<div class="empty"><b>${S.list.length ? 'Aucun résultat' : 'Rien ici pour le moment'}</b>${S.list.length ? 'Essaie un autre mot ou un autre filtre.' : 'Clique sur « Nouvelle fiche » ou sur « Importer les fiches du site » (en bas du menu).'}</div>`; return; }
  $('list').innerHTML = rows.map(x => {
    const pub = x.status === 'published', ev = id === 'news' && (x.tags || []).includes('event');
    const sub = [x.slug, x.sub || x.region || x.category || x.type || x.kind || ''].filter(Boolean).join(' · ');
    return `<div class="row" data-id="${esc(x._id)}"><div class="thumb" ${bg(x.cover)}>${x.cover ? '' : C.icon}</div>
     <div class="info"><div class="t">${esc((x.title && x.title.fr) || x.slug)}</div><div class="s">${esc(sub)}</div></div>
     ${ev ? '<span class="pill ev">Événement</span>' : ''}
     <button class="pill ${pub ? 'pub' : 'dra'}" data-a="toggle" title="Cliquer pour ${pub ? 'dépublier' : 'publier'}">${pub ? 'Publié' : 'Brouillon'}</button>
     <div class="acts"><button class="btn sm" data-a="edit">Modifier</button><button class="btn sm ico" data-a="move" title="Déplacer vers une autre rubrique ou un autre filtre">⇄</button><button class="btn sm bad ico" data-a="del" aria-label="Supprimer">🗑</button></div></div>`;
  }).join('');
}
$('content').addEventListener('click', async e => {
  const st = e.target.closest('[data-st]'); if (st && COLS[S.view]) { S.filter = st.dataset.st; drawList(); return; }
  const row = e.target.closest('.row'), a = e.target.closest('[data-a]');
  if (!row || !a || !COLS[S.view]) return;
  const x = S.list.find(i => i._id === row.dataset.id); if (!x) return;
  if (a.dataset.a === 'edit') return openEditor(S.view, x);
  if (a.dataset.a === 'move') return moveModal(x);
  if (a.dataset.a === 'toggle') {
    const next = x.status === 'published' ? 'draft' : 'published';
    try { const u = await call(S.view + '/' + x._id, { method: 'PUT', body: JSON.stringify({ status: next }) }); Object.assign(x, u); drawList(); toast(next === 'published' ? 'Fiche publiée' : 'Fiche passée en brouillon'); }
    catch (err) { toast(err.message, 'err'); }
  }
  if (a.dataset.a === 'del') {
    if (!confirm('Supprimer « ' + ((x.title && x.title.fr) || x.slug) + ' » ? Cette action est définitive.')) return;
    try { await call(S.view + '/' + x._id, { method: 'DELETE' }); S.list = S.list.filter(i => i !== x); drawList(); toast('Fiche supprimée'); }
    catch (err) { toast(err.message, 'err'); }
  }
});

/* ---------------------------------------------------------------- tiroir d'édition */
let ED = null; // { col, doc, dirty, map, marker }
const fld = (d, v) => {
  const k = esc(d.k), help = d.h ? `<em>${esc(d.h)}</em>` : '';
  if (d.t === 'select') return `<label class="f"><span>${esc(d.l)}</span><select data-f="${k}"><option value="">—</option>${d.o.map(o => `<option value="${o}" ${v === o ? 'selected' : ''}>${o}</option>`).join('')}</select>${help}</label>`;
  if (d.t === 'multi') return `<div class="f"><span style="display:block;margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)">${esc(d.l)}</span><div class="checks">${d.o.map(o => `<label><input type="checkbox" data-f="${k}" value="${o}" ${(v || []).includes(o) ? 'checked' : ''}>${o}</label>`).join('')}</div></div>`;
  if (d.t === 'i18n') return `<div class="f"><span style="display:block;margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)">${esc(d.l)}</span><div class="g2">${LG.map(l => `<label class="f"><span>${l.toUpperCase()}</span><input data-f="${k}.${l}" value="${esc((v || {})[l] || '')}"></label>`).join('')}</div></div>`;
  const val = d.t === 'tags' ? (v || []).join(', ') : d.t === 'date' ? (v ? String(v).slice(0, 10) : '') : (v == null ? '' : v);
  return `<label class="f"><span>${esc(d.l)}</span><input data-f="${k}" type="${d.t === 'number' ? 'number' : d.t === 'date' ? 'date' : 'text'}" ${d.t === 'number' ? 'step="any"' : ''} value="${esc(val)}">${help}</label>`;
};
const langBlock = (key, label, obj, rows, ph) => `<div class="card-sec"><h5>${esc(label)}</h5>
  <div class="langs" data-langs="${key}">${LG.map((l, i) => `<button type="button" data-l="${l}" class="${i ? '' : 'on'} ${(obj || {})[l] ? 'has' : ''}">${l.toUpperCase()}</button>`).join('')}</div>
  ${LG.map((l, i) => `<div class="lp ${i ? '' : 'on'}" data-lp="${key}.${l}"><textarea data-f="${key}.${l}" rows="${rows}" placeholder="${esc(ph)} ${LGN[l]} (Entrée = nouveau paragraphe)">${esc((obj || {})[l] || '')}</textarea></div>`).join('')}</div>`;

function openEditor(colId, doc) {
  closeDrawer(true);
  const C = COLS[colId], isNew = !doc, d = doc || {};
  const handled = new Set([...BASE_KEYS, ...C.fields.map(f => f.k), ...(colId === 'news' ? ['body'] : [])]);
  const rest = {}; Object.keys(d).forEach(k => { if (!handled.has(k)) rest[k] = d[k]; });
  ED = { col: colId, doc, dirty: false, slugTouched: !isNew, map: null, marker: null, trk: parseGeo(doc && doc.trace), trkDirty: false, tmap: null, tlayer: null, codeEdited: false };
  const t = d.title || {}, loc = d.location || {};
  const veil = document.createElement('div'); veil.className = 'veil'; veil.id = 'veil';
  const dr = document.createElement('div'); dr.className = 'drawer'; dr.id = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true');
  dr.innerHTML = `
  <div class="dh"><h3>${isNew ? 'Nouvelle fiche' : 'Modifier : ' + esc(t.fr || d.slug)}</h3><span class="dot hide" id="dot" title="Modifications non enregistrées"></span><button class="btn sm ico" id="dClose" aria-label="Fermer">✕</button></div>
  <div class="tabs" id="dTabs">${[['gen', 'Général'], ['txt', 'Textes'], ['det', 'Détails'], ['med', 'Médias'], ['map', 'Carte'], ['trk', 'Parcours'], ['adv', 'Avancé']].map(([k, l], i) => `<button type="button" data-t="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
  <div class="db">
   <div class="pane on" data-p="gen">
    <div class="g2"><label class="f"><span>Rubrique (où la fiche s'affiche sur le site)</span><select data-f="rubric">${RUBS.map(([k, l]) => `<option value="${k}" ${k === (isNew ? ({ circuits: 'c', activities: 'a', restaurants: 'g', heritage: 'h', news: 'n' })[colId] : rubOf(colId, d)) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span>Statut</span><select data-f="status"><option value="draft" ${d.status !== 'published' ? 'selected' : ''}>Brouillon (invisible)</option><option value="published" ${d.status === 'published' ? 'selected' : ''}>Publié (visible)</option></select></label>
    <label class="f"><span>Identifiant (slug)</span><input data-f="slug" placeholder="ex : cricova" value="${esc(d.slug || '')}"><em>Sans espace ni accent, unique. Généré depuis le titre si tu le laisses vide.</em></label></div>
    <div class="card-sec"><h5>Titre</h5><div class="g2">${LG.map(l => `<label class="f"><span>${l.toUpperCase()}${l === 'fr' ? ' *' : ''}</span><input data-f="title.${l}" value="${esc(t[l] || '')}"></label>`).join('')}</div></div>
    <label class="f"><span>Photo principale (URL)</span><input data-f="cover" type="url" placeholder="https://…" value="${esc(d.cover || '')}"><em>Laisse vide pour que le site cherche une photo tout seul.</em></label>
    <img class="prev" id="coverPrev" alt="" ${d.cover ? `src="${esc(d.cover)}"` : ''}>
   </div>
   <div class="pane" data-p="txt">
    ${langBlock('summary', 'Présentation', d.summary, 6, 'Présentation')}
    ${colId === 'news' ? langBlock('body', 'Texte complet de l\'article', d.body, 10, 'Article') : ''}
   </div>
   <div class="pane" data-p="det">
    <p class="hint">Champs propres à cette rubrique.</p>
    <div class="g2">${C.fields.filter(f => f.t !== 'multi' && f.t !== 'i18n').map(f => fld(f, d[f.k])).join('')}</div>
    ${C.fields.filter(f => f.t === 'multi' || f.t === 'i18n').map(f => fld(f, d[f.k])).join('')}
    <div class="g2"><label class="f"><span>Filtre / catégorie</span><input data-f="sub" list="subList" value="${esc(d.sub || '')}"><datalist id="subList">${subOptions('a')}${subOptions('g')}${subOptions('h')}${subOptions('t')}</datalist><em>Le bouton de filtre sous lequel la fiche apparaît. Crée de nouveaux filtres dans Accueil du site › Filtres.</em></label>
    <label class="f"><span>Terme Wikipédia (w)</span><input data-f="w" value="${esc(d.w || '')}"><em>Sert à retrouver la photo et l'histoire sur Wikipédia.</em></label></div>
   </div>
   <div class="pane" data-p="med">
    <label class="f"><span>Galerie de photos — une URL par ligne</span><textarea data-f="gallery" rows="6" placeholder="https://…">${esc((d.gallery || []).join('\n'))}</textarea></label>
    <div class="thumbs" id="galPrev"></div>
    <label class="f" style="margin-top:16px"><span>Vidéos — une URL par ligne (YouTube, mp4…)</span><textarea data-f="videos" rows="3" placeholder="https://…">${esc((d.videos || []).join('\n'))}</textarea></label>
    <label class="f"><span>Liens utiles — « Libellé | URL » par ligne</span><textarea data-f="links" rows="3" placeholder="Site officiel | https://…">${esc((d.links || []).map(l => (l.label || '') + ' | ' + (l.url || '')).join('\n'))}</textarea></label>
   </div>
   <div class="pane" data-p="map">
    <p class="hint">Clique sur la carte pour placer la fiche, ou saisis les coordonnées.</p>
    <div class="row2"><label class="f"><span>Latitude</span><input data-f="lat" inputmode="decimal" placeholder="45.69" value="${loc.lat == null ? '' : esc(loc.lat)}"></label>
    <label class="f"><span>Longitude</span><input data-f="lng" inputmode="decimal" placeholder="28.40" value="${loc.lng == null ? '' : esc(loc.lng)}"></label>
    <button type="button" class="btn" id="clrPt" style="margin-bottom:14px">Retirer le point</button></div>
    <div id="pick"></div>
   </div>
   <div class="pane" data-p="trk">
    <p class="hint">Trace un parcours : cherche une ville ou clique sur la carte pour ajouter les étapes. Elles sont reliées dans l'ordre de la liste (change l'ordre avec ↑ ↓, ou déplace un numéro sur la carte).</p>
    <div class="srch"><input id="tkQ" placeholder="Rechercher une ville, un village, un lieu…" autocomplete="off"><button type="button" class="btn gold" id="tkGo">Chercher</button></div>
    <div class="tkres hide" id="tkRes"></div>
    <div id="tkMap"></div>
    <div class="tools" style="margin:12px 0 0"><button type="button" class="btn" id="tkRoad" title="Calcule le tracé le long des routes (voiture)">🛣 Suivre les routes</button><button type="button" class="btn" id="tkLine">⟋ Lignes droites</button><button type="button" class="btn bad" id="tkClr">Tout effacer</button></div>
    <p class="hint" id="tkInfo" style="margin:10px 0 0"></p>
    <ol class="tklist" id="tkList"></ol>
    <details class="card-sec" style="margin-top:16px"><summary>Code GeoJSON (avancé)</summary>
     <p class="hint" style="margin-top:10px">Colle un GeoJSON (FeatureCollection avec une LineString et des Points) puis « Appliquer le code ». Les coordonnées sont [longitude, latitude].</p>
     <textarea class="json" id="tkCode" spellcheck="false" rows="10" placeholder='{"type":"FeatureCollection","features":[…]}'></textarea>
     <div class="tools"><button type="button" class="btn" id="tkApply">Appliquer le code</button><button type="button" class="btn" id="tkRefresh">↻ Régénérer depuis les étapes</button></div>
    </details>
   </div>
   <div class="pane" data-p="adv">
    <p class="hint">Réservé aux champs qui n'ont pas de case dédiée (itinéraire détaillé…). Astuce : tu peux coller ici directement un GeoJSON (FeatureCollection) : il devient le parcours de la fiche. Laisse tel quel si tu n'es pas sûr.</p>
    <textarea class="json" data-f="extra" spellcheck="false" placeholder="{}">${Object.keys(rest).length ? esc(JSON.stringify(rest, null, 2)) : ''}</textarea>
   </div>
  </div>
  <div class="df"><span class="msg" id="dMsg"></span><button class="btn" id="dCancel">Annuler</button><button class="btn pri" id="dSave">Enregistrer</button></div>`;
  document.body.append(veil, dr);
  document.body.style.overflow = 'hidden';
  drawGalPrev();
  dr.addEventListener('input', onEdInput); dr.addEventListener('change', onEdInput);
  dr.addEventListener('click', onEdClick);
  dr.addEventListener('click', onTrkClick); dr.addEventListener('input', onTrkInput);
  dr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tkQ') { e.preventDefault(); tkSearch(); } });
  veil.onclick = () => closeDrawer();
  $('dClose').onclick = $('dCancel').onclick = () => closeDrawer();
  $('dSave').onclick = saveEditor;
  $('clrPt').onclick = () => setPoint(null, null);
  setTimeout(() => { const f = dr.querySelector('[data-f="title.fr"]'); if (f && isNew) f.focus(); }, 280);
  ensureHome().then(() => { const l = $('subList'); if (l) l.innerHTML = subOptions('a') + subOptions('g') + subOptions('h') + subOptions('t'); });
}
const F = k => $('drawer') && $('drawer').querySelector(`[data-f="${k}"]`);
function markDirty() { if (!ED) return; ED.dirty = true; $('dot').classList.remove('hide'); }
function onEdInput(e) {
  const f = e.target.dataset && e.target.dataset.f; if (!f) return;
  markDirty();
  if (f === 'cover') $('coverPrev').src = e.target.value.trim();
  if (f === 'gallery') drawGalPrev();
  if (f === 'slug') ED.slugTouched = true;
  if (f === 'title.fr' && !ED.slugTouched) F('slug').value = slugify(e.target.value);
  if (f === 'lat' || f === 'lng') fromInputs();
  const m = f.match(/^(summary|body)\.(\w+)$/);
  if (m) { const b = $('drawer').querySelector(`[data-langs="${m[1]}"] [data-l="${m[2]}"]`); if (b) b.classList.toggle('has', !!e.target.value.trim()); }
}
function onEdClick(e) {
  const tb = e.target.closest('#dTabs [data-t]');
  if (tb) {
    document.querySelectorAll('#dTabs button').forEach(b => b.classList.toggle('on', b === tb));
    document.querySelectorAll('#drawer .pane').forEach(p => p.classList.toggle('on', p.dataset.p === tb.dataset.t));
    if (tb.dataset.t === 'map') initPicker();
    if (tb.dataset.t === 'trk') initTrk();
    return;
  }
  const lb = e.target.closest('[data-langs] [data-l]');
  if (lb) {
    const key = lb.parentNode.dataset.langs;
    lb.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === lb));
    document.querySelectorAll(`#drawer [data-lp^="${key}."]`).forEach(p => p.classList.toggle('on', p.dataset.lp === key + '.' + lb.dataset.l));
  }
}
function drawGalPrev() {
  const g = F('gallery'), box = $('galPrev'); if (!g || !box) return;
  box.innerHTML = g.value.split(/\s+/).filter(isUrl).slice(0, 24).map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('');
}
function closeDrawer(force) {
  if (!ED) return;
  if (!force && ED.dirty && !confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return;
  if (ED.map) { try { ED.map.remove(); } catch {} }
  if (ED.tmap) { try { ED.tmap.remove(); } catch {} }
  ED = null; const v = $('veil'), d = $('drawer'); if (v) v.remove(); if (d) d.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('modalBox')) closeModal(); else closeDrawer(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { if (ED) { e.preventDefault(); saveEditor(); } else if (S.view === 'home' && S.dirty) { e.preventDefault(); saveHome(); } }
});

/* --- parcours : étapes, recherche de ville, tracé --- */
const isNum = v => typeof v === 'number' && isFinite(v);
const samePath = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-6 && Math.abs(p[1] - b[i][1]) < 1e-6);
function parseGeo(g) {
  const out = { steps: [], line: null, mode: 'line', dropped: false, res: [] };
  if (!g || typeof g !== 'object') return out;
  const feats = g.type === 'FeatureCollection' ? (g.features || []) : g.type === 'Feature' ? [g] : g.type ? [{ type: 'Feature', properties: {}, geometry: g }] : [];
  let line = [];
  feats.forEach(f => {
    const geo = f && f.geometry, p = (f && f.properties) || {}; if (!geo || !Array.isArray(geo.coordinates)) return;
    if (geo.type === 'Point' && isNum(geo.coordinates[0]) && isNum(geo.coordinates[1]))
      out.steps.push({ name: String(p.name || p.title || 'Étape ' + (out.steps.length + 1)), type: String(p.type || p.description || ''), lat: geo.coordinates[1], lng: geo.coordinates[0] });
    else if (geo.type === 'LineString') line = line.concat(geo.coordinates);
    else if (geo.type === 'MultiLineString') geo.coordinates.forEach(c => { line = line.concat(c); });
  });
  line = line.filter(c => Array.isArray(c) && isNum(c[0]) && isNum(c[1])).map(c => [c[1], c[0]]);
  if (!out.steps.length && line.length > 1) { const a = line[0], b = line[line.length - 1]; out.steps = [{ name: 'Départ', type: '', lat: a[0], lng: a[1] }, { name: 'Arrivée', type: '', lat: b[0], lng: b[1] }]; }
  if (line.length > 1 && !samePath(line, out.steps.map(s => [s.lat, s.lng]))) { out.line = line; out.mode = 'custom'; }
  return out;
}
function simplifyPath(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const dist = (p, a, b) => { const dx = b[1] - a[1], dy = b[0] - a[0]; if (!dx && !dy) return Math.hypot(p[1] - a[1], p[0] - a[0]); let t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); return Math.hypot(p[1] - (a[1] + t * dx), p[0] - (a[0] + t * dy)); };
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop(); let mx = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = dist(pts[i], pts[s], pts[e]); if (d > mx) { mx = d; idx = i; } }
    if (mx > tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const pathKm = p => { let d = 0; for (let i = 1; i < p.length; i++) d += kmBetween(p[i - 1], p[i]); return d; };
function buildGeo() {
  const T = ED.trk, st = T.steps; if (!st.length) return null;
  const path = (T.line && T.line.length > 1) ? T.line : st.map(s => [s.lat, s.lng]);
  const t = F('title.fr'), title = (t && t.value.trim()) || 'Parcours';
  const feats = [];
  if (st.length > 1) feats.push({ type: 'Feature', properties: { name: title, description: "Tracé global de l'itinéraire reliant les étapes", mode: T.line ? (T.mode === 'road' ? 'road' : 'custom') : 'line' }, geometry: { type: 'LineString', coordinates: path.map(p => [+p[1].toFixed(6), +p[0].toFixed(6)]) } });
  st.forEach((s, i) => feats.push({ type: 'Feature', properties: { name: s.name, type: s.type, order: i + 1 }, geometry: { type: 'Point', coordinates: [+(+s.lng).toFixed(6), +(+s.lat).toFixed(6)] } }));
  return { type: 'FeatureCollection', features: feats };
}
function geomChanged() { const T = ED.trk; if (T.line) { T.line = null; T.dropped = true; } ED.trkDirty = true; markDirty(); }
function syncCode(force) { const c = $('tkCode'); if (!c || !ED) return; if (ED.codeEdited && !force) return; const g = buildGeo(); c.value = g ? JSON.stringify(g, null, 2) : ''; }
function renderTrk(fit) {
  if (!ED || !$('tkList')) return;
  const T = ED.trk, st = T.steps, path = (T.line && T.line.length > 1) ? T.line : st.map(s => [s.lat, s.lng]);
  $('tkList').innerHTML = st.length ? st.map((s, i) => `<li class="tks" data-i="${i}"><span class="n">${i + 1}</span>
    <div class="tkf"><input data-tk="name" value="${esc(s.name)}" placeholder="Nom de l'étape" aria-label="Nom de l'étape ${i + 1}"><input data-tk="type" value="${esc(s.type)}" placeholder="Description (ex : Vestiges du Mur inférieur)" aria-label="Description de l'étape ${i + 1}"></div>
    <div class="tka"><button type="button" class="btn sm ico" data-tkb="up" ${i ? '' : 'disabled'} aria-label="Monter">↑</button><button type="button" class="btn sm ico" data-tkb="down" ${i < st.length - 1 ? '' : 'disabled'} aria-label="Descendre">↓</button><button type="button" class="btn sm bad ico" data-tkb="del" aria-label="Supprimer l'étape">✕</button></div>
    <small class="co">${(+s.lat).toFixed(4)}, ${(+s.lng).toFixed(4)}</small></li>`).join('') : '<li class="tk-empty">Aucune étape pour l\'instant. Cherche une ville ci-dessus ou clique sur la carte.</li>';
  const kind = T.line ? (T.mode === 'road' ? 'suit les routes' : 'tracé personnalisé') : 'lignes droites';
  $('tkInfo').innerHTML = st.length ? `${st.length} étape${st.length > 1 ? 's' : ''} · ${kind}${st.length > 1 ? ' · ≈ ' + pathKm(path).toFixed(0) + ' km' : ''}${T.dropped ? '<br><b style="color:var(--gold)">Les étapes ont changé : le tracé est repassé en lignes droites. Clique sur « Suivre les routes » pour le recalculer.</b>' : ''}` : '';
  syncCode();
  if (!ED.tmap || !window.L) return;
  const L = window.L; ED.tlayer.clearLayers();
  if (path.length > 1) { L.polyline(path, { color: '#000', weight: 8, opacity: .35, interactive: false }).addTo(ED.tlayer); L.polyline(path, { color: '#ffc83d', weight: 4, opacity: .95, dashArray: T.line ? null : '8 6' }).addTo(ED.tlayer); }
  st.forEach((s, i) => {
    const mk = L.marker([s.lat, s.lng], { draggable: true, icon: L.divIcon({ className: '', html: `<div class="tkpin">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(ED.tlayer);
    mk.bindTooltip(s.name || 'Étape ' + (i + 1));
    mk.on('dragend', ev => { const p = ev.target.getLatLng(); s.lat = p.lat; s.lng = p.lng; geomChanged(); renderTrk(false); });
  });
  if (fit && st.length) { try { ED.tmap.fitBounds(path, { padding: [40, 40], maxZoom: 12 }); } catch {} }
}
async function initTrk() {
  if (!ED) return; renderTrk(false);
  const el = $('tkMap'); if (!el) return;
  if (ED.tmap) { setTimeout(() => ED.tmap && ED.tmap.invalidateSize(), 60); return; }
  try { await loadLeaflet(); } catch { el.innerHTML = '<p class="hint" style="padding:16px">Carte indisponible (réseau) : tu peux quand même utiliser la recherche et le code GeoJSON.</p>'; return; }
  if (!ED || ED.tmap) return;
  const L = window.L; ED.tmap = L.map(el).setView([47.0, 28.6], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(ED.tmap);
  ED.tlayer = L.layerGroup().addTo(ED.tmap);
  ED.tmap.on('click', e => tkAdd(e.latlng.lat, e.latlng.lng, 'Étape ' + (ED.trk.steps.length + 1), '', true));
  renderTrk(true); setTimeout(() => ED && ED.tmap && ED.tmap.invalidateSize(), 150);
}
function tkAdd(lat, lng, name, type, reverse) {
  const step = { name, type: type || '', lat: +lat, lng: +lng };
  ED.trk.steps.push(step); geomChanged(); renderTrk(false);
  if (ED.tmap) ED.tmap.panTo([step.lat, step.lng]);
  if (reverse) tkRev(step);
}
async function tkRev(step) {
  try {
    const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=fr&lat=${step.lat}&lon=${step.lng}`)).json();
    const a = j.address || {}, nm = a.village || a.town || a.city || a.hamlet || a.municipality || j.name;
    if (ED && nm && /^Étape \d+$/.test(step.name) && ED.trk.steps.includes(step)) { step.name = nm; renderTrk(false); }
  } catch {}
}
async function tkSearch() {
  if (!ED) return; const q = ($('tkQ').value || '').trim(); if (q.length < 2) return;
  const box = $('tkRes'); box.classList.remove('hide'); box.innerHTML = '<div class="tkr dim">Recherche…</div>';
  try {
    const j = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=fr&viewbox=26.4,48.6,30.3,45.3&q=' + encodeURIComponent(q))).json();
    if (!ED) return; ED.trk.res = j;
    box.innerHTML = j.length ? j.map((x, i) => `<button type="button" class="tkr" data-tkr="${i}"><b>${esc(x.name || String(x.display_name).split(',')[0])}</b><span>${esc(x.display_name)}</span><em>＋ Ajouter</em></button>`).join('') : '<div class="tkr dim">Aucun résultat. Essaie un autre nom.</div>';
  } catch { box.innerHTML = '<div class="tkr dim">Recherche indisponible. Tu peux cliquer directement sur la carte.</div>'; }
}
async function tkRoad() {
  const T = ED.trk, st = T.steps;
  if (st.length < 2) { toast('Ajoute au moins 2 étapes.', 'err'); return; }
  if (st.length > 40) { toast('40 étapes maximum pour le calcul sur route.', 'err'); return; }
  const btn = $('tkRoad'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Calcul…';
  try {
    const c = st.map(s => (+s.lng).toFixed(6) + ',' + (+s.lat).toFixed(6)).join(';');
    const j = await (await fetch('https://router.project-osrm.org/route/v1/driving/' + c + '?overview=full&geometries=geojson')).json();
    if (j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error(j.message || 'aucun itinéraire trouvé');
    T.line = simplifyPath(j.routes[0].geometry.coordinates.map(p => [p[1], p[0]]), 0.0002); T.mode = 'road'; T.dropped = false;
    ED.trkDirty = true; markDirty(); renderTrk(false); toast('Tracé calculé sur les routes');
  } catch (e) { toast('Calcul impossible (' + e.message + '). Le tracé reste en lignes droites.', 'err'); }
  finally { btn.disabled = false; btn.textContent = lbl; }
}
function tkApply() {
  const raw = ($('tkCode').value || '').trim();
  if (!raw) { ED.trk.steps = []; ED.trk.line = null; ED.trkDirty = true; ED.codeEdited = false; markDirty(); renderTrk(false); return; }
  let g; try { g = JSON.parse(raw); } catch { toast('GeoJSON invalide : vérifie les virgules et les accolades.', 'err'); return; }
  const p = parseGeo(g); if (!p.steps.length) { toast('Aucune étape (Point) ni ligne trouvée dans ce GeoJSON.', 'err'); return; }
  Object.assign(ED.trk, { steps: p.steps, line: p.line, mode: p.mode, dropped: false }); ED.trkDirty = true; ED.codeEdited = false; markDirty(); renderTrk(true); toast(p.steps.length + ' étape(s) chargée(s)');
}
function onTrkClick(e) {
  if (!ED) return; const T = ED.trk;
  const b = e.target.closest('[data-tkb]');
  if (b) {
    const i = +b.closest('.tks').dataset.i, k = b.dataset.tkb;
    if (k === 'up' && i > 0) [T.steps[i - 1], T.steps[i]] = [T.steps[i], T.steps[i - 1]];
    else if (k === 'down' && i < T.steps.length - 1) [T.steps[i + 1], T.steps[i]] = [T.steps[i], T.steps[i + 1]];
    else if (k === 'del') T.steps.splice(i, 1);
    geomChanged(); renderTrk(false); return;
  }
  const r = e.target.closest('[data-tkr]');
  if (r) { const x = (T.res || [])[+r.dataset.tkr]; if (x) { tkAdd(+x.lat, +x.lon, String(x.name || String(x.display_name).split(',')[0]).trim(), '', false); $('tkRes').classList.add('hide'); $('tkQ').value = ''; if (ED.tmap) ED.tmap.setView([+x.lat, +x.lon], Math.max(ED.tmap.getZoom(), 11)); } return; }
  const bt = e.target.closest('button'), id = bt && bt.id;
  if (id === 'tkGo') tkSearch();
  else if (id === 'tkRoad') tkRoad();
  else if (id === 'tkLine') { if (T.line) { T.line = null; T.dropped = false; ED.trkDirty = true; markDirty(); renderTrk(false); } }
  else if (id === 'tkClr') { if (T.steps.length && confirm('Effacer toutes les étapes du parcours ?')) { T.steps = []; T.line = null; T.dropped = false; ED.trkDirty = true; markDirty(); renderTrk(false); } }
  else if (id === 'tkApply') tkApply();
  else if (id === 'tkRefresh') { ED.codeEdited = false; syncCode(true); }
}
function onTrkInput(e) {
  if (!ED) return; const t = e.target;
  if (t.dataset && t.dataset.tk) { const li = t.closest('.tks'), s = li && ED.trk.steps[+li.dataset.i]; if (!s) return; s[t.dataset.tk] = t.value; ED.trkDirty = true; markDirty(); syncCode(); }
  if (t.id === 'tkCode') ED.codeEdited = true;
}

/* --- sélecteur de position (Leaflet chargé à la demande) --- */
let LP;
const loadLeaflet = () => LP || (LP = new Promise((ok, ko) => {
  const B = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = B + 'leaflet.min.css'; document.head.append(css);
  const js = document.createElement('script'); js.src = B + 'leaflet.min.js'; js.onload = ok; js.onerror = ko; document.head.append(js);
}));
async function initPicker() {
  if (!ED || ED.map) { if (ED && ED.map) setTimeout(() => ED.map.invalidateSize(), 50); return; }
  const el = $('pick'); try { await loadLeaflet(); } catch { el.innerHTML = '<p class="hint" style="padding:16px">Carte indisponible : saisis les coordonnées à la main.</p>'; return; }
  if (!ED || ED.map) return;
  const L = window.L; ED.map = L.map(el).setView([47.0, 28.6], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(ED.map);
  ED.map.on('click', e => { setPoint(e.latlng.lat, e.latlng.lng); markDirty(); });
  fromInputs(); setTimeout(() => ED && ED.map && ED.map.invalidateSize(), 150);
}
function setPoint(la, ln, fly) {
  const a = F('lat'), b = F('lng'); if (!a) return;
  if (la == null || ln == null || isNaN(la) || isNaN(ln)) { a.value = b.value = ''; if (ED.marker) { ED.marker.remove(); ED.marker = null; } return; }
  a.value = (+la).toFixed(5); b.value = (+ln).toFixed(5);
  if (!ED.map) return; const L = window.L;
  if (ED.marker) ED.marker.setLatLng([la, ln]); else ED.marker = L.marker([la, ln]).addTo(ED.map);
  if (fly) ED.map.setView([la, ln], Math.max(ED.map.getZoom(), 10));
}
function fromInputs() { if (!ED) return; const la = parseFloat(F('lat').value), ln = parseFloat(F('lng').value); if (!isNaN(la) && !isNaN(ln)) setPoint(la, ln, true); }

/* --- enregistrement --- */
function collect() {
  const C = COLS[ED.col], editing = !!ED.doc, val = k => { const e = F(k); return e ? e.value.trim() : ''; };
  let extra = {}; const raw = F('extra').value.trim();
  if (raw) { try { extra = JSON.parse(raw); } catch { throw new Error('Onglet « Avancé » : JSON invalide.'); } if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new Error('Onglet « Avancé » : il faut un objet JSON { … }.'); }
  const title = {}; LG.forEach(l => { title[l] = val('title.' + l); });
  if (!title.fr) throw new Error('Le titre en français est obligatoire.');
  let slug = val('slug') || slugify(title.fr);
  if (!slug) throw new Error("L'identifiant (slug) est obligatoire.");
  let traceAdv = null;
  if (extra && typeof extra.type === 'string' && /^(FeatureCollection|Feature|LineString|MultiLineString|Point)$/.test(extra.type)) { traceAdv = extra; extra = {}; }
  const body = { ...extra, slug, status: F('status').value, title, cover: val('cover') || (editing ? '' : undefined) };
  if (traceAdv) body.trace = traceAdv;
  else if (ED.trkDirty) { const g = buildGeo(); if (g) body.trace = g; else if (editing) body.trace = null; }
  if (body.trace && JSON.stringify(body.trace).length > 150000) throw new Error('Parcours trop lourd (plus de 150 Ko) : retire des étapes ou repasse en lignes droites.');
  body.gallery = F('gallery').value.split(/\s+/).filter(Boolean);
  body.videos = F('videos').value.split('\n').map(s => s.trim()).filter(Boolean);
  body.links = F('links').value.split('\n').map(s => s.trim()).filter(Boolean).map(s => { const i = s.lastIndexOf('|'); return i < 0 ? { label: s, url: s } : { label: s.slice(0, i).trim(), url: s.slice(i + 1).trim() }; }).filter(l => isUrl(l.url));
  ['sub', 'w'].forEach(k => { const v = val(k); if (v || editing) body[k] = v; });
  const sm = {}; LG.forEach(l => { const v = val('summary.' + l); if (v) sm[l] = v; });
  if (Object.keys(sm).length) body.summary = sm; else if (editing && !extra.summary) body.summary = {};
  if (ED.col === 'news') { const bd = {}; LG.forEach(l => { const v = val('body.' + l); if (v) bd[l] = v; }); if (Object.keys(bd).length) body.body = bd; else if (editing && !extra.body) body.body = {}; }
  C.fields.forEach(f => {
    if (f.t === 'multi') { body[f.k] = [...$('drawer').querySelectorAll(`[data-f="${f.k}"]:checked`)].map(c => c.value); return; }
    if (f.t === 'i18n') { const o = {}; LG.forEach(l => { const v = val(f.k + '.' + l); if (v) o[l] = v; }); if (Object.keys(o).length) body[f.k] = o; else if (editing && !extra[f.k]) body[f.k] = {}; return; }
    const v = val(f.k);
    if (f.t === 'number') { if (v !== '') body[f.k] = +v; else if (editing) body[f.k] = null; }
    else if (f.t === 'tags') { const a = v.split(',').map(s => s.trim()).filter(Boolean); body[f.k] = a; }
    else if (f.t === 'date') { if (v) body[f.k] = v; }
    else if (f.t === 'select') { if (v) body[f.k] = v; }
    else if (v || editing) body[f.k] = v;
  });
  const la = parseFloat(val('lat')), ln = parseFloat(val('lng'));
  if (!isNaN(la) && !isNaN(ln)) body.location = { lat: la, lng: ln }; else if (editing && !extra.location) body.location = { lat: null, lng: null };
  return body;
}
async function saveEditor() {
  const msg = $('dMsg'), btn = $('dSave'); msg.textContent = '';
  let body; try { body = collect(); } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--bad)'; toast(e.message, 'err'); return; }
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    const col = ED.col;
    const rub = F('rubric') && F('rubric').value, wasNew = !ED.doc;
    const saved = ED.doc ? await call(col + '/' + ED.doc._id, { method: 'PUT', body: JSON.stringify(body) }) : await call(col, { method: 'POST', body: JSON.stringify(body) });
    let moved = false;
    if (rub && saved && rub !== rubOf(col, saved)) { await doMove(col, saved, rub); moved = true; }
    toast(moved ? 'Fiche enregistrée et déplacée vers « ' + RUBS.find(r => r[0] === rub)[1] + ' »' : wasNew ? 'Fiche créée' : 'Fiche enregistrée'); closeDrawer(true);
    if (S.view === col) showCol(col);
  } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--bad)'; toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Enregistrer'; }
}

/* ---------------------------------------------------------------- fenêtre modale simple */
function openModal(html, wide) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modalBox';
  m.innerHTML = `<div class="mbox ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
  document.body.append(m); return m;
}
function closeModal() { const m = $('modalBox'); if (m) m.remove(); }

/* ---------------------------------------------------------------- accueil du site : galerie, cartes, vidéo */
async function showHome() {
  $('topbar').innerHTML = `<h2>🏠 Accueil du site<small>Gère ce qui s'affiche sur la page d'accueil : carrousel « Un pays en images », cartes « Par où commencer » et vidéo du header.</small></h2>`;
  $('content').innerHTML = `<div class="skeleton"></div>`;
  if (!S.home) {
    try { const d = await call('settings/home'); S.home = normHome(d); S.homeErr = ''; }
    catch (e) { S.home = normHome({}); S.homeErr = e.message; }
  }
  drawHome();
}
function drawHome() {
  const H = S.home, tabs = [['look', '🎨 Apparence', Object.keys(H.theme).length], ['sections', '🧩 Sections & ordre', H.sections.length + H.cardOrder.length], ['texts', '✍️ Textes', Object.keys(H.texts).length], ['gallery', '🖼 Galerie « Un pays en images »', H.gallery.length], ['cards', '🃏 Cartes « Par où commencer »', Object.keys(H.cards).length], ['filters', '🏷 Filtres', Object.values(H.filters).reduce((n, l) => n + l.length, 0)], ['yt', '▶ Vidéo YouTube', (H.video && H.video.on === false) ? 0 : 1], ['video', '🎬 Header (vidéo & photo)', (H.heroVideo ? 1 : 0) + (H.heroImage ? 1 : 0)]];
  let h = '';
  if (S.homeErr) h += `<div class="card-sec" style="border-color:#e5615f88"><h5>⚠ Le serveur ne répond pas à cette section</h5><p class="hint" style="margin:0">${esc(S.homeErr)}. Si c'est une erreur 404, le fichier <b>server.js</b> mis à jour n'est pas encore déployé sur Render : mets-le à jour dans ton dépôt, Render le redéploie tout seul.</p></div>`;
  h += `<div class="tools"><div class="seg">${tabs.map(([k, l, n]) => `<button data-ht="${k}" class="${S.homeTab === k ? 'on' : ''}">${l}${n ? ` (${n})` : ''}</button>`).join('')}</div></div><div id="homeBody"></div>`;
  h += `<div class="savebar ${S.dirty ? '' : 'hide'}" id="saveBar"><span>● Modifications non enregistrées</span><button class="btn" id="hCancel">Annuler</button><button class="btn pri" id="hSave">Enregistrer l'accueil</button></div>`;
  $('content').innerHTML = h;
  drawHomeBody();
  $('hSave').onclick = saveHome;
  $('hCancel').onclick = () => { if (confirm('Abandonner les modifications non enregistrées ?')) { S.dirty = false; S.home = null; showHome(); } };
}
function homeDirty() { S.dirty = true; const b = $('saveBar'); if (b) b.classList.remove('hide'); }
/* ---- rubriques, déplacement de fiches, filtres ---- */
const RUBS = [['c', 'Circuits', 'circuits'], ['a', 'Activités', 'activities'], ['g', 'Vin & gastronomie', 'restaurants'], ['h', 'Histoire & culture', 'heritage'], ['t', 'Transnistrie', null], ['e', 'Événements', 'news'], ['n', 'Actualités', 'news']];
const rubOf = (col, d) => col === 'circuits' ? 'c' : col === 'news' ? ((d.tags || []).includes('event') ? 'e' : 'n') : (String(d.wilaya || '').toLowerCase() === 'transnistrie' ? 't' : ({ activities: 'a', restaurants: 'g', heritage: 'h' })[col]);
function moveSpec(col, doc, to) {
  if (to === 't') return { col: ['activities', 'restaurants', 'heritage'].includes(col) ? col : 'heritage', patch: { wilaya: 'transnistrie' } };
  if (to === 'e' || to === 'n') { const tags = (doc.tags || []).filter(t => t !== 'event'); if (to === 'e') tags.push('event'); return { col: 'news', patch: { tags } }; }
  return { col: ({ c: 'circuits', a: 'activities', g: 'restaurants', h: 'heritage' })[to], patch: { wilaya: '' } };
}
async function doMove(col, doc, to, sub) {
  const sp = moveSpec(col, doc, to);
  if (sub !== undefined) sp.patch.sub = sub; else if (!doc.sub) { const k = doc.kind || doc.category || doc.type; if (k) sp.patch.sub = k; }
  return call(col + '/' + doc._id + '/move', { method: 'POST', body: JSON.stringify({ to: sp.col, patch: sp.patch }) });
}
async function ensureHome() { if (!S.home) { try { S.home = normHome(await call('settings/home')); } catch { S.home = normHome({}); } } return S.home; }
const subOptions = rub => ((S.home && S.home.filters && S.home.filters[rub]) || []).map(f => `<option value="${esc(f.k)}">${esc(f.l.fr || f.k)}</option>`).join('');
function moveModal(x) {
  const col = S.view, cur = rubOf(col, x);
  const m = openModal(`<h3>Déplacer « ${esc((x.title && x.title.fr) || x.slug)} »</h3><div class="mb">
    <p class="hint">La fiche change de rubrique : elle apparaît dans l'onglet choisi sur le site, avec le filtre indiqué.</p>
    <label class="f"><span>Nouvelle rubrique</span><select id="mvR">${RUBS.map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span>Filtre / catégorie (facultatif)</span><input id="mvS" list="mvL" placeholder="ex : musee, chateau…" value="${esc(x.sub || '')}"><datalist id="mvL">${subOptions('a')}${subOptions('g')}${subOptions('h')}${subOptions('t')}</datalist><em>Laisse vide pour garder le filtre actuel. Un nouveau filtre se crée dans l'onglet « Filtres » de l'accueil.</em></label>
  </div><div class="mf"><button class="btn" id="mCancel">Annuler</button><button class="btn pri" id="mOk">Déplacer</button></div>`);
  ensureHome().then(() => { const l = $('mvL'); if (l) l.innerHTML = subOptions('a') + subOptions('g') + subOptions('h') + subOptions('t'); });
  $('mCancel').onclick = closeModal;
  $('mOk').onclick = async () => {
    const to = $('mvR').value, sub = $('mvS').value.trim(); if (to === cur && sub === (x.sub || '')) { closeModal(); return; }
    const b = $('mOk'); b.disabled = true;
    try { await doMove(col, x, to, sub || undefined); closeModal(); toast('Fiche déplacée vers « ' + RUBS.find(r => r[0] === to)[1] + ' »'); showCol(col); }
    catch (e) { toast(e.message, 'err'); b.disabled = false; }
  };
}
const FRUB = [['a', '🥾 Activités'], ['g', '🍷 Vin & gastronomie'], ['h', '🏛️ Histoire & culture'], ['t', '🏰 Transnistrie']];
function drawFilters(box) {
  const Fl = S.home.filters = S.home.filters || {};
  box.innerHTML = `<p class="hint">Ce sont les boutons de filtre affichés au-dessus des fiches. Écris un nom (ex : Château) et clique sur « Ajouter » : le bouton est créé. Pour y ranger une fiche, utilise le bouton « ⇄ Déplacer » de la fiche (ou son champ « Filtre »).</p>` +
    FRUB.map(([c, t]) => `<div class="card-sec"><h5>${t}</h5>${(Fl[c] || []).map((f, i) => `<div class="frow" data-fc="${c}" data-i="${i}"><b>${esc(f.l.fr || f.k)}</b><code>${esc(f.k)}</code>
      <span class="grow"></span><button type="button" class="btn sm" data-fa="tr">Traductions</button><button type="button" class="btn sm ico" data-fa="up" ${i ? '' : 'disabled'}>↑</button><button type="button" class="btn sm ico" data-fa="down" ${i < Fl[c].length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="btn sm bad ico" data-fa="del">✕</button></div>
      <div class="ftr hide g2" data-ftr="${c}.${i}">${LG.map(l => `<label class="f"><span>${l.toUpperCase()}</span><input data-fl="${c}.${i}.${l}" value="${esc(f.l[l] || '')}"></label>`).join('')}</div>`).join('') || '<p class="hint" style="margin:0 0 10px">Aucun filtre ajouté ici pour l\'instant (ceux déjà présents sur le site continuent de s\'afficher).</p>'}
      <div class="srch"><input data-fnew="${c}" placeholder="Nouveau filtre (ex : Château)"><button type="button" class="btn gold" data-fa="add" data-fc="${c}">＋ Ajouter</button></div></div>`).join('');
}
document.addEventListener('click', e => {
  if (S.view !== 'home' || S.homeTab !== 'filters') return;
  const b = e.target.closest('[data-fa]'); if (!b) return;
  const Fl = S.home.filters, a = b.dataset.fa;
  if (a === 'add') {
    const c = b.dataset.fc, inp = document.querySelector(`[data-fnew="${c}"]`), label = inp.value.trim(); if (!label) return;
    const list = Fl[c] = Fl[c] || []; let k = slugify(label) || 'filtre', n = 2; const base = k; while (list.some(f => f.k === k)) k = base + '-' + n++;
    list.push({ k, l: { fr: label } }); homeDirty(); drawFilters($('homeBody')); toast('Filtre « ' + label + ' » créé'); return;
  }
  const row = b.closest('.frow'); if (!row) return; const c = row.dataset.fc, i = +row.dataset.i, list = Fl[c];
  if (a === 'tr') { const t = document.querySelector(`[data-ftr="${c}.${i}"]`); if (t) t.classList.toggle('hide'); return; }
  if (a === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
  else if (a === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
  else if (a === 'del') { if (!confirm('Supprimer ce filtre ? (les fiches qui l\'utilisent le gardent tant qu\'elles ne sont pas déplacées)')) return; list.splice(i, 1); if (!list.length) delete Fl[c]; }
  homeDirty(); drawFilters($('homeBody'));
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.fl; if (!k || S.view !== 'home') return;
  const [c, i, l] = k.split('.'), f = S.home.filters[c] && S.home.filters[c][+i]; if (!f) return;
  const v = e.target.value.trim(); if (v) f.l[l] = v; else if (l !== 'fr') delete f.l[l]; homeDirty();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.fnew) { e.preventDefault(); const b = document.querySelector(`[data-fa="add"][data-fc="${e.target.dataset.fnew}"]`); if (b) b.click(); } });
const DEF_YT = 'https://youtu.be/55VUcUz8cuU';
const ytIdA = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtube-nocookie\.com\/embed\/)([\w-]{11})/); return m ? m[1] : ''; };
function drawYt(box) {
  const V = S.home.video = S.home.video || {}, url = V.url || '', id = ytIdA(url || DEF_YT);
  box.innerHTML = `<div class="card-sec"><h5>Vidéo YouTube de la page d'accueil</h5>
   <p class="hint">Une section « La Moldavie en mouvement » avec ta vidéo. Elle ne se charge qu'au clic : le site reste rapide.</p>
   <div class="checks" style="margin-bottom:12px"><label><input type="checkbox" data-yt="on" ${V.on !== false ? 'checked' : ''}> Afficher la section vidéo</label></div>
   <label class="f"><span>Adresse YouTube</span><input data-yt="url" type="url" placeholder="${DEF_YT} (par défaut)" value="${esc(url)}"><em>Colle un lien youtu.be/… ou youtube.com/watch?v=…</em></label>
   <img class="prev" id="ytPrev" alt="" ${id ? `src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"` : ''}></div>
  <div class="card-sec"><h5>Titre et texte (facultatifs)</h5><p class="hint">Vide = textes par défaut du site.</p>
   <div class="langs" data-yl>${LG.map((l, i) => `<button type="button" data-l="${l}" class="${i ? '' : 'on'}">${l.toUpperCase()}</button>`).join('')}</div>
   ${LG.map((l, i) => `<div class="lp ${i ? '' : 'on'}" data-yp="${l}"><label class="f"><span>Titre (${esc(LGN[l] || l)})</span><input data-yt="title.${l}" value="${esc((V.title || {})[l] || '')}"></label><label class="f"><span>Texte sous la vidéo (${esc(LGN[l] || l)})</span><textarea data-yt="text.${l}" rows="3">${esc((V.text || {})[l] || '')}</textarea></label></div>`).join('')}</div>`;
}
function ytInput(e) {
  if (S.view !== 'home' || S.homeTab !== 'yt') return;
  const t = e.target, k = t.dataset && t.dataset.yt; if (!k) return;
  const V = S.home.video = S.home.video || {};
  if (t.type === 'checkbox') V[k] = t.checked;
  else if (k === 'url') { const v = t.value.trim(); if (v) V.url = v; else delete V.url; const id = ytIdA(v || DEF_YT), p = $('ytPrev'); if (p) p.src = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''; }
  else { const [f, l] = k.split('.'); V[f] = V[f] || {}; if (t.value.trim()) V[f][l] = t.value.trim(); else delete V[f][l]; if (!Object.keys(V[f]).length) delete V[f]; }
  homeDirty();
}
document.addEventListener('input', ytInput); document.addEventListener('change', ytInput);
document.addEventListener('click', e => {
  const lb = S.view === 'home' && e.target.closest('[data-yl] [data-l]');
  if (lb) { lb.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === lb)); document.querySelectorAll('[data-yp]').forEach(p => p.classList.toggle('on', p.dataset.yp === lb.dataset.l)); }
});
function drawHomeBody() {
  const box = $('homeBody'); if (!box) return;
  if (S.homeTab === 'look') return drawLook(box);
  if (S.homeTab === 'sections') return drawSections(box);
  if (S.homeTab === 'texts') return drawTexts(box);
  if (S.homeTab === 'gallery') return drawGallery(box);
  if (S.homeTab === 'cards') return drawCards(box);
  if (S.homeTab === 'yt') return drawYt(box);
  if (S.homeTab === 'filters') return drawFilters(box);
  drawVideo(box);
}
/* --- galerie --- */
const readAuto = () => { try { const v = JSON.parse(localStorage.getItem('md_autogal') || '[]'); return Array.isArray(v) ? v.filter(g => g && isUrl(g.url)) : []; } catch { return []; } };
async function importAuto() {
  let list = readAuto();
  if (!list.length) {
    toast('Chargement des photos du site…');
    const f = document.createElement('iframe'); f.src = './index.html'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
    document.body.append(f);
    for (let i = 0; i < 40 && !list.length; i++) { await new Promise(r => setTimeout(r, 500)); list = readAuto(); }
    f.remove();
  }
  if (!list.length) { toast("Impossible de lire les photos : ouvre le site dans ce navigateur (bouton « Voir le site ») puis réessaie.", 'err'); return; }
  const have = new Set(S.home.gallery.map(g => g.url)); let n = 0;
  list.forEach(g => { if (!have.has(g.url)) { S.home.gallery.push({ url: g.url, caption: g.caption || {}, link: g.link || '' }); n++; } });
  homeDirty(); drawGallery($('homeBody'));
  toast(n ? n + ' photo(s) reprise(s) : modifie, déplace ou retire-les, puis « Enregistrer l\'accueil »' : 'Ces photos sont déjà dans la galerie.');
}
function drawGallery(box) {
  const G = S.home.gallery;
  box.innerHTML = `<p class="hint">Fais glisser les images pour changer leur ordre (ou utilise ◀ ▶ sur téléphone). Si la galerie est vide, le site choisit tout seul des photos parmi tes fiches (c'est ce que tu vois en ce moment sur le site).</p>
  ${G.length ? '' : `<div class="card-sec" style="border-color:var(--gold)"><h5>Le site affiche des photos automatiques</h5><p class="hint" style="margin:0 0 12px">Pour les modifier, les retirer ou les déplacer, reprends d'abord les photos actuelles : elles apparaissent ici et tu en fais ce que tu veux.</p><button class="btn gold" data-g="auto">↧ Reprendre les photos actuelles du site</button></div>`}
  <div class="tools"><button class="btn gold" data-g="add">＋ Ajouter une image</button><button class="btn" data-g="bulk">Coller plusieurs URLs</button><button class="btn" data-g="pick">Choisir parmi mes fiches</button><button class="btn" data-g="auto" title="Copie ici les photos que le site affiche actuellement">↧ Reprendre les photos du site</button></div>
  <div class="ggrid" id="ggrid">${G.map((g, i) => `<div class="gitem" draggable="true" data-i="${i}">
    <div class="gthumb" ${bg(g.url)}><span class="n">${i + 1}</span><span class="h" title="Glisser pour déplacer">⋮⋮</span></div>
    <div class="gcap ${(g.caption && (g.caption.fr || Object.values(g.caption)[0])) ? '' : 'none'}">${esc((g.caption && (g.caption.fr || Object.values(g.caption)[0])) || 'Sans légende')}</div>
    <div class="glink">${g.link ? '🔗 ' + esc(g.link) : ''}</div>
    <div class="gact"><button class="btn sm ico" data-g="left" ${i === 0 ? 'disabled' : ''} aria-label="Avancer">◀</button><button class="btn sm ico" data-g="right" ${i === G.length - 1 ? 'disabled' : ''} aria-label="Reculer">▶</button><button class="btn sm" data-g="edit">Modifier</button><button class="btn sm bad ico" data-g="del" aria-label="Retirer">🗑</button></div></div>`).join('')}
    <button class="addtile" data-g="add"><b>＋</b>Ajouter une image</button></div>`;
}
const gItem = e => { const el = e.target.closest('.gitem'); return el ? +el.dataset.i : -1; };
function moveG(from, to) { const G = S.home.gallery; if (from === to || from < 0 || to < 0 || to >= G.length) return; G.splice(to, 0, G.splice(from, 1)[0]); homeDirty(); drawGallery($('homeBody')); }
document.addEventListener('click', async e => {
  const ht = e.target.closest('[data-ht]'); if (ht && S.view === 'home') { S.homeTab = ht.dataset.ht; drawHome(); return; }
  const b = e.target.closest('[data-g]'); if (!b || S.view !== 'home') return;
  const i = gItem(e), a = b.dataset.g, G = S.home.gallery;
  if (a === 'left') moveG(i, i - 1);
  else if (a === 'right') moveG(i, i + 1);
  else if (a === 'del') { if (confirm('Retirer cette image de la galerie ?')) { G.splice(i, 1); homeDirty(); drawGallery($('homeBody')); } }
  else if (a === 'edit') galleryModal(i);
  else if (a === 'add') galleryModal(-1);
  else if (a === 'bulk') bulkModal();
  else if (a === 'pick') pickModal();
  else if (a === 'auto') importAuto();
});
let dragFrom = -1;
document.addEventListener('dragstart', e => { const it = e.target.closest && e.target.closest('.gitem'); if (!it) return; dragFrom = +it.dataset.i; it.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); } catch {} });
document.addEventListener('dragover', e => { const it = e.target.closest && e.target.closest('.gitem'); if (!it || dragFrom < 0) return; e.preventDefault(); document.querySelectorAll('.gitem.over').forEach(x => x.classList.remove('over')); it.classList.add('over'); });
document.addEventListener('drop', e => { const it = e.target.closest && e.target.closest('.gitem'); if (!it || dragFrom < 0) return; e.preventDefault(); const to = +it.dataset.i, from = dragFrom; dragFrom = -1; moveG(from, to); });
document.addEventListener('dragend', () => { dragFrom = -1; document.querySelectorAll('.gitem.drag,.gitem.over').forEach(x => x.classList.remove('drag', 'over')); });

function galleryModal(i) {
  const G = S.home.gallery, g = i >= 0 ? G[i] : { url: '', caption: {}, link: '' };
  const m = openModal(`<h3>${i >= 0 ? "Modifier l'image" : 'Ajouter une image'}</h3><div class="mb">
    <label class="f"><span>Adresse de l'image (URL https) *</span><input id="gUrl" type="url" placeholder="https://…" value="${esc(g.url)}"></label>
    <img class="prev" id="gPrev" alt="" ${g.url ? `src="${esc(g.url)}"` : ''}>
    <div class="card-sec" style="margin-top:14px"><h5>Légende (facultative)</h5><div class="g2">${LG.map(l => `<label class="f"><span>${l.toUpperCase()}</span><input data-c="${l}" value="${esc((g.caption || {})[l] || '')}"></label>`).join('')}</div></div>
    <label class="f"><span>Lien au clic (facultatif)</span><input id="gLink" placeholder="identifiant d'une fiche (ex : cricova) ou URL https" value="${esc(g.link || '')}"><em>Avec l'identifiant d'une fiche, un clic sur la photo ouvre la fiche. Sans lien, la photo n'est pas cliquable.</em></label>
  </div><div class="mf"><button class="btn" id="mCancel">Annuler</button><button class="btn pri" id="mOk">${i >= 0 ? 'Valider' : 'Ajouter'}</button></div>`);
  $('gUrl').oninput = e => { $('gPrev').src = e.target.value.trim(); };
  $('mCancel').onclick = closeModal;
  $('mOk').onclick = () => {
    const url = $('gUrl').value.trim(); if (!isUrl(url)) { toast("L'adresse de l'image doit commencer par https://", 'err'); return; }
    const caption = {}; m.querySelectorAll('[data-c]').forEach(x => { if (x.value.trim()) caption[x.dataset.c] = x.value.trim(); });
    const item = { url, caption, link: $('gLink').value.trim() };
    if (i >= 0) G[i] = item; else G.push(item);
    homeDirty(); closeModal(); drawGallery($('homeBody'));
  };
  setTimeout(() => $('gUrl').focus(), 60);
}
function bulkModal() {
  openModal(`<h3>Ajouter plusieurs images</h3><div class="mb"><p class="hint">Colle une adresse d'image par ligne. Tu pourras ajouter les légendes ensuite avec « Modifier ».</p><textarea id="bUrls" rows="9" placeholder="https://…\nhttps://…"></textarea></div><div class="mf"><button class="btn" id="mCancel">Annuler</button><button class="btn pri" id="mOk">Ajouter</button></div>`);
  $('mCancel').onclick = closeModal;
  $('mOk').onclick = () => {
    const urls = $('bUrls').value.split(/\s+/).filter(isUrl); if (!urls.length) { toast('Aucune adresse valide trouvée.', 'err'); return; }
    urls.forEach(url => S.home.gallery.push({ url, caption: {}, link: '' })); homeDirty(); closeModal(); drawGallery($('homeBody')); toast(urls.length + ' image(s) ajoutée(s)');
  };
}
async function pickModal() {
  const m = openModal(`<h3>Choisir parmi mes fiches</h3><div class="mb"><p class="hint">Photos principales et galeries de tes fiches. Clique pour sélectionner.</p><div id="pg" class="pgrid"><div class="skeleton" style="grid-column:1/-1"></div></div></div><div class="mf"><button class="btn" id="mCancel">Annuler</button><button class="btn pri" id="mOk" disabled>Ajouter la sélection</button></div>`, true);
  $('mCancel').onclick = closeModal;
  const have = new Set(S.home.gallery.map(g => g.url)), seen = new Set(), items = [];
  await Promise.all(Object.keys(COLS).map(async c => {
    try { (await call(c)).forEach(d => { const cap = { fr: (d.title && d.title.fr) || '' }; [d.cover, ...(d.gallery || [])].filter(isUrl).forEach(u => { if (!have.has(u) && !seen.has(u)) { seen.add(u); items.push({ url: u, caption: cap, link: d.slug || '' }); } }); }); } catch {}
  }));
  if (!$('pg')) return;
  if (!items.length) { $('pg').innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Aucune photo disponible</b>Ajoute des photos dans tes fiches (onglet Médias) et reviens ici.</div>'; return; }
  $('pg').innerHTML = items.map((x, i) => `<div class="pitem" data-i="${i}" ${bg(x.url)}><i>${esc(x.caption.fr)}</i></div>`).join('');
  const upd = () => { const n = m.querySelectorAll('.pitem.sel').length; $('mOk').disabled = !n; $('mOk').textContent = n ? `Ajouter la sélection (${n})` : 'Ajouter la sélection'; };
  $('pg').onclick = e => { const p = e.target.closest('.pitem'); if (p) { p.classList.toggle('sel'); upd(); } };
  $('mOk').onclick = () => { const sel = [...m.querySelectorAll('.pitem.sel')].map(p => items[+p.dataset.i]); sel.forEach(x => S.home.gallery.push({ ...x })); homeDirty(); closeModal(); drawGallery($('homeBody')); toast(sel.length + ' image(s) ajoutée(s)'); };
}
/* --- cartes d'accueil --- */
function drawCards(box) {
  const C = S.home.cards;
  box.innerHTML = `<p class="hint">Ces 4 cartes s'empilent quand on descend sur la page d'accueil. Laisse un champ vide pour garder le texte ou la photo automatiques du site.</p><div class="hcards">` +
    Object.entries(DEF_CARDS).map(([k, d]) => {
      const c = C[k] || {};
      return `<div class="hcard" data-k="${k}"><div class="vis" style="--g:${d.g};${c.image ? `background-image:url(&quot;${esc(c.image)}&quot;)` : ''}"><b>${esc((c.title && c.title.fr) || d.t)}</b><span>${c.image ? 'Photo personnalisée' : 'Photo automatique'}</span></div>
      <div><h5>${esc(d.n)}<button class="btn sm" data-r="${k}" style="margin-left:auto">Réinitialiser</button></h5>
      <label class="f"><span>Photo (URL https)</span><input data-hc="${k}.image" type="url" placeholder="Vide = photo choisie automatiquement parmi tes fiches" value="${esc(c.image || '')}"></label>
      <div class="langs" data-hl="${k}">${LG.map((l, i) => `<button type="button" data-l="${l}" class="${i ? '' : 'on'} ${(c.title && c.title[l]) || (c.text && c.text[l]) ? 'has' : ''}">${l.toUpperCase()}</button>`).join('')}</div>
      ${LG.map((l, i) => `<div class="lp ${i ? '' : 'on'}" data-hp="${k}.${l}"><label class="f"><span>Titre (${LGN[l]})</span><input data-hc="${k}.title.${l}" placeholder="${l === 'fr' ? esc(d.t) : 'Texte par défaut du site'}" value="${esc((c.title || {})[l] || '')}"></label>
      <label class="f"><span>Texte (${LGN[l]})</span><textarea data-hc="${k}.text.${l}" rows="3" placeholder="${l === 'fr' ? esc(d.d) : 'Texte par défaut du site'}">${esc((c.text || {})[l] || '')}</textarea></label></div>`).join('')}
      </div></div>`;
    }).join('') + `</div>`;
}
document.addEventListener('input', e => {
  if (S.view !== 'home') return;
  const hc = e.target.dataset && e.target.dataset.hc;
  if (hc) {
    const [k, f, l] = hc.split('.'), C = S.home.cards, v = e.target.value.trim();
    const c = C[k] = C[k] || {};
    if (f === 'image') { if (v) c.image = v; else delete c.image; const vis = e.target.closest('.hcard').querySelector('.vis'); vis.style.backgroundImage = isUrl(v) ? `url("${v}")` : ''; vis.querySelector('span').textContent = v ? 'Photo personnalisée' : 'Photo automatique'; }
    else { c[f] = c[f] || {}; if (v) c[f][l] = v; else delete c[f][l]; if (!Object.keys(c[f]).length) delete c[f]; if (f === 'title' && l === 'fr') e.target.closest('.hcard').querySelector('.vis b').textContent = v || DEF_CARDS[k].t; const b = e.target.closest('.hcard').querySelector(`[data-hl] [data-l="${l}"]`); if (b) b.classList.toggle('has', !!((c.title || {})[l] || (c.text || {})[l])); }
    if (!Object.keys(c).length) delete C[k];
    homeDirty();
  }
  if (e.target.id === 'hImage') { S.home.heroImage = e.target.value.trim(); const p = $('hiPrev'); if (p) p.src = isUrl(S.home.heroImage) ? S.home.heroImage : ''; homeDirty(); }
  if (e.target.id === 'hVideo') { S.home.heroVideo = e.target.value.trim(); const p = $('hvPrev'); if (p) { if (isUrl(S.home.heroVideo)) { p.src = S.home.heroVideo; p.classList.remove('hide'); } else p.classList.add('hide'); } homeDirty(); }
});
document.addEventListener('click', e => {
  if (S.view !== 'home') return;
  const lb = e.target.closest('[data-hl] [data-l]');
  if (lb) { const k = lb.parentNode.dataset.hl; lb.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === lb)); document.querySelectorAll(`[data-hp^="${k}."]`).forEach(p => p.classList.toggle('on', p.dataset.hp === k + '.' + lb.dataset.l)); }
  const r = e.target.closest('[data-r]');
  if (r && confirm('Remettre les textes et la photo automatiques pour cette carte ?')) { delete S.home.cards[r.dataset.r]; homeDirty(); drawCards($('homeBody')); }
});

/* --- apparence : couleurs, polices, mode --- */
const TH0 = { p1: '#2f6df6', ac: '#ffc83d', bg: '#070f1d', cat: '#0b1a33', ft: '#0b1a33', mode: 'dark', ff: 'Playfair Display', fb: 'Georgia' };
const PRESETS = [
  { n: 'Nuit & or', t: { p1: '#2f6df6', ac: '#ffc83d', bg: '#070f1d', cat: '#0b1a33', ft: '#0b1a33' } },
  { n: 'Vignoble', t: { p1: '#3aa86a', ac: '#f0c36d', bg: '#08140e', cat: '#0d2118', ft: '#0f2a1d' } },
  { n: 'Azur & sable', t: { p1: '#1fa3d6', ac: '#f2d49b', bg: '#06141c', cat: '#0a2230', ft: '#0a2c38' } },
  { n: 'Violet nuit', t: { p1: '#8b5cf6', ac: '#fbbf24', bg: '#0d0a1c', cat: '#150f2e', ft: '#1d1245' } },
  { n: 'Cuivre', t: { p1: '#e0742f', ac: '#ffd08a', bg: '#100a07', cat: '#1c110b', ft: '#2a1a10' } },
  { n: 'Bordeaux (ancien)', t: { p1: '#1fa37a', ac: '#e8b45a', bg: '#14100b', cat: '#1a0b11', ft: '#0f3222' } }
];
const FH = ['Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Fraunces', 'Lora', 'Montserrat', 'Poppins', 'Space Grotesk', 'Syne', 'Bebas Neue', 'Unbounded'];
const FB = ['Georgia', 'Inter', 'DM Sans', 'Manrope', 'Nunito', 'Lora', 'Poppins', 'Montserrat', 'system-ui'];
const FSPEC = { 'Playfair Display': 'wght@500;600;700', 'Cormorant Garamond': 'wght@500;600;700', 'DM Serif Display': '', 'Fraunces': 'wght@500;600;700', 'Lora': 'wght@400;500;600;700', 'Montserrat': 'wght@400;500;600;700', 'Poppins': 'wght@400;500;600;700', 'Space Grotesk': 'wght@400;500;600;700', 'Syne': 'wght@500;600;700', 'Bebas Neue': '', 'Unbounded': 'wght@400;500;600;700', 'Inter': 'wght@400;500;600;700', 'DM Sans': 'wght@400;500;600;700', 'Manrope': 'wght@400;500;600;700', 'Nunito': 'wght@400;500;600;700' };
const fontsLoaded = new Set(['Playfair Display']);
function loadFont(n) { if (!(n in FSPEC) || fontsLoaded.has(n)) return; fontsLoaded.add(n); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + n.replace(/ /g, '+') + (FSPEC[n] ? ':' + FSPEC[n] : '') + '&display=swap'; document.head.append(l); }
const fam = (n, serif) => n === 'system-ui' ? 'system-ui,sans-serif' : n === 'Georgia' ? 'Georgia,serif' : `'${n}',${serif ? 'Georgia,serif' : 'system-ui,sans-serif'}`;
const THK = [['p1', 'Couleur principale', 'Boutons, éléments actifs, carte'], ['ac', "Couleur d'accent", 'Sur-titres, anneau du bouton haut, points, contour de la Moldavie'], ['bg', 'Fond du site', 'Fond général de la page'], ['cat', 'Fond du catalogue', 'Zone « Tout explorer »'], ['ft', 'Fond du pied de page', 'Footer']];
const thv = k => (S.home.theme[k] || TH0[k]);
const lum = h => { const v = parseInt(h.slice(1), 16); return (.299 * (v >> 16) + .587 * (v >> 8 & 255) + .114 * (v & 255)); };
function drawLook(box) {
  const T = S.home.theme;
  FH.forEach(loadFont); FB.forEach(loadFont);
  box.innerHTML = `<div class="lookgrid"><div>
   <div class="card-sec"><h5>Palettes prêtes à l'emploi</h5><div class="presets">${PRESETS.map((p, i) => `<button type="button" class="preset" data-pre="${i}"><span class="sw"><i style="background:${p.t.bg}"></i><i style="background:${p.t.cat}"></i><i style="background:${p.t.p1}"></i><i style="background:${p.t.ac}"></i><i style="background:${p.t.ft}"></i></span>${esc(p.n)}</button>`).join('')}</div></div>
   <div class="card-sec"><h5>Couleurs</h5>${THK.map(([k, l, h]) => `<div class="crow"><input type="color" data-th="${k}" value="${thv(k)}" aria-label="${esc(l)}"><div><b>${esc(l)}</b><small>${esc(h)}</small></div><input class="hex" data-thx="${k}" value="${thv(k)}" maxlength="7" spellcheck="false" aria-label="Code couleur ${esc(l)}"></div>`).join('')}</div>
   <div class="card-sec"><h5>Polices</h5>
    <label class="f"><span>Titres</span><select data-thsel="ff">${FH.map(n => `<option ${thv('ff') === n ? 'selected' : ''} style="font-family:'${n}'">${n}</option>`).join('')}</select></label>
    <label class="f"><span>Textes</span><select data-thsel="fb">${FB.map(n => `<option ${thv('fb') === n ? 'selected' : ''}>${n}</option>`).join('')}</select><em>« Georgia » = la police d'origine du site.</em></label>
    <label class="f"><span>Mode</span><select data-thsel="mode"><option value="dark" ${thv('mode') === 'dark' ? 'selected' : ''}>Sombre (recommandé)</option><option value="light" ${thv('mode') === 'light' ? 'selected' : ''}>Clair</option><option value="auto" ${thv('mode') === 'auto' ? 'selected' : ''}>Automatique (suit l'appareil du visiteur)</option></select></label>
    <button type="button" class="btn" data-threset>↺ Revenir aux réglages d'origine</button></div>
   <div class="card-sec"><h5>Image de fond (derrière tout le site)</h5>
    <p class="hint">Une photo en transparence derrière les zones bleues (le header vidéo et la planète gardent leur propre fond). Sans adresse, le site met une photo automatique du pays.</p>
    <div class="checks" style="margin-bottom:12px"><label><input type="checkbox" data-bg="on" ${BG().on !== false ? 'checked' : ''}> Afficher l'image de fond</label><label><input type="checkbox" data-bg="parallax" ${BG().parallax !== false ? 'checked' : ''}> Effet de profondeur au défilement</label></div>
    <label class="f"><span>Adresse de l'image (https)</span><input data-bg="url" type="url" placeholder="Vide = photo automatique" value="${esc(BG().url || '')}"></label>
    <div class="rng"><span>Transparence (visibilité)</span><input type="range" data-bg="opacity" min="0" max="100" step="1" value="${BG().opacity != null ? BG().opacity : 24}"><output>${BG().opacity != null ? BG().opacity : 24} %</output></div>
    <div class="rng"><span>Flou</span><input type="range" data-bg="blur" min="0" max="20" step="1" value="${BG().blur || 0}"><output>${BG().blur || 0} px</output></div>
    <div class="rng"><span>Luminosité</span><input type="range" data-bg="brightness" min="40" max="140" step="5" value="${BG().brightness != null ? BG().brightness : 100}"><output>${BG().brightness != null ? BG().brightness : 100} %</output></div>
    <label class="f"><span>Cadrage de la photo</span><select data-bg="pos"><option value="center" ${(BG().pos || 'center') === 'center' ? 'selected' : ''}>Centre</option><option value="top" ${BG().pos === 'top' ? 'selected' : ''}>Haut</option><option value="bottom" ${BG().pos === 'bottom' ? 'selected' : ''}>Bas</option></select></label>
    <div class="bgprev" id="bgPrev"><div class="bgp-img"></div><b>Aperçu</b></div>
    <div class="tools" style="margin-top:12px"><button type="button" class="btn" data-bgreset>↺ Réglages d'origine</button></div>
   </div>
  </div><div class="lookprev"><div class="card-sec" style="position:sticky;top:90px"><h5>Aperçu en direct</h5><div id="lpv"></div><p class="hint" style="margin:12px 0 0">Les titres, les boutons et le pied de page prennent ces couleurs sur tout le site après enregistrement.</p></div></div></div>`;
  drawPreview(); drawBgPrev();
}
const BG = () => (S.home && S.home.bg) || {};
function drawBgPrev() {
  const el = $('bgPrev'); if (!el) return; const B = BG(), im = el.querySelector('.bgp-img'); if (!im) return;
  const on = B.on !== false;
  im.style.backgroundImage = isUrl(B.url) ? `url("${B.url}")` : '';
  im.style.opacity = on ? ((B.opacity != null ? B.opacity : 24) / 100) : 0;
  im.style.filter = `blur(${B.blur || 0}px) brightness(${(B.brightness != null ? B.brightness : 100) / 100})`;
  im.style.backgroundPosition = B.pos === 'top' ? 'center top' : B.pos === 'bottom' ? 'center bottom' : 'center';
  el.classList.toggle('auto', !isUrl(B.url));
}
function bgInput(e) {
  if (S.view !== 'home' || S.homeTab !== 'look') return;
  const t = e.target, k = t.dataset && t.dataset.bg; if (!k) return;
  const B = S.home.bg = S.home.bg || {};
  if (t.type === 'checkbox') B[k] = t.checked;
  else if (t.type === 'range') { B[k] = +t.value; const o = t.parentNode.querySelector('output'); if (o) o.textContent = t.value + (k === 'blur' ? ' px' : ' %'); }
  else if (t.value.trim()) B[k] = t.value.trim(); else delete B[k];
  homeDirty(); drawBgPrev();
}
document.addEventListener('input', bgInput); document.addEventListener('change', bgInput);
document.addEventListener('click', e => {
  if (S.view === 'home' && e.target.closest('[data-bgreset]') && confirm("Revenir à l'image de fond d'origine (photo automatique, transparence 24 %) ?")) { S.home.bg = {}; homeDirty(); drawLook($('homeBody')); }
});
function drawPreview() {
  const p = $('lpv'); if (!p) return;
  const p1 = thv('p1'), ac = thv('ac'), bg = thv('bg'), cat = thv('cat'), ft = thv('ft'), light = thv('mode') === 'light';
  const fg = light ? '#0f1b2e' : '#eaf1fb', base = light ? '#f4f7fb' : bg, on = lum(p1) > 150 ? '#1a1203' : '#fff';
  const mix = (a, b, pc) => `color-mix(in srgb,${a} ${pc}%,${b})`;
  p.innerHTML = `<div class="pv" style="background:${base};color:${fg};font-family:${fam(thv('fb'))}">
   <div class="pv-hero" style="background:linear-gradient(#0006,#000a),radial-gradient(80% 90% at 70% 10%,${mix(p1, '#000', 55)},${bg})"><span class="pv-eye" style="color:#fff"><i style="background:${ac}"></i>Guide de voyage</span><h4 style="font-family:${fam(thv('ff'), 1)};color:#fff">Découvrez la Moldavie</h4><button type="button" style="background:linear-gradient(135deg,${p1},${mix(p1, '#000', 60)});color:${on}">Explorer les circuits →</button></div>
   <div class="pv-body"><span style="color:${light ? p1 : ac};font-size:11px;font-weight:700;letter-spacing:.2em">LE CATALOGUE</span><div style="font-family:${fam(thv('ff'), 1)};font-size:22px;font-weight:600;margin:4px 0 10px">Tout explorer</div>
   <div class="pv-cat" style="background:${cat}"><span style="background:linear-gradient(135deg,${p1},${mix(p1, '#000', 60)});color:${on}">Circuits</span><span style="background:#ffffff14;color:#eaf1fb">Vin</span><span style="background:#ffffff14;color:#eaf1fb">Histoire</span></div></div>
   <div class="pv-ft" style="background:linear-gradient(180deg,${ft},${mix(ft, '#000', 60)})"><b style="font-family:${fam(thv('ff'), 1)};background:linear-gradient(180deg,${mix(ac, '#fff', 25)},${ac});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">Moldova Explorer</b></div></div>`;
}
function setTheme(k, v) { if (v === '' || v == null) delete S.home.theme[k]; else S.home.theme[k] = v; homeDirty(); drawPreview(); }
document.addEventListener('input', e => {
  if (S.view !== 'home' || S.homeTab !== 'look') return;
  const t = e.target;
  if (t.dataset.th) { setTheme(t.dataset.th, t.value); const x = document.querySelector(`[data-thx="${t.dataset.th}"]`); if (x) x.value = t.value; }
  if (t.dataset.thx && /^#[0-9a-f]{6}$/i.test(t.value.trim())) { setTheme(t.dataset.thx, t.value.trim().toLowerCase()); const c = document.querySelector(`[data-th="${t.dataset.thx}"]`); if (c) c.value = t.value.trim().toLowerCase(); }
});
document.addEventListener('change', e => {
  if (S.view !== 'home' || S.homeTab !== 'look') return;
  const t = e.target; if (t.dataset.thsel) { setTheme(t.dataset.thsel, t.value); }
});
document.addEventListener('click', e => {
  if (S.view !== 'home' || S.homeTab !== 'look') return;
  const pre = e.target.closest('[data-pre]');
  if (pre) { Object.assign(S.home.theme, PRESETS[+pre.dataset.pre].t); homeDirty(); drawLook($('homeBody')); return; }
  if (e.target.closest('[data-threset]') && confirm("Revenir à l'apparence d'origine (palette, polices, mode) ?")) { S.home.theme = {}; homeDirty(); drawLook($('homeBody')); }
});

/* --- sections & ordre --- */
const SECS = [{ id: 'intro', i: '✍️', l: "Phrase d'introduction", d: "La phrase qui s'allume mot par mot" }, { id: 'stack', i: '🃏', l: 'Cartes « Par où commencer »', d: "Les cartes qui s'empilent" }, { id: 'gallery', i: '🖼', l: 'Galerie « Un pays en images »', d: 'Le carrousel de photos' }, { id: 'video', i: '▶️', l: 'Vidéo YouTube', d: 'La vidéo « La Moldavie en mouvement »' }, { id: 'globe', i: '🌍', l: 'Globe 3D', d: 'La planète avec la frontière de la Moldavie' }, { id: 'catalogue', i: '📚', l: 'Catalogue', d: 'Circuits, vin, histoire, carte…' }];
const CARDS = { c: 'Circuits clé en main', g: 'Vin & gastronomie', h: 'Histoire & culture', t: 'Transnistrie' };
const secOrder = () => { const o = S.home.sections.map(s => s.id).filter(id => SECS.some(x => x.id === id)); SECS.forEach(x => { if (!o.includes(x.id)) o.push(x.id); }); return o; };
const secOn = id => { const c = S.home.sections.find(s => s.id === id); return !c || c.on !== false; };
const cardOrder = () => { const o = S.home.cardOrder.filter(k => k in CARDS); Object.keys(CARDS).forEach(k => { if (!o.includes(k)) o.push(k); }); return o; };
const cardOn = k => !(S.home.cards[k] && S.home.cards[k].off);
function drawSections(box) {
  const so = secOrder(), co = cardOrder();
  box.innerHTML = `<p class="hint">Le header (vidéo) reste toujours en haut et le pied de page en bas. Utilise ▲ ▼ pour déplacer, l'interrupteur pour masquer.</p>
  <div class="card-sec"><h5>Sections de la page d'accueil</h5><div class="olist">${so.map((id, i) => { const x = SECS.find(s => s.id === id); return `<div class="orow ${secOn(id) ? '' : 'off'}" data-sec="${id}"><span class="ic">${x.i}</span><div class="info"><b>${esc(x.l)}</b><small>${esc(x.d)}</small></div><button class="btn sm ico" data-so="up" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button><button class="btn sm ico" data-so="down" ${i === so.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button><label class="sw2"><input type="checkbox" data-sv ${secOn(id) ? 'checked' : ''}><i></i></label></div>`; }).join('')}</div></div>
  <div class="card-sec"><h5>Cartes « Par où commencer »</h5><div class="olist">${co.map((k, i) => `<div class="orow ${cardOn(k) ? '' : 'off'}" data-ck="${k}"><span class="ic">${i + 1}</span><div class="info"><b>${esc((S.home.cards[k] && S.home.cards[k].title && S.home.cards[k].title.fr) || CARDS[k])}</b><small>Pile d'accueil — position ${i + 1}</small></div><button class="btn sm ico" data-co="up" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button><button class="btn sm ico" data-co="down" ${i === co.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button><label class="sw2"><input type="checkbox" data-cv ${cardOn(k) ? 'checked' : ''}><i></i></label></div>`).join('')}</div></div>`;
}
function saveSecOrder(o) { const on = id => secOn(id); S.home.sections = o.map(id => ({ id, on: on(id) })); homeDirty(); }
document.addEventListener('click', e => {
  if (S.view !== 'home' || S.homeTab !== 'sections') return;
  const so = e.target.closest('[data-so]'), co = e.target.closest('[data-co]');
  if (so) { const id = so.closest('[data-sec]').dataset.sec, o = secOrder(), i = o.indexOf(id), j = so.dataset.so === 'up' ? i - 1 : i + 1; if (j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); saveSecOrder(o); drawSections($('homeBody')); }
  if (co) { const k = co.closest('[data-ck]').dataset.ck, o = cardOrder(), i = o.indexOf(k), j = co.dataset.co === 'up' ? i - 1 : i + 1; if (j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); S.home.cardOrder = o; homeDirty(); drawSections($('homeBody')); }
});
document.addEventListener('change', e => {
  if (S.view !== 'home' || S.homeTab !== 'sections') return;
  if (e.target.matches('[data-sv]')) { const id = e.target.closest('[data-sec]').dataset.sec, o = secOrder(); const cur = S.home.sections.find(s => s.id === id); S.home.sections = o.map(x => ({ id: x, on: x === id ? e.target.checked : secOn(x) })); homeDirty(); drawSections($('homeBody')); }
  if (e.target.matches('[data-cv]')) { const k = e.target.closest('[data-ck]').dataset.ck, c = S.home.cards[k] = S.home.cards[k] || {}; if (e.target.checked) delete c.off; else c.off = true; if (!Object.keys(c).length) delete S.home.cards[k]; homeDirty(); drawSections($('homeBody')); }
});

/* --- textes du site --- */
const TXT = [['h1', "Titre principal du header", 'Découvrez la Moldavie', 1], ['sub', 'Sous-titre du header', "Vins, monastères, forteresses et Transnistrie au cœur de l'Europe de l'Est", 2], ['eye', 'Petite étiquette au-dessus du titre', 'Guide de voyage · Moldavie', 1], ['c1', 'Bouton 1 du header', 'Explorer les circuits', 1], ['c2', 'Bouton 2 du header', 'Voir la carte', 1],
  ['st', "Phrase d'introduction (s'allume au scroll)", "Des caves creusées sous terre sur des kilomètres, des monastères taillés dans la falaise, des forteresses au bord du Dniestr : la Moldavie se découvre à son rythme, verre à la main.", 3],
  ['kStack', 'Cartes : sur-titre', 'Par où commencer ?', 1], ['tStack', 'Cartes : titre', 'Quatre façons de découvrir le pays', 1], ['kGal', 'Galerie : sur-titre', 'Aperçu', 1], ['tGal', 'Galerie : titre', 'Un pays en images', 1],
  ['kEarth', 'Globe : sur-titre', 'Sur la carte du monde', 1], ['tEarth', 'Globe : titre', "Au cœur de l'Europe de l'Est", 1], ['dEarth', 'Globe : texte', "Entre la Roumanie et l'Ukraine, la Moldavie se traverse en une journée et se savoure en une semaine. Fais tourner le globe pour la retrouver.", 3],
  ['kCat', 'Catalogue : sur-titre', 'Le catalogue', 1], ['tCat', 'Catalogue : titre', 'Tout explorer', 1], ['fH', 'Pied de page : phrase', 'Vins, monastères et petites routes : la Moldavie vous attend.', 2]];
let txtLang = 'fr';
function drawTexts(box) {
  const T = S.home.texts;
  box.innerHTML = `<p class="hint">Laisse vide pour garder le texte d'origine du site. Chaque langue se règle séparément ; les cartes (titres et textes) se modifient dans l'onglet « Cartes ».</p>
  <div class="langs" id="tl">${LG.map(l => `<button type="button" data-tl="${l}" class="${l === txtLang ? 'on' : ''} ${T[l] && Object.keys(T[l]).length ? 'has' : ''}">${LGN[l]}</button>`).join('')}</div>
  <div class="card-sec">${TXT.map(([k, l, ph, r]) => `<label class="f"><span>${esc(l)}</span>${r > 1 ? `<textarea data-tx="${k}" rows="${r}" placeholder="${txtLang === 'fr' ? esc(ph) : 'Texte d\'origine du site'}">${esc((T[txtLang] || {})[k] || '')}</textarea>` : `<input data-tx="${k}" placeholder="${txtLang === 'fr' ? esc(ph) : 'Texte d\'origine du site'}" value="${esc((T[txtLang] || {})[k] || '')}">`}</label>`).join('')}</div>`;
}
document.addEventListener('input', e => {
  if (S.view !== 'home' || S.homeTab !== 'texts' || !e.target.dataset.tx) return;
  const T = S.home.texts, k = e.target.dataset.tx, v = e.target.value.trim();
  T[txtLang] = T[txtLang] || {}; if (v) T[txtLang][k] = v; else delete T[txtLang][k];
  if (!Object.keys(T[txtLang]).length) delete T[txtLang];
  const b = document.querySelector(`[data-tl="${txtLang}"]`); if (b) b.classList.toggle('has', !!T[txtLang]);
  homeDirty();
});
document.addEventListener('click', e => {
  if (S.view !== 'home' || S.homeTab !== 'texts') return;
  const b = e.target.closest('[data-tl]'); if (b) { txtLang = b.dataset.tl; drawTexts($('homeBody')); }
});

/* --- header : photo de fond + vidéo --- */
function drawVideo(box) {
  const v = S.home.heroVideo || '', im = S.home.heroImage || '';
  box.innerHTML = `<div class="card-sec"><h5>Photo de fond du header</h5><p class="hint">Visible avant que la vidéo démarre, et à la place de la vidéo si elle ne se charge pas. Vide = photo d'Orheiul Vechi choisie automatiquement.</p>
  <label class="f"><span>Adresse de la photo (https)</span><input id="hImage" type="url" placeholder="https://…" value="${esc(im)}"></label>
  <img class="prev" id="hiPrev" alt="" ${isUrl(im) ? `src="${esc(im)}"` : ''}></div>
  <div class="card-sec"><h5>Vidéo de fond du header</h5><p class="hint">Par défaut, le site lit <b>assets/header.mp4</b> (le fichier de ton dépôt). Si tu colles ici l'adresse d'un autre fichier mp4 (https), elle passe en premier. La vidéo est toujours muette.</p>
  <label class="f"><span>Adresse d'un fichier mp4 (facultatif)</span><input id="hVideo" type="url" placeholder="https://lk10ar.github.io/moldova/assets/header.mp4" value="${esc(v)}"></label>
  <video class="vid-prev ${isUrl(v) ? '' : 'hide'}" id="hvPrev" src="${isUrl(v) ? esc(v) : ''}" muted controls playsinline preload="metadata"></video></div>`;
}
async function saveHome() {
  const b = $('hSave'); if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
  try {
    const d = await call('settings/home', { method: 'PUT', body: JSON.stringify(S.home) });
    const wantsNew = Object.keys(S.home.theme).length || S.home.sections.length || S.home.cardOrder.length || Object.keys(S.home.texts).length || S.home.heroImage;
    if (wantsNew && !('theme' in d)) {
      S.homeErr = "Le serveur n'a pas encore la dernière version de server.js : l'apparence, l'ordre, les textes et la photo du header n'ont PAS été enregistrés (la galerie, les cartes et la vidéo, oui). Mets server.js à jour dans ton dépôt, attends que Render redéploie, puis réenregistre.";
      toast('Serveur pas à jour : apparence non enregistrée', 'err'); drawHome(); return;
    }
    S.home = normHome(d); S.dirty = false; S.homeErr = '';
    toast("Accueil enregistré — visible sur le site dans quelques secondes"); drawHome();
  } catch (e) { toast(e.message, 'err'); if (b) { b.disabled = false; b.textContent = "Enregistrer l'accueil"; } }
}

/* ---------------------------------------------------------------- langues + traduction automatique */
const BUILTIN = ['fr', 'en', 'es', 'ro', 'ru'];
const COMMON_LANGS = [['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['uk', 'Українська'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['bg', 'Български'], ['cs', 'Čeština'], ['el', 'Ελληνικά'], ['hu', 'Magyar'], ['sv', 'Svenska'], ['da', 'Dansk'], ['fi', 'Suomi'], ['no', 'Norsk'], ['he', 'עברית'], ['sr', 'Српски'], ['hr', 'Hrvatski'], ['sk', 'Slovenčina'], ['lt', 'Lietuvių'], ['lv', 'Latviešu'], ['et', 'Eesti'], ['sq', 'Shqip'], ['hi', 'हिन्दी']];
S.langs = { list: [], ui: {} }; S.tr = { running: false, stop: false, code: '', msg: {}, prog: {} }; S.scan = null;
const langName = c => LGN[c] || (S.langs.list.find(l => l.code === c) || {}).name || c;
async function loadLangs() {
  const d = await call('langs'); S.langs = { list: d.list || [], ui: d.ui || {} };
  S.langs.list.forEach(l => { if (!LG.includes(l.code)) LG.push(l.code); LGN[l.code] = l.name; });
  for (let i = LG.length - 1; i >= 0; i--) if (!BUILTIN.includes(LG[i]) && !S.langs.list.some(l => l.code === LG[i])) { delete LGN[LG[i]]; LG.splice(i, 1); }
}
async function saveLangList(list) { const d = await call('langs', { method: 'PUT', body: JSON.stringify({ list }) }); S.langs.list = d.list; await loadLangs(); }
function getUiSource() {
  return new Promise(res => {
    const f = document.createElement('iframe'); f.src = './index.html'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
    document.body.append(f); let n = 0;
    const t = setInterval(() => {
      n++;
      try { const m = f.contentWindow.__md; if (m && typeof m.uiSource === 'function') { const o = m.uiSource(); if (Object.keys(o).some(k => k.startsWith('FX.'))) { clearInterval(t); f.remove(); res(o); return; } } } catch {}
      if (n > 60) { clearInterval(t); f.remove(); res({}); }
    }, 500);
  });
}
async function loadScan(force) {
  if (S.scan && !force) return S.scan;
  const cols = Object.keys(COLS);
  const [src, home, ...docs] = await Promise.all([getUiSource(), call('settings/home'), ...cols.map(c => call(c))]);
  S.scan = { src, home, docs: Object.fromEntries(cols.map((c, i) => [c, docs[i]])) };
  return S.scan;
}
function buildUnits(code, data) {
  const units = [], parts = { ui: [0, 0], home: [0, 0], docs: [0, 0] }; let total = 0, done = 0;
  const add = (part, text, have, unit) => {
    if (typeof text !== 'string' || !/\p{L}/u.test(text)) return;
    parts[part][1]++; total++;
    if (have && String(have).trim()) { parts[part][0]++; done++; } else units.push({ part, text, ...unit });
  };
  if (!BUILTIN.includes(code)) { const have = S.langs.ui[code] || {}; Object.entries(data.src || {}).forEach(([k, v]) => add('ui', v, have[k], { kind: 'ui', key: k })); }
  const H = data.home || {};
  Object.entries(H.cards || {}).forEach(([k, c]) => ['title', 'text'].forEach(f => c[f] && add('home', c[f].fr, c[f][code], { kind: 'home', path: ['cards', k, f] })));
  (H.gallery || []).forEach((g, i) => g.caption && add('home', g.caption.fr, g.caption[code], { kind: 'home', path: ['gallery', i, 'caption'] }));
  ['title', 'text'].forEach(f => H.video && H.video[f] && add('home', H.video[f].fr, H.video[f][code], { kind: 'home', path: ['video', f] }));
  Object.entries(H.filters || {}).forEach(([c, list]) => list.forEach((f, i) => add('home', f.l && f.l.fr, f.l && f.l[code], { kind: 'home', path: ['filters', c, i, 'l'] })));
  Object.entries(data.docs || {}).forEach(([col, list]) => list.forEach(d => {
    ['title', 'summary', 'body', 'when'].forEach(f => { if (d[f] && typeof d[f] === 'object') add('docs', d[f].fr, d[f][code], { kind: 'doc', col, id: d._id, path: [f] }); });
    (d.itinerary || []).forEach((it, i) => ['title', 'text'].forEach(f => it && it[f] && add('docs', it[f].fr, it[f][code], { kind: 'doc', col, id: d._id, path: ['itinerary', i, f] })));
  }));
  return { units, total, done, parts };
}
const pct = b => b && b.total ? Math.floor(100 * b.done / b.total) : 0;
function takeBatch(units, max) {
  const first = units[0], out = []; let chars = 0;
  while (units.length && out.length < max && units[0].part === first.part && (!out.length || chars + units[0].text.length < 3500)) { const u = units.shift(); chars += u.text.length; out.push(u); }
  return out;
}
async function saveBatch(code, batch, out, data) {
  const kind = batch[0].kind;
  if (kind === 'ui') {
    const map = {}; batch.forEach((u, i) => { map[u.key] = out[i]; });
    await call('lang/ui/' + code, { method: 'PUT', body: JSON.stringify({ map }) });
    S.langs.ui[code] = Object.assign(S.langs.ui[code] || {}, map);
  } else if (kind === 'home') {
    batch.forEach((u, i) => { let o = data.home; for (const p of u.path) o = o[p]; o[code] = out[i]; });
    await call('settings/home', { method: 'PUT', body: JSON.stringify(data.home) });
  } else {
    const touched = {};
    batch.forEach((u, i) => {
      const d = data.docs[u.col].find(x => x._id === u.id); let o = d; for (const p of u.path) o = o[p]; o[code] = out[i];
      (touched[u.col + '/' + u.id] = touched[u.col + '/' + u.id] || { d, keys: new Set() }).keys.add(u.path[0]);
    });
    for (const [path, t] of Object.entries(touched)) { const body = {}; t.keys.forEach(k => { body[k] = t.d[k]; }); await call(path, { method: 'PUT', body: JSON.stringify(body) }); }
  }
}
function drawBars() {
  document.querySelectorAll('.lcard').forEach(card => {
    const c = card.dataset.code, b = S.tr.prog[c]; if (!b) return;
    const p = pct(b);
    card.querySelector('.pbar i').style.width = p + '%';
    card.querySelector('.pinfo').innerHTML = `<b>${p} %</b> · ${b.done} / ${b.total} textes` + [['ui', 'Interface'], ['home', 'Accueil'], ['docs', 'Fiches']].filter(([k]) => b.parts[k][1]).map(([k, l]) => ` · ${l} ${b.parts[k][1] ? Math.floor(100 * b.parts[k][0] / b.parts[k][1]) : 100} %`).join('');
  });
}
async function scanProgress(code) { const data = await loadScan(false); S.tr.prog[code] = buildUnits(code, data); drawBars(); }
async function runTr(code) {
  if (S.tr.running) return;
  if (S.dirty) { toast("Enregistre d'abord les modifications en cours de l'accueil.", 'err'); return; }
  S.tr.running = true; S.tr.stop = false; S.tr.code = code; S.tr.msg[code] = ''; drawLangs();
  try {
    const data = await loadScan(true), b = S.tr.prog[code] = buildUnits(code, data), batchMax = (S.trInfo && S.trInfo.batch) || 6;
    if (!BUILTIN.includes(code) && !Object.keys(data.src || {}).length) toast("Les textes de l'interface n'ont pas pu être lus : seuls l'accueil et les fiches seront traduits.", 'err');
    while (!S.tr.stop && b.units.length) {
      const batch = takeBatch(b.units, batchMax);
      let r;
      try { r = await call('translate', { method: 'POST', body: JSON.stringify({ to: code, name: langName(code), strings: batch.map(u => u.text) }) }); }
      catch (e) { if (e.quota) { b.units.unshift(...batch); S.tr.msg[code] = 'quota'; break; } throw e; }
      await saveBatch(code, batch, r.out, data);
      b.done += batch.length; batch.forEach(u => { b.parts[u.part][0]++; }); drawBars();
    }
    if (!S.tr.msg[code]) S.tr.msg[code] = b.units.length ? 'stop' : 'done';
  } catch (e) { S.tr.msg[code] = 'err:' + e.message; toast(e.message, 'err'); }
  S.tr.running = false; S.home = null; S.scan = null;
  if (S.view === 'langs') { drawLangs(); drawBars(); }
  if (S.tr.msg[code] === 'quota' && S.autoRetry) setTimeout(() => { if (!S.tr.running) runTr(code); }, 30 * 60 * 1000);
}
function trNote() {
  const p = S.trInfo && S.trInfo.provider;
  if (p === 'claude') return '🤖 Traducteur : <b>Claude</b> (clé détectée) — traduction de haute qualité ; les « tokens » de ton compte servent de limite.';
  if (p === 'deepl') return '🔤 Traducteur : <b>DeepL</b> (clé détectée) — limite mensuelle de caractères.';
  if (p === 'mymemory') return '🆓 Traducteur : <b>MyMemory</b> (gratuit, sans clé) — limite quotidienne de caractères. Pour traduire plus vite et mieux, ajoute <code>ANTHROPIC_API_KEY</code> (Claude) ou <code>DEEPL_API_KEY</code> dans les variables d\'environnement de Render, puis redéploie.';
  return '⚠ Le serveur ne répond pas à la traduction : remets le nouveau <b>server.js</b> dans ton dépôt (Render redéploie seul).';
}
const MSGS = { quota: '⏸ Limite du service atteinte : la progression est <b>sauvegardée</b>. Relance plus tard : la traduction reprend exactement là où elle s\'est arrêtée.', done: '✔ Traduction terminée.', stop: '⏹ Arrêtée : la progression est sauvegardée, tu peux reprendre quand tu veux.' };
function drawLangs() {
  const all = [...BUILTIN.filter(c => c !== 'fr').map(c => ({ code: c, name: LGN[c] || c, builtin: true, on: true })), ...S.langs.list];
  $('content').innerHTML = `<div class="card-sec"><p class="hint" style="margin:0">${trNote()}</p>
   <div class="checks" style="margin-top:12px"><label><input type="checkbox" data-autor ${S.autoRetry ? 'checked' : ''}> Réessayer automatiquement toutes les 30 min quand la limite est atteinte (tant que cette page reste ouverte)</label></div></div>
   <div class="card-sec"><h5>Ajouter une langue</h5><div class="srch"><input id="lgC" list="lgL" placeholder="Code (ex : de) ou choisis dans la liste" autocomplete="off"><input id="lgN" placeholder="Nom affiché (ex : Deutsch)"><button type="button" class="btn gold" data-la="add">＋ Ajouter</button></div>
   <datalist id="lgL">${COMMON_LANGS.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('')}</datalist><p class="hint" style="margin:8px 0 0">Une fois ajoutée, clique sur « Traduire » : l'interface du site, la page d'accueil et toutes les fiches sont traduites depuis le français.</p></div>
   <div class="lgrid">${all.map(l => {
     const b = S.tr.prog[l.code], p = pct(b), run = S.tr.running && S.tr.code === l.code, m = S.tr.msg[l.code] || '';
     return `<div class="lcard" data-code="${esc(l.code)}"><div class="lh"><div><b class="ln">${esc(l.name)}</b> <span class="pill ${l.builtin ? 'dra' : 'pub'}" style="margin-left:6px">${esc(l.code.toUpperCase())}</span> <small>${l.builtin ? 'intégrée' : 'ajoutée'}</small></div>
      ${l.builtin ? '' : `<label class="sw"><input type="checkbox" data-lv="${esc(l.code)}" ${l.on !== false ? 'checked' : ''}><span>Visible sur le site</span></label>`}</div>
      <div class="pbar"><i style="width:${p}%"></i></div><div class="pinfo">${b ? '' : 'Calcul de la progression…'}</div>
      ${m ? `<div class="lmsg ${m.startsWith('err') ? 'bad' : ''}">${m.startsWith('err:') ? '⚠ ' + esc(m.slice(4)) : MSGS[m]}</div>` : ''}
      <div class="tools" style="margin:12px 0 0">${run ? '<button type="button" class="btn bad" data-la="stop">⏹ Arrêter</button><span class="spin">Traduction en cours…</span>' : `<button type="button" class="btn pri" data-la="run" ${S.tr.running ? 'disabled' : ''}>🌐 Traduire</button><button type="button" class="btn" data-la="rescan" ${S.tr.running ? 'disabled' : ''}>↻ Recalculer</button>${l.builtin ? '' : `<button type="button" class="btn bad" data-la="del" ${S.tr.running ? 'disabled' : ''}>Supprimer</button>`}`}</div></div>`;
   }).join('')}</div>`;
  drawBars();
}
async function showLangs() {
  $('topbar').innerHTML = `<h2>🌍 Langues<small>Ajoute des langues et traduis-les automatiquement. Si la limite du service est atteinte, la progression est sauvegardée et reprend ensuite là où elle s'est arrêtée.</small></h2>`;
  $('content').innerHTML = '<div class="skeleton"></div>';
  try { await loadLangs(); } catch (e) { $('content').innerHTML = `<div class="empty"><b>Impossible de charger</b>${esc(e.message)}</div>`; return; }
  try { S.trInfo = await call('translate/info'); } catch { S.trInfo = null; }
  drawLangs();
  if (!S.tr.running) for (const l of [...BUILTIN.filter(c => c !== 'fr'), ...S.langs.list.map(x => x.code)]) { try { await scanProgress(l); } catch (e) { break; } if (S.view !== 'langs') return; }
}
document.addEventListener('click', async e => {
  if (S.view !== 'langs') return;
  const b = e.target.closest('[data-la]'); if (!b) return;
  const act = b.dataset.la, card = b.closest('.lcard'), code = card && card.dataset.code;
  if (act === 'run') return runTr(code);
  if (act === 'stop') { S.tr.stop = true; return; }
  if (act === 'rescan') { S.scan = null; delete S.tr.prog[code]; drawLangs(); try { await scanProgress(code); } catch (er) { toast(er.message, 'err'); } return; }
  if (act === 'add') {
    const c = $('lgC').value.trim().toLowerCase(), known = COMMON_LANGS.find(x => x[0] === c), n = $('lgN').value.trim() || (known && known[1]) || c;
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i.test(c)) { toast('Code de langue invalide (ex : de, it, pt, zh).', 'err'); return; }
    if (BUILTIN.includes(c) || S.langs.list.some(l => l.code === c)) { toast('Cette langue existe déjà.', 'err'); return; }
    try { await saveLangList([...S.langs.list, { code: c, name: n, on: true }]); toast('Langue « ' + n + ' » ajoutée'); drawLangs(); scanProgress(c).catch(() => {}); } catch (er) { toast(er.message, 'err'); }
    return;
  }
  if (act === 'del') {
    if (!confirm('Supprimer cette langue du site ? Les traductions de l\'interface seront effacées (celles des fiches restent enregistrées).')) return;
    try { await saveLangList(S.langs.list.filter(l => l.code !== code)); delete S.tr.prog[code]; toast('Langue supprimée'); drawLangs(); } catch (er) { toast(er.message, 'err'); }
  }
});
document.addEventListener('change', async e => {
  if (S.view !== 'langs') return;
  if (e.target.dataset && e.target.dataset.autor !== undefined) { S.autoRetry = e.target.checked; return; }
  const v = e.target.dataset && e.target.dataset.lv; if (!v) return;
  try { await saveLangList(S.langs.list.map(l => l.code === v ? { ...l, on: e.target.checked } : l)); toast(e.target.checked ? 'Langue visible sur le site' : 'Langue masquée du site'); } catch (er) { toast(er.message, 'err'); e.target.checked = !e.target.checked; }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && S.view === 'langs' && (e.target.id === 'lgC' || e.target.id === 'lgN')) { e.preventDefault(); const b = document.querySelector('[data-la="add"]'); if (b) b.click(); } });

/* ---------------------------------------------------------------- propositions automatiques */
async function showCands() {
  $('topbar').innerHTML = `<h2>✨ Propositions automatiques<small>Fiches suggérées par Wikipédia et Google : valide celles que tu veux garder (elles arrivent en brouillon).</small></h2><button class="btn gold" id="cFind">🔎 Chercher de nouvelles propositions</button><button class="btn" id="cRef">↻ Actualiser</button>`;
  $('content').innerHTML = `<div class="list" id="cl"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('cRef').onclick = showCands;
  $('cFind').onclick = async () => {
    const b = $('cFind'); b.disabled = true; b.textContent = '⏳ Recherche en cours (jusqu\'à 40 s)…';
    try { const d = await call('candidates/refresh', { method: 'POST' }); toast(d.added ? d.added + ' nouvelle(s) proposition(s) trouvée(s)' : 'Aucune nouvelle proposition pour le moment'); showCands(); }
    catch (e) { toast(e.message.includes('404') ? 'Le serveur n\'est pas à jour : remets le nouveau server.js dans ton dépôt (Render redéploie seul).' : e.message, 'err'); b.disabled = false; b.textContent = '🔎 Chercher de nouvelles propositions'; }
  };
  try { S.cands = await call('candidates'); } catch (e) { $('cl').innerHTML = `<div class="empty"><b>Impossible de charger</b>${esc(e.message)}</div>`; return; }
  S.candCount = S.cands.length; const bd = $('candBadge'); if (bd) { bd.textContent = S.candCount; bd.classList.toggle('alert', !!S.candCount); }
  drawCands();
}
function drawCands() {
  if (!S.cands.length) { $('cl').innerHTML = '<div class="empty"><b>Rien à valider</b>Clique sur « Chercher de nouvelles propositions » : le site explore Wikipédia (monastères, caves, parcs, musées, forteresses…) et ne garde que les lieux situés en Moldavie.</div>'; return; }
  $('cl').innerHTML = S.cands.map(c => `<div class="cand" data-id="${esc(c._id)}"><div class="thumb" ${bg(c.photoUrl)}>${c.photoUrl ? '' : '✨'}</div>
    <div class="info" style="flex:1;min-width:0"><div class="t" style="font-weight:700">${esc(c.name)} <span class="pill dra" style="margin-left:6px">${esc(c.source)}</span></div><p>${esc(c.summary || 'Pas de description.')}</p></div>
    <div class="acts"><button class="btn sm pri" data-c="ok">Valider</button><button class="btn sm bad" data-c="no">Rejeter</button></div></div>`).join('');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-c]'); if (!b || S.view !== 'candidates') return;
  const row = b.closest('.cand'), id = row.dataset.id; b.disabled = true;
  try {
    await call('candidates/' + id + (b.dataset.c === 'ok' ? '/approve' : '/reject'), { method: 'POST' });
    S.cands = S.cands.filter(c => c._id !== id); S.candCount = S.cands.length; const bd = $('candBadge'); if (bd) { bd.textContent = S.candCount; bd.classList.toggle('alert', !!S.candCount); }
    drawCands(); toast(b.dataset.c === 'ok' ? 'Fiche créée en brouillon (rubrique correspondante)' : 'Proposition rejetée');
  } catch (err) { toast(err.message, 'err'); b.disabled = false; }
});

show();
})();
