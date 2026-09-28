const API = 'https://back-moldova.onrender.com'; // URL de l'API Render, sans / final
const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('md_t') || '';
let editId = null;
const api = (p, o = {}) => fetch(API + '/api/admin/' + p, { ...o, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } });
const show = () => { $('login').classList.toggle('hide', !!token); $('app').classList.toggle('hide', !token); if (token) load(); };
$('go').onclick = async () => {
  $('err').textContent = '';
  try {
    const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('em').value.trim(), password: $('pw').value }) });
    if (r.status === 429) return $('err').textContent = 'Trop de tentatives, réessaie dans 15 min';
    if (!r.ok) return $('err').textContent = 'Identifiants incorrects';
    token = (await r.json()).token; sessionStorage.setItem('md_t', token); show();
  } catch { $('err').textContent = 'Serveur injoignable (il se réveille peut-être, réessaie dans 30 s) ou CORS refusé'; }
};
$('col').onchange = () => { editId = null; $('f').reset(); setPoint(null, null); load(); };
$('f').cover.oninput = e => $('pv').src = e.target.value;
// Champ galerie : une URL d'image par ligne
const gal = document.createElement('textarea'); gal.id = 'gal'; gal.rows = 5;
gal.placeholder = "Galerie de photos : une URL d'image par ligne (https://…)";
$('f').extra.before(gal);

// Position sur la carte : clic sur la carte ou saisie des coordonnées
const mk = (ph) => { const i = document.createElement('input'); i.placeholder = ph; i.inputMode = 'decimal'; return i; };
const latI = mk('Latitude (ex: 45.69)'), lngI = mk('Longitude (ex: 28.40)');
const clr = document.createElement('button'); clr.type = 'button'; clr.textContent = 'Retirer le point de la carte';
const pick = document.createElement('div'); pick.style.cssText = 'height:320px;border-radius:12px;margin:8px 0';
$('f').extra.before(latI, lngI, clr, pick);
let pmap, pmark;
const setPoint = (la, ln, fly) => {
  if (la == null || ln == null || isNaN(la) || isNaN(ln)) { latI.value = lngI.value = ''; if (pmark) { pmark.remove(); pmark = null; } return; }
  latI.value = (+la).toFixed(5); lngI.value = (+ln).toFixed(5);
  if (!pmap) return;
  if (pmark) pmark.setLatLng([la, ln]); else pmark = L.marker([la, ln]).addTo(pmap);
  if (fly) pmap.setView([la, ln], Math.max(pmap.getZoom(), 10));
};
const fromInputs = () => { const la = parseFloat(latI.value), ln = parseFloat(lngI.value); if (!isNaN(la) && !isNaN(ln)) setPoint(la, ln, true); };
latI.onchange = lngI.onchange = fromInputs;
clr.onclick = () => setPoint(null, null);
(() => {
  const B = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = B + 'leaflet.min.css'; document.head.append(css);
  const js = document.createElement('script'); js.src = B + 'leaflet.min.js';
  js.onload = () => {
    pmap = L.map(pick).setView([47.0, 28.6], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pmap);
    pmap.on('click', e => setPoint(e.latlng.lat, e.latlng.lng));
    fromInputs();
  };
  document.head.append(js);
})();
async function load() {
  const c = $('col').value, cand = c === 'candidates';
  $('f').classList.toggle('hide', cand);
  const r = await api(c);
  if (r.status === 401) { token = ''; sessionStorage.removeItem('md_t'); return show(); }
  const d = await r.json();
  $('list').innerHTML = '';
  d.forEach(x => {
    const row = document.createElement('div'); row.className = 'row';
    const t = document.createElement('span'); t.textContent = cand ? x.name + ' (' + x.source + ')' : ((x.title && x.title.fr) || x.slug) + ' — ' + x.status;
    row.append(t);
    const b = (label, fn) => { const e = document.createElement('button'); e.textContent = label; e.onclick = fn; row.append(e); };
    if (cand) { b('Valider', async () => { await api('candidates/' + x._id + '/approve', { method: 'POST' }); load(); });
                b('Rejeter', async () => { await api('candidates/' + x._id + '/reject', { method: 'POST' }); load(); }); }
    else { b('Modifier', () => {
      const f = $('f'); editId = x._id; f.classList.remove('hide');
      const { _id, __v, createdAt, updatedAt, slug, status, cover, title, gallery, location, ...rest } = x;
      setPoint(location && location.lat, location && location.lng, true); setTimeout(() => pmap && pmap.invalidateSize(), 200);
      gal.value = (gallery || []).join('\n');
      f.slug.value = slug || ''; f.status.value = status || 'draft'; f.cover.value = cover || '';
      ['fr','en','es','ro','ru'].forEach(l => { if (f[l]) f[l].value = (title && title[l]) || ''; });
      f.extra.value = JSON.stringify(rest);
      $('pv').src = cover || ''; $('msg').textContent = 'Modification de : ' + slug + ' (Enregistrer pour valider)';
      f.scrollIntoView({ behavior: 'smooth' });
    });
    b('Supprimer', async () => { if (confirm('Supprimer ?')) { await api(c + '/' + x._id, { method: 'DELETE' }); load(); } }); }
    $('list').append(row);
  });
}
$('f').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  let extra = {}; try { extra = f.extra.value ? JSON.parse(f.extra.value) : {}; } catch { return $('msg').textContent = 'JSON invalide'; }
  const body = { slug: f.slug.value, status: f.status.value, cover: f.cover.value || undefined,
    title: { fr: f.fr.value, en: f.en.value, es: f.es.value, ro: f.ro ? f.ro.value : '', ru: f.ru ? f.ru.value : '' }, ...extra, gallery: gal.value.split(/\s+/).filter(Boolean) };
  const la = parseFloat(latI.value), ln = parseFloat(lngI.value);
  if (!isNaN(la) && !isNaN(ln)) body.location = { lat: la, lng: ln };
  else if (editId && !extra.location) body.location = { lat: null, lng: null };
  if (editId) { body.cover = f.cover.value; body.title = { ...body.title }; }
  const r = editId ? await api($('col').value + '/' + editId, { method: 'PUT', body: JSON.stringify(body) })
                   : await api($('col').value, { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) { $('msg').textContent = 'Enregistré'; editId = null; f.reset(); setPoint(null, null); $('pv').removeAttribute('src'); load(); }
  else { let m = 'Erreur ' + r.status; try { m = (await r.json()).error || m; } catch {} $('msg').textContent = m; }
};
const imp = document.createElement('button'); imp.type = 'button'; imp.textContent = 'Importer les fiches existantes du site';
imp.onclick = async () => {
  if (!confirm('Copier dans la base toutes les fiches du site (sans doublon ni écrasement) ?')) return;
  imp.disabled = true;
  try { const r = await api('seed', { method: 'POST' }); const d = await r.json(); $('msg').textContent = r.ok ? d.added + ' fiche(s) importée(s)' : (d.error || 'Erreur ' + r.status); load(); }
  catch { $('msg').textContent = 'Serveur injoignable'; }
  imp.disabled = false;
};
$('app').prepend(imp);
show();
