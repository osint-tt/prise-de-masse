// logic.js — logique pure : calculs, dates, parsing, validation.
// Aucun accès au DOM ni au stockage : ce fichier est importable par Node pour les tests.

export const APP_VERSION = '1.6.0';

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
  unitGramsMax: 2000,
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

/** « 1,4 kg » : une masse en grammes, arrondie à 100 g près. */
export function formatKg(grams) {
  return `${nf1.format(round1((grams || 0) / 1000))} kg`;
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

/**
 * Masse d'une entrée, en grammes.
 * - aliment au gramme : c'est la quantité saisie ;
 * - aliment à l'unité : le nombre d'unités × le poids d'une unité (`unitGrams`),
 *   quand ce poids est renseigné. Il ne se déduit d'aucune autre valeur : les
 *   calories d'un aliment à l'unité sont données par unité, pas pour 100 g.
 * @param {Object} entry
 * @param {Array} [foods] base d'aliments, pour retrouver le poids d'une unité
 *   des entrées saisies avant qu'il ne soit renseigné.
 * @returns {number} 0 quand le poids reste inconnu.
 */
export function entryGrams(entry, foods = null) {
  if (!entry) return 0;
  const quantity = Number(entry.grams) || 0;
  if (normalizeUnit(entry.unit) !== 'piece') return quantity;

  const own = Number(entry.unitGrams);
  if (Number.isFinite(own) && own > 0) return own * quantity;

  const food =
    Array.isArray(foods) && entry.foodId
      ? foods.find((f) => f && f.id === entry.foodId)
      : null;
  const known = food ? Number(food.unitGrams) : NaN;
  return Number.isFinite(known) && known > 0 ? known * quantity : 0;
}

/** Masse totale d'une journée, en grammes, toutes sections confondues. */
export function dayGrams(day, foods = null) {
  let grams = 0;
  for (const key of MEAL_KEYS) {
    const list = day && Array.isArray(day[key]) ? day[key] : [];
    for (const e of list) grams += entryGrams(e, foods);
  }
  return grams;
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
 * Moyenne par jour sur les journées terminées de la période.
 * Le jour en cours n'entre pas dans le calcul : au jour 4, c'est la moyenne des
 * 3 premiers jours. Les journées vides comptent pour 0, sinon la moyenne ne
 * voudrait rien dire.
 * @returns {{days:number, kcal:number, prot:number}|null} null avant le début et
 *   le premier jour, où aucune journée n'est encore terminée.
 */
export function periodAverage(days, startKey, endKey, today) {
  const total = periodLength(startKey, endKey);
  if (total === 0 || !isDateKey(today)) return null;
  if (today < startKey) return null;

  // Après la période, toutes les journées sont terminées.
  const elapsed = today > endKey ? total : dayNumber(today, startKey, endKey) - 1;
  if (!elapsed || elapsed < 1) return null;

  let kcal = 0;
  let prot = 0;
  for (let i = 0; i < elapsed; i++) {
    const t = dayTotals(days ? days[addDays(startKey, i)] : null);
    kcal += t.kcal;
    prot += t.prot;
  }
  return { days: elapsed, kcal: kcal / elapsed, prot: prot / elapsed };
}

/**
 * Cumul des `count` derniers jours, jour en cours compris, sans sortir de la
 * période. La fenêtre est raccourcie tant que la période n'a pas `count` jours
 * derrière elle, et se fige sur la fin de période une fois celle-ci passée.
 * @returns {{from:string, to:string, days:number, kcal:number, prot:number, grams:number}|null}
 *   null avant le début de la période.
 */
export function lastDaysTotals(days, foods, startKey, endKey, today, count = 7) {
  if (!isDateKey(today) || periodLength(startKey, endKey) === 0) return null;
  if (today < startKey) return null;

  const to = today > endKey ? endKey : today;
  const wanted = addDays(to, -(Math.max(1, count) - 1));
  const from = wanted < startKey ? startKey : wanted;
  const span = diffDays(from, to) + 1;

  let kcal = 0;
  let prot = 0;
  let grams = 0;
  for (let i = 0; i < span; i++) {
    const day = days ? days[addDays(from, i)] : null;
    const t = dayTotals(day);
    kcal += t.kcal;
    prot += t.prot;
    grams += dayGrams(day, foods);
  }
  return { from, to, days: span, kcal, prot, grams };
}

/** Série { key, kcal, prot } pour chaque jour de la période. */
export function periodSeries(days, startKey, endKey) {
  return periodDays(startKey, endKey).map((key) => {
    const t = dayTotals(days ? days[key] : null);
    return { key, kcal: t.kcal, prot: t.prot, empty: dayIsEmpty(days ? days[key] : null) };
  });
}

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */

/** « 21 – 27 sept. », « 28 sept. – 4 oct. », « 21 sept. » */
export function formatDayRange(from, to) {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return '';
  if (from === to) return formatMediumDate(from);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${formatMediumDate(to)}`;
  }
  return `${formatMediumDate(from)} – ${formatMediumDate(to)}`;
}

/**
 * Statistiques globales de la période, de son début à aujourd'hui.
 *
 * Deux règles, reprises de l'accueil :
 * - les cumuls (bilan, semaines, repas, aliments) comptent le jour en cours,
 *   comme la note des 7 derniers jours ;
 * - les records et les objectifs ne portent que sur les journées terminées,
 *   comme la moyenne : une journée à moitié saisie serait toujours « la moins
 *   calorique ». Les records ignorent en plus les journées vides, qui ne sont
 *   pas des journées légères mais des journées non saisies.
 * À égalité, un record revient à la première journée qui l'a atteint.
 *
 * @returns {Object|null} null avant le début de la période.
 */
export function periodStats(data, today, { topFoods = 5 } = {}) {
  const s = data && data.settings;
  if (!s || !isDateKey(today)) return null;
  const length = periodLength(s.startDate, s.endDate);
  if (length === 0 || today < s.startDate) return null;

  const days = (data && data.days) || {};
  const foods = Array.isArray(data.foods) ? data.foods : [];
  const over = today > s.endDate;
  const last = over ? s.endDate : today;

  const perDay = periodDays(s.startDate, last).map((key) => {
    const day = days[key] || null;
    const t = dayTotals(day);
    return {
      key,
      day,
      kcal: t.kcal,
      prot: t.prot,
      grams: dayGrams(day, foods),
      empty: dayIsEmpty(day),
      finished: over || key < today,
    };
  });

  // Bilan depuis le début.
  const totals = { kcal: 0, prot: 0, grams: 0 };
  let filled = 0;
  for (const d of perDay) {
    totals.kcal += d.kcal;
    totals.prot += d.prot;
    totals.grams += d.grams;
    if (!d.empty) filled += 1;
  }

  // Records : journées terminées et remplies.
  const done = perDay.filter((d) => d.finished && !d.empty);
  const best = (list, value, better) =>
    list.reduce((acc, d) => (acc === null || better(value(d), value(acc)) ? d : acc), null);
  const asRecord = (d, value) => (d ? { key: d.key, value: value(d) } : null);
  const plus = (a, b) => a > b;
  const moins = (a, b) => a < b;

  let records = null;
  if (done.length > 0) {
    let meal = null;
    for (const d of done) {
      for (const m of MEALS) {
        const kcal = mealTotals(d.day, m.key).kcal;
        if (kcal > 0 && (meal === null || kcal > meal.value)) {
          meal = { key: d.key, meal: m.key, label: m.label, value: kcal };
        }
      }
    }
    const weighed = done.filter((d) => d.grams > 0);
    records = {
      maxKcal: asRecord(best(done, (d) => d.kcal, plus), (d) => d.kcal),
      minKcal: asRecord(best(done, (d) => d.kcal, moins), (d) => d.kcal),
      maxProt: asRecord(best(done, (d) => d.prot, plus), (d) => d.prot),
      minProt: asRecord(best(done, (d) => d.prot, moins), (d) => d.prot),
      maxGrams: asRecord(best(weighed, (d) => d.grams, plus), (d) => d.grams),
      biggestMeal: meal,
    };
  }

  // Objectifs : sur les journées terminées, vides comprises (une journée non
  // saisie n'a pas atteint l'objectif). Comparés aux valeurs affichées, arrondies.
  const finished = perDay.filter((d) => d.finished);
  const goalCount = (goal, value) =>
    goal ? { goal, hit: finished.filter((d) => value(d) >= goal).length, of: finished.length } : null;
  const goals = {
    kcal: goalCount(s.goalKcal, (d) => Math.round(d.kcal)),
    prot: goalCount(s.goalProt, (d) => round1(d.prot)),
  };

  // Semaines du lundi au dimanche, rognées aux bornes de la période.
  const weeks = [];
  for (const d of perDay) {
    const monday = addDays(d.key, -weekdayMonday(d.key));
    let w = weeks[weeks.length - 1];
    if (!w || w.monday !== monday) {
      w = { monday, from: d.key, to: d.key, days: 0, filled: 0, kcal: 0, prot: 0, grams: 0 };
      weeks.push(w);
    }
    w.to = d.key;
    w.days += 1;
    if (!d.empty) w.filled += 1;
    w.kcal += d.kcal;
    w.prot += d.prot;
    w.grams += d.grams;
  }
  for (const w of weeks) {
    w.current = !over && w.from <= today && today <= w.to;
  }

  // Répartition des calories entre les repas.
  const meals = MEALS.map((m) => {
    let kcal = 0;
    let prot = 0;
    for (const d of perDay) {
      const t = mealTotals(d.day, m.key);
      kcal += t.kcal;
      prot += t.prot;
    }
    return { key: m.key, label: m.label, kcal, prot, share: totals.kcal > 0 ? kcal / totals.kcal : 0 };
  });

  // Aliments qui apportent le plus de calories. Regroupés par aliment de la base,
  // sous son nom actuel ; par nom pour une entrée sans lien vers la base.
  const byFood = new Map();
  for (const d of perDay) {
    for (const k of MEAL_KEYS) {
      const list = d.day && Array.isArray(d.day[k]) ? d.day[k] : [];
      for (const e of list) {
        const id = e.foodId ? `id:${e.foodId}` : `nom:${fold(e.name)}`;
        let f = byFood.get(id);
        if (!f) {
          const known = e.foodId ? foods.find((x) => x && x.id === e.foodId) : null;
          f = { name: known ? known.name : e.name, kcal: 0, prot: 0, grams: 0, count: 0 };
          byFood.set(id, f);
        }
        f.kcal += entryKcal(e);
        f.prot += entryProt(e);
        f.grams += entryGrams(e, foods);
        f.count += 1;
      }
    }
  }
  const top = [...byFood.values()]
    .sort((a, b) => b.kcal - a.kcal || collator.compare(a.name, b.name))
    .slice(0, Math.max(0, topFoods));

  return {
    from: s.startDate,
    to: last,
    length,
    elapsed: perDay.length,
    finished: finished.length,
    filled,
    totals,
    records,
    goals,
    weeks,
    meals,
    foods: top,
  };
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

  // Poids d'une unité : facultatif, et sans objet pour un aliment au gramme.
  let unitGrams = null;
  if (unit === 'piece' && !isBlank(input && input.unitGrams)) {
    const n = parseNumber(input.unitGrams);
    if (n === null || n <= 0) {
      errors.unitGrams = 'Indique un poids, ou laisse vide.';
    } else if (n > LIMITS.unitGramsMax) {
      errors.unitGrams = `${formatInt(LIMITS.unitGramsMax)} g maximum.`;
    } else {
      unitGrams = n;
    }
  }

  const ok = Object.keys(errors).length === 0;
  return ok ? { ok, errors, value: { name, unit, kcal100, prot100, unitGrams } } : { ok, errors };
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

/** Poids d'une unité relu depuis une sauvegarde : null s'il est absent ou aberrant. */
export function cleanUnitGrams(value, unit) {
  if (normalizeUnit(unit) !== 'piece' || isBlank(value)) return null;
  const n = parseNumber(value);
  if (n === null || n <= 0 || n > LIMITS.unitGramsMax) return null;
  return n;
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
    unitGrams: cleanUnitGrams(raw.unitGrams, unit),
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
    unitGrams: cleanUnitGrams(raw.unitGrams, unit),
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
 * Plancher de l'axe des ordonnées : en dessous, les journées se ressemblent toutes
 * et les écarts sont illisibles. Partir de 2 500 kcal / 60 g étale les barres.
 */
export const CHART_FLOORS = { kcal: 2500, prot: 60 };

/**
 * Plancher de l'axe pour une valeur affichée. Il s'applique toujours, quelles que
 * soient les données : c'est le réglage voulu. Une journée sous le plancher (une
 * journée légère, ou celle en cours à moitié saisie) est dessinée comme une amorce
 * sur la ligne du bas — son total exact reste lisible sur la carte du jour et au tap.
 */
export function chartFloor(metric) {
  return CHART_FLOORS[metric] || 0;
}

/**
 * Échelle « ronde » pour l'axe des ordonnées.
 * @param {number} floor valeur de départ de l'axe (0 = axe classique).
 * @returns {{min:number, max:number, ticks:number[]}} `steps` graduations au-dessus de min.
 */
export function chartScale(maxValue, goal = null, steps = 3, floor = 0) {
  const top = Math.max(maxValue || 0, goal || 0);
  const min = Math.max(floor, 0);

  // Tout est sous le plancher : on garde quand même un axe court au-dessus de lui,
  // pour que la grille et les étiquettes restent cohérentes.
  const rough = top > min ? (top - min) / steps : Math.max(min, steps) / (steps * 5);
  const step = niceStep(rough);
  const max = min + step * steps;

  const ticks = [];
  for (let i = 1; i <= steps; i++) ticks.push(round1(min + step * i));
  return { min, max, ticks };
}

/** Plus petit pas « rond » supérieur ou égal à la valeur demandée. */
function niceStep(rough) {
  if (!(rough > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const c of candidates) {
    if (mag * c >= rough) return mag * c;
  }
  return mag * 10;
}

/** Pourcentage de progression, borné à 100 pour la barre. */
export function progressPercent(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (value / goal) * 100));
}
