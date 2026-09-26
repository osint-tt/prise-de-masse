import { test, expect } from '@playwright/test';
import { open, text, createFood, addEntry, storedData, norm } from './helpers.js';
import { sampleData } from '../fixtures/sample-data.js';
import * as L from '../../js/logic.js';

test.describe('Saisie', () => {
  test('créer un aliment, l’ajouter au repas du soir, et retrouver le calcul partout', async ({ page }) => {
    await open(page);

    // Base vide au départ.
    await expect(page.locator('.chart-empty')).toContainText('Aucune donnée');

    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await expect(page.locator('.toast')).toContainText('Aliment ajouté');

    await page.click('.today-card');
    await expect(page).toHaveURL(/#\/jour\/2026-09-21$/);

    await addEntry(page, 'soir', 'Pâtes', '300');

    // 1. l'entrée
    const entry = page.locator('section.meal[data-meal="soir"] .entry');
    await expect(entry).toHaveCount(1);
    expect(await text(entry)).toContain('Pâtes');
    expect(await text(entry)).toContain('300 g');
    expect(await text(entry)).toContain('1 050 kcal');
    expect(await text(entry)).toContain('36,0 g');

    // 2. le sous-total de la section
    expect(await text(page.locator('section.meal[data-meal="soir"] .meal-total'))).toBe(
      '1 050 kcal · 36,0 g'
    );

    // Les autres sections restent vides.
    await expect(page.locator('section.meal[data-meal="midi"] .entry')).toHaveCount(0);
    await expect(page.locator('section.meal[data-meal="midi"] .meal-total')).toHaveCount(0);

    // 3. le total de la journée
    const total = await text(page.locator('.day-total .values'));
    expect(total).toContain('1 050 kcal');
    expect(total).toContain('36,0 g');

    // 4. la carte d'accueil
    await page.click('[data-action="back-home"]');
    await expect(page).toHaveURL(/#\/$/);
    const card = await text(page.locator('.today-card'));
    expect(card).toContain('Lundi 21 septembre');
    expect(card).toContain('1 050');
    expect(card).toContain('36,0 g de protéines');

    // 5. le graphique
    await expect(page.locator('.chart-svg .bar')).toHaveCount(1);
    await expect(page.locator('.chart-svg .bar')).toHaveClass(/is-today/);
    const tip = norm(await page.locator('.chart-svg .hit title').textContent());
    expect(tip).toContain('1 050 kcal');

    // Protéines : l'axe bascule sans casser le graphique.
    await page.click('[data-metric="prot"]');
    await expect(page.locator('.chart-svg .bar')).toHaveCount(1);
    expect(norm(await page.locator('.chart-svg .hit title').textContent())).toContain('36,0 g');
  });

  test('les 5 sections ont les bons libellés, dans le bon ordre', async ({ page }) => {
    await open(page, null, { hash: '#/jour/2026-09-21' });
    const titles = await page.locator('section.meal h2').allInnerTexts();
    expect(titles.map((t) => t.trim())).toEqual([
      'Petit-déj',
      'Repas midi',
      'Goûter',
      'Repas soir',
      'Grignotage',
    ]);
  });

  test('la virgule est acceptée dans tous les champs numériques', async ({ page }) => {
    await open(page);

    await page.click('.fab');
    await page.fill('#f-name', 'Huile d’olive');
    await page.fill('#f-kcal', '899,5');
    await page.fill('#f-prot', '0,2');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    await page.click('.today-card');
    await page.click('section.meal[data-meal="midi"] .add-btn');
    await page.click('.sheet .food-row:has-text("Huile")');
    await page.fill('.sheet #q-grams', '12,5');
    expect(await text(page.locator('.sheet [data-preview]'))).toBe(
      '12,5 g → 112 kcal · 0,0 g de protéines'
    );
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    expect(await text(page.locator('section.meal[data-meal="midi"] .entry'))).toContain('12,5 g');

    // Objectifs : la virgule passe aussi dans les paramètres.
    await page.goto('/#/parametres');
    await page.fill('#goal-prot', '180,5');
    await expect(page.locator('#goal-error')).toBeHidden();
    const data = await storedData(page);
    expect(data.settings.goalProt).toBe(180.5);
  });

  test('la touche Entrée valide la quantité', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Riz', kcal: '355', prot: '7,5' });
    await page.goto('/#/jour/2026-09-21');
    await page.click('section.meal[data-meal="midi"] .add-btn');
    await page.click('.sheet .food-row:has-text("Riz")');
    await page.fill('.sheet #q-grams', '200');
    await page.press('.sheet #q-grams', 'Enter');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect(await text(page.locator('section.meal[data-meal="midi"] .entry'))).toContain('710 kcal');
  });

  test('modifier la quantité d’une entrée met à jour tous les totaux', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'soir', 'Pâtes', '300');

    await page.click('section.meal[data-meal="soir"] .entry');
    await expect(page.locator('.sheet #q-grams')).toHaveValue('300');
    await page.fill('.sheet #q-grams', '150');
    expect(await text(page.locator('.sheet [data-preview]'))).toBe(
      '150 g → 525 kcal · 18,0 g de protéines'
    );
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    expect(await text(page.locator('section.meal[data-meal="soir"] .entry'))).toContain('525 kcal');
    expect(await text(page.locator('section.meal[data-meal="soir"] .meal-total'))).toBe(
      '525 kcal · 18,0 g'
    );
    expect(await text(page.locator('.day-total .values'))).toContain('525 kcal');
  });

  test('supprimer une entrée, puis annuler la suppression', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'soir', 'Pâtes', '300');
    await addEntry(page, 'soir', 'Pâtes', '100');
    await expect(page.locator('section.meal[data-meal="soir"] .entry')).toHaveCount(2);

    await page.locator('section.meal[data-meal="soir"] .entry').first().click();
    await page.click('.sheet [data-delete]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    await expect(page.locator('section.meal[data-meal="soir"] .entry')).toHaveCount(1);
    await expect(page.locator('.toast')).toContainText('Entrée supprimée');

    await page.click('.toast [data-toast-action]');
    await expect(page.locator('section.meal[data-meal="soir"] .entry')).toHaveCount(2);
    // L'entrée revient à sa place d'origine.
    expect(await text(page.locator('section.meal[data-meal="soir"] .entry').first())).toContain(
      '1 050 kcal'
    );
    const data = await storedData(page);
    expect(data.days['2026-09-21'].soir).toHaveLength(2);
  });

  test('modifier un aliment ne change pas les journées déjà remplies', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'soir', 'Pâtes', '300');

    await page.goto('/#/aliments');
    await page.click('.food-row:has-text("Pâtes")');
    await page.fill('.sheet #f-kcal', '500');
    await page.fill('.sheet #f-prot', '20');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect(await text(page.locator('.food-row'))).toContain('500 kcal');

    await page.goto('/#/jour/2026-09-21');
    const entry = await text(page.locator('section.meal[data-meal="soir"] .entry'));
    expect(entry).toContain('1 050 kcal');
    expect(entry).toContain('36,0 g');

    // Une nouvelle entrée, elle, utilise les nouvelles valeurs.
    await addEntry(page, 'midi', 'Pâtes', '100');
    expect(await text(page.locator('section.meal[data-meal="midi"] .entry'))).toContain('500 kcal');
  });

  test('supprimer un aliment ne change pas les journées déjà remplies', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'soir', 'Pâtes', '300');

    await page.goto('/#/aliments');
    await page.click('.food-row:has-text("Pâtes")');
    await page.click('.sheet [data-delete]');
    await page.click('.sheet [data-confirm]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    await expect(page.locator('.empty-state')).toContainText('Aucun aliment pour l’instant');

    await page.goto('/#/jour/2026-09-21');
    expect(await text(page.locator('section.meal[data-meal="soir"] .entry'))).toContain('1 050 kcal');
  });
});

test.describe('Aliments à l’unité', () => {
  test('la case à cocher fait passer un aliment en unités, pas en grammes', async ({ page }) => {
    await open(page);
    await page.click('.fab');

    // Par défaut, tout est en grammes.
    await expect(page.locator('.sheet [data-hint]')).toContainText('pour 100 g');
    expect(await text(page.locator('.sheet label[for="f-kcal"]'))).toBe('Calories / 100 g');

    await page.fill('#f-name', 'Œuf');
    await page.click('.sheet .check-row');
    expect(await page.locator('.sheet #f-unit').isChecked()).toBe(true);
    await expect(page.locator('.sheet [data-hint]')).toContainText('une unité');
    expect(await text(page.locator('.sheet label[for="f-kcal"]'))).toBe('Calories / unité');
    expect(await text(page.locator('.sheet label[for="f-prot"]'))).toBe('Protéines / unité');

    await page.fill('#f-kcal', '72');
    await page.fill('#f-prot', '6,3');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    await page.goto('/#/jour/2026-09-21');
    await page.click('section.meal[data-meal="petitdej"] .add-btn');
    expect(await text(page.locator('.sheet .food-row'))).toContain('72 kcal · 6,3 g / unité');

    await page.click('.sheet .food-row');
    await expect(page.locator('.sheet .qty-input-wrap .unit')).toHaveText('u.');
    expect(await text(page.locator('.sheet label[for="q-grams"]'))).toBe('Nombre d’unités');
    await page.fill('.sheet #q-grams', '2');
    expect(await text(page.locator('.sheet [data-preview]'))).toBe(
      '2 unités → 144 kcal · 12,6 g de protéines'
    );
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    const entry = page.locator('section.meal[data-meal="petitdej"] .entry');
    expect(await text(entry)).toContain('2 unités');
    expect(await text(entry)).toContain('144 kcal');
    expect(await text(entry)).toContain('12,6 g');
    expect(await text(page.locator('.day-total .values'))).toContain('144 kcal');

    // L'unité est enregistrée avec l'entrée et avec l'aliment.
    const data = await storedData(page);
    expect(data.version).toBe(2);
    expect(data.foods[0].unit).toBe('piece');
    expect(data.days['2026-09-21'].petitdej[0].unit).toBe('piece');
    expect(data.days['2026-09-21'].petitdej[0].grams).toBe(2);

    // La case reste cochée quand on rouvre l'aliment.
    await page.goto('/#/aliments');
    await page.click('.food-row:has-text("Œuf")');
    expect(await page.locator('.sheet #f-unit').isChecked()).toBe(true);
  });

  test('une seule unité s’écrit au singulier, et un demi est accepté', async ({ page }) => {
    await open(page);
    await page.click('.fab');
    await page.fill('#f-name', 'Banane');
    await page.click('.sheet .check-row');
    await page.fill('#f-kcal', '105');
    await page.fill('#f-prot', '1,3');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    await page.goto('/#/jour/2026-09-21');
    await page.click('section.meal[data-meal="gouter"] .add-btn');
    await page.click('.sheet .food-row');
    await page.fill('.sheet #q-grams', '0,5');
    expect(await text(page.locator('.sheet [data-preview]'))).toBe(
      '0,5 unité → 53 kcal · 0,7 g de protéines'
    );
    await page.fill('.sheet #q-grams', '1');
    expect(await text(page.locator('.sheet [data-preview]'))).toContain('1 unité →');

    // Au-delà de 100 unités, c'est refusé.
    await page.fill('.sheet #q-grams', '101');
    await expect(page.locator('.sheet [data-error="grams"]')).toContainText('unités maximum');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();
  });

  test('grammes et unités cohabitent dans la même journée', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });

    // Le jeu de données contient des œufs à l'unité et des pâtes au gramme.
    const petitdej = await text(page.locator('section.meal[data-meal="petitdej"] .entry').first());
    expect(petitdej).toContain('Œuf');
    expect(petitdej).toMatch(/\d unités?/);

    const soir = await text(page.locator('section.meal[data-meal="soir"] .entry').first());
    expect(soir).toContain('Pâtes');
    expect(soir).toContain(' g');

    // Le total du jour additionne bien les deux.
    const totals = L.dayTotals(sampleData().days['2026-09-21']);
    expect(await text(page.locator('.day-total .values'))).toContain(norm(L.formatKcal(totals.kcal)));
  });

  test('le total du jour affiche la masse en kilos, œufs compris', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });

    const data = sampleData();
    const day = data.days['2026-09-21'];
    expect(await text(page.locator('.day-total [data-total-kg]'))).toBe(
      norm(L.formatKg(L.dayGrams(day, data.foods)))
    );

    // Les œufs pèsent 60 g l'unité : ils comptent en plus des aliments au gramme.
    const auGramme = L.MEAL_KEYS.flatMap((k) => day[k])
      .filter((e) => e.unit !== 'piece')
      .reduce((somme, e) => somme + e.grams, 0);
    const oeufs = day.petitdej.filter((e) => e.unit === 'piece');
    expect(oeufs.length).toBe(1);
    expect(L.dayGrams(day, data.foods)).toBe(auGramme + oeufs[0].grams * 60);

    // Une entrée de plus, et la masse suit.
    await addEntry(page, 'gouter', 'Pâtes', '250');
    expect(await text(page.locator('.day-total [data-total-kg]'))).toBe(
      norm(L.formatKg(L.dayGrams(day, data.foods) + 250))
    );
  });

  test('sans rien de pesé, aucun kilo n’est affiché', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-10-05' }); // journée sans rien de saisi

    await expect(page.locator('.day-total .values')).toContainText('0 kcal');
    await expect(page.locator('.day-total [data-total-kg]')).toHaveCount(0);
  });

  test('poids d’une unité : facultatif, et renseigné après coup il rattrape les jours passés', async ({
    page,
  }) => {
    await open(page);

    // Le champ n'apparaît qu'une fois la case « aliment à l'unité » cochée.
    await page.click('.fab');
    await expect(page.locator('.sheet [data-unit-only]')).toBeHidden();
    await page.fill('#f-name', 'Yaourt');
    await page.click('.sheet .check-row');
    await expect(page.locator('.sheet [data-unit-only]')).toBeVisible();
    await page.fill('#f-kcal', '60');
    await page.fill('#f-prot', '4');
    await page.click('.sheet [data-submit]'); // poids laissé vide
    await page.waitForSelector('.sheet', { state: 'detached' });

    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'gouter', 'Yaourt', '4');
    await expect(page.locator('section.meal[data-meal="gouter"] .entry')).toHaveCount(1);
    expect((await storedData(page)).foods[0].unitGrams).toBe(null);
    await expect(page.locator('.day-total [data-total-kg]')).toHaveCount(0);

    // Poids renseigné après coup sur l'aliment.
    await page.goto('/#/aliments');
    await page.click('.food-row:has-text("Yaourt")');
    await page.fill('.sheet #f-weight', '125');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect((await storedData(page)).foods[0].unitGrams).toBe(125);
    expect(await text(page.locator('.food-row:has-text("Yaourt")'))).toContain('125 g/u.');

    // La journée déjà saisie compte maintenant ses 4 × 125 g.
    await page.goto('/#/jour/2026-09-21');
    expect(await text(page.locator('.day-total [data-total-kg]'))).toBe('0,5 kg');

    // Un poids absurde est refusé.
    await page.goto('/#/aliments');
    await page.click('.food-row:has-text("Yaourt")');
    await page.fill('.sheet #f-weight', '0');
    await expect(page.locator('.sheet [data-error="unitGrams"]')).toBeVisible();
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();
    await page.fill('.sheet #f-weight', '2500');
    await expect(page.locator('.sheet [data-error="unitGrams"]')).toContainText('maximum');
  });
});

test.describe('Saisie libre', () => {
  test('des kcal et des protéines directement, sans rien ajouter à la base', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });
    const avant = L.dayTotals(sampleData().days['2026-09-21']);
    const kilosAvant = L.dayGrams(sampleData().days['2026-09-21'], sampleData().foods);

    await page.click('section.meal[data-meal="soir"] .add-btn');
    await page.waitForSelector('.sheet #picker-search');
    await expect(page.locator('.sheet [data-free-entry]')).toHaveText('Saisie libre');
    await page.click('.sheet [data-free-entry]');

    // On tombe directement sur les calories : le nom est facultatif.
    await expect(page.locator('.sheet .sheet-head h2')).toHaveText('Saisie libre');
    await expect(page.locator('.sheet #free-kcal')).toBeFocused();
    await page.fill('.sheet #free-name', 'Raclette');
    await page.fill('.sheet #free-kcal', '1250');
    await page.fill('.sheet #free-prot', '45,5');
    await page.fill('.sheet #free-grams', '650'); // facultatif : pour les kilos du jour
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    const ligne = page.locator('section.meal[data-meal="soir"] .entry:has-text("Raclette")');
    await expect(ligne).toHaveCount(1);
    const texte = await text(ligne);
    expect(texte).toContain('Saisie libre · 650 g');
    expect(texte).toContain('1 250 kcal');
    expect(texte).toContain('45,5 g');
    expect(await text(page.locator('.day-total .values'))).toContain(
      norm(L.formatKcal(avant.kcal + 1250))
    );
    // Le poids du plat entre dans les kilos du jour.
    expect(await text(page.locator('.day-total [data-total-kg]'))).toBe(
      norm(L.formatKg(kilosAvant + 650))
    );

    // Rien n'est entré dans la base d'aliments.
    const data = await storedData(page);
    expect(data.foods.length).toBe(6);
    const stockee = data.days['2026-09-21'].soir.find((e) => e.name === 'Raclette');
    expect(stockee.free).toBe(true);
    expect(stockee.foodId).toBe(null);
    expect(stockee.unitGrams).toBe(650);

    // Modifier : le même formulaire, pré-rempli.
    await ligne.click();
    await expect(page.locator('.sheet #free-kcal')).toHaveValue('1250');
    await expect(page.locator('.sheet #free-prot')).toHaveValue('45,5');
    await expect(page.locator('.sheet #free-name')).toHaveValue('Raclette');
    await expect(page.locator('.sheet #free-grams')).toHaveValue('650');
    await page.fill('.sheet #free-kcal', '1400');
    await page.fill('.sheet #free-grams', ''); // poids retiré
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect(await text(ligne)).toContain('1 400 kcal');
    expect(await text(ligne)).not.toContain('650 g');
    expect(await text(page.locator('.day-total [data-total-kg]'))).toBe(norm(L.formatKg(kilosAvant)));

    // Supprimer depuis la même feuille.
    await ligne.click();
    await page.click('.sheet [data-delete]');
    await expect(page.locator('.toast')).toContainText('Entrée supprimée');
    await expect(ligne).toHaveCount(0);
  });

  test('un nom cherché sans résultat devient le nom du plat ; sans nom, c’est « Plat »', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });
    await page.click('section.meal[data-meal="midi"] .add-btn');
    await page.fill('.sheet #picker-search', 'couscous');
    await expect(page.locator('.sheet [data-new-food]')).toHaveText('Créer « couscous »');
    await page.click('.sheet [data-free-entry]');
    await expect(page.locator('.sheet #free-name')).toHaveValue('couscous');

    // La flèche retour revient au sélecteur, recherche conservée.
    await page.click('.sheet [aria-label="Étape précédente"]');
    await expect(page.locator('.sheet #picker-search')).toHaveValue('couscous');

    // Sans nom du tout.
    await page.fill('.sheet #picker-search', '');
    await page.click('.sheet [data-free-entry]');
    await expect(page.locator('.sheet #free-name')).toHaveValue('');
    await page.fill('.sheet #free-kcal', '500');
    await page.fill('.sheet #free-prot', '20');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.sheet', { state: 'detached' });
    const ligne = page.locator('section.meal[data-meal="midi"] .entry').last();
    expect(await text(ligne)).toMatch(/^Plat Saisie libre 500 kcal 20,0 g$/);
  });

  test('les erreurs de saisie bloquent l’ajout', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });
    await page.click('section.meal[data-meal="soir"] .add-btn');
    await page.click('.sheet [data-free-entry]');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('.sheet #free-kcal', '6000');
    await page.fill('.sheet #free-prot', '20');
    await expect(page.locator('.sheet [data-error="kcal"]')).toContainText('5 000');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('.sheet #free-kcal', '0');
    await page.fill('.sheet #free-prot', '0');
    await expect(page.locator('.sheet [data-error="kcal"]')).toContainText('ne compte pour rien');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('.sheet #free-kcal', '4800');
    await expect(page.locator('.sheet [data-submit]')).toBeEnabled();

    // Le poids, facultatif, doit rester plausible s'il est donné.
    await page.fill('.sheet #free-grams', '0');
    await expect(page.locator('.sheet [data-error="grams"]')).toContainText('poids');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();
    await page.fill('.sheet #free-grams', '6000');
    await expect(page.locator('.sheet [data-error="grams"]')).toContainText('maximum');
    await page.fill('.sheet #free-grams', '');
    await expect(page.locator('.sheet [data-submit]')).toBeEnabled();
  });
});

test.describe('Base d’aliments', () => {
  test('recherche insensible à la casse et aux accents, et création depuis la recherche', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await createFood(page, { name: 'Riz complet', kcal: '355', prot: '7,5' });

    await page.goto('/#/jour/2026-09-21');
    await page.click('section.meal[data-meal="soir"] .add-btn');
    await page.fill('.sheet #picker-search', 'pate');
    await expect(page.locator('.sheet .food-row')).toHaveCount(1);
    expect(await text(page.locator('.sheet .food-row'))).toContain('Pâtes');
    expect(await text(page.locator('.sheet .food-row'))).toContain('350 kcal · 12 g / 100 g');

    // Aucun résultat : le bouton propose de créer l'aliment tapé.
    await page.fill('.sheet #picker-search', 'Skyr');
    await expect(page.locator('.sheet .food-row')).toHaveCount(0);
    expect(norm(await page.locator('.sheet [data-new-food]').textContent())).toBe('Créer « Skyr »');
    await page.click('.sheet [data-new-food]');
    await expect(page.locator('.sheet #f-name')).toHaveValue('Skyr');
    await page.fill('.sheet #f-kcal', '63');
    await page.fill('.sheet #f-prot', '10');
    await page.click('.sheet [data-submit]');

    // On arrive directement à l'étape quantité pour le nouvel aliment.
    await expect(page.locator('.sheet #q-grams')).toBeVisible();
    await expect(page.locator('.sheet h2')).toHaveText('Skyr');
    await page.fill('.sheet #q-grams', '200');
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect(await text(page.locator('section.meal[data-meal="soir"] .entry'))).toContain('126 kcal');
  });

  test('les doublons sont refusés et le bouton reste désactivé', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });

    await page.click('.fab');
    await page.fill('#f-name', 'PATES');
    await page.fill('#f-kcal', '350');
    await page.fill('#f-prot', '12');
    await expect(page.locator('.sheet [data-error="name"]')).toContainText('existe déjà');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('#f-name', 'Pâtes complètes');
    await expect(page.locator('.sheet [data-error="name"]')).toBeHidden();
    await expect(page.locator('.sheet [data-submit]')).toBeEnabled();
  });

  test('les bornes de saisie sont vérifiées', async ({ page }) => {
    await open(page);
    await page.click('.fab');
    await page.fill('#f-name', 'Test');
    await page.fill('#f-kcal', '901');
    await page.fill('#f-prot', '12');
    await expect(page.locator('.sheet [data-error="kcal100"]')).toContainText('Entre 0 et 900');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('#f-kcal', '350');
    await page.fill('#f-prot', '101');
    await expect(page.locator('.sheet [data-error="prot100"]')).toContainText('Entre 0 et 100');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();

    await page.fill('#f-prot', '12');
    await expect(page.locator('.sheet [data-submit]')).toBeEnabled();
    await page.click('.sheet [data-submit]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    // Quantité : 0 et plus de 5 000 g refusés.
    await page.goto('/#/jour/2026-09-21');
    await page.click('section.meal[data-meal="midi"] .add-btn');
    await page.click('.sheet .food-row:has-text("Test")');
    await page.fill('.sheet #q-grams', '0');
    await expect(page.locator('.sheet [data-error="grams"]')).toContainText('supérieure à 0');
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();
    await page.fill('.sheet #q-grams', '5001');
    await expect(page.locator('.sheet [data-error="grams"]')).toBeVisible();
    await expect(page.locator('.sheet [data-submit]')).toBeDisabled();
    await page.fill('.sheet #q-grams', '5000');
    await expect(page.locator('.sheet [data-submit]')).toBeEnabled();
  });
});
