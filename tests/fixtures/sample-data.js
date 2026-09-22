// Jeu de données réaliste, déterministe, partagé par les tests e2e et les captures.

// `unit: 'piece'` = valeurs pour une unité (un œuf), sinon pour 100 g.
export const FOODS = [
  { id: 'f-pates', name: 'Pâtes', unit: 'g', kcal100: 350, prot100: 12 },
  { id: 'f-poulet', name: 'Blanc de poulet', unit: 'g', kcal100: 121, prot100: 26 },
  { id: 'f-riz', name: 'Riz complet', unit: 'g', kcal100: 355, prot100: 7.5 },
  { id: 'f-fromage', name: 'Fromage blanc 3 %', unit: 'g', kcal100: 74, prot100: 7.8 },
  { id: 'f-amandes', name: 'Amandes', unit: 'g', kcal100: 598, prot100: 21 },
  { id: 'f-oeufs', name: 'Œuf', unit: 'piece', kcal100: 72, prot100: 6.3 },
];

const ISO = '2026-09-21T08:00:00.000Z';

function food(id) {
  return FOODS.find((f) => f.id === id);
}

function entry(suffix, foodId, grams) {
  const f = food(foodId);
  return {
    id: `e-${suffix}`,
    foodId: f.id,
    name: f.name,
    unit: f.unit,
    grams,
    kcal100: f.kcal100,
    prot100: f.prot100,
    createdAt: ISO,
  };
}

function emptyDay() {
  return { petitdej: [], midi: [], gouter: [], soir: [], grignotage: [] };
}

// Petit générateur pseudo-aléatoire déterministe (pas de Math.random dans les tests).
function prng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 10 journées remplies à partir du 21/09/2026, valeurs variées mais stables. */
export function filledDays(count = 10, startKey = '2026-09-21') {
  const rand = prng(20260921);
  const days = {};
  const start = new Date(
    Number(startKey.slice(0, 4)),
    Number(startKey.slice(5, 7)) - 1,
    Number(startKey.slice(8, 10))
  );

  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = emptyDay();
    const jitter = (base, spread) => Math.round(base + (rand() - 0.5) * spread);

    day.petitdej.push(entry(`${i}-a`, 'f-oeufs', rand() > 0.5 ? 3 : 2)); // en unités
    day.petitdej.push(entry(`${i}-b`, 'f-fromage', jitter(200, 80)));
    day.midi.push(entry(`${i}-c`, 'f-riz', jitter(160, 60)));
    day.midi.push(entry(`${i}-d`, 'f-poulet', jitter(180, 60)));
    if (rand() > 0.3) day.gouter.push(entry(`${i}-e`, 'f-amandes', jitter(40, 30)));
    day.soir.push(entry(`${i}-f`, 'f-pates', jitter(380, 120)));
    day.soir.push(entry(`${i}-g`, 'f-poulet', jitter(140, 60)));
    if (rand() > 0.6) day.grignotage.push(entry(`${i}-h`, 'f-fromage', jitter(120, 60)));

    days[key] = day;
  }
  return days;
}

/** Données complètes prêtes à injecter dans localStorage. */
export function sampleData({ theme = 'auto', goals = true, days = 10 } = {}) {
  return {
    version: 2,
    settings: {
      theme,
      startDate: '2026-09-21',
      endDate: '2026-10-21',
      goalKcal: goals ? 3200 : null,
      goalProt: goals ? 180 : null,
    },
    foods: FOODS.map((f) => ({ ...f, createdAt: ISO })),
    days: filledDays(days),
  };
}

export function emptyData({ theme = 'auto' } = {}) {
  return {
    version: 2,
    settings: { theme, startDate: '2026-09-21', endDate: '2026-10-21', goalKcal: null, goalProt: null },
    foods: [],
    days: {},
  };
}
