(() => {
'use strict';
const API = 'https://back-moldova.onrender.com'; // URL de l'API Render, sans / final
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LG = ['fr', 'en', 'es', 'ro', 'ru'];
const LGN = { fr: 'Français', en: 'English', es: 'Español', ro: 'Română', ru: 'Русский' };
let token = sessionStorage.getItem('md_t') || '';

/* ---------------------------------------------------------------- réseau */
async function call(path, opt = {}) {
  const r = await fetch(API + '/api/admin/' + path, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } });
  if (r.status === 401) { logout(); throw new Error('Session expirée, reconnecte-toi.'); }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error((data && data.error) || ('Erreur ' + r.status));
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
const BASE_KEYS = ['_id', '__v', 'createdAt', 'updatedAt', 'slug', 'status', 'cover', 'title', 'gallery', 'location', 'summary', 'videos', 'links', 'sub', 'w'];
const MENU = [
  { h: "Page d'accueil" }, { id: 'home', icon: '🏠', label: 'Accueil du site' },
  { h: 'Contenu' }, ...Object.entries(COLS).map(([id, c]) => ({ id, icon: c.icon, label: c.label })),
  { h: 'À valider' }, { id: 'candidates', icon: '✨', label: 'Propositions auto' }
];
const DEF_CARDS = {
  c: { n: '01 · Circuits', t: 'Circuits clé en main', d: 'Itinéraires de 2 à 3 jours à travers le centre, le nord, le sud et la Gagaouzie.', g: 'linear-gradient(135deg,#2f5d3a,#14301f)' },
  g: { n: '02 · Vin & gastronomie', t: 'Vin & gastronomie', d: 'Caves souterraines, domaines des Codri, mămăligă et plăcinte : la Moldavie se déguste.', g: 'linear-gradient(135deg,#8c2340,#3a0f1c)' },
  h: { n: '03 · Histoire & culture', t: 'Histoire & culture', d: 'Orheiul Vechi, Soroca, Țipova, Căpriana : des monastères rupestres aux forteresses du Dniestr.', g: 'linear-gradient(135deg,#8a5a00,#3b2600)' },
  t: { n: '04 · Transnistrie', t: 'Transnistrie', d: 'Bender, Tiraspol, Chițcani : héritage soviétique et forteresse ottomane. Passeport requis au poste de contrôle.', g: 'linear-gradient(135deg,#1d4f9c,#0d2450)' }
};

/* ---------------------------------------------------------------- état */
const S = { view: '', list: [], filter: 'all', q: '', home: null, homeErr: '', dirty: false, homeTab: 'gallery', cands: [], candCount: 0 };
const bg = u => u ? `style="background-image:url(&quot;${esc(u)}&quot;)"` : '';
const isUrl = v => /^https?:\/\//i.test(String(v || '').trim());

/* ---------------------------------------------------------------- connexion */
function logout() { token = ''; sessionStorage.removeItem('md_t'); closeDrawer(true); show(); }
function show() {
  $('login').classList.toggle('hide', !!token); $('app').classList.toggle('hide', !token);
  if (token) { buildMenu(); go(S.view || 'home'); loadCandCount(); }
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
     <div class="acts"><button class="btn sm" data-a="edit">Modifier</button><button class="btn sm bad ico" data-a="del" aria-label="Supprimer">🗑</button></div></div>`;
  }).join('');
}
$('content').addEventListener('click', async e => {
  const st = e.target.closest('[data-st]'); if (st && COLS[S.view]) { S.filter = st.dataset.st; drawList(); return; }
  const row = e.target.closest('.row'), a = e.target.closest('[data-a]');
  if (!row || !a || !COLS[S.view]) return;
  const x = S.list.find(i => i._id === row.dataset.id); if (!x) return;
  if (a.dataset.a === 'edit') return openEditor(S.view, x);
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
  ED = { col: colId, doc, dirty: false, slugTouched: !isNew, map: null, marker: null };
  const t = d.title || {}, loc = d.location || {};
  const veil = document.createElement('div'); veil.className = 'veil'; veil.id = 'veil';
  const dr = document.createElement('div'); dr.className = 'drawer'; dr.id = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true');
  dr.innerHTML = `
  <div class="dh"><h3>${isNew ? 'Nouvelle fiche' : 'Modifier : ' + esc(t.fr || d.slug)}</h3><span class="dot hide" id="dot" title="Modifications non enregistrées"></span><button class="btn sm ico" id="dClose" aria-label="Fermer">✕</button></div>
  <div class="tabs" id="dTabs">${[['gen', 'Général'], ['txt', 'Textes'], ['det', 'Détails'], ['med', 'Médias'], ['map', 'Carte'], ['adv', 'Avancé']].map(([k, l], i) => `<button type="button" data-t="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
  <div class="db">
   <div class="pane on" data-p="gen">
    <div class="g2"><label class="f"><span>Statut</span><select data-f="status"><option value="draft" ${d.status !== 'published' ? 'selected' : ''}>Brouillon (invisible)</option><option value="published" ${d.status === 'published' ? 'selected' : ''}>Publié (visible)</option></select></label>
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
    <div class="g2"><label class="f"><span>Sous-catégorie (sub)</span><input data-f="sub" value="${esc(d.sub || '')}"><em>Optionnel : écrase la sous-catégorie calculée.</em></label>
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
   <div class="pane" data-p="adv">
    <p class="hint">Réservé aux champs qui n'ont pas de case dédiée (itinéraire détaillé, route…). Laisse tel quel si tu n'es pas sûr.</p>
    <textarea class="json" data-f="extra" spellcheck="false" placeholder="{}">${Object.keys(rest).length ? esc(JSON.stringify(rest, null, 2)) : ''}</textarea>
   </div>
  </div>
  <div class="df"><span class="msg" id="dMsg"></span><button class="btn" id="dCancel">Annuler</button><button class="btn pri" id="dSave">Enregistrer</button></div>`;
  document.body.append(veil, dr);
  document.body.style.overflow = 'hidden';
  drawGalPrev();
  dr.addEventListener('input', onEdInput); dr.addEventListener('change', onEdInput);
  dr.addEventListener('click', onEdClick);
  veil.onclick = () => closeDrawer();
  $('dClose').onclick = $('dCancel').onclick = () => closeDrawer();
  $('dSave').onclick = saveEditor;
  $('clrPt').onclick = () => setPoint(null, null);
  setTimeout(() => { const f = dr.querySelector('[data-f="title.fr"]'); if (f && isNew) f.focus(); }, 280);
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
  ED = null; const v = $('veil'), d = $('drawer'); if (v) v.remove(); if (d) d.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('modalBox')) closeModal(); else closeDrawer(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { if (ED) { e.preventDefault(); saveEditor(); } else if (S.view === 'home' && S.dirty) { e.preventDefault(); saveHome(); } }
});

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
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(ED.map);
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
  const body = { ...extra, slug, status: F('status').value, title, cover: val('cover') || (editing ? '' : undefined) };
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
    if (ED.doc) await call(col + '/' + ED.doc._id, { method: 'PUT', body: JSON.stringify(body) });
    else await call(col, { method: 'POST', body: JSON.stringify(body) });
    toast(ED.doc ? 'Fiche enregistrée' : 'Fiche créée'); closeDrawer(true);
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
    try { const d = await call('settings/home'); S.home = { gallery: d.gallery || [], cards: d.cards || {}, heroVideo: d.heroVideo || '' }; S.homeErr = ''; }
    catch (e) { S.home = { gallery: [], cards: {}, heroVideo: '' }; S.homeErr = e.message; }
  }
  drawHome();
}
function drawHome() {
  const H = S.home, tabs = [['gallery', '🖼 Galerie « Un pays en images »', H.gallery.length], ['cards', '🃏 Cartes « Par où commencer »', Object.keys(H.cards).length], ['video', '🎬 Vidéo du header', H.heroVideo ? 1 : 0]];
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
function drawHomeBody() {
  const box = $('homeBody'); if (!box) return;
  if (S.homeTab === 'gallery') return drawGallery(box);
  if (S.homeTab === 'cards') return drawCards(box);
  drawVideo(box);
}
/* --- galerie --- */
function drawGallery(box) {
  const G = S.home.gallery;
  box.innerHTML = `<p class="hint">Fais glisser les images pour changer leur ordre (ou utilise ◀ ▶ sur téléphone). Si la galerie est vide, le site choisit tout seul des photos parmi tes fiches.</p>
  <div class="tools"><button class="btn gold" data-g="add">＋ Ajouter une image</button><button class="btn" data-g="bulk">Coller plusieurs URLs</button><button class="btn" data-g="pick">Choisir parmi mes fiches</button></div>
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
  if (e.target.id === 'hVideo') { S.home.heroVideo = e.target.value.trim(); const p = $('hvPrev'); if (p) { if (isUrl(S.home.heroVideo)) { p.src = S.home.heroVideo; p.classList.remove('hide'); } else p.classList.add('hide'); } homeDirty(); }
});
document.addEventListener('click', e => {
  if (S.view !== 'home') return;
  const lb = e.target.closest('[data-hl] [data-l]');
  if (lb) { const k = lb.parentNode.dataset.hl; lb.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === lb)); document.querySelectorAll(`[data-hp^="${k}."]`).forEach(p => p.classList.toggle('on', p.dataset.hp === k + '.' + lb.dataset.l)); }
  const r = e.target.closest('[data-r]');
  if (r && confirm('Remettre les textes et la photo automatiques pour cette carte ?')) { delete S.home.cards[r.dataset.r]; homeDirty(); drawCards($('homeBody')); }
});
/* --- vidéo du header --- */
function drawVideo(box) {
  const v = S.home.heroVideo || '';
  box.innerHTML = `<div class="card-sec"><h5>Vidéo de fond du header</h5><p class="hint">Par défaut, le site lit <b>assets/header.mp4</b> (le fichier de ton dépôt). Si tu colles ici l'adresse d'un autre fichier mp4 (https), elle passe en premier. La vidéo est toujours muette.</p>
  <label class="f"><span>Adresse d'un fichier mp4 (facultatif)</span><input id="hVideo" type="url" placeholder="https://lk10ar.github.io/moldova/assets/header.mp4" value="${esc(v)}"></label>
  <video class="vid-prev ${isUrl(v) ? '' : 'hide'}" id="hvPrev" src="${isUrl(v) ? esc(v) : ''}" muted controls playsinline preload="metadata"></video></div>`;
}
async function saveHome() {
  const b = $('hSave'); if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
  try {
    const d = await call('settings/home', { method: 'PUT', body: JSON.stringify(S.home) });
    S.home = { gallery: d.gallery || [], cards: d.cards || {}, heroVideo: d.heroVideo || '' }; S.dirty = false; S.homeErr = '';
    toast("Accueil enregistré — visible sur le site dans quelques secondes"); drawHome();
  } catch (e) { toast(e.message, 'err'); if (b) { b.disabled = false; b.textContent = "Enregistrer l'accueil"; } }
}

/* ---------------------------------------------------------------- propositions automatiques */
async function showCands() {
  $('topbar').innerHTML = `<h2>✨ Propositions automatiques<small>Fiches suggérées par Wikipédia et Google : valide celles que tu veux garder (elles arrivent en brouillon).</small></h2><button class="btn" id="cRef">↻ Actualiser</button>`;
  $('content').innerHTML = `<div class="list" id="cl"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  $('cRef').onclick = showCands;
  try { S.cands = await call('candidates'); } catch (e) { $('cl').innerHTML = `<div class="empty"><b>Impossible de charger</b>${esc(e.message)}</div>`; return; }
  S.candCount = S.cands.length; const bd = $('candBadge'); if (bd) { bd.textContent = S.candCount; bd.classList.toggle('alert', !!S.candCount); }
  drawCands();
}
function drawCands() {
  if (!S.cands.length) { $('cl').innerHTML = '<div class="empty"><b>Rien à valider</b>Les nouvelles propositions apparaîtront ici.</div>'; return; }
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
