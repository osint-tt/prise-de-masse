// Utilitaires partagés par les tests end-to-end.

export const STORAGE_KEY = 'prise-de-masse';

/** 21/09/2026, 9 h 00, heure de Paris : premier jour de la période. */
export const FIXED_TIME = new Date('2026-09-21T09:00:00+02:00');

/** Normalise les espaces, y compris l'espace insécable fine du séparateur français. */
export function norm(s) {
  return String(s).replace(/[\s   ]+/g, ' ').trim();
}

export async function text(locator) {
  return norm(await locator.innerText());
}

/**
 * Prépare la page : horloge fixée, données éventuelles en place, puis navigation.
 * `data` à null = premier lancement (stockage vide).
 */
export async function open(page, data = null, { hash = '#/' } = {}) {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(
    ({ key, payload }) => {
      // Uniquement au premier chargement de l'onglet : les rechargements et les
      // navigations suivantes doivent retrouver les données réellement enregistrées.
      try {
        if (!sessionStorage.getItem('pdm-seeded')) {
          sessionStorage.setItem('pdm-seeded', '1');
          if (payload === null) localStorage.removeItem(key);
          else localStorage.setItem(key, payload);
        }
      } catch {
        /* stockage indisponible */
      }
      // Force le chemin « téléchargement » de l'export, pour un test déterministe.
      try {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      } catch {
        /* certains navigateurs refusent : l'export retombera de toute façon sur le téléchargement */
      }
    },
    { key: STORAGE_KEY, payload: data === null ? null : JSON.stringify(data) }
  );
  await page.goto(`/${hash}`);
  await page.waitForSelector('[data-ready="true"]', { state: 'attached' });
}

/** Lit les données enregistrées dans localStorage. */
export async function storedData(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** Crée un aliment depuis la feuille « Nouvel aliment » déjà ouverte. */
export async function fillFoodForm(page, { name, kcal, prot }) {
  await page.fill('#f-name', name);
  await page.fill('#f-kcal', kcal);
  await page.fill('#f-prot', prot);
  await page.click('.sheet [data-submit]');
}

/** Parcours complet : accueil → bouton +, création d'un aliment. */
export async function createFood(page, food) {
  await page.click('.fab');
  await page.waitForSelector('.sheet #f-name');
  await fillFoodForm(page, food);
  await page.waitForSelector('.sheet', { state: 'detached' });
}

/** Ajoute une entrée dans une section de la journée affichée. */
export async function addEntry(page, mealKey, foodName, grams) {
  await page.click(`section.meal[data-meal="${mealKey}"] .add-btn`);
  await page.waitForSelector('.sheet #picker-search');
  await page.click(`.sheet .food-row:has-text("${foodName}")`);
  await page.waitForSelector('.sheet #q-grams');
  await page.fill('.sheet #q-grams', grams);
  await page.click('.sheet [data-submit]');
  await page.waitForSelector('.sheet', { state: 'detached' });
}
