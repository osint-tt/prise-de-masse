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

test('masse du jour : les grammes s’additionnent, les unités pèsent leur poids', () => {
  const oeuf = { kcal100: 72, prot100: 6.3, unit: 'piece', unitGrams: 60, foodId: 'f-oeuf' };
  const day = L.emptyDay();
  day.petitdej.push({ ...entry(2, oeuf), unit: 'piece' }); // 2 œufs de 60 g
  day.midi.push(entry(250));
  day.soir.push(entry(300));
  day.gouter.push(entry(75.5));

  assert.equal(L.dayGrams(day), 745.5); // 120 + 625,5
  assert.equal(L.entryGrams({ ...entry(3, oeuf), unit: 'piece' }), 180);
  assert.equal(L.entryGrams(entry(250)), 250);
  assert.equal(L.entryGrams(null), 0);
  assert.equal(L.dayGrams(null), 0);
  assert.equal(L.dayGrams(L.emptyDay()), 0);
});

test('masse : un aliment à l’unité sans poids renseigné ne pèse rien', () => {
  const yaourt = { kcal100: 60, prot100: 4, unit: 'piece', foodId: 'f-yaourt' };
  const e = { ...entry(2, yaourt), unit: 'piece' };

  assert.equal(L.entryGrams(e), 0);
  assert.equal(L.entryGrams(e, []), 0);

  // Le poids renseigné après coup dans la base rattrape les entrées déjà saisies.
  const foods = [{ id: 'f-yaourt', unit: 'piece', unitGrams: 125 }];
  assert.equal(L.entryGrams(e, foods), 250);

  // Mais le poids copié sur l'entrée reste prioritaire.
  assert.equal(L.entryGrams({ ...e, unitGrams: 100 }, foods), 200);

  const day = L.emptyDay();
  day.gouter.push(e);
  assert.equal(L.dayGrams(day), 0);
  assert.equal(L.dayGrams(day, foods), 250);
});

test('poids d’une unité : facultatif, refusé s’il est absurde, ignoré au gramme', () => {
  const base = { name: 'Banane', unit: 'piece', kcal100: '105', prot100: '1,3' };

  assert.equal(L.validateFood(base).value.unitGrams, null); // absent = inconnu
  assert.equal(L.validateFood({ ...base, unitGrams: '' }).value.unitGrams, null);
  assert.equal(L.validateFood({ ...base, unitGrams: '120' }).value.unitGrams, 120);
  assert.equal(L.validateFood({ ...base, unitGrams: '62,5' }).value.unitGrams, 62.5);

  assert.equal(L.validateFood({ ...base, unitGrams: '0' }).ok, false);
  assert.equal(L.validateFood({ ...base, unitGrams: '-5' }).ok, false);
  assert.equal(L.validateFood({ ...base, unitGrams: 'abc' }).ok, false);
  assert.match(L.validateFood({ ...base, unitGrams: '2500' }).errors.unitGrams, /maximum/);

  // Un aliment au gramme n'a pas de poids d'unité : la valeur est ignorée.
  const grammes = { name: 'Pâtes', unit: 'g', kcal100: '350', prot100: '12', unitGrams: '120' };
  const res = L.validateFood(grammes);
  assert.equal(res.ok, true);
  assert.equal(res.value.unitGrams, null);
});

test('affichage d’une masse en kilos, arrondie à 0,1', () => {
  assert.equal(L.formatKg(625.5), '0,6 kg');
  assert.equal(L.formatKg(1450), '1,5 kg');
  assert.equal(L.formatKg(1440), '1,4 kg');
  assert.equal(L.formatKg(2000), '2,0 kg');
  assert.equal(L.formatKg(0), '0,0 kg');
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

/* ------------------------------------------------------------------ */
/* Aliments à l'unité                                                  */
/* ------------------------------------------------------------------ */

const oeuf = { unit: 'piece', kcal100: 72, prot100: 6.3 };

test('un aliment à l’unité se multiplie par la quantité, pas par 100', () => {
  assert.equal(L.refQuantity('piece'), 1);
  assert.equal(L.refQuantity('g'), 100);
  assert.equal(L.refQuantity(undefined), 100);

  const deuxOeufs = { ...oeuf, grams: 2 };
  assert.equal(L.entryKcal(deuxOeufs), 144);
  assert.equal(L.round1(L.entryProt(deuxOeufs)), 12.6);

  // Un demi-œuf reste possible.
  assert.equal(L.entryKcal({ ...oeuf, grams: 0.5 }), 36);

  // Sans unité, on reste sur les valeurs pour 100 g.
  assert.equal(L.entryKcal({ kcal100: 350, grams: 300 }), 1050);
});

test('les deux unités se mélangent dans une même journée', () => {
  const day = L.emptyDay();
  day.petitdej.push({ ...oeuf, grams: 3, name: 'Œuf' }); // 216 kcal / 18,9 g
  day.soir.push({ kcal100: 350, prot100: 12, grams: 200, name: 'Pâtes' }); // 700 kcal / 24 g
  const total = L.dayTotals(day);
  assert.equal(total.kcal, 916);
  assert.equal(L.round1(total.prot), 42.9);
});

test('affichage des quantités selon l’unité', () => {
  assert.equal(L.formatQuantity(300, 'g'), '300 g');
  assert.equal(L.formatQuantity(2, 'piece'), '2 unités');
  assert.equal(L.formatQuantity(1, 'piece'), '1 unité');
  assert.equal(L.formatQuantity(0.5, 'piece'), '0,5 unité');
  assert.equal(L.formatQuantity(300), '300 g');
  assert.equal(L.perLabel('piece'), '/ unité');
  assert.equal(L.perLabel('g'), '/ 100 g');
  assert.equal(L.unitLabel('piece'), 'u.');
  assert.equal(L.unitLabel('g'), 'g');
});

test('bornes de saisie élargies pour un aliment à l’unité', () => {
  const v = (unit, kcal, prot) => L.validateFood({ name: 'Test', unit, kcal100: kcal, prot100: prot }, []);
  // 950 kcal pour 100 g est impossible, mais pas pour une part entière.
  assert.equal(v('g', '950', '10').ok, false);
  assert.equal(v('piece', '950', '10').ok, true);
  assert.equal(v('piece', '2000', '200').ok, true);
  assert.equal(v('piece', '2001', '10').ok, false);
  assert.equal(v('piece', '100', '201').ok, false);
  assert.match(v('piece', '', '10').errors.kcal100, /par unité/);
  assert.match(v('g', '', '10').errors.kcal100, /pour 100 g/);
});

test('l’unité est conservée par la validation d’un aliment', () => {
  const res = L.validateFood({ name: 'Œuf', unit: 'piece', kcal100: '72', prot100: '6,3' }, []);
  assert.equal(res.ok, true);
  assert.deepEqual(res.value, {
    name: 'Œuf',
    unit: 'piece',
    kcal100: 72,
    prot100: 6.3,
    unitGrams: null,
  });
  // Une unité inconnue retombe sur le gramme.
  assert.equal(L.validateFood({ name: 'X', unit: 'litres', kcal100: '1', prot100: '1' }, []).value.unit, 'g');
});

test('quantité en grammes : strictement positive et 5 000 g maximum', () => {
  assert.equal(L.validateQuantity('300', 'g').value, 300);
  assert.equal(L.validateQuantity('12,5', 'g').value, 12.5);
  assert.equal(L.validateQuantity('5000', 'g').value, 5000);
  assert.equal(L.validateQuantity('0', 'g').ok, false);
  assert.equal(L.validateQuantity('-5', 'g').ok, false);
  assert.equal(L.validateQuantity('5001', 'g').ok, false);
  assert.equal(L.validateQuantity('', 'g').ok, false);
  assert.equal(L.validateQuantity('abc', 'g').ok, false);
  // L'unité par défaut est le gramme.
  assert.equal(L.validateQuantity('300').value, 300);
});

test('quantité en unités : strictement positive et 100 unités maximum', () => {
  assert.equal(L.validateQuantity('2', 'piece').value, 2);
  assert.equal(L.validateQuantity('0,5', 'piece').value, 0.5);
  assert.equal(L.validateQuantity('100', 'piece').value, 100);
  assert.equal(L.validateQuantity('101', 'piece').ok, false);
  assert.equal(L.validateQuantity('0', 'piece').ok, false);
  assert.match(L.validateQuantity('101', 'piece').error, /unités/);
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
  assert.equal(res.data.version, 2);
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

test('migration v1 -> v2 : les anciennes sauvegardes passent au gramme', () => {
  const file = validFile(); // écrit en version 1, sans champ « unit »
  assert.equal(file.version, 1);
  const migrated = L.migrate(file);
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.version, L.SCHEMA_VERSION);
  assert.equal(migrated.foods.length, 1);
  // Tout ce qui existait était en grammes : les calculs ne bougent pas.
  assert.equal(migrated.foods[0].unit, 'g');
  assert.equal(migrated.days['2026-09-21'].midi[0].unit, 'g');
  assert.equal(L.entryKcal(migrated.days['2026-09-21'].midi[0]), 1050);

  assert.equal(L.migrate(null), null);
  assert.equal(L.migrate({ version: 99, settings: {}, foods: [], days: {} }), null);
  assert.equal(L.migrate({ foods: [] }), null);
});

test('une sauvegarde en version 2 garde ses aliments à l’unité', () => {
  const file = validFile();
  file.version = 2;
  file.foods.push({ id: 'o', name: 'Œuf', unit: 'piece', kcal100: 72, prot100: 6.3, createdAt: '2026-09-21T10:00:00.000Z' });
  file.days['2026-09-21'].petitdej.push({
    id: 'e2', foodId: 'o', name: 'Œuf', unit: 'piece', grams: 2,
    kcal100: 72, prot100: 6.3, createdAt: '2026-09-21T08:00:00.000Z',
  });
  const migrated = L.migrate(file);
  assert.ok(migrated);
  assert.equal(migrated.foods[1].unit, 'piece');
  assert.equal(L.entryKcal(migrated.days['2026-09-21'].petitdej[0]), 144);
});

test('migration : les sections manquantes sont recréées vides', () => {
  const file = validFile();
  delete file.days['2026-09-21'].gouter;
  const migrated = L.migrate(file);
  assert.deepEqual(migrated.days['2026-09-21'].gouter, []);
});

test('données par défaut : période du cahier des charges, base vide', () => {
  const d = L.defaultData();
  assert.equal(d.version, 2);
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
/* Moyenne depuis le début de la période                               */
/* ------------------------------------------------------------------ */

const S = L.DEFAULT_START;
const E = L.DEFAULT_END;

/** n journées à 1 000 kcal / 50 g, à partir du 21/09. */
function daysOf(n) {
  const days = {};
  for (let i = 0; i < n; i++) {
    days[L.addDays(S, i)] = { ...L.emptyDay(), midi: [{ kcal100: 1000, prot100: 50, grams: 100 }] };
  }
  return days;
}

test('moyenne : au jour 4 on divise par 3, au jour 28 par 27', () => {
  // Le jour en cours ne compte pas : seules les journées terminées entrent dedans.
  const a = L.periodAverage(daysOf(4), S, E, '2026-09-24'); // 24/09 = jour 4
  assert.equal(a.days, 3);
  assert.equal(a.kcal, 1000);
  assert.equal(a.prot, 50);

  const b = L.periodAverage(daysOf(28), S, E, '2026-10-18'); // 18/10 = jour 28
  assert.equal(b.days, 27);
  assert.equal(b.kcal, 1000);
});

test('moyenne : ce qui est saisi aujourd’hui ne la change pas', () => {
  // 3 journées terminées remplies, plus une grosse journée en cours.
  const days = daysOf(3);
  days['2026-09-24'] = { ...L.emptyDay(), midi: [{ kcal100: 9000, prot100: 900, grams: 100 }] };
  const a = L.periodAverage(days, S, E, '2026-09-24');
  assert.equal(a.days, 3);
  assert.equal(a.kcal, 1000, 'la journée en cours est exclue');
});

test('moyenne : les journées vides comptent pour 0', () => {
  // 2 journées remplies sur 4 journées terminées (jour 5 en cours).
  const a = L.periodAverage(daysOf(2), S, E, '2026-09-25');
  assert.equal(a.days, 4);
  assert.equal(a.kcal, 500);
  assert.equal(a.prot, 25);
});

test('moyenne : pas de moyenne le premier jour', () => {
  // Aucune journée n'est encore terminée.
  assert.equal(L.periodAverage(daysOf(1), S, E, S), null);
  // Dès le deuxième jour, elle porte sur la première journée.
  const a = L.periodAverage(daysOf(1), S, E, '2026-09-22');
  assert.equal(a.days, 1);
  assert.equal(a.kcal, 1000);
});

test('moyenne : les jours à venir ne comptent pas', () => {
  // 10 journées saisies, mais on n'est qu'au jour 3.
  const a = L.periodAverage(daysOf(10), S, E, '2026-09-23');
  assert.equal(a.days, 2);
  assert.equal(a.kcal, 1000);
});

test('moyenne : hors période', () => {
  assert.equal(L.periodAverage(daysOf(3), S, E, '2026-09-20'), null, 'avant le début');
  // Après la fin, toutes les journées sont terminées : la période entière compte.
  const apres = L.periodAverage(daysOf(31), S, E, '2026-11-15');
  assert.equal(apres.days, 31);
  assert.equal(apres.kcal, 1000);
  assert.equal(L.periodAverage({}, S, E, 'pas-une-date'), null);
});

test('moyenne : base vide', () => {
  const a = L.periodAverage({}, S, E, '2026-09-25');
  assert.equal(a.days, 4);
  assert.equal(a.kcal, 0);
  assert.equal(a.prot, 0);
});

test('7 derniers jours : fenêtre glissante, jour en cours compris', () => {
  // 10 journées saisies à 1 000 kcal, on est au jour 10 (30/09).
  const r = L.lastDaysTotals(daysOf(10), [], S, E, '2026-09-30', 7);
  assert.equal(r.days, 7);
  assert.equal(r.from, '2026-09-24');
  assert.equal(r.to, '2026-09-30');
  assert.equal(r.kcal, 7000);
  assert.equal(r.prot, 350);

  // Ce qui est saisi aujourd'hui compte, lui : c'est un cumul, pas une moyenne.
  const days = daysOf(10);
  days['2026-09-30'].soir = [{ kcal100: 500, prot100: 10, grams: 100 }];
  assert.equal(L.lastDaysTotals(days, [], S, E, '2026-09-30', 7).kcal, 7500);
});

test('7 derniers jours : la fenêtre ne déborde pas de la période', () => {
  // Jour 3 : il n'y a que 3 journées derrière.
  const debut = L.lastDaysTotals(daysOf(3), [], S, E, '2026-09-23', 7);
  assert.equal(debut.days, 3);
  assert.equal(debut.from, S);
  assert.equal(debut.kcal, 3000);

  // Après la fin, la fenêtre se fige sur les 7 derniers jours de la période.
  const apres = L.lastDaysTotals(daysOf(31), [], S, E, '2026-11-15', 7);
  assert.equal(apres.days, 7);
  assert.equal(apres.to, E);
  assert.equal(apres.from, '2026-10-15');

  assert.equal(L.lastDaysTotals(daysOf(3), [], S, E, '2026-09-20', 7), null, 'avant le début');
  assert.equal(L.lastDaysTotals({}, [], S, E, 'pas-une-date', 7), null, 'date illisible');
});

test('7 derniers jours : les kilos suivent les mêmes règles que la journée', () => {
  const oeuf = { kcal100: 72, prot100: 6.3, unit: 'piece', foodId: 'f-oeuf', grams: 2 };
  const days = daysOf(3); // 3 x 100 g de l'aliment de test
  days['2026-09-21'].petitdej = [oeuf];

  // Sans poids connu, les œufs ne pèsent rien.
  assert.equal(L.lastDaysTotals(days, [], S, E, '2026-09-23', 7).grams, 300);

  // Avec le poids dans la base, ils comptent.
  const foods = [{ id: 'f-oeuf', unit: 'piece', unitGrams: 60 }];
  assert.equal(L.lastDaysTotals(days, foods, S, E, '2026-09-23', 7).grams, 420);
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

test('plancher du graphique : toujours 2 000 kcal et 60 g', () => {
  assert.equal(L.chartFloor('kcal'), L.CHART_FLOORS.kcal);
  assert.equal(L.chartFloor('prot'), L.CHART_FLOORS.prot);
  assert.equal(L.CHART_FLOORS.kcal, 2500, 'plancher calories');
  assert.equal(L.CHART_FLOORS.prot, 60, 'plancher proteines');
  assert.equal(L.chartFloor('autre'), 0);
});

test('échelle tronquée : l’axe part du plancher, les graduations suivent', () => {
  const kcal = L.chartScale(2400, 3200, 3, 2000);
  assert.equal(kcal.min, 2000);
  assert.equal(kcal.max, 3200);
  assert.deepEqual(kcal.ticks, [2400, 2800, 3200]);

  const prot = L.chartScale(175, 180, 3, 60);
  assert.equal(prot.min, 60);
  assert.equal(prot.max, 180);
  assert.deepEqual(prot.ticks, [100, 140, 180]);

  // Sans plancher, rien ne change par rapport à avant.
  const zero = L.chartScale(2850, 3200, 3, 0);
  assert.equal(zero.min, 0);
  assert.equal(zero.max, 3600);
});

test('échelle : le plancher tient même quand toutes les journées sont en dessous', () => {
  // Une journée à 500 kcal ne fait pas redescendre l'axe à 0 : c'est le réglage voulu.
  const maigre = L.chartScale(500, null, 3, 2000);
  assert.equal(maigre.min, 2000);
  assert.ok(maigre.max > 2000, 'l’axe garde une hauteur exploitable');
  assert.equal(maigre.ticks.length, 3);
  assert.ok(maigre.ticks.every((t) => t > 2000));

  // Avec un objectif, c'est lui qui fixe le haut.
  const avecObjectif = L.chartScale(500, 3200, 3, 2000);
  assert.equal(avecObjectif.min, 2000);
  assert.equal(avecObjectif.max, 3200);

  const prot = L.chartScale(20, null, 3, 60);
  assert.equal(prot.min, 60);
  assert.ok(prot.max > 60);
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

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */

/** Une journée d'une seule entrée au gramme, avec ses kcal et protéines totales. */
function oneEntryDay(kcal, prot, { meal = 'midi', grams = 100, foodId = 'f-test', name = 'Test' } = {}) {
  const day = L.emptyDay();
  day[meal].push({
    foodId,
    name,
    unit: 'g',
    grams,
    kcal100: (kcal * 100) / grams,
    prot100: (prot * 100) / grams,
  });
  return day;
}

function statsData(days, settings = {}) {
  return {
    version: 2,
    settings: { theme: 'auto', startDate: S, endDate: E, goalKcal: null, goalProt: null, ...settings },
    foods: [],
    days,
  };
}

test('stats : intervalle de dates lisible', () => {
  assert.equal(ns(L.formatDayRange('2026-09-21', '2026-09-27')), '21 – 27 sept.');
  assert.equal(ns(L.formatDayRange('2026-09-28', '2026-10-04')), '28 sept. – 4 oct.');
  assert.equal(ns(L.formatDayRange('2026-10-21', '2026-10-21')), '21 oct.');
  assert.equal(L.formatDayRange('pas', 'une date'), '');
});

test('stats : rien avant le début de la période', () => {
  assert.equal(L.periodStats(statsData({}), '2026-09-20'), null);
  assert.equal(L.periodStats(statsData({}), 'pas-une-date'), null);
  assert.equal(L.periodStats(null, '2026-09-25'), null);
});

test('stats : le bilan compte le jour en cours', () => {
  const days = {
    '2026-09-21': oneEntryDay(2500, 150),
    '2026-09-22': oneEntryDay(3000, 170),
    '2026-09-23': oneEntryDay(1000, 40), // jour en cours, à moitié saisi
  };
  const st = L.periodStats(statsData(days), '2026-09-23');
  assert.equal(st.elapsed, 3);
  assert.equal(st.finished, 2);
  assert.equal(st.filled, 3);
  assert.equal(Math.round(st.totals.kcal), 6500);
  assert.equal(Math.round(st.totals.prot), 360);
  assert.equal(st.totals.grams, 300);
});

test('stats : records sur les journées terminées et remplies seulement', () => {
  const days = {
    '2026-09-21': oneEntryDay(2800, 160),
    // 22/09 : rien saisi — une journée vide n'est pas « la moins calorique ».
    '2026-09-23': oneEntryDay(3400, 150, { grams: 900 }),
    '2026-09-24': oneEntryDay(2600, 190),
    '2026-09-25': oneEntryDay(500, 20), // jour en cours : exclu des records
  };
  const r = L.periodStats(statsData(days), '2026-09-25').records;

  assert.equal(r.maxKcal.key, '2026-09-23');
  assert.equal(Math.round(r.maxKcal.value), 3400);
  assert.equal(r.minKcal.key, '2026-09-24');
  assert.equal(Math.round(r.minKcal.value), 2600);
  assert.equal(r.maxProt.key, '2026-09-24');
  assert.equal(r.minProt.key, '2026-09-23');
  assert.deepEqual(r.maxGrams, { key: '2026-09-23', value: 900 });
  assert.equal(r.biggestMeal.key, '2026-09-23');
  assert.equal(r.biggestMeal.meal, 'midi');
  assert.equal(r.biggestMeal.label, 'Repas midi');
});

test('stats : à égalité, le record revient à la première journée', () => {
  const days = {
    '2026-09-21': oneEntryDay(3000, 150),
    '2026-09-22': oneEntryDay(3000, 150),
  };
  const r = L.periodStats(statsData(days), '2026-09-23').records;
  assert.equal(r.maxKcal.key, '2026-09-21');
  assert.equal(r.minKcal.key, '2026-09-21');
});

test('stats : pas de record le premier jour, ni de record de masse sans rien de pesé', () => {
  const premier = L.periodStats(statsData({ '2026-09-21': oneEntryDay(2000, 100) }), '2026-09-21');
  assert.equal(premier.records, null);
  assert.equal(premier.filled, 1);

  // Des œufs à l'unité sans poids connu : il y a des calories, mais aucune masse.
  const oeufs = L.emptyDay();
  oeufs.petitdej.push({ foodId: 'f-oeuf', name: 'Œuf', unit: 'piece', grams: 3, kcal100: 72, prot100: 6.3 });
  const r = L.periodStats(statsData({ '2026-09-21': oeufs }), '2026-09-22').records;
  assert.equal(r.maxKcal.value, 216);
  assert.equal(r.maxGrams, null);
});

test('stats : objectifs atteints, comparés aux valeurs affichées', () => {
  const days = {
    '2026-09-21': oneEntryDay(3199.6, 179.96), // s'affiche 3 200 kcal et 180,0 g : atteint
    '2026-09-22': oneEntryDay(3100, 185),
    // 23/09 non saisi : manqué
    '2026-09-24': oneEntryDay(9999, 999), // jour en cours : pas encore jugé
  };
  const st = L.periodStats(statsData(days, { goalKcal: 3200, goalProt: 180 }), '2026-09-24');
  assert.deepEqual(st.goals.kcal, { goal: 3200, hit: 1, of: 3 });
  assert.deepEqual(st.goals.prot, { goal: 180, hit: 2, of: 3 });

  const sans = L.periodStats(statsData(days), '2026-09-24');
  assert.equal(sans.goals.kcal, null);
  assert.equal(sans.goals.prot, null);
});

test('stats : semaines du lundi au dimanche, rognées à la période', () => {
  // Période du mercredi 16/09 au mercredi 30/09, vue le mardi 29/09.
  const days = {};
  for (let i = 0; i < 14; i++) days[L.addDays('2026-09-16', i)] = oneEntryDay(1000, 50);
  const data = statsData(days, { startDate: '2026-09-16', endDate: '2026-09-30' });
  const weeks = L.periodStats(data, '2026-09-29').weeks;

  assert.deepEqual(
    weeks.map((w) => [w.from, w.to, w.days, w.current]),
    [
      ['2026-09-16', '2026-09-20', 5, false], // du mercredi au dimanche
      ['2026-09-21', '2026-09-27', 7, false],
      ['2026-09-28', '2026-09-29', 2, true], // semaine en cours, jusqu'à aujourd'hui
    ]
  );
  assert.equal(Math.round(weeks[1].kcal), 7000);
  assert.equal(Math.round(weeks[1].prot), 350);
  assert.equal(weeks[1].grams, 700);

  // Une fois la période passée, plus rien n'est « en cours ».
  const apres = L.periodStats(data, '2026-11-01').weeks;
  assert.equal(apres[apres.length - 1].to, '2026-09-30');
  assert.ok(apres.every((w) => !w.current));
});

test('stats : répartition des calories entre les repas', () => {
  const day = L.emptyDay();
  day.petitdej.push({ unit: 'g', grams: 100, kcal100: 500, prot100: 20 });
  day.soir.push({ unit: 'g', grams: 100, kcal100: 1500, prot100: 60 });
  const meals = L.periodStats(statsData({ '2026-09-21': day }), '2026-09-21').meals;

  assert.deepEqual(
    meals.map((m) => m.key),
    ['petitdej', 'midi', 'gouter', 'soir', 'grignotage']
  );
  assert.equal(meals[0].share, 0.25);
  assert.equal(meals[3].share, 0.75);
  assert.equal(meals[1].share, 0);
  assert.equal(
    meals.reduce((s, m) => s + m.share, 0),
    1
  );
});

test('stats : aliments regroupés, sous leur nom actuel, classés par calories', () => {
  const d1 = oneEntryDay(700, 24, { foodId: 'f-pates', name: 'Pâtes', grams: 200 });
  d1.soir.push({ foodId: 'f-riz', name: 'Riz', unit: 'g', grams: 100, kcal100: 355, prot100: 7.5 });
  const d2 = oneEntryDay(1050, 36, { foodId: 'f-pates', name: 'Pâtes', grams: 300 });
  d2.gouter.push({ foodId: null, name: 'Banane', unit: 'g', grams: 120, kcal100: 89, prot100: 1.1 });
  d2.gouter.push({ foodId: null, name: 'banane', unit: 'g', grams: 120, kcal100: 89, prot100: 1.1 });

  const data = statsData({ '2026-09-21': d1, '2026-09-22': d2 });
  data.foods = [{ id: 'f-pates', name: 'Pâtes complètes', unit: 'g', kcal100: 350, prot100: 12 }];
  const foods = L.periodStats(data, '2026-09-22').foods;

  assert.deepEqual(
    foods.map((f) => [f.name, f.count, Math.round(f.kcal)]),
    [
      ['Pâtes complètes', 2, 1750], // renommé depuis : on affiche le nom actuel
      ['Riz', 1, 355],
      ['Banane', 2, 214], // sans lien vers la base : regroupé par nom, casse ignorée
    ]
  );
  assert.equal(foods[0].grams, 500);

  // La liste est limitée.
  assert.equal(L.periodStats(data, '2026-09-22', { topFoods: 1 }).foods.length, 1);
});

/* ------------------------------------------------------------------ */
/* Saisie libre                                                        */
/* ------------------------------------------------------------------ */

test('saisie libre : kcal et protéines directement, nom facultatif', () => {
  const res = L.validateFreeEntry({ name: '  Raclette   chez Léa ', kcal: '1250', prot: '45,5' });
  assert.equal(res.ok, true);
  assert.deepEqual(res.value, { name: 'Raclette chez Léa', kcal: 1250, prot: 45.5 });

  // Sans nom, le plat s'appelle « Plat ».
  assert.equal(L.validateFreeEntry({ name: '', kcal: '500', prot: '20' }).value.name, L.FREE_ENTRY_NAME);
  assert.equal(L.FREE_ENTRY_NAME, 'Plat');

  // Des protéines sans calories (ou l'inverse) sont acceptées.
  assert.equal(L.validateFreeEntry({ kcal: '0', prot: '25' }).ok, true);
  assert.equal(L.validateFreeEntry({ kcal: '300', prot: '0' }).ok, true);
});

test('saisie libre : champs obligatoires et bornes', () => {
  assert.match(L.validateFreeEntry({ kcal: '', prot: '20' }).errors.kcal, /calories/);
  assert.match(L.validateFreeEntry({ kcal: '500', prot: '' }).errors.prot, /protéines/);
  assert.match(L.validateFreeEntry({ kcal: 'beaucoup', prot: '20' }).errors.kcal, /calories/);
  assert.match(L.validateFreeEntry({ kcal: '6000', prot: '20' }).errors.kcal, /5\s000/);
  assert.match(L.validateFreeEntry({ kcal: '500', prot: '500' }).errors.prot, /400/);
  assert.equal(L.validateFreeEntry({ kcal: '-1', prot: '20' }).ok, false);
  assert.match(L.validateFreeEntry({ kcal: '0', prot: '0' }).errors.kcal, /rien/);
  assert.match(L.validateFreeEntry({ name: 'x'.repeat(41), kcal: '1', prot: '1' }).errors.name, /40/);
  // Un plat entier peut dépasser les 2 000 kcal d'une unité.
  assert.equal(L.validateFreeEntry({ kcal: '4800', prot: '150' }).ok, true);
});

test('saisie libre : l’entrée compte comme les autres, sans poids ni quantité', () => {
  const e = L.freeEntry({ name: 'Raclette', kcal: 1250, prot: 45.5 }, new Date('2026-09-26T20:00:00Z'));
  assert.equal(e.free, true);
  assert.equal(e.foodId, null);
  assert.equal(e.createdAt, '2026-09-26T20:00:00.000Z');
  assert.equal(L.entryKcal(e), 1250);
  assert.equal(L.entryProt(e), 45.5);
  assert.equal(L.entryGrams(e), 0);
  assert.equal(L.entryQuantityLabel(e), 'Saisie libre');
  assert.equal(L.entryQuantityLabel({ unit: 'g', grams: 300 }), '300 g');

  const day = L.emptyDay();
  day.soir.push(e);
  day.soir.push({ unit: 'g', grams: 100, kcal100: 350, prot100: 12 });
  assert.deepEqual(L.dayTotals(day), { kcal: 1600, prot: 57.5 });
});

test('saisie libre : conservée à l’import, bornes du plat entier', () => {
  const file = validFile();
  const libre = L.freeEntry({ name: 'Menu du resto', kcal: 2800, prot: 90 });
  file.days['2026-09-21'].soir = [libre];
  const res = L.validateData(file);
  assert.equal(res.ok, true);
  const relue = res.data.days['2026-09-21'].soir[0];
  assert.equal(relue.free, true);
  assert.equal(relue.kcal100, 2800);
  assert.equal(relue.unitGrams, null);

  // Les entrées ordinaires ne gagnent pas de champ « free ».
  assert.equal('free' in res.data.days['2026-09-21'].midi[0], false);

  // Au-delà des bornes d'un plat entier, le fichier est refusé.
  file.days['2026-09-21'].soir = [{ ...libre, kcal100: 9000 }];
  assert.equal(L.validateData(file).ok, false);
});
