import './_tz.js'; // doit rester le premier import
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../js/logic.js';

/** Enlève toutes les espaces (y compris insécables fines) pour comparer du texte formaté. */
const ns = (s) => s.replace(/[\s   ]/g, ' ');

test('le fuseau des tests est bien Europe/Paris', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Paris');
});

/* ------------------------------------------------------------------ */
test('sections : les 5 repas, dans l’ordre, avec les bons libellés', () => {
  assert.deepEqual(L.MEAL_KEYS, ['petitdej', 'midi', 'gouter', 'soir', 'grignotage']);
  assert.deepEqual(
    L.MEALS.map((m) => m.label),
    ['Petit-déj', 'Repas midi', 'Goûter', 'Repas soir', 'Grignotage']
  );
});

/* ------------------------------------------------------------------ */
/* Calculs et arrondis                                                 */
/* ------------------------------------------------------------------ */

const pates = { kcal100: 350, prot100: 12 };
const entry = (grams, food = pates) => ({ ...food, grams, id: 'x', name: 'Pâtes' });

test('calcul d’une entrée : kcal et protéines proportionnels aux grammes', () => {
  assert.equal(L.entryKcal(entry(300)), 1050);
  assert.equal(L.entryProt(entry(300)), 36);
  assert.equal(L.entryKcal(entry(0)), 0);
  assert.equal(L.entryKcal(entry(75)), 262.5);
  assert.equal(L.entryProt(entry(133)), 15.96);
});

test('les totaux se calculent sur les valeurs brutes, pas sur les valeurs arrondies', () => {
  // 3 x 16,666 g de protéines : arrondir d'abord donnerait 50,1 au lieu de 50,0
  const e = { kcal100: 0, prot100: 33.333, grams: 50 };
  const total = L.totalsOfEntries([e, e, e]);
  assert.equal(L.round1(total.prot), 50);
  assert.equal(L.formatProt(total.prot), '50,0 g');
});

test('sous-totaux par repas et total de la journée', () => {
  const day = L.emptyDay();
  day.midi.push(entry(200)); // 700 kcal / 24 g
  day.soir.push(entry(300)); // 1050 kcal / 36 g
  day.soir.push(entry(100)); // 350 kcal / 12 g

  assert.deepEqual(L.mealTotals(day, 'midi'), { kcal: 700, prot: 24 });
  assert.deepEqual(L.mealTotals(day, 'soir'), { kcal: 1400, prot: 48 });
  assert.deepEqual(L.mealTotals(day, 'petitdej'), { kcal: 0, prot: 0 });

  const total = L.dayTotals(day);
  assert.equal(total.kcal, 2100);
  assert.equal(total.prot, 72);
});

test('journée vide', () => {
  assert.equal(L.dayIsEmpty(null), true);
  assert.equal(L.dayIsEmpty(L.emptyDay()), true);
  const day = L.emptyDay();
  day.gouter.push(entry(10));
  assert.equal(L.dayIsEmpty(day), false);
});

test('affichage : kcal à l’unité, protéines à 0,1 g, format français', () => {
  assert.equal(ns(L.formatKcal(1050)), '1 050 kcal');
  assert.equal(ns(L.formatKcal(2850.4)), '2 850 kcal');
  assert.equal(ns(L.formatKcal(2850.6)), '2 851 kcal');
  assert.equal(L.formatProt(36), '36,0 g');
  assert.equal(L.formatProt(12.54), '12,5 g');
  assert.equal(L.formatProt(12.55), '12,6 g');
  assert.equal(L.formatGrams(300), '300 g');
  assert.equal(L.formatGrams(12.5), '12,5 g');
  assert.equal(ns(L.formatInt(2850)), '2 850');
});

/* ------------------------------------------------------------------ */
/* Parsing des nombres                                                 */
/* ------------------------------------------------------------------ */

test('parseNumber accepte la virgule et le point', () => {
  assert.equal(L.parseNumber('12,5'), 12.5);
  assert.equal(L.parseNumber('12.5'), 12.5);
  assert.equal(L.parseNumber('300'), 300);
  assert.equal(L.parseNumber(' 300 '), 300);
  assert.equal(L.parseNumber('0'), 0);
  assert.equal(L.parseNumber('0,5'), 0.5);
  assert.equal(L.parseNumber(',5'), 0.5);
  assert.equal(L.parseNumber('12,'), 12);
  assert.equal(L.parseNumber('1 050'), 1050); // espace insécable du clavier / du copier-coller
  assert.equal(L.parseNumber('1 050'), 1050);
  assert.equal(L.parseNumber(350), 350);
});

test('parseNumber refuse ce qui n’est pas un nombre', () => {
  for (const bad of ['', '   ', 'abc', '12a', '1,2,3', '1.2.3', '--3', '1e5', null, undefined, NaN, Infinity, {}, []]) {
    assert.equal(L.parseNumber(bad), null, `devrait refuser : ${JSON.stringify(bad)}`);
  }
});

/* ------------------------------------------------------------------ */
/* Dates : clés locales, période, bornes                               */
/* ------------------------------------------------------------------ */

test('clé de date en heure locale à 23 h 30 et à 0 h 30 (Europe/Paris)', () => {
  const soir = new Date(2026, 8, 21, 23, 30, 0);
  const nuit = new Date(2026, 8, 21, 0, 30, 0);
  assert.equal(L.dateKey(soir), '2026-09-21');
  assert.equal(L.dateKey(nuit), '2026-09-21');

  // toISOString aurait décalé la nuit d'un jour : c'est exactement le piège à éviter.
  assert.equal(nuit.toISOString().slice(0, 10), '2026-09-20');
  assert.notEqual(L.dateKey(nuit), nuit.toISOString().slice(0, 10));

  // Même vérification en heure d'hiver (UTC+1).
  const hiver = new Date(2026, 11, 31, 0, 30, 0);
  assert.equal(L.dateKey(hiver), '2026-12-31');
  assert.equal(hiver.toISOString().slice(0, 10), '2026-12-30');
});

test('todayKey suit l’horloge locale', () => {
  assert.equal(L.todayKey(new Date(2026, 9, 21, 0, 30)), '2026-10-21');
  assert.equal(L.todayKey(new Date(2026, 9, 21, 23, 30)), '2026-10-21');
});

test('parseDateKey et isDateKey', () => {
  const d = L.parseDateKey('2026-09-21');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 21);
  assert.equal(d.getHours(), 0);

  assert.equal(L.isDateKey('2026-09-21'), true);
  assert.equal(L.isDateKey('2026-02-30'), false);
  assert.equal(L.isDateKey('2026-13-01'), false);
  assert.equal(L.isDateKey('21/09/2026'), false);
  assert.equal(L.isDateKey(''), false);
  assert.equal(L.isDateKey(null), false);
});

test('addDays et diffDays traversent le changement d’heure sans se décaler', () => {
  assert.equal(L.addDays('2026-09-21', 1), '2026-09-22');
  assert.equal(L.addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(L.addDays('2026-10-01', -1), '2026-09-30');
  // Passage à l'heure d'hiver 2026 : nuit du 24 au 25 octobre.
  assert.equal(L.addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(L.diffDays('2026-10-24', '2026-10-26'), 2);
  assert.equal(L.diffDays('2026-09-21', '2026-10-21'), 30);
  assert.equal(L.diffDays('2026-10-21', '2026-09-21'), -30);
});

test('la période par défaut fait 31 jours, du lundi 21/09 au mercredi 21/10', () => {
  const days = L.periodDays(L.DEFAULT_START, L.DEFAULT_END);
  assert.equal(days.length, 31);
  assert.equal(L.periodLength(L.DEFAULT_START, L.DEFAULT_END), 31);
  assert.equal(days[0], '2026-09-21');
  assert.equal(days[30], '2026-10-21');
  assert.equal(L.weekdayMonday('2026-09-21'), 0); // lundi
  assert.equal(L.weekdayMonday('2026-10-21'), 2); // mercredi
  // 5 lignes de 7 colonnes suffisent (décalage 0 + 31 jours = 31 cases).
  assert.equal(Math.ceil((L.weekdayMonday(days[0]) + days.length) / 7), 5);
});

test('numéro du jour dans la période', () => {
  assert.equal(L.dayNumber('2026-09-21', L.DEFAULT_START, L.DEFAULT_END), 1);
  assert.equal(L.dayNumber('2026-09-30', L.DEFAULT_START, L.DEFAULT_END), 10);
  assert.equal(L.dayNumber('2026-10-21', L.DEFAULT_START, L.DEFAULT_END), 31);
  assert.equal(L.dayNumber('2026-09-20', L.DEFAULT_START, L.DEFAULT_END), null);
  assert.equal(L.dayNumber('2026-10-22', L.DEFAULT_START, L.DEFAULT_END), null);
});

test('jour précédent / suivant bornés à la période', () => {
  const s = L.DEFAULT_START;
  const e = L.DEFAULT_END;
  assert.equal(L.prevDayKey(s, s, e), null, 'pas de jour avant le début');
  assert.equal(L.nextDayKey(s, s, e), '2026-09-22');
  assert.equal(L.prevDayKey(e, s, e), '2026-10-20');
  assert.equal(L.nextDayKey(e, s, e), null, 'pas de jour après la fin');
  assert.equal(L.prevDayKey('2026-10-01', s, e), '2026-09-30');
  assert.equal(L.nextDayKey('2026-09-30', s, e), '2026-10-01');
});

test('isInPeriod', () => {
  assert.equal(L.isInPeriod('2026-09-21', L.DEFAULT_START, L.DEFAULT_END), true);
  assert.equal(L.isInPeriod('2026-10-21', L.DEFAULT_START, L.DEFAULT_END), true);
  assert.equal(L.isInPeriod('2026-09-20', L.DEFAULT_START, L.DEFAULT_END), false);
  assert.equal(L.isInPeriod('2026-10-22', L.DEFAULT_START, L.DEFAULT_END), false);
});

test('dates en toutes lettres, en français', () => {
  assert.equal(L.formatLongDate('2026-09-21'), 'Lundi 21 septembre');
  assert.equal(L.formatLongDate('2026-10-01'), 'Jeudi 1 octobre');
  assert.equal(L.formatShortDate('2026-09-21'), '21/09/2026');
  assert.equal(L.formatChartDate('2026-10-01'), '01/10');
  assert.match(L.monthShort('2026-10-01'), /^oct/);
});

/* ------------------------------------------------------------------ */
/* Recherche et tri                                                    */
/* ------------------------------------------------------------------ */

const foods = [
  { id: 'a', name: 'Pâtes', kcal100: 350, prot100: 12 },
  { id: 'b', name: 'Œufs', kcal100: 143, prot100: 12.6 },
  { id: 'c', name: 'Riz complet', kcal100: 355, prot100: 7.5 },
];

test('recherche insensible à la casse et aux accents', () => {
  assert.deepEqual(L.searchFoods(foods, 'pate').map((f) => f.id), ['a']);
  assert.deepEqual(L.searchFoods(foods, 'PÂTES').map((f) => f.id), ['a']);
  assert.deepEqual(L.searchFoods(foods, 'oeu').map((f) => f.id), []);
  assert.deepEqual(L.searchFoods(foods, 'œuf').map((f) => f.id), ['b']);
  assert.deepEqual(L.searchFoods(foods, 'riz').map((f) => f.id), ['c']);
  assert.equal(L.searchFoods(foods, '').length, 3);
});

test('tri du sélecteur : les plus utilisés d’abord, puis alphabétique', () => {
  const days = {
    '2026-09-21': { ...L.emptyDay(), soir: [{ foodId: 'c' }, { foodId: 'c' }], midi: [{ foodId: 'a' }] },
  };
  const counts = L.foodUsageCounts(days);
  assert.deepEqual({ ...counts }, { c: 2, a: 1 });
  assert.deepEqual(L.sortFoodsByUsage(foods, counts).map((f) => f.id), ['c', 'a', 'b']);
  assert.deepEqual(L.sortFoodsAlpha(foods).map((f) => f.id), ['b', 'a', 'c']); // Œufs, Pâtes, Riz
});

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

test('nom d’aliment : obligatoire, rogné, 40 caractères max', () => {
  assert.equal(L.validateFood({ name: '  ', kcal100: '1', prot100: '1' }, []).ok, false);
  const ok = L.validateFood({ name: '  Pâtes  ', kcal100: '350', prot100: '12' }, []);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, 'Pâtes');
  const long = L.validateFood({ name: 'x'.repeat(41), kcal100: '1', prot100: '1' }, []);
  assert.equal(long.ok, false);
  assert.match(long.errors.name, /40/);
  assert.equal(L.validateFood({ name: 'x'.repeat(40), kcal100: '1', prot100: '1' }, []).ok, true);
});

test('nom d’aliment unique, sans tenir compte de la casse ni des accents', () => {
  const base = [{ id: 'a', name: 'Pâtes', kcal100: 350, prot100: 12 }];
  for (const dup of ['Pâtes', 'pâtes', 'PATES', 'pates', '  Pates  ']) {
    const res = L.validateFood({ name: dup, kcal100: '1', prot100: '1' }, base);
    assert.equal(res.ok, false, `doublon non détecté : ${dup}`);
    assert.match(res.errors.name, /existe déjà/);
  }
  assert.equal(L.validateFood({ name: 'Pâtes complètes', kcal100: '1', prot100: '1' }, base).ok, true);
  // On peut renommer un aliment sans qu'il se considère lui-même comme doublon.
  assert.equal(L.validateFood({ name: 'Pâtes', kcal100: '1', prot100: '1' }, base, 'a').ok, true);
});

test('bornes des valeurs pour 100 g', () => {
  const v = (kcal, prot) => L.validateFood({ name: 'Test', kcal100: kcal, prot100: prot }, []);
  assert.equal(v('0', '0').ok, true);
  assert.equal(v('900', '100').ok, true);
  assert.equal(v('901', '10').ok, false);
  assert.equal(v('-1', '10').ok, false);
  assert.equal(v('350', '101').ok, false);
  assert.equal(v('350', '-0,5').ok, false);
  assert.equal(v('', '10').ok, false);
  assert.equal(v('abc', '10').ok, false);
  // La virgule passe partout.
  const comma = v('349,5', '12,5');
  assert.equal(comma.ok, true);
  assert.equal(comma.value.kcal100, 349.5);
  assert.equal(comma.value.prot100, 12.5);
});

test('quantité : strictement positive et 5 000 g maximum', () => {
  assert.equal(L.validateGrams('300').value, 300);
  assert.equal(L.validateGrams('12,5').value, 12.5);
  assert.equal(L.validateGrams('5000').value, 5000);
  assert.equal(L.validateGrams('0').ok, false);
  assert.equal(L.validateGrams('-5').ok, false);
  assert.equal(L.validateGrams('5001').ok, false);
  assert.equal(L.validateGrams('').ok, false);
  assert.equal(L.validateGrams('abc').ok, false);
});

test('objectifs : vides = null, sinon nombre positif', () => {
  assert.deepEqual(L.validateGoal('', 20000), { ok: true, value: null });
  assert.deepEqual(L.validateGoal('   ', 20000), { ok: true, value: null });
  assert.deepEqual(L.validateGoal(null, 20000), { ok: true, value: null });
  assert.equal(L.validateGoal('3200', 20000).value, 3200);
  assert.equal(L.validateGoal('180,5', 1000).value, 180.5);
  assert.equal(L.validateGoal('0', 20000).ok, false);
  assert.equal(L.validateGoal('abc', 20000).ok, false);
});

test('période : début avant fin', () => {
  assert.equal(L.validatePeriod('2026-09-21', '2026-10-21').ok, true);
  assert.equal(L.validatePeriod('2026-09-21', '2026-09-21').ok, true);
  assert.equal(L.validatePeriod('2026-10-21', '2026-09-21').ok, false);
  assert.equal(L.validatePeriod('pas-une-date', '2026-09-21').ok, false);
  assert.equal(L.validatePeriod('2020-01-01', '2026-09-21').ok, false); // > 366 jours
});

/* ------------------------------------------------------------------ */
/* Import / migration                                                  */
/* ------------------------------------------------------------------ */

function validFile() {
  return {
    version: 1,
    settings: {
      theme: 'dark',
      startDate: '2026-09-21',
      endDate: '2026-10-21',
      goalKcal: 3200,
      goalProt: 180,
    },
    foods: [{ id: 'a', name: 'Pâtes', kcal100: 350, prot100: 12, createdAt: '2026-09-21T10:00:00.000Z' }],
    days: {
      '2026-09-21': {
        petitdej: [],
        midi: [
          { id: 'e1', foodId: 'a', name: 'Pâtes', grams: 300, kcal100: 350, prot100: 12, createdAt: '2026-09-21T12:00:00.000Z' },
        ],
        gouter: [],
        soir: [],
        grignotage: [],
      },
      '2026-09-22': L.emptyDay(),
    },
  };
}

test('import d’un fichier valide : résumé correct, données normalisées', () => {
  const res = L.validateData(validFile());
  assert.equal(res.ok, true);
  assert.deepEqual(res.summary, { foods: 1, days: 1 });
  assert.equal(res.data.version, 1);
  assert.equal(res.data.settings.theme, 'dark');
  assert.equal(res.data.settings.goalKcal, 3200);
  assert.equal(res.data.days['2026-09-21'].midi[0].grams, 300);
  assert.deepEqual(Object.keys(res.data.days['2026-09-21']).sort(), L.MEAL_KEYS.slice().sort());
});

test('import : fichiers invalides refusés', () => {
  const bad = [
    null,
    'texte',
    42,
    [],
    {},
    { version: 1 },
    { version: 1, settings: {}, foods: {}, days: {} },
    { version: 1, settings: {}, foods: [], days: [] },
    { version: 0, settings: {}, foods: [], days: {} },
    { version: 1, settings: {}, foods: [{ name: '', kcal100: 1, prot100: 1 }], days: {} },
    { version: 1, settings: {}, foods: [{ name: 'X', kcal100: 5000, prot100: 1 }], days: {} },
    { version: 1, settings: {}, foods: [], days: { 'pas-une-date': L.emptyDay() } },
    { version: 1, settings: {}, foods: [], days: { '2026-09-21': { midi: 'pas-un-tableau' } } },
    {
      version: 1,
      settings: {},
      foods: [],
      days: { '2026-09-21': { midi: [{ name: 'X', grams: 0, kcal100: 1, prot100: 1 }] } },
    },
    {
      version: 1,
      settings: { startDate: '2026-10-21', endDate: '2026-09-21' },
      foods: [],
      days: {},
    },
  ];
  for (const file of bad) {
    const res = L.validateData(file);
    assert.equal(res.ok, false, `aurait dû être refusé : ${JSON.stringify(file)}`);
    assert.equal(typeof res.error, 'string');
    assert.ok(res.error.length > 0);
  }
});

test('import : version inconnue (plus récente) refusée', () => {
  const file = validFile();
  file.version = 99;
  const res = L.validateData(file);
  assert.equal(res.ok, false);
  assert.match(res.error, /99/);
  assert.equal(L.migrate(file), null);
});

test('migration : la version 1 passe telle quelle, les données illisibles donnent null', () => {
  const migrated = L.migrate(validFile());
  assert.ok(migrated);
  assert.equal(migrated.version, L.SCHEMA_VERSION);
  assert.equal(migrated.foods.length, 1);
  assert.equal(L.migrate(null), null);
  assert.equal(L.migrate({ version: 2, settings: {}, foods: [], days: {} }), null);
  assert.equal(L.migrate({ foods: [] }), null);
});

test('migration : les sections manquantes sont recréées vides', () => {
  const file = validFile();
  delete file.days['2026-09-21'].gouter;
  const migrated = L.migrate(file);
  assert.deepEqual(migrated.days['2026-09-21'].gouter, []);
});

test('données par défaut : période du cahier des charges, base vide', () => {
  const d = L.defaultData();
  assert.equal(d.version, 1);
  assert.equal(d.settings.theme, 'auto');
  assert.equal(d.settings.startDate, '2026-09-21');
  assert.equal(d.settings.endDate, '2026-10-21');
  assert.equal(d.settings.goalKcal, null);
  assert.equal(d.settings.goalProt, null);
  assert.deepEqual(d.foods, []);
  assert.deepEqual(d.days, {});
  assert.equal(L.validateData(d).ok, true);
});

/* ------------------------------------------------------------------ */
/* Graphique                                                           */
/* ------------------------------------------------------------------ */

test('série du graphique : une valeur par jour de la période', () => {
  const days = { '2026-09-22': { ...L.emptyDay(), midi: [entry(300)] } };
  const series = L.periodSeries(days, L.DEFAULT_START, L.DEFAULT_END);
  assert.equal(series.length, 31);
  assert.equal(series[0].empty, true);
  assert.equal(series[1].empty, false);
  assert.equal(series[1].kcal, 1050);
  assert.equal(series[1].prot, 36);
});

test('échelle du graphique : graduations rondes qui englobent l’objectif', () => {
  const s1 = L.chartScale(2850, 3200, 3);
  assert.ok(s1.max >= 3200);
  assert.equal(s1.ticks.length, 3);
  assert.equal(s1.ticks[2], s1.max);
  const s2 = L.chartScale(0, null, 3);
  assert.ok(s2.max > 0);
  const s3 = L.chartScale(180, null, 3);
  assert.ok(s3.max >= 180);
});

test('progression bornée entre 0 et 100 %', () => {
  assert.equal(L.progressPercent(1600, 3200), 50);
  assert.equal(L.progressPercent(4000, 3200), 100);
  assert.equal(L.progressPercent(0, 3200), 0);
  assert.equal(L.progressPercent(100, null), 0);
});
