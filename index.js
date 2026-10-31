// Météo : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle demande l'accès complet pour utiliser les outils d'interface de NeoBase. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap\">\n      <div class=\"agHead\"><span class=\"label\">Météo</span><input class=\"f\" id=\"mtCity\" placeholder=\"Autre ville… (Entrée)\" spellcheck=\"false\" style=\"width:240px;margin-left:auto;font-size:15px;padding:8px 12px\"><button class=\"btn px\" id=\"mtHome\">MA VILLE</button></div>\n      <div class=\"sysCard px\" id=\"mtNow\"></div>\n      <div class=\"sysCard px\"><span class=\"label\">Prochaines 36 heures</span><div id=\"mtHours\"></div><div class=\"chart small\"><canvas id=\"mtChart\"></canvas><div class=\"chTip\"></div></div><div class=\"hint\">Ligne : température · barres : risque de pluie · survole pour le détail</div></div>\n      <div class=\"sysCard px\"><span class=\"label\">10 jours</span><div id=\"mtDays\"></div></div>\n    </div>";
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  view.innerHTML = HTML;
  const $ = id => id === "meteoApp" ? view : (view.querySelector('#' + id) || document.getElementById(id));  // les identifiants de ta vue d'abord, puis ceux de la page (fenêtres, menus)
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const __icon = () => ctx.icon;  // l'icône de ce plugin
  const prefs = new Proxy({}, { get: (_, k) => host.pref(k) });  // les réglages de NeoBase, en lecture seule
  // ---- ton code d'origine ----
const WX_LABEL = {sun: 'Ensoleillé', moon: 'Dégagé', partly: 'Éclaircies', cloud: 'Couvert', fog: 'Brouillard', rain: 'Pluie', snow: 'Neige', storm: 'Orage'};
const wxKind = (c, day) => c === 0 ? (day ? 'sun' : 'moon') : c <= 2 ? 'partly' : c === 3 ? 'cloud' : c <= 48 ? 'fog'
  : c <= 67 || (c >= 80 && c <= 82) ? 'rain' : c <= 77 || c === 85 || c === 86 ? 'snow' : 'storm';  // WMO weather codes

/* ---------- Météo app: Open-Meteo forecast (10 days, hour by hour) and air quality, for the city of the settings or another one ---------- */
let mt = null;  // {name, lat, lon}
const MT_DIR = d => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(d / 45) % 8];
const MT_AQI = v => v == null ? ['—', ''] : v <= 20 ? ['Très bon', 'good'] : v <= 40 ? ['Bon', 'good'] : v <= 60 ? ['Moyen', ''] : v <= 80 ? ['Médiocre', 'soon'] : v <= 100 ? ['Mauvais', 'urgent'] : ['Très mauvais', 'late'];
const mtIcon = (code, day, scale = 3) => { const k = wxKind(code, day); const s = el('span', 'mtIc'); s.innerHTML = pixIcon(WX[k][1], scale); s.style.color = WX[k][0]; s.title = WX_LABEL[k]; return s; };
async function mtOpen() {
  mt ??= prefs.weatherCity ? {name: prefs.weatherCity, lat: prefs.weatherLat, lon: prefs.weatherLon} : null;
  if (!mt) { $('mtNow').replaceChildren(el('div', 'hint', 'Cherche une ville ci-dessus (ou choisis-la dans Paramètres).')); return; }
  $('mtCity').value = '';
  try {
    const q = `latitude=${mt.lat}&longitude=${mt.lon}&timezone=auto`;
    const [f, aq] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&forecast_days=10&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,cloud_cover,uv_index` +
        '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max').then(r => r.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=european_aqi,pm2_5,pm10,ozone`).then(r => r.json()).catch(() => null)]);
    mtRender(f, aq);
  } catch (e) { $('mtNow').replaceChildren(el('div', 'hint', 'Météo indisponible : ' + e.message)); }
}
function mtRender(f, aq) {
  const c = f.current, d = f.daily, hh = (t => t.slice(11, 16));
  const big = el('div', 'mtBig'), info = el('div', 'mtGrid'), stat = (k, v) => { const s = el('div'); s.append(el('span', 'label', k), el('b', '', v)); info.append(s); };
  const k = wxKind(c.weather_code, c.is_day);
  big.append(mtIcon(c.weather_code, c.is_day, 7), (() => { const t = el('div'); t.append(el('div', 'mtTemp', Math.round(c.temperature_2m) + '°'), el('div', 'mtDesc', WX_LABEL[k] + ' · ressenti ' + Math.round(c.apparent_temperature) + '°'), el('div', 'hint', mt.name + ' · ' + Math.round(d.temperature_2m_min[0]) + '° / ' + Math.round(d.temperature_2m_max[0]) + '°')); return t; })());
  stat('Vent', Math.round(c.wind_speed_10m) + ' km/h ' + MT_DIR(c.wind_direction_10m) + ' · rafales ' + Math.round(c.wind_gusts_10m));
  stat('Humidité', c.relative_humidity_2m + ' %'); stat('Pression', Math.round(c.pressure_msl) + ' hPa'); stat('Nuages', c.cloud_cover + ' %');
  stat('Indice UV', String(Math.round(c.uv_index ?? d.uv_index_max[0]))); stat('Soleil', '↑ ' + hh(d.sunrise[0]) + ' · ↓ ' + hh(d.sunset[0]));
  const [aqLabel] = MT_AQI(aq?.current?.european_aqi);
  stat("Qualité de l'air", aqLabel + (aq?.current ? ' (' + Math.round(aq.current.european_aqi) + ')' : ''));
  stat('Pluie (24 h)', (f.hourly.precipitation.slice(0, 24).reduce((a, b) => a + b, 0)).toFixed(1).replace('.', ',') + ' mm');
  $('mtNow').replaceChildren(big, info);
  // next 36 hours from now
  const now = f.hourly.time.findIndex(t => t >= c.time.slice(0, 13)), hours = f.hourly.time.slice(now, now + 36).map((t, i) => ({t, temp: f.hourly.temperature_2m[now + i], p: f.hourly.precipitation_probability[now + i], mm: f.hourly.precipitation[now + i], code: f.hourly.weather_code[now + i], day: f.hourly.is_day[now + i], wind: f.hourly.wind_speed_10m[now + i]}));
  $('mtHours').replaceChildren(...hours.map((h, i) => { const b = el('div', 'mtHour'); b.append(el('span', 'label', i ? hh(h.t).slice(0, 2) + ' h' : 'MAINT.'), mtIcon(h.code, h.day, 2), el('b', '', Math.round(h.temp) + '°'), el('span', 'mtRain' + (h.p >= 50 ? ' hi' : ''), h.p + ' %')); b.title = `${hh(h.t)} : ${Math.round(h.temp)}°, pluie ${h.p} % (${h.mm} mm), vent ${Math.round(h.wind)} km/h`; return b; }));
  mtChart($('mtChart'), hours);
  // 10 days, with each day's range drawn on the week's scale
  const lo = Math.min(...d.temperature_2m_min), hi = Math.max(...d.temperature_2m_max);
  $('mtDays').replaceChildren(...d.time.map((t, i) => {
    const r = el('div', 'mtDay'), bar = el('div', 'mtRange'), fill = el('i');
    fill.style.left = (d.temperature_2m_min[i] - lo) / (hi - lo || 1) * 100 + '%'; fill.style.right = (hi - d.temperature_2m_max[i]) / (hi - lo || 1) * 100 + '%'; bar.append(fill);
    r.append(el('span', 'tn', i ? new Date(t + 'T12:00').toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric'}) : "Aujourd'hui"), mtIcon(d.weather_code[i], 1, 2),
      el('span', 'd', Math.round(d.temperature_2m_min[i]) + '°'), bar, el('span', 'd', Math.round(d.temperature_2m_max[i]) + '°'),
      el('span', 'mtRain' + (d.precipitation_probability_max[i] >= 50 ? ' hi' : ''), d.precipitation_probability_max[i] + ' % · ' + d.precipitation_sum[i].toFixed(1).replace('.', ',') + ' mm'), el('span', 'd', Math.round(d.wind_speed_10m_max[i]) + ' km/h'));
    r.title = `Lever ${hh(d.sunrise[i])}, coucher ${hh(d.sunset[i])}, UV max ${Math.round(d.uv_index_max[i])}`;
    return r;
  }));
}
// temperature line (pixel steps) with rain chance as bars, hover shows the hour
function mtChart(cv, hours) {
  cv._h = hours;
  const dpr = devicePixelRatio, w = cv.clientWidth, h = cv.clientHeight, tip = cv.nextElementSibling; if (!w) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'), css = getComputedStyle(document.documentElement), col = v => css.getPropertyValue(v).trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ts = hours.map(x => x.temp), lo = Math.floor(Math.min(...ts)) - 1, hi = Math.ceil(Math.max(...ts)) + 1, step = w / hours.length, Y = v => Math.round(h - 18 - (v - lo) / (hi - lo) * (h - 36));
  g.font = '12px ' + css.getPropertyValue('--text');
  hours.forEach((x, i) => { g.fillStyle = col('--violet'); g.globalAlpha = .35; const bh = x.p / 100 * (h - 36); g.fillRect(Math.round(i * step + 2), h - 18 - bh, Math.max(1, Math.round(step - 4)), bh); g.globalAlpha = 1; });
  g.fillStyle = col('--pink');
  hours.forEach((x, i) => { const x0 = Math.round(i * step), y0 = Y(x.temp); g.fillRect(x0, y0 - 1, Math.ceil(step), 2); if (i) { const yp = Y(hours[i - 1].temp); g.fillRect(x0, Math.min(yp, y0) - 1, 2, Math.abs(y0 - yp) + 2); } });
  g.fillStyle = col('--muted');
  hours.forEach((x, i) => { if (i % 6 === 0) g.fillText(x.t.slice(11, 13) + ' h', Math.round(i * step + 2), h - 3); });
  const i = cv._hx == null ? -1 : Math.min(hours.length - 1, Math.floor(cv._hx / step));
  if (i < 0) { tip.style.display = 'none'; return; }
  const x = hours[i], hx = Math.round(i * step + step / 2);
  g.fillStyle = col('--muted'); g.fillRect(hx, 0, 1, h - 18);
  g.fillStyle = col('--win'); g.fillRect(hx - 5, Y(x.temp) - 5, 10, 10); g.fillStyle = col('--pink'); g.fillRect(hx - 4, Y(x.temp) - 4, 8, 8);
  tip.replaceChildren(el('b', '', new Date(x.t).toLocaleString('fr-FR', {weekday: 'short', hour: '2-digit', minute: '2-digit'}).toUpperCase()), el('div', '', Math.round(x.temp * 10) / 10 + ' °C'), el('div', '', 'Pluie : ' + x.p + ' % · ' + x.mm + ' mm'), el('div', '', 'Vent : ' + Math.round(x.wind) + ' km/h'));
  tip.style.display = 'block'; tip.style.left = (hx + 14 + tip.offsetWidth > w ? hx - 14 - tip.offsetWidth : hx + 14) + 'px';
}
$('mtChart').onmousemove = e => { $('mtChart')._hx = e.offsetX; $('mtChart')._h && mtChart($('mtChart'), $('mtChart')._h); };
$('mtChart').onmouseleave = () => { $('mtChart')._hx = null; $('mtChart')._h && mtChart($('mtChart'), $('mtChart')._h); };
$('mtCity').onkeydown = async e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  try {
    const r = (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=' + encodeURIComponent(e.target.value.trim())).then(r => r.json())).results?.[0];
    if (!r) return toast('Ville introuvable', true);
    mt = {name: r.name + (r.admin1 ? ', ' + r.admin1 : ''), lat: r.latitude, lon: r.longitude}; mtOpen();
  } catch (err) { toast('Recherche impossible : ' + err.message, true); }
};
$('mtHome').onclick = () => { mt = null; mtOpen(); };  // (non indenté : les textes sur plusieurs lignes restent exactement les tiens)
  // ---- fin ----
  ctx.onOpen(() => { mtOpen(); });
}
