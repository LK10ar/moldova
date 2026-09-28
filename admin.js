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
$('col').onchange = () => { editId = null; $('f').reset(); load(); };
$('f').cover.oninput = e => $('pv').src = e.target.value;
// Champ galerie : une URL d'image par ligne
const gal = document.createElement('textarea'); gal.id = 'gal'; gal.rows = 5;
gal.placeholder = "Galerie de photos : une URL d'image par ligne (https://…)";
$('f').extra.before(gal);
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
      const { _id, __v, createdAt, updatedAt, slug, status, cover, title, gallery, ...rest } = x;
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
  if (editId) { body.cover = f.cover.value; body.title = { ...body.title }; }
  const r = editId ? await api($('col').value + '/' + editId, { method: 'PUT', body: JSON.stringify(body) })
                   : await api($('col').value, { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) { $('msg').textContent = 'Enregistré'; editId = null; f.reset(); $('pv').removeAttribute('src'); load(); }
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
