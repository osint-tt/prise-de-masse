import { test, expect } from '@playwright/test';
import { open, text, createFood, addEntry, norm } from './helpers.js';
import { sampleData, emptyData, filledDays } from '../fixtures/sample-data.js';
import * as L from '../../js/logic.js';

test.describe('Navigation', () => {
  test('les flèches jour précédent / suivant sont bornées à la période', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-21' });

    const prev = page.locator('[aria-label="Jour précédent"]');
    const next = page.locator('[aria-label="Jour suivant"]');

    // Premier jour : pas de précédent.
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(page.locator('.app-header .sub')).toHaveText('Jour 1 / 31');

    await next.click();
    await expect(page).toHaveURL(/#\/jour\/2026-09-22$/);
    await expect(page.locator('.app-header .sub')).toHaveText('Jour 2 / 31');
    await expect(page.locator('.app-header h1')).toHaveText('Mardi 22 septembre');
    await expect(prev).toBeEnabled();

    // Dernier jour : pas de suivant.
    await page.goto('/#/jour/2026-10-21');
    await expect(page.locator('.app-header .sub')).toHaveText('Jour 31 / 31');
    await expect(page.locator('[aria-label="Jour suivant"]')).toBeDisabled();
    await expect(page.locator('[aria-label="Jour précédent"]')).toBeEnabled();
    await page.locator('[aria-label="Jour précédent"]').click();
    await expect(page).toHaveURL(/#\/jour\/2026-10-20$/);
  });

  test('le calendrier n’affiche que la période et ouvre le bon jour', async ({ page }) => {
    await open(page, sampleData());

    // 31 jours, sur 5 lignes de 7 colonnes.
    await expect(page.locator('.cal-cell:not(.empty)')).toHaveCount(31);
    await expect(page.locator('.cal-cell')).toHaveCount(35);
    await expect(page.locator('.cal-cell.today')).toHaveCount(1);
    await expect(page.locator('.cal-cell.today')).toHaveAttribute('data-date', '2026-09-21');

    // Mois abrégé sur la première case et sur le 1er octobre.
    expect(await text(page.locator('.cal-cell[data-date="2026-09-21"]'))).toContain('sept');
    expect(await text(page.locator('.cal-cell[data-date="2026-10-01"]'))).toContain('oct');
    expect(await text(page.locator('.cal-cell[data-date="2026-09-22"]'))).toBe('22');

    // Un point sous les jours remplis, rien sous les jours vides.
    await expect(page.locator('.cal-cell[data-date="2026-09-25"] .dot')).toHaveCount(1);
    await expect(page.locator('.cal-cell[data-date="2026-10-15"] .dot')).toHaveCount(0);

    await page.click('.cal-cell[data-date="2026-09-25"]');
    await expect(page).toHaveURL(/#\/jour\/2026-09-25$/);
    await expect(page.locator('.app-header h1')).toHaveText('Vendredi 25 septembre');
  });

  test('un tap sur une barre du graphique ouvre le bon jour', async ({ page }) => {
    await open(page, sampleData());
    await expect(page.locator('.chart-svg .bar')).toHaveCount(10);
    await page.click('.chart-svg .hit[data-date="2026-09-23"]');
    await expect(page).toHaveURL(/#\/jour\/2026-09-23$/);
    await expect(page.locator('.app-header h1')).toHaveText('Mercredi 23 septembre');
  });

  test('les boutons retour visibles ramènent à l’écran parent', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/jour/2026-09-24' });
    await page.click('[data-action="back-home"]');
    await expect(page).toHaveURL(/#\/$/);

    await page.click('[aria-label="Paramètres"]');
    await expect(page).toHaveURL(/#\/parametres$/);
    await page.click('[data-action="foods"]');
    await expect(page).toHaveURL(/#\/aliments$/);
    await page.click('[data-action="back-settings"]');
    await expect(page).toHaveURL(/#\/parametres$/);
    await page.click('[data-action="back-home"]');
    await expect(page).toHaveURL(/#\/$/);
  });

  test('le bouton retour du navigateur ferme d’abord la feuille ouverte', async ({ page }) => {
    await open(page, sampleData());

    await page.click('.fab');
    await expect(page.locator('.sheet')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page).toHaveURL(/#\/$/, { timeout: 3000 });

    // Sans feuille ouverte, le retour change d'écran.
    await page.click('[aria-label="Paramètres"]');
    await expect(page).toHaveURL(/#\/parametres$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('la croix et le fond ferment la feuille', async ({ page }) => {
    await open(page, sampleData());
    await page.click('.fab');
    await page.click('.sheet [aria-label="Fermer"]');
    await expect(page.locator('.sheet')).toHaveCount(0);

    await page.click('.fab');
    await page.click('.sheet-backdrop', { position: { x: 10, y: 10 } });
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  test('l’accueil affiche « Jour X / 31 » et la carte du jour', async ({ page }) => {
    await open(page, sampleData());
    await expect(page.locator('.app-header .sub')).toHaveText('Jour 1 / 31');
    expect(await text(page.locator('.today-card'))).toContain('Lundi 21 septembre');
    await expect(page.locator('.fab')).toBeVisible();
    // Le bouton « + » n'existe que sur l'accueil.
    await page.goto('/#/jour/2026-09-21');
    await expect(page.locator('.fab')).toHaveCount(0);
    await page.goto('/#/parametres');
    await expect(page.locator('.fab')).toHaveCount(0);
  });

  test('le graphique démarre au plancher quand toutes les journées sont au-dessus', async ({ page }) => {
    await open(page, sampleData());

    // Le jeu de données tient entre le plancher et l'objectif : l'axe part du plancher.
    const graduations = async () =>
      (await page.locator('.chart-svg .tick-label').allTextContents()).map((t) =>
        Number(norm(t).replace(/\s/g, ''))
      );
    let ticks = await graduations();
    expect(Math.min(...ticks)).toBe(L.CHART_FLOORS.kcal);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(2400);

    // Les protéines partent de leur propre plancher.
    await page.click('[data-metric="prot"]');
    ticks = await graduations();
    expect(Math.min(...ticks)).toBe(L.CHART_FLOORS.prot);
  });

  test('la journée en cours, encore à moitié saisie, ne ramène pas l’axe à 0', async ({ page }) => {
    const data = sampleData();
    // Aujourd'hui : un seul petit repas, bien sous le plancher.
    data.days['2026-09-21'] = {
      ...L.emptyDay(),
      petitdej: [
        {
          id: 'e-matin',
          foodId: 'f-pates',
          name: 'Pâtes',
          unit: 'g',
          grams: 100,
          kcal100: 350,
          prot100: 12,
          createdAt: '2026-09-21T08:00:00.000Z',
        },
      ],
    };
    await open(page, data);

    // Les journées terminées sont toutes au-dessus : le plancher tient.
    const ticks = (await page.locator('.chart-svg .tick-label').allTextContents()).map((t) =>
      Number(norm(t).replace(/\s/g, ''))
    );
    expect(Math.min(...ticks)).toBe(L.CHART_FLOORS.kcal);

    // La barre du jour reste visible, rognée à la ligne du bas.
    const aujourdhui = page.locator('.chart-svg .bar.is-today');
    await expect(aujourdhui).toHaveCount(1);
    expect(Number(await aujourdhui.getAttribute('height'))).toBeGreaterThanOrEqual(3);

    // Et son vrai total reste lisible en gros sur la carte du jour.
    expect(await text(page.locator('.today-card'))).toContain('350');
  });

  test('une journée légère ne fait pas redescendre l’axe à 0', async ({ page }) => {
    const data = sampleData();
    // Une journée à 700 kcal, très en dessous du plancher.
    data.days['2026-09-23'] = {
      ...L.emptyDay(),
      midi: [
        {
          id: 'e-light',
          foodId: 'f-pates',
          name: 'Pâtes',
          unit: 'g',
          grams: 200,
          kcal100: 350,
          prot100: 12,
          createdAt: '2026-09-21T08:00:00.000Z',
        },
      ],
    };
    await open(page, data);

    const ticks = (await page.locator('.chart-svg .tick-label').allTextContents()).map((t) =>
      Number(norm(t).replace(/\s/g, ''))
    );
    expect(Math.min(...ticks)).toBe(L.CHART_FLOORS.kcal);

    // Toutes les barres sont là, et celle du 23 garde une amorce visible.
    await expect(page.locator('.chart-svg .bar')).toHaveCount(10);
    const hauteurs = await page.locator('.chart-svg .bar').evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute('height')))
    );
    expect(Math.min(...hauteurs)).toBeGreaterThanOrEqual(3);

    // Son vrai total reste accessible au tap.
    await page.click('.chart-svg .hit[data-date="2026-09-23"]');
    expect(await text(page.locator('.day-total .values'))).toContain('700 kcal');
  });

  test('la moyenne porte sur les journées terminées, sans le jour en cours', async ({ page }) => {
    const data = sampleData();
    data.settings.startDate = '2026-09-17'; // aujourd'hui (21/09) devient le jour 5
    data.days = filledDays(4, '2026-09-17'); // les 4 journées terminées sont remplies
    await open(page, data);

    const avg = page.locator('.average-card');
    await expect(avg).toBeVisible();
    // Le CSS met le libellé en capitales : on compare sans la casse.
    expect(await text(avg.locator('.avg-label'))).toMatch(/^Moyenne · 4 jours$/i);

    let kcal = 0;
    let prot = 0;
    for (const key of ['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']) {
      const t = L.dayTotals(data.days[key]);
      kcal += t.kcal;
      prot += t.prot;
    }
    expect(await text(avg.locator('.k'))).toBe(norm(L.formatKcal(kcal / 4)));
    expect(await text(avg.locator('.p'))).toBe(L.formatProt(prot / 4));
  });

  test('au premier jour, il n’y a pas encore de moyenne', async ({ page }) => {
    await open(page, sampleData()); // 21/09 = jour 1, aucune journée terminée
    await expect(page.locator('.average-card')).toHaveCount(0);
  });

  test('saisir sur le jour en cours ne change pas la moyenne', async ({ page }) => {
    const data = sampleData({ days: 0 });
    data.settings.startDate = '2026-09-20'; // aujourd'hui (21/09) = jour 2
    await open(page, data);
    expect(await text(page.locator('.average-card .avg-label'))).toMatch(/^Moyenne · 1 jour$/i);
    expect(await text(page.locator('.average-card .k'))).toBe('0 kcal');

    // Une saisie sur aujourd'hui : la moyenne ne bouge pas.
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'midi', 'Pâtes', '300'); // 1 050 kcal
    await page.click('[data-action="back-home"]');
    expect(await text(page.locator('.today-card'))).toContain('1 050');
    expect(await text(page.locator('.average-card .k'))).toBe('0 kcal');

    // Une saisie sur la veille, elle, compte.
    await page.goto('/#/jour/2026-09-20');
    await addEntry(page, 'soir', 'Pâtes', '200'); // 700 kcal
    await page.click('[data-action="back-home"]');
    expect(await text(page.locator('.average-card .k'))).toBe('700 kcal');
  });

  test('sous le graphique, le cumul des 7 derniers jours', async ({ page }) => {
    const data = sampleData();
    data.settings.startDate = '2026-09-07'; // aujourd'hui (21/09) devient le jour 15
    data.days = filledDays(15, '2026-09-07');
    await open(page, data);

    const note = page.locator('[data-last-week]');
    await expect(note).toBeVisible();

    // Les 7 journées du 15/09 au 21/09, jour en cours compris.
    const attendu = L.lastDaysTotals(
      data.days,
      data.foods,
      data.settings.startDate,
      data.settings.endDate,
      '2026-09-21',
      7
    );
    expect(attendu.days).toBe(7);
    expect(attendu.from).toBe('2026-09-15');

    const texte = await text(note);
    expect(texte).toContain('7 derniers jours');
    expect(texte).toContain(norm(L.formatKcal(attendu.kcal)));
    // Sur une semaine, les protéines sont arrondies au gramme.
    expect(texte).toContain(`${norm(L.formatInt(attendu.prot))} g`);
    expect(texte).toContain(norm(L.formatKg(attendu.grams)));

    // Une saisie sur aujourd'hui entre bien dans le cumul, elle.
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'grignotage', 'Pâtes', '200'); // 700 kcal
    await page.click('[data-action="back-home"]');
    expect(await text(page.locator('[data-last-week]'))).toContain(
      norm(L.formatKcal(attendu.kcal + 700))
    );
  });

  test('au début de la période, le cumul porte sur les jours écoulés seulement', async ({
    page,
  }) => {
    const data = sampleData();
    data.settings.startDate = '2026-09-19'; // aujourd'hui (21/09) = jour 3
    data.days = filledDays(3, '2026-09-19');
    await open(page, data);
    expect(await text(page.locator('[data-last-week]'))).toContain('3 derniers jours');
  });

  test('sans rien de saisi, aucun cumul sous le graphique', async ({ page }) => {
    await open(page, emptyData());
    await expect(page.locator('[data-last-week]')).toHaveCount(0);
  });

  test('la moyenne disparaît avant le début de la période', async ({ page }) => {
    const data = sampleData();
    data.settings.startDate = '2026-10-01';
    data.settings.endDate = '2026-10-21';
    await open(page, data);
    await expect(page.locator('.average-card')).toHaveCount(0);
  });

  test('hors période, la carte le signale', async ({ page }) => {
    const data = sampleData();
    data.settings.startDate = '2026-10-01';
    data.settings.endDate = '2026-10-21';
    await open(page, data);
    expect(await text(page.locator('.today-card'))).toContain('En dehors de la période');
    expect(await text(page.locator('.today-card'))).toContain('01/10/2026');
    await expect(page.locator('.cal-cell:not(.empty)')).toHaveCount(21);
  });

  test('les données survivent à un rechargement', async ({ page }) => {
    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'soir', 'Pâtes', '300');

    await page.reload();
    await page.waitForSelector('[data-ready="true"]', { state: 'attached' });
    expect(await text(page.locator('section.meal[data-meal="soir"] .entry'))).toContain('1 050 kcal');

    await page.goto('/');
    await page.reload();
    expect(await text(page.locator('.today-card'))).toContain('1 050');
  });
});
