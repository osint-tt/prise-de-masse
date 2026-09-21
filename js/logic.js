// logic.js — logique pure : calculs, dates, parsing, validation.
// Aucun accès au DOM ni au stockage : ce fichier est importable par Node pour les tests.

export const APP_VERSION = '1.1.0';

export const SCHEMA_VERSION = 2;

export const DEFAULT_START = '2026-09-21';
export const DEFAULT_END = '2026-10-21';

export const MEALS = [
  { key: 'petitdej', label: 'Petit-déj' },
  { key: 'midi', label: 'Repas midi' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'soir', label: 'Repas soir' },
  { key: 'grignotage', label: 'Grignotage' },
];

export const MEAL_KEYS = MEALS.map((m) => m.key);

export const THEMES = ['auto', 'light', 'dark'];

/**
 * Unité de mesure d'un aliment.
 * - 'g'     : valeurs pour 100 g (cas courant), quantité saisie en grammes.
 * - 'piece' : valeurs pour 1 unité (un œuf, une banane…), quantité saisie en unités.
 * Les champs `kcal100` / `prot100` gardent leur nom dans les deux cas : ils portent
 * les valeurs pour la quantité de référence, donnée par refQuantity().
 */
export const UNITS = ['g', 'piece'];

export const LIMITS = {
  nameMax: 40,
  kcalMax: 900,
  protMax: 100,
  gramsMax: 5000,
  kcalUnitMax: 2000,
  protUnitMax: 200,
  piecesMax: 100,
};

/** Quantité à laquelle se rapportent kcal100 / prot100 : 100 g, ou 1 unité. */
export function refQuantity(unit) {
  return unit === 'piece' ? 1 : 100;
}

export function normalizeUnit(unit) {
  return unit === 'piece' ? 'piece' : 'g';
}

/** Bornes de saisie des valeurs de référence, selon l'unité. */
export function valueLimits(unit) {
  return unit === 'piece'
    ? { kcal: LIMITS.kcalUnitMax, prot: LIMITS.protUnitMax }
    : { kcal: LIMITS.kcalMax, prot: LIMITS.protMax };
}

/** Borne haute de la quantité saisissable, selon l'unité. */
export function quantityLimit(unit) {
  return unit === 'piece' ? LIMITS.piecesMax : LIMITS.gramsMax;
}

/* ------------------------------------------------------------------ */
/* Identifiants                                                        */
/* ------------------------------------------------------------------ */

// Pas de Date.now() : l'horloge peut être figée (tests) et les ids doivent rester uniques.
export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  let s = '';
  for (let i = 0; i < 4; i++) s += Math.random().toString(36).slice(2, 10);
  return s.slice(0, 32);
}

/* ------------------------------------------------------------------ */
/* Dates (toujours en heure locale, jamais toISOString)                */
/* ------------------------------------------------------------------ */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> clé locale AAAA-MM-JJ. */
export function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Clé AAAA-MM-JJ -> Date à minuit heure locale. */
export function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Rejette les dates impossibles (31 février...)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function isDateKey(key) {
  return parseDateKey(key) !== null;
}

/** Clé du jour courant, en heure locale. */
export function todayKey(now = new Date()) {
  return dateKey(now);
}

/** Décale une clé de n jours (n peut être négatif). */
export function addDays(key, n) {
  const d = parseDateKey(key);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Nombre de jours entre deux clés (b - a), en jours entiers. */
export function diffDays(a, b) {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return null;
  // On passe par UTC pour neutraliser les changements d'heure (mars / octobre).
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Toutes les clés de la période, bornes incluses. */
export function periodDays(startKey, endKey) {
  const n = diffDays(startKey, endKey);
  if (n === null || n < 0) return [];
  const out = [];
  for (let i = 0; i <= n; i++) out.push(addDays(startKey, i));
  return out;
}

export function periodLength(startKey, endKey) {
  const n = diffDays(startKey, endKey);
  if (n === null || n < 0) return 0;
  return n + 1;
}

export function isInPeriod(key, startKey, endKey) {
  if (!isDateKey(key)) return false;
  return key >= startKey && key <= endKey;
}

/** Numéro du jour dans la période (1-based), ou null si hors période. */
export function dayNumber(key, startKey, endKey) {
  if (!isInPeriod(key, startKey, endKey)) return null;
  const n = diffDays(startKey, key);
  return n === null ? null : n + 1;
}

export function prevDayKey(key, startKey, endKey) {
  const p = addDays(key, -1);
  return p && isInPeriod(p, startKey, endKey) ? p : null;
}

export function nextDayKey(key, startKey, endKey) {
  const n = addDays(key, 1);
  return n && isInPeriod(n, startKey, endKey) ? n : null;
}

/** Jour de la semaine, 0 = lundi ... 6 = dimanche. */
export function weekdayMonday(key) {
  const d = parseDateKey(key);
  if (!d) return null;
  return (d.getDay() + 6) % 7;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « Lundi 21 septembre » */
export function formatLongDate(key) {
  const d = parseDateKey(key);
  if (!d) return '';
  const s = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return capitalize(s);
}

/** « 21 sept. » */
export function formatMediumDate(key) {
  const d = parseDateKey(key);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}

/** « 21/09/2026 » */
export function formatShortDate(key) {
  const d = parseDateKey(key);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** « 21/09 » (abscisse du graphique) */
export function formatChartDate(key) {
  const d = parseDateKey(key);
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** Mois abrégé sans point final parasite : « sept. », « oct. » */
export function monthShort(key) {
  const d = parseDateKey(key);
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d);
}

/* ------------------------------------------------------------------ */
/* Nombres                                                             */
/* ------------------------------------------------------------------ */

/**
 * Accepte la virgule ET le point (clavier iPhone français).
 * Renvoie un nombre fini, ou null si la saisie n'est pas un nombre.
 */
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  const cleaned = input
    .replace(/[\s   ]/g, '') // espaces, y compris insécables
    .replace(',', '.')
    .trim();
  if (cleaned === '') return null;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const nfInt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfUpTo1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Nombre entier au format français : 1050 -> « 1 050 » */
export function formatInt(n) {
  return nfInt.format(Math.round(n || 0));
}

/** « 1 050 kcal » (kcal à l'unité) */
export function formatKcal(n) {
  return `${formatInt(n)} kcal`;
}

/** « 36,0 g » (protéines à 0,1 g) */
export function formatProt(n) {
  return `${nf1.format(round1(n || 0))} g`;
}

/** « 300 g » / « 12,5 g » pour les quantités (au plus une décimale) */
export function formatGrams(n) {
  return `${nfUpTo1.format(n || 0)} g`;
}

/** « 300 g », « 2 unités », « 1 unité » selon l'unité de l'aliment. */
export function formatQuantity(n, unit) {
  const value = n || 0;
  if (normalizeUnit(unit) !== 'piece') return formatGrams(value);
  return `${nfUpTo1.format(value)} ${value > 1 ? 'unités' : 'unité'}`;
}

/** Suffixe des valeurs de référence : « / 100 g » ou « / unité ». */
export function perLabel(unit) {
  return normalizeUnit(unit) === 'piece' ? '/ unité' : '/ 100 g';
}

/** Libellé de l'unité de saisie : « g » ou « u. ». */
export function unitLabel(unit) {
  return normalizeUnit(unit) === 'piece' ? 'u.' : 'g';
}

export function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

// `grams` porte la quantité saisie : des grammes, ou un nombre d'unités si
// l'aliment se compte à l'unité. La division se fait par la quantité de référence.
export function entryKcal(entry) {
  if (!entry) return 0;
  return ((Number(entry.kcal100) || 0) * (Number(entry.grams) || 0)) / refQuantity(entry.unit);
}

export function entryProt(entry) {
  if (!entry) return 0;
  return ((Number(entry.prot100) || 0) * (Number(entry.grams) || 0)) / refQuantity(entry.unit);
}

/** Totaux bruts (non arrondis) d'une liste d'entrées. */
export function totalsOfEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let kcal = 0;
  let prot = 0;
  for (const e of list) {
    kcal += entryKcal(e);
    prot += entryProt(e);
  }
  return { kcal, prot };
}

export function mealTotals(day, mealKey) {
  return totalsOfEntries(day ? day[mealKey] : []);
}

/** Totaux bruts d'une journée (toutes sections). */
export function dayTotals(day) {
  let kcal = 0;
  let prot = 0;
  for (const key of MEAL_KEYS) {
    const t = totalsOfEntries(day ? day[key] : []);
    kcal += t.kcal;
    prot += t.prot;
  }
  return { kcal, prot };
}

export function dayIsEmpty(day) {
  if (!day) return true;
  return MEAL_KEYS.every((k) => !Array.isArray(day[k]) || day[k].length === 0);
}

export function emptyDay() {
  const d = {};
  for (const k of MEAL_KEYS) d[k] = [];
  return d;
}

/**
 * Moyenne par jour depuis le début de la période, sur les jours écoulés.
 * Au jour 5, c'est la moyenne des 5 premiers jours — les journées vides comptent
 * pour 0, sinon la moyenne ne voudrait rien dire.
 * @returns {{days:number, kcal:number, prot:number}|null} null avant le début.
 */
export function periodAverage(days, startKey, endKey, today) {
  const total = periodLength(startKey, endKey);
  if (total === 0 || !isDateKey(today)) return null;
  if (today < startKey) return null;

  const elapsed = today > endKey ? total : dayNumber(today, startKey, endKey);
  if (!elapsed) return null;

  let kcal = 0;
  let prot = 0;
  for (let i = 0; i < elapsed; i++) {
    const t = dayTotals(days ? days[addDays(startKey, i)] : null);
    kcal += t.kcal;
    prot += t.prot;
  }
  return { days: elapsed, kcal: kcal / elapsed, prot: prot / elapsed };
}

/** Série { key, kcal, prot } pour chaque jour de la période. */
export function periodSeries(days, startKey, endKey) {
  return periodDays(startKey, endKey).map((key) => {
    const t = dayTotals(days ? days[key] : null);
    return { key, kcal: t.kcal, prot: t.prot, empty: dayIsEmpty(days ? days[key] : null) };
  });
}

/* ------------------------------------------------------------------ */
/* Texte : recherche insensible à la casse et aux accents              */
/* ------------------------------------------------------------------ */

export function fold(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeName(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

export function searchFoods(foods, query) {
  const q = fold(query);
  const list = Array.isArray(foods) ? foods : [];
  if (!q) return list.slice();
  return list.filter((f) => fold(f.name).includes(q));
}

/** Nombre d'utilisations de chaque aliment, toutes journées confondues. */
export function foodUsageCounts(days) {
  const counts = Object.create(null);
  if (!days) return counts;
  for (const key of Object.keys(days)) {
    const day = days[key];
    if (!day) continue;
    for (const meal of MEAL_KEYS) {
      const entries = day[meal];
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (!e || !e.foodId) continue;
        counts[e.foodId] = (counts[e.foodId] || 0) + 1;
      }
    }
  }
  return counts;
}

const collator = new Intl.Collator('fr-FR', { sensitivity: 'base' });

export function sortFoodsAlpha(foods) {
  return (Array.isArray(foods) ? foods.slice() : []).sort((a, b) => collator.compare(a.name, b.name));
}

/** Les plus utilisés d'abord, puis par ordre alphabétique. */
export function sortFoodsByUsage(foods, counts) {
  const c = counts || {};
  return (Array.isArray(foods) ? foods.slice() : []).sort((a, b) => {
    const ca = c[a.id] || 0;
    const cb = c[b.id] || 0;
    if (ca !== cb) return cb - ca;
    return collator.compare(a.name, b.name);
  });
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Valide la saisie d'un aliment.
 * @returns {{ok:boolean, errors:Object, value?:{name:string,kcal100:number,prot100:number}}}
 */
export function validateFood(input, foods = [], excludeId = null) {
  const errors = {};
  const name = normalizeName(input && input.name);
  if (!name) {
    errors.name = 'Donne un nom à cet aliment.';
  } else if (name.length > LIMITS.nameMax) {
    errors.name = `${LIMITS.nameMax} caractères maximum.`;
  } else {
    const exists = (Array.isArray(foods) ? foods : []).some(
      (f) => f && f.id !== excludeId && fold(f.name) === fold(name)
    );
    if (exists) errors.name = 'Cet aliment existe déjà.';
  }

  const unit = normalizeUnit(input && input.unit);
  const max = valueLimits(unit);
  const pour = unit === 'piece' ? 'par unité' : 'pour 100 g';

  const kcal100 = parseNumber(input && input.kcal100);
  if (kcal100 === null) {
    errors.kcal100 = `Indique les calories ${pour}.`;
  } else if (kcal100 < 0 || kcal100 > max.kcal) {
    errors.kcal100 = `Entre 0 et ${formatInt(max.kcal)} kcal.`;
  }

  const prot100 = parseNumber(input && input.prot100);
  if (prot100 === null) {
    errors.prot100 = `Indique les protéines ${pour}.`;
  } else if (prot100 < 0 || prot100 > max.prot) {
    errors.prot100 = `Entre 0 et ${formatInt(max.prot)} g.`;
  }

  const ok = Object.keys(errors).length === 0;
  return ok ? { ok, errors, value: { name, unit, kcal100, prot100 } } : { ok, errors };
}

/** Quantité : > 0, et bornée selon l'unité (5 000 g, ou 100 unités). */
export function validateQuantity(input, unit) {
  const value = parseNumber(input);
  if (value === null) return { ok: false, error: 'Indique une quantité.' };
  if (value <= 0) return { ok: false, error: 'La quantité doit être supérieure à 0.' };
  const max = quantityLimit(unit);
  if (value > max) {
    return {
      ok: false,
      error: `${formatInt(max)} ${normalizeUnit(unit) === 'piece' ? 'unités' : 'g'} maximum.`,
    };
  }
  return { ok: true, value };
}

/** Objectif quotidien optionnel : vide -> null. */
export function validateGoal(input, max) {
  const raw = typeof input === 'string' ? input.trim() : input;
  if (raw === '' || raw === null || raw === undefined) return { ok: true, value: null };
  const n = parseNumber(raw);
  if (n === null) return { ok: false, error: 'Nombre invalide.' };
  if (n <= 0) return { ok: false, error: 'Doit être supérieur à 0.' };
  if (max && n > max) return { ok: false, error: `${formatInt(max)} maximum.` };
  return { ok: true, value: n };
}

/** Période : début <= fin, et au plus 366 jours. */
export function validatePeriod(startKey, endKey) {
  if (!isDateKey(startKey) || !isDateKey(endKey)) {
    return { ok: false, error: 'Dates invalides.' };
  }
  if (startKey > endKey) {
    return { ok: false, error: 'La date de fin doit suivre la date de début.' };
  }
  if (periodLength(startKey, endKey) > 366) {
    return { ok: false, error: '366 jours maximum.' };
  }
  return { ok: true, value: { startDate: startKey, endDate: endKey } };
}

/* ------------------------------------------------------------------ */
/* Données : valeurs par défaut, migration, validation d'un import     */
/* ------------------------------------------------------------------ */

export function defaultSettings() {
  return {
    theme: 'auto',
    startDate: DEFAULT_START,
    endDate: DEFAULT_END,
    goalKcal: null,
    goalProt: null,
  };
}

export function defaultData() {
  return {
    version: SCHEMA_VERSION,
    settings: defaultSettings(),
    foods: [],
    days: {},
  };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanEntry(raw) {
  if (!isPlainObject(raw)) return null;
  const unit = normalizeUnit(raw.unit);
  const max = valueLimits(unit);
  const grams = parseNumber(raw.grams);
  const kcal100 = parseNumber(raw.kcal100);
  const prot100 = parseNumber(raw.prot100);
  const name = normalizeName(raw.name);
  if (!name || grams === null || kcal100 === null || prot100 === null) return null;
  if (grams <= 0 || grams > quantityLimit(unit)) return null;
  if (kcal100 < 0 || kcal100 > max.kcal) return null;
  if (prot100 < 0 || prot100 > max.prot) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    foodId: typeof raw.foodId === 'string' ? raw.foodId : null,
    name: name.slice(0, LIMITS.nameMax),
    unit,
    grams,
    kcal100,
    prot100,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function cleanFood(raw) {
  if (!isPlainObject(raw)) return null;
  const unit = normalizeUnit(raw.unit);
  const max = valueLimits(unit);
  const name = normalizeName(raw.name);
  const kcal100 = parseNumber(raw.kcal100);
  const prot100 = parseNumber(raw.prot100);
  if (!name || kcal100 === null || prot100 === null) return null;
  if (kcal100 < 0 || kcal100 > max.kcal) return null;
  if (prot100 < 0 || prot100 > max.prot) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: name.slice(0, LIMITS.nameMax),
    unit,
    kcal100,
    prot100,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

/**
 * Vérifie et normalise un objet de données (venant du stockage ou d'un import).
 * @returns {{ok:true, data:Object, summary:{foods:number, days:number}}|{ok:false, error:string}}
 */
export function validateData(raw) {
  if (!isPlainObject(raw)) return { ok: false, error: "Ce fichier n’est pas une sauvegarde de l’app." };

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "Ce fichier n’est pas une sauvegarde de l’app." };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Sauvegarde version ${version} : trop récente pour cette version de l’app.`,
    };
  }

  if (!isPlainObject(raw.settings)) return { ok: false, error: 'Paramètres manquants ou illisibles.' };
  if (!Array.isArray(raw.foods)) return { ok: false, error: 'Liste des aliments manquante ou illisible.' };
  if (!isPlainObject(raw.days)) return { ok: false, error: 'Journées manquantes ou illisibles.' };

  const s = raw.settings;
  const settings = defaultSettings();
  if (THEMES.includes(s.theme)) settings.theme = s.theme;
  if (isDateKey(s.startDate)) settings.startDate = s.startDate;
  if (isDateKey(s.endDate)) settings.endDate = s.endDate;
  if (settings.startDate > settings.endDate) {
    return { ok: false, error: 'Période invalide dans la sauvegarde.' };
  }
  const gk = s.goalKcal === null || s.goalKcal === undefined ? null : parseNumber(s.goalKcal);
  const gp = s.goalProt === null || s.goalProt === undefined ? null : parseNumber(s.goalProt);
  settings.goalKcal = gk !== null && gk > 0 ? gk : null;
  settings.goalProt = gp !== null && gp > 0 ? gp : null;

  const foods = [];
  const seenIds = new Set();
  for (const f of raw.foods) {
    const clean = cleanFood(f);
    if (!clean) return { ok: false, error: 'Un aliment de la sauvegarde est illisible.' };
    if (seenIds.has(clean.id)) return { ok: false, error: 'Deux aliments ont le même identifiant.' };
    seenIds.add(clean.id);
    foods.push(clean);
  }

  const days = {};
  let filledDays = 0;
  for (const key of Object.keys(raw.days)) {
    if (!isDateKey(key)) return { ok: false, error: `Date illisible dans la sauvegarde : ${key}` };
    const rawDay = raw.days[key];
    if (!isPlainObject(rawDay)) return { ok: false, error: `Journée illisible : ${key}` };
    const day = emptyDay();
    for (const meal of MEAL_KEYS) {
      const entries = rawDay[meal];
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) return { ok: false, error: `Section illisible : ${key} / ${meal}` };
      for (const e of entries) {
        const clean = cleanEntry(e);
        if (!clean) return { ok: false, error: `Entrée illisible dans la journée ${key}.` };
        day[meal].push(clean);
      }
    }
    if (!dayIsEmpty(day)) filledDays += 1;
    days[key] = day;
  }

  return {
    ok: true,
    data: { version: SCHEMA_VERSION, settings, foods, days },
    summary: { foods: foods.length, days: filledDays },
  };
}

/**
 * Migration du schéma. Version 1 pour l'instant ; les futures versions
 * s'ajoutent ici, étape par étape.
 * @returns {Object|null} données à la version courante, ou null si illisible.
 */
export function migrate(raw) {
  if (!isPlainObject(raw)) return null;
  let data = raw;

  // v1 -> v2 : les aliments peuvent se compter à l'unité. Tout ce qui existait
  // était en grammes ; `normalizeUnit` donne déjà 'g' par défaut, la migration se
  // contente donc de marquer la version pour que le reste de la validation suive.
  if (data.version === 1) {
    data = { ...data, version: 2 };
  }

  if (typeof data.version !== 'number' || data.version > SCHEMA_VERSION) return null;

  const res = validateData(data);
  return res.ok ? res.data : null;
}

/* ------------------------------------------------------------------ */
/* Graphique                                                           */
/* ------------------------------------------------------------------ */

/**
 * Échelle « ronde » pour l'axe des ordonnées.
 * @returns {{max:number, ticks:number[]}} 3 graduations au-dessus de 0.
 */
export function chartScale(maxValue, goal = null, steps = 3) {
  const target = Math.max(maxValue || 0, goal || 0);
  if (!(target > 0)) {
    return { max: steps, ticks: Array.from({ length: steps }, (_, i) => i + 1) };
  }
  const rough = target / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let step = mag * 10;
  for (const c of candidates) {
    if (mag * c >= rough) {
      step = mag * c;
      break;
    }
  }
  const max = step * steps;
  const ticks = [];
  for (let i = 1; i <= steps; i++) ticks.push(round1(step * i));
  return { max, ticks };
}

/** Pourcentage de progression, borné à 100 pour la barre. */
export function progressPercent(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (value / goal) * 100));
}
