// app.js — interface, DOM, navigation.

import * as L from './logic.js';
import * as S from './storage.js';

/* ------------------------------------------------------------------ */
/* Icônes (SVG inline, trait fin, homogènes)                           */
/* ------------------------------------------------------------------ */

const sv = (inner, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;

const ICONS = {
  sun: sv(
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>'
  ),
  moon: sv('<path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"/>'),
  settings: sv(
    '<circle cx="12" cy="12" r="3.1"/><path d="M19.3 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z"/>'
  ),
  plus: sv('<path d="M12 5.5v13M5.5 12h13"/>'),
  plusSmall: sv('<path d="M12 5.5v13M5.5 12h13"/>'),
  close: sv('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  back: sv('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  next: sv('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  chevron: sv('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  check: sv('<path d="M5 12.5 10 17.5 19 7"/>'),
  search: sv('<circle cx="11" cy="11" r="6.2"/><path d="m16 16 4 4"/>'),
  download: sv('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  upload: sv('<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14"/>'),
  trash: sv('<path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.8 7l.7 12a1.3 1.3 0 0 0 1.3 1.2h6.4a1.3 1.3 0 0 0 1.3-1.2l.7-12"/>'),
};

/* ------------------------------------------------------------------ */
/* Utilitaires DOM                                                     */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const appEl = () => document.getElementById('app');

/* ------------------------------------------------------------------ */
/* État                                                                */
/* ------------------------------------------------------------------ */

let state = L.defaultData();
let route = { name: 'home' };
let chartMetric = 'kcal';
let today = L.todayKey();
const scrollMemory = new Map();

function settings() {
  return state.settings;
}

function dayOf(key) {
  return state.days[key] || null;
}

function ensureDay(key) {
  if (!state.days[key]) state.days[key] = L.emptyDay();
  return state.days[key];
}

function persist() {
  const res = S.save(state);
  if (!res.ok) toast(res.error, { duration: 6000 });
  return res.ok;
}

/* ------------------------------------------------------------------ */
/* Thème                                                               */
/* ------------------------------------------------------------------ */

const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolvedTheme() {
  const t = settings().theme;
  if (t === 'dark' || t === 'light') return t;
  return darkQuery && darkQuery.matches ? 'dark' : 'light';
}

function applyTheme() {
  const root = document.documentElement;
  const resolved = resolvedTheme();
  root.setAttribute('data-theme', settings().theme);
  root.setAttribute('data-resolved', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#ffffff');
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (status) status.setAttribute('content', resolved === 'dark' ? 'black' : 'default');
}

function setTheme(theme) {
  settings().theme = theme;
  persist();
  applyTheme();
}

/* ------------------------------------------------------------------ */
/* Routage                                                             */
/* ------------------------------------------------------------------ */

function parseRoute() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  if (raw === '/' || raw === '') return { name: 'home' };
  const m = /^\/jour\/(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (m && L.isDateKey(m[1])) return { name: 'day', date: m[1] };
  if (raw === '/parametres') return { name: 'settings' };
  if (raw === '/aliments') return { name: 'foods' };
  return { name: 'home' };
}

function go(hash) {
  if (currentSheet) closeSheet();
  if (location.hash === hash) render();
  else location.hash = hash;
}

function routeKey() {
  return route.name === 'day' ? `day:${route.date}` : route.name;
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

let lastRouteKey = null;

function render() {
  const prev = lastRouteKey;
  if (prev) {
    const scroller = $('[data-scroll]');
    if (scroller) scrollMemory.set(prev, scroller.scrollTop);
  }
  route = parseRoute();
  const key = routeKey();

  let html = '';
  if (route.name === 'day') html = viewDay(route.date);
  else if (route.name === 'settings') html = viewSettings();
  else if (route.name === 'foods') html = viewFoods();
  else html = viewHome();

  appEl().innerHTML = html;
  lastRouteKey = key;

  const scroller = $('[data-scroll]');
  if (scroller && scrollMemory.has(key)) scroller.scrollTop = scrollMemory.get(key);

  if (route.name === 'home') drawChart();
  if (route.name === 'foods') wireFoodsScreen();
  if (route.name === 'settings') wireSettingsScreen();

  // Les messages temporaires doivent rester au-dessus du total fixé en bas.
  const totalBar = $('.day-total');
  document.documentElement.style.setProperty(
    '--toast-bottom',
    totalBar ? `${totalBar.offsetHeight + 12}px` : ''
  );
}

/* ------------------------------------------------------------------ */
/* Fragments communs                                                   */
/* ------------------------------------------------------------------ */

function progressRow(label, value, goal, kind) {
  const pct = L.progressPercent(value, goal);
  const text =
    kind === 'kcal'
      ? `${L.formatInt(value)} / ${L.formatInt(goal)} kcal`
      : `${L.formatProt(value).replace(' g', '')} / ${L.formatProt(goal)}`;
  return `<div class="progress-row">
      <div class="progress-head"><span>${esc(label)}</span><span class="num">${esc(text)}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
}

function progressList(totals) {
  const s = settings();
  if (!s.goalKcal && !s.goalProt) return '';
  let rows = '';
  if (s.goalKcal) rows += progressRow('Calories', totals.kcal, s.goalKcal, 'kcal');
  if (s.goalProt) rows += progressRow('Protéines', totals.prot, s.goalProt, 'prot');
  return `<div class="progress-list">${rows}</div>`;
}

/* ------------------------------------------------------------------ */
/* Accueil                                                             */
/* ------------------------------------------------------------------ */

function viewHome() {
  const s = settings();
  const n = L.periodLength(s.startDate, s.endDate);
  const num = L.dayNumber(today, s.startDate, s.endDate);
  const sub = num ? `Jour ${num} / ${n}` : `${L.formatInt(n)} jours`;
  const dark = resolvedTheme() === 'dark';

  return `<div class="screen">
    <header class="app-header">
      <div class="titles">
        <h1>Prise de masse</h1>
        <p class="sub">${esc(sub)}</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn" data-action="toggle-theme" aria-label="${dark ? 'Passer en thème clair' : 'Passer en thème sombre'}">${dark ? ICONS.sun : ICONS.moon}</button>
        <button class="icon-btn" data-action="settings" aria-label="Paramètres">${ICONS.settings}</button>
      </div>
    </header>
    <main class="home-main" data-scroll>
      ${viewTodayCard()}
      ${viewCalendar()}
      ${viewChartShell()}
    </main>
    <button class="fab" data-action="new-food" aria-label="Nouvel aliment">${ICONS.plus}</button>
  </div>`;
}

function viewTodayCard() {
  const s = settings();
  const inPeriod = L.isInPeriod(today, s.startDate, s.endDate);

  if (!inPeriod) {
    return `<section class="today-card" aria-label="Aujourd'hui">
      <div class="today-top"><span class="today-label">Aujourd'hui</span><span class="today-date">${esc(L.formatLongDate(today))}</span></div>
      <p class="today-out">En dehors de la période
        <span class="muted num">Du ${esc(L.formatShortDate(s.startDate))} au ${esc(L.formatShortDate(s.endDate))}</span>
      </p>
    </section>`;
  }

  const totals = L.dayTotals(dayOf(today));
  return `<button class="today-card" data-action="open-day" data-date="${esc(today)}">
      <div class="today-top"><span class="today-label">Aujourd'hui</span><span class="today-date">${esc(L.formatLongDate(today))}</span></div>
      <div class="today-kcal"><span class="value num">${esc(L.formatInt(totals.kcal))}</span><span class="unit">kcal</span></div>
      <p class="today-prot"><strong class="num">${esc(L.formatProt(totals.prot))}</strong> de protéines</p>
      ${progressList(totals)}
    </button>`;
}

function viewCalendar() {
  const s = settings();
  const days = L.periodDays(s.startDate, s.endDate);
  if (days.length === 0) return '';

  const offset = L.weekdayMonday(days[0]);
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<div class="cal-cell empty" aria-hidden="true"></div>';

  days.forEach((key, index) => {
    const d = L.parseDateKey(key);
    const showMonth = index === 0 || d.getDate() === 1;
    const isToday = key === today;
    const hasData = !L.dayIsEmpty(dayOf(key));
    const label = `${L.formatLongDate(key)}${hasData ? ', journée remplie' : ''}`;
    cells += `<button class="cal-cell${isToday ? ' today' : ''}" data-action="open-day" data-date="${esc(key)}" aria-label="${esc(label)}" aria-current="${isToday ? 'date' : 'false'}">
        <span class="d num">${d.getDate()}</span>
        ${showMonth ? `<span class="m">${esc(L.monthShort(key))}</span>` : ''}
        ${hasData ? '<span class="dot"></span>' : ''}
      </button>`;
  });

  const trailing = (7 - ((offset + days.length) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="cal-cell empty" aria-hidden="true"></div>';

  return `<section class="calendar" aria-label="Calendrier de la période">
      <div class="cal-weekdays" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="cal-grid">${cells}</div>
    </section>`;
}

function viewChartShell() {
  return `<section class="chart" aria-label="Évolution sur la période">
      <div class="chart-head">
        <span class="section-label" style="margin:0">Évolution</span>
        <div class="seg" role="group" aria-label="Valeur affichée">
          <button data-action="metric" data-metric="kcal" aria-pressed="${chartMetric === 'kcal'}">Calories</button>
          <button data-action="metric" data-metric="prot" aria-pressed="${chartMetric === 'prot'}">Protéines</button>
        </div>
      </div>
      <div class="chart-holder" data-chart></div>
    </section>`;
}

function drawChart() {
  const holder = $('[data-chart]');
  if (!holder) return;
  const s = settings();
  const series = L.periodSeries(state.days, s.startDate, s.endDate);
  const filled = series.filter((d) => !d.empty);

  if (filled.length === 0) {
    holder.innerHTML = `<div class="chart-empty">Aucune donnée pour l’instant.<br>Ajoute un repas pour voir la courbe.</div>`;
    return;
  }

  const width = Math.max(holder.clientWidth || 340, 240);
  const height = 150;
  const padL = 36;
  const padR = 6;
  const padT = 10;
  const padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const metric = chartMetric;
  const goal = metric === 'kcal' ? s.goalKcal : s.goalProt;
  const max = Math.max(...filled.map((d) => d[metric]), 0);
  const scale = L.chartScale(max, goal, 3);
  const y = (v) => padT + plotH * (1 - v / scale.max);

  const n = series.length;
  const colW = plotW / n;
  const barW = Math.max(3, Math.min(colW - 2.5, 13));

  let g = '';

  for (const t of scale.ticks) {
    const yy = y(t);
    g += `<line class="grid" x1="${padL}" y1="${yy.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${yy.toFixed(1)}"/>`;
    g += `<text class="tick-label" x="${padL - 7}" y="${(yy + 3.2).toFixed(1)}" text-anchor="end">${esc(
      metric === 'kcal' ? L.formatInt(t) : L.formatInt(t)
    )}</text>`;
  }
  g += `<line class="axis" x1="${padL}" y1="${padT + plotH}" x2="${(width - padR).toFixed(1)}" y2="${padT + plotH}"/>`;

  if (goal && goal <= scale.max) {
    const yy = y(goal);
    g += `<line class="goal-line" x1="${padL}" y1="${yy.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${yy.toFixed(1)}"/>`;
  }

  series.forEach((d, i) => {
    if (d.empty) return;
    const v = Math.min(d[metric], scale.max);
    const h = Math.max(1.5, plotH * (v / scale.max));
    const cx = padL + colW * (i + 0.5);
    const isToday = d.key === today;
    g += `<rect class="bar${isToday ? ' is-today' : ''}" x="${(cx - barW / 2).toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
    g += `<rect class="hit" data-action="open-day" data-date="${esc(d.key)}" x="${(cx - colW / 2).toFixed(1)}" y="${padT}" width="${colW.toFixed(1)}" height="${plotH}"><title>${esc(
      `${L.formatLongDate(d.key)} — ${metric === 'kcal' ? L.formatKcal(d.kcal) : L.formatProt(d.prot)}`
    )}</title></rect>`;
  });

  for (let i = 0; i < n; i += 7) {
    const cx = padL + colW * (i + 0.5);
    g += `<text class="x-label" x="${cx.toFixed(1)}" y="${height - 4}" text-anchor="middle">${esc(L.formatChartDate(series[i].key))}</text>`;
  }

  holder.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Graphique : ${
    metric === 'kcal' ? 'calories' : 'protéines'
  } par jour">${g}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Écran d'un jour                                                     */
/* ------------------------------------------------------------------ */

function viewDay(key) {
  const s = settings();
  const n = L.periodLength(s.startDate, s.endDate);
  const num = L.dayNumber(key, s.startDate, s.endDate);
  const prev = L.prevDayKey(key, s.startDate, s.endDate);
  const next = L.nextDayKey(key, s.startDate, s.endDate);
  const day = dayOf(key);
  const totals = L.dayTotals(day);

  const sections = L.MEALS.map((meal) => {
    const entries = (day && day[meal.key]) || [];
    const t = L.totalsOfEntries(entries);
    const rows = entries
      .map(
        (e) => `<li><button class="entry" data-action="edit-entry" data-meal="${esc(meal.key)}" data-entry="${esc(e.id)}">
            <span class="entry-name"><span class="n">${esc(e.name)}</span><span class="q num">${esc(L.formatGrams(e.grams))}</span></span>
            <span class="entry-values"><span class="k">${esc(L.formatKcal(L.entryKcal(e)))}</span><span class="p">${esc(L.formatProt(L.entryProt(e)))}</span></span>
          </button></li>`
      )
      .join('');

    return `<section class="meal" data-meal="${esc(meal.key)}">
        <div class="meal-head">
          <h2>${esc(meal.label)}</h2>
          ${entries.length ? `<span class="meal-total num">${esc(L.formatKcal(t.kcal))} · ${esc(L.formatProt(t.prot))}</span>` : ''}
        </div>
        ${entries.length ? `<ul>${rows}</ul>` : ''}
        <button class="add-btn" data-action="add-entry" data-meal="${esc(meal.key)}">${ICONS.plusSmall}Ajouter</button>
      </section>`;
  }).join('');

  return `<div class="screen">
    <header class="app-header day-header">
      <button class="icon-btn back-btn" data-action="back-home" aria-label="Retour à l’accueil">${ICONS.back}</button>
      <div class="titles">
        <h1>${esc(L.formatLongDate(key))}</h1>
        <p class="sub">${num ? `Jour ${num} / ${n}` : 'Hors période'}</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn" data-action="goto-day" data-date="${esc(prev || '')}" aria-label="Jour précédent" ${prev ? '' : 'disabled'}>${ICONS.back}</button>
        <button class="icon-btn" data-action="goto-day" data-date="${esc(next || '')}" aria-label="Jour suivant" ${next ? '' : 'disabled'}>${ICONS.next}</button>
      </div>
    </header>
    <main class="day-main" data-scroll>${sections}</main>
    <div class="day-total">
      <div class="row">
        <span class="label">Total du jour</span>
        <span class="values"><span class="k" data-total-kcal>${esc(L.formatInt(totals.kcal))}<span class="p"> kcal</span></span><span class="p" data-total-prot>${esc(L.formatProt(totals.prot))}</span></span>
      </div>
      ${progressList(totals)}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

function viewSettings() {
  const s = settings();
  const themeChoice = (value, label) =>
    `<button class="choice" data-action="set-theme" data-theme="${value}" aria-pressed="${s.theme === value}">
      <span>${esc(label)}</span>
      <span class="check">${s.theme === value ? ICONS.check : ''}</span>
    </button>`;

  return `<div class="screen">
    <header class="app-header">
      <button class="icon-btn back-btn" data-action="back-home" aria-label="Retour à l’accueil">${ICONS.back}</button>
      <div class="titles"><h1>Paramètres</h1></div>
    </header>
    <main class="plain-main" data-scroll>
      <section class="group">
        <p class="section-label">Thème</p>
        <div class="choice-list">
          ${themeChoice('auto', 'Automatique')}
          ${themeChoice('light', 'Clair')}
          ${themeChoice('dark', 'Sombre')}
        </div>
      </section>

      <section class="group">
        <p class="section-label">Période</p>
        <div class="two-cols">
          <div class="field">
            <label for="start-date">Début</label>
            <input class="input num" type="date" id="start-date" value="${esc(s.startDate)}">
          </div>
          <div class="field">
            <label for="end-date">Fin</label>
            <input class="input num" type="date" id="end-date" value="${esc(s.endDate)}">
          </div>
        </div>
        <p class="field-error" id="period-error" hidden></p>
        <p class="hint">${esc(`${L.periodLength(s.startDate, s.endDate)} jours. Changer la période ne supprime aucune donnée.`)}</p>
      </section>

      <section class="group">
        <p class="section-label">Objectifs quotidiens</p>
        <div class="two-cols">
          <div class="field">
            <label for="goal-kcal">Calories</label>
            <input class="input num" type="text" inputmode="decimal" id="goal-kcal" placeholder="—" value="${s.goalKcal == null ? '' : esc(String(s.goalKcal).replace('.', ','))}">
          </div>
          <div class="field">
            <label for="goal-prot">Protéines (g)</label>
            <input class="input num" type="text" inputmode="decimal" id="goal-prot" placeholder="—" value="${s.goalProt == null ? '' : esc(String(s.goalProt).replace('.', ','))}">
          </div>
        </div>
        <p class="field-error" id="goal-error" hidden></p>
        <p class="hint">Laisse vide pour ne pas afficher d’objectif.</p>
      </section>

      <section class="group">
        <button class="row-link" data-action="foods">
          <span class="rl-main">
            <span class="rl-title">Mes aliments</span>
            <span class="rl-sub">${state.foods.length === 0 ? 'Aucun aliment' : `${L.formatInt(state.foods.length)} aliment${state.foods.length > 1 ? 's' : ''}`}</span>
          </span>
          <span class="chev">${ICONS.chevron}</span>
        </button>
      </section>

      <section class="group">
        <p class="section-label">Sauvegarde</p>
        <div class="btn-row">
          <button class="btn ghost" data-action="export">${ICONS.download}Exporter</button>
          <button class="btn ghost" data-action="import">${ICONS.upload}Importer</button>
        </div>
        <p class="hint">L’export crée un fichier JSON avec toutes tes données.</p>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </section>

      <p class="version-line">Prise de masse — version ${esc(L.APP_VERSION)}</p>
    </main>
  </div>`;
}

function wireSettingsScreen() {
  const s = settings();
  const start = $('#start-date');
  const end = $('#end-date');
  const periodError = $('#period-error');

  const applyPeriod = () => {
    const res = L.validatePeriod(start.value, end.value);
    if (!res.ok) {
      periodError.textContent = res.error;
      periodError.hidden = false;
      start.classList.add('invalid');
      end.classList.add('invalid');
      return;
    }
    periodError.hidden = true;
    start.classList.remove('invalid');
    end.classList.remove('invalid');
    s.startDate = res.value.startDate;
    s.endDate = res.value.endDate;
    persist();
    render();
  };
  start.addEventListener('change', applyPeriod);
  end.addEventListener('change', applyPeriod);

  const goalKcal = $('#goal-kcal');
  const goalProt = $('#goal-prot');
  const goalError = $('#goal-error');

  const applyGoals = () => {
    const rk = L.validateGoal(goalKcal.value, 20000);
    const rp = L.validateGoal(goalProt.value, 1000);
    goalKcal.classList.toggle('invalid', !rk.ok);
    goalProt.classList.toggle('invalid', !rp.ok);
    if (!rk.ok || !rp.ok) {
      goalError.textContent = (!rk.ok ? `Calories : ${rk.error}` : '') + (!rk.ok && !rp.ok ? ' ' : '') + (!rp.ok ? `Protéines : ${rp.error}` : '');
      goalError.hidden = false;
      return;
    }
    goalError.hidden = true;
    s.goalKcal = rk.value;
    s.goalProt = rp.value;
    persist();
  };
  goalKcal.addEventListener('input', applyGoals);
  goalProt.addEventListener('input', applyGoals);

  $('#import-file').addEventListener('change', onImportFile);
}

/* ------------------------------------------------------------------ */
/* Mes aliments                                                        */
/* ------------------------------------------------------------------ */

let foodsQuery = '';

function viewFoods() {
  return `<div class="screen">
    <header class="app-header">
      <button class="icon-btn back-btn" data-action="back-settings" aria-label="Retour aux paramètres">${ICONS.back}</button>
      <div class="titles"><h1>Mes aliments</h1></div>
      <div class="header-actions">
        <button class="icon-btn" data-action="new-food" aria-label="Nouvel aliment">${ICONS.plus}</button>
      </div>
    </header>
    <main class="plain-main" data-scroll>
      ${
        state.foods.length
          ? `<div class="search-wrap">
              <span class="search-icon">${ICONS.search}</span>
              <input class="input" type="search" id="foods-search" placeholder="Rechercher" value="${esc(foodsQuery)}" aria-label="Rechercher un aliment">
            </div>`
          : ''
      }
      <div data-foods-list>${foodsListHtml()}</div>
    </main>
  </div>`;
}

function foodsListHtml() {
  if (state.foods.length === 0) {
    return `<p class="empty-state">Aucun aliment pour l’instant — appuie sur + pour en ajouter.</p>`;
  }
  const list = L.sortFoodsAlpha(L.searchFoods(state.foods, foodsQuery));
  if (list.length === 0) {
    return `<p class="empty-state">Aucun aliment ne correspond à « ${esc(foodsQuery)} ».</p>`;
  }
  return list
    .map(
      (f) => `<button class="food-row" data-action="edit-food" data-food="${esc(f.id)}">
        <span class="rl-main">
          <span class="f-name">${esc(f.name)}</span>
          <span class="f-sub">${esc(L.formatKcal(f.kcal100))} · ${esc(L.formatGrams(f.prot100))} / 100 g</span>
        </span>
        <span class="chev">${ICONS.chevron}</span>
      </button>`
    )
    .join('');
}

function wireFoodsScreen() {
  const search = $('#foods-search');
  if (!search) return;
  search.addEventListener('input', () => {
    foodsQuery = search.value;
    $('[data-foods-list]').innerHTML = foodsListHtml();
  });
}

/* ------------------------------------------------------------------ */
/* Feuilles (bottom sheets)                                            */
/* ------------------------------------------------------------------ */

let currentSheet = null;
let ignorePop = 0;

function openSheet(label) {
  const root = document.getElementById('sheet-root');
  if (!currentSheet) history.pushState({ pdmSheet: true }, '');
  root.innerHTML = `
    <div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="sheet-grab"></div>
      <div class="sheet-head">
        <button class="icon-btn back-btn" data-action="sheet-back" aria-label="Étape précédente" hidden>${ICONS.back}</button>
        <h2></h2>
        <button class="icon-btn" data-action="close-sheet" aria-label="Fermer">${ICONS.close}</button>
      </div>
      <div class="sheet-body"></div>
    </div>`;
  currentSheet = {
    el: $('.sheet', root),
    body: $('.sheet-body', root),
    title: $('.sheet-head h2', root),
    backBtn: $('[data-action="sheet-back"]', root),
    onBack: null,
  };
  return currentSheet;
}

function setSheetContent(title, html, { onBack = null, mount = null } = {}) {
  if (!currentSheet) return;
  currentSheet.title.textContent = title;
  currentSheet.body.innerHTML = html;
  currentSheet.onBack = onBack;
  currentSheet.backBtn.hidden = !onBack;
  currentSheet.el.setAttribute('aria-label', title);
  if (mount) mount(currentSheet.body);
}

function closeSheet(fromPop = false) {
  if (!currentSheet) return;
  const root = document.getElementById('sheet-root');
  const sheet = $('.sheet', root);
  const backdrop = $('.sheet-backdrop', root);
  if (sheet) sheet.classList.add('closing');
  if (backdrop) backdrop.classList.add('closing');
  currentSheet = null;
  setTimeout(() => {
    if (!currentSheet) root.innerHTML = '';
  }, 190);
  if (!fromPop) {
    ignorePop += 1;
    history.back();
  }
}

/* Feuille : nouvel aliment ------------------------------------------ */

function openNewFoodSheet({ prefillName = '', onCreated = null } = {}) {
  openSheet('Nouvel aliment');
  renderFoodForm({
    title: 'Nouvel aliment',
    food: { name: prefillName, kcal100: '', prot100: '' },
    submitLabel: 'Enregistrer',
    onSubmit: (value) => {
      const food = {
        id: L.newId(),
        name: value.name,
        kcal100: value.kcal100,
        prot100: value.prot100,
        createdAt: new Date().toISOString(),
      };
      state.foods.push(food);
      persist();
      if (onCreated) {
        onCreated(food);
      } else {
        closeSheet();
        toast('Aliment ajouté');
        if (route.name === 'foods') render();
        if (route.name === 'settings') render();
      }
    },
  });
}

function openEditFoodSheet(foodId) {
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) return;
  openSheet('Modifier l’aliment');
  renderFoodForm({
    title: 'Modifier l’aliment',
    food,
    submitLabel: 'Enregistrer',
    note: 'Les jours déjà remplis ne changent pas.',
    excludeId: food.id,
    onDelete: () => confirmDeleteFood(food),
    onSubmit: (value) => {
      food.name = value.name;
      food.kcal100 = value.kcal100;
      food.prot100 = value.prot100;
      persist();
      closeSheet();
      toast('Aliment modifié');
      render();
    },
  });
}

function renderFoodForm({ title, food, submitLabel, onSubmit, onDelete = null, note = '', excludeId = null }) {
  const html = `
    ${note ? `<p class="sheet-note">${esc(note)}</p>` : ''}
    <div class="field">
      <label for="f-name">Nom</label>
      <input class="input" type="text" id="f-name" maxlength="${L.LIMITS.nameMax}" autocomplete="off" value="${esc(food.name || '')}" placeholder="Pâtes">
      <p class="field-error" data-error="name" hidden></p>
    </div>
    <div class="two-cols">
      <div class="field">
        <label for="f-kcal">Calories / 100 g</label>
        <input class="input num" type="text" inputmode="decimal" id="f-kcal" autocomplete="off" value="${esc(numToInput(food.kcal100))}" placeholder="350">
        <p class="field-error" data-error="kcal100" hidden></p>
      </div>
      <div class="field">
        <label for="f-prot">Protéines / 100 g</label>
        <input class="input num" type="text" inputmode="decimal" id="f-prot" autocomplete="off" value="${esc(numToInput(food.prot100))}" placeholder="12">
        <p class="field-error" data-error="prot100" hidden></p>
      </div>
    </div>
    <p class="hint">Valeurs indiquées sur l’emballage, pour 100 g.</p>
    <button class="btn primary" data-submit type="button">${esc(submitLabel)}</button>
    ${onDelete ? `<div class="btn-row"><button class="btn ghost" data-delete type="button">${ICONS.trash}Supprimer</button></div>` : ''}
  `;

  setSheetContent(title, html, {
    mount: (body) => {
      const name = $('#f-name', body);
      const kcal = $('#f-kcal', body);
      const prot = $('#f-prot', body);
      const submit = $('[data-submit]', body);
      const touched = { name: false, kcal100: false, prot100: false };

      const showError = (field, message) => {
        const el = body.querySelector(`[data-error="${field}"]`);
        const input = { name, kcal100: kcal, prot100: prot }[field];
        if (message && touched[field]) {
          el.textContent = message;
          el.hidden = false;
          input.classList.add('invalid');
        } else {
          el.hidden = true;
          input.classList.remove('invalid');
        }
      };

      const check = () => {
        const res = L.validateFood(
          { name: name.value, kcal100: kcal.value, prot100: prot.value },
          state.foods,
          excludeId
        );
        showError('name', res.errors.name);
        showError('kcal100', res.errors.kcal100);
        showError('prot100', res.errors.prot100);
        submit.disabled = !res.ok;
        return res;
      };

      // Les erreurs apparaissent à la frappe et à la validation, jamais au simple
      // passage dans le champ : sinon la feuille change de hauteur sous le doigt.
      [['name', name], ['kcal100', kcal], ['prot100', prot]].forEach(([field, input]) => {
        input.addEventListener('input', () => {
          touched[field] = true;
          check();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitNow();
          }
        });
      });

      const submitNow = () => {
        touched.name = touched.kcal100 = touched.prot100 = true;
        const res = check();
        if (res.ok) onSubmit(res.value);
      };

      submit.addEventListener('click', submitNow);
      if (onDelete) $('[data-delete]', body).addEventListener('click', onDelete);

      check();
      submit.disabled = !L.validateFood({ name: name.value, kcal100: kcal.value, prot100: prot.value }, state.foods, excludeId).ok;
      if (!food.name) name.focus();
    },
  });
}

function numToInput(v) {
  if (v === '' || v === null || v === undefined) return '';
  return String(v).replace('.', ',');
}

function confirmDeleteFood(food) {
  setSheetContent('Supprimer l’aliment', `
    <p class="sheet-note">Supprimer « ${esc(food.name)} » de ta base d’aliments ? Les jours déjà remplis ne changent pas.</p>
    <button class="btn primary" data-confirm type="button">Supprimer</button>
    <div class="btn-row"><button class="btn ghost" data-cancel type="button">Annuler</button></div>
  `, {
    onBack: () => openEditFoodSheet(food.id),
    mount: (body) => {
      $('[data-confirm]', body).addEventListener('click', () => {
        state.foods = state.foods.filter((f) => f.id !== food.id);
        persist();
        closeSheet();
        toast('Aliment supprimé');
        render();
      });
      $('[data-cancel]', body).addEventListener('click', () => openEditFoodSheet(food.id));
    },
  });
}

/* Feuille : ajouter une entrée --------------------------------------- */

function openAddEntrySheet(dateKey, mealKey) {
  const meal = L.MEALS.find((m) => m.key === mealKey);
  openSheet(`Ajouter à ${meal.label}`);
  showFoodPicker(dateKey, mealKey, '');
}

function showFoodPicker(dateKey, mealKey, query) {
  const meal = L.MEALS.find((m) => m.key === mealKey);
  // Pas de champ de recherche tant que la base est vide.
  const hasFoods = state.foods.length > 0;
  const html = `
    ${
      hasFoods
        ? `<div class="search-wrap">
            <span class="search-icon">${ICONS.search}</span>
            <input class="input" type="search" id="picker-search" placeholder="Rechercher un aliment" autocomplete="off" value="${esc(query)}" aria-label="Rechercher un aliment">
          </div>`
        : ''
    }
    <div class="picker-list" data-picker-list></div>
    <button class="btn ghost" data-new-food type="button"></button>
  `;

  setSheetContent(`Ajouter à ${meal.label}`, html, {
    mount: (body) => {
      const search = $('#picker-search', body);
      const list = $('[data-picker-list]', body);
      const newBtn = $('[data-new-food]', body);
      const counts = L.foodUsageCounts(state.days);

      const paint = () => {
        const q = search ? search.value : '';
        const found = L.sortFoodsByUsage(L.searchFoods(state.foods, q), counts);
        if (state.foods.length === 0) {
          list.innerHTML = `<p class="empty-state">Aucun aliment pour l’instant.</p>`;
        } else if (found.length === 0) {
          list.innerHTML = `<p class="empty-state">Aucun aliment ne correspond.</p>`;
        } else {
          list.innerHTML = found
            .map(
              (f) => `<button class="food-row" data-pick="${esc(f.id)}" type="button">
                <span class="rl-main">
                  <span class="f-name">${esc(f.name)}</span>
                  <span class="f-sub">${esc(L.formatKcal(f.kcal100))} · ${esc(L.formatGrams(f.prot100))} / 100 g</span>
                </span>
                <span class="chev">${ICONS.chevron}</span>
              </button>`
            )
            .join('');
        }
        const q2 = q.trim();
        newBtn.textContent = found.length === 0 && q2 ? `Créer « ${q2} »` : 'Nouvel aliment';
        newBtn.dataset.prefill = found.length === 0 && q2 ? q2 : '';
      };

      if (search) search.addEventListener('input', paint);
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick]');
        if (!btn) return;
        const food = state.foods.find((f) => f.id === btn.dataset.pick);
        if (food) showQuantityStep(dateKey, mealKey, food, search ? search.value : '');
      });
      newBtn.addEventListener('click', () => {
        const prefill = newBtn.dataset.prefill || '';
        const back = search ? search.value : '';
        renderFoodForm({
          title: 'Nouvel aliment',
          food: { name: prefill, kcal100: '', prot100: '' },
          submitLabel: 'Enregistrer',
          onSubmit: (value) => {
            const food = {
              id: L.newId(),
              name: value.name,
              kcal100: value.kcal100,
              prot100: value.prot100,
              createdAt: new Date().toISOString(),
            };
            state.foods.push(food);
            persist();
            showQuantityStep(dateKey, mealKey, food, back);
          },
        });
        currentSheet.onBack = () => showFoodPicker(dateKey, mealKey, back);
        currentSheet.backBtn.hidden = false;
      });

      paint();
    },
  });
}

function showQuantityStep(dateKey, mealKey, food, backQuery) {
  const html = `
    <div class="field">
      <label for="q-grams">Quantité en grammes</label>
      <div class="qty-input-wrap">
        <input class="input num" type="text" inputmode="decimal" id="q-grams" autocomplete="off" placeholder="0" value="">
        <span class="unit">g</span>
      </div>
      <p class="field-error" data-error="grams" hidden></p>
    </div>
    <div class="qty-preview" data-preview>—</div>
    <button class="btn primary" data-submit type="button">Ajouter</button>
  `;

  setSheetContent(food.name, html, {
    onBack: () => showFoodPicker(dateKey, mealKey, backQuery || ''),
    mount: (body) => {
      const input = $('#q-grams', body);
      const preview = $('[data-preview]', body);
      const err = body.querySelector('[data-error="grams"]');
      const submit = $('[data-submit]', body);

      const check = () => {
        const res = L.validateGrams(input.value);
        if (!res.ok) {
          preview.innerHTML = '—';
          submit.disabled = true;
          if (input.value.trim() !== '') {
            err.textContent = res.error;
            err.hidden = false;
            input.classList.add('invalid');
          } else {
            err.hidden = true;
            input.classList.remove('invalid');
          }
          return null;
        }
        err.hidden = true;
        input.classList.remove('invalid');
        submit.disabled = false;
        const kcal = (food.kcal100 * res.value) / 100;
        const prot = (food.prot100 * res.value) / 100;
        preview.innerHTML = `${esc(L.formatGrams(res.value))} → <strong>${esc(L.formatKcal(kcal))}</strong> · <strong>${esc(L.formatProt(prot))}</strong> de protéines`;
        return res.value;
      };

      const add = () => {
        const grams = check();
        if (grams === null) return;
        const day = ensureDay(dateKey);
        day[mealKey].push({
          id: L.newId(),
          foodId: food.id,
          name: food.name,
          grams,
          kcal100: food.kcal100,
          prot100: food.prot100,
          createdAt: new Date().toISOString(),
        });
        persist();
        closeSheet();
        render();
      };

      input.addEventListener('input', check);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
      submit.addEventListener('click', add);

      check();
      input.focus();
    },
  });
}

/* Feuille : modifier une entrée -------------------------------------- */

function openEditEntrySheet(dateKey, mealKey, entryId) {
  const day = dayOf(dateKey);
  if (!day) return;
  const entry = (day[mealKey] || []).find((e) => e.id === entryId);
  if (!entry) return;

  openSheet('Modifier');
  const html = `
    <p class="sheet-note">${esc(entry.name)} — ${esc(L.formatKcal(entry.kcal100))} · ${esc(L.formatGrams(entry.prot100))} / 100 g</p>
    <div class="field">
      <label for="q-grams">Quantité en grammes</label>
      <div class="qty-input-wrap">
        <input class="input num" type="text" inputmode="decimal" id="q-grams" autocomplete="off" value="${esc(numToInput(entry.grams))}">
        <span class="unit">g</span>
      </div>
      <p class="field-error" data-error="grams" hidden></p>
    </div>
    <div class="qty-preview" data-preview>—</div>
    <button class="btn primary" data-submit type="button">Enregistrer</button>
    <div class="btn-row"><button class="btn ghost" data-delete type="button">${ICONS.trash}Supprimer</button></div>
  `;

  setSheetContent('Modifier', html, {
    mount: (body) => {
      const input = $('#q-grams', body);
      const preview = $('[data-preview]', body);
      const err = body.querySelector('[data-error="grams"]');
      const submit = $('[data-submit]', body);

      const check = () => {
        const res = L.validateGrams(input.value);
        if (!res.ok) {
          preview.innerHTML = '—';
          submit.disabled = true;
          err.textContent = res.error;
          err.hidden = input.value.trim() === '';
          input.classList.toggle('invalid', input.value.trim() !== '');
          return null;
        }
        err.hidden = true;
        input.classList.remove('invalid');
        submit.disabled = false;
        const kcal = (entry.kcal100 * res.value) / 100;
        const prot = (entry.prot100 * res.value) / 100;
        preview.innerHTML = `${esc(L.formatGrams(res.value))} → <strong>${esc(L.formatKcal(kcal))}</strong> · <strong>${esc(L.formatProt(prot))}</strong> de protéines`;
        return res.value;
      };

      const saveNow = () => {
        const grams = check();
        if (grams === null) return;
        entry.grams = grams;
        persist();
        closeSheet();
        render();
      };

      input.addEventListener('input', check);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveNow();
        }
      });
      submit.addEventListener('click', saveNow);
      $('[data-delete]', body).addEventListener('click', () => {
        deleteEntry(dateKey, mealKey, entryId);
        closeSheet();
      });

      check();
    },
  });
}

function deleteEntry(dateKey, mealKey, entryId) {
  const day = dayOf(dateKey);
  if (!day) return;
  const list = day[mealKey] || [];
  const index = list.findIndex((e) => e.id === entryId);
  if (index === -1) return;
  const [removed] = list.splice(index, 1);
  persist();
  render();
  toast('Entrée supprimée', {
    duration: 5000,
    actionLabel: 'Annuler',
    onAction: () => {
      const target = ensureDay(dateKey)[mealKey];
      target.splice(Math.min(index, target.length), 0, removed);
      persist();
      render();
    },
  });
}

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

async function doExport() {
  try {
    const how = await S.exportData(state);
    if (how === 'download') toast('Sauvegarde téléchargée');
  } catch {
    toast('Export impossible sur cet appareil.', { duration: 5000 });
  }
}

function onImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showImportResult({ ok: false, error: 'Impossible de lire ce fichier.' });
  reader.onload = () => showImportResult(S.parseImport(String(reader.result)));
  reader.readAsText(file);
}

function showImportResult(res) {
  openSheet('Importer une sauvegarde');
  if (!res.ok) {
    setSheetContent('Importer une sauvegarde', `
      <p class="sheet-note">${esc(res.error)}</p>
      <p class="hint">Rien n’a été modifié.</p>
      <button class="btn ghost" data-close type="button">Fermer</button>
    `, {
      mount: (body) => $('[data-close]', body).addEventListener('click', () => closeSheet()),
    });
    return;
  }

  setSheetContent('Importer une sauvegarde', `
    <div class="summary-list">
      <div class="srow"><span>Aliments</span><span class="v num">${esc(L.formatInt(res.summary.foods))}</span></div>
      <div class="srow"><span>Journées remplies</span><span class="v num">${esc(L.formatInt(res.summary.days))}</span></div>
      <div class="srow"><span>Période</span><span class="v num">${esc(L.formatShortDate(res.data.settings.startDate))} → ${esc(L.formatShortDate(res.data.settings.endDate))}</span></div>
    </div>
    <p class="hint">Ces données remplaceront complètement les données actuelles.</p>
    <button class="btn primary" data-confirm type="button">Remplacer mes données</button>
    <div class="btn-row"><button class="btn ghost" data-cancel type="button">Annuler</button></div>
  `, {
    mount: (body) => {
      $('[data-confirm]', body).addEventListener('click', () => {
        state = res.data;
        persist();
        applyTheme();
        closeSheet();
        toast('Sauvegarde importée');
        render();
      });
      $('[data-cancel]', body).addEventListener('click', () => closeSheet());
    },
  });
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

let toastTimer = null;

function toast(message, { actionLabel = null, onAction = null, duration = 3000 } = {}) {
  const root = document.getElementById('toast-root');
  if (toastTimer) clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast">
      <span class="t-msg">${esc(message)}</span>
      ${actionLabel ? `<button class="t-action" type="button" data-toast-action>${esc(actionLabel)}</button>` : ''}
    </div>`;
  if (actionLabel && onAction) {
    $('[data-toast-action]', root).addEventListener('click', () => {
      root.innerHTML = '';
      if (toastTimer) clearTimeout(toastTimer);
      onAction();
    });
  }
  toastTimer = setTimeout(() => {
    root.innerHTML = '';
  }, duration);
}

/* ------------------------------------------------------------------ */
/* Actions (délégation)                                                */
/* ------------------------------------------------------------------ */

function handleAction(action, el) {
  switch (action) {
    case 'toggle-theme':
      setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
      render();
      break;
    case 'set-theme':
      setTheme(el.dataset.theme);
      render();
      break;
    case 'settings':
      go('#/parametres');
      break;
    case 'foods':
      go('#/aliments');
      break;
    case 'back-home':
      go('#/');
      break;
    case 'back-settings':
      go('#/parametres');
      break;
    case 'open-day':
      if (el.dataset.date) go(`#/jour/${el.dataset.date}`);
      break;
    case 'goto-day':
      if (el.dataset.date && !el.disabled) go(`#/jour/${el.dataset.date}`);
      break;
    case 'metric':
      chartMetric = el.dataset.metric;
      $$('[data-action="metric"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === chartMetric)));
      drawChart();
      break;
    case 'new-food':
      openNewFoodSheet();
      break;
    case 'edit-food':
      openEditFoodSheet(el.dataset.food);
      break;
    case 'add-entry':
      openAddEntrySheet(route.date, el.dataset.meal);
      break;
    case 'edit-entry':
      openEditEntrySheet(route.date, el.dataset.meal, el.dataset.entry);
      break;
    case 'export':
      doExport();
      break;
    case 'import':
      $('#import-file').click();
      break;
    case 'close-sheet':
      closeSheet();
      break;
    case 'sheet-back':
      if (currentSheet && currentSheet.onBack) currentSheet.onBack();
      break;
    default:
      break;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.hasAttribute('disabled')) return;
  handleAction(target.dataset.action, target);
});

/* ------------------------------------------------------------------ */
/* Navigation navigateur                                               */
/* ------------------------------------------------------------------ */

window.addEventListener('hashchange', () => {
  if (currentSheet) closeSheet();
  render();
});

window.addEventListener('popstate', () => {
  if (ignorePop > 0) {
    ignorePop -= 1;
    return;
  }
  if (currentSheet) {
    closeSheet(true);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentSheet) closeSheet();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (route.name === 'home') drawChart();
  }, 120);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = L.todayKey();
  if (now !== today) {
    today = now;
    render();
  }
});

if (darkQuery && darkQuery.addEventListener) {
  darkQuery.addEventListener('change', () => {
    if (settings().theme === 'auto') {
      applyTheme();
      render();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Service worker                                                      */
/* ------------------------------------------------------------------ */

const MAJ_CACHE = 'prise-de-masse-maj';
const MAJ_MARQUEUR = './maj';

function showUpdateBanner() {
  const root = document.getElementById('update-root');
  if (root.firstChild) return;
  root.innerHTML = `<div class="update-banner">
      <span class="u-msg">Mise à jour disponible</span>
      <button class="u-action" type="button" data-reload>Recharger</button>
    </div>`;
  // Les fichiers à jour sont déjà dans le cache : un simple rechargement suffit.
  // Les données, elles, ne sont jamais touchées.
  $('[data-reload]', root).addEventListener('click', async () => {
    try {
      const cache = await caches.open(MAJ_CACHE);
      await cache.delete(MAJ_MARQUEUR);
    } catch {
      /* sans importance : au pire le bandeau réapparaît une fois */
    }
    location.reload();
  });
}

/** Le worker a pu signaler la mise à jour avant que la page ne soit prête à l'entendre. */
async function verifierMiseAJourEnAttente() {
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open(MAJ_CACHE);
    if (await cache.match(MAJ_MARQUEUR)) showUpdateBanner();
  } catch {
    /* contexte non sécurisé : pas de cache, donc pas de mise à jour à signaler */
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Le worker prévient quand un fichier de l'app a réellement changé sur le serveur.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CONTENT_UPDATED') showUpdateBanner();
  });

  verifierMiseAJourEnAttente();

  navigator.serviceWorker
    .register(`./sw.js?v=${L.APP_VERSION}`, { scope: './' })
    .then((reg) => {
      // Un worker en attente a déjà remis tous les fichiers en cache : on le laisse
      // prendre la main sans rien demander. La page affichée ne change pas, et c'est
      // le bandeau (déclenché par un vrai changement de contenu) qui propose de recharger.
      const activerEnAttente = () => {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      };
      activerEnAttente();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') activerEnAttente();
        });
      });
    })
    .catch(() => {
      /* hors ligne ou contexte non sécurisé : l'app fonctionne quand même */
    });
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

function start() {
  const loaded = S.load();
  state = loaded.data;
  today = L.todayKey();
  applyTheme();
  render();
  if (loaded.warning) toast(loaded.warning, { duration: 6000 });
  S.requestPersist();
  registerServiceWorker();
  document.documentElement.setAttribute('data-ready', 'true');
}

start();
