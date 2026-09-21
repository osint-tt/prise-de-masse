import { test, expect } from '@playwright/test';
import { open, text, createFood, addEntry } from './helpers.js';
import { sampleData } from '../fixtures/sample-data.js';

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
