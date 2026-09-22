import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { open, text, storedData, createFood, addEntry, STORAGE_KEY } from './helpers.js';
import { sampleData } from '../fixtures/sample-data.js';
import { APP_VERSION } from '../../js/logic.js';

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const resolved = (page) => page.evaluate(() => document.documentElement.dataset.resolved);

test.describe('Thème', () => {
  test('bascule clair / sombre depuis l’accueil, choix conservé après rechargement', async ({ page }) => {
    await open(page, sampleData({ theme: 'light' }));
    expect(await resolved(page)).toBe('light');
    expect(await bg(page)).toBe('rgb(255, 255, 255)');

    await page.click('[data-action="toggle-theme"]');
    expect(await resolved(page)).toBe('dark');
    expect(await bg(page)).toBe('rgb(0, 0, 0)');
    expect(await page.getAttribute('meta[name="theme-color"]', 'content')).toBe('#000000');

    await page.reload();
    await page.waitForSelector('[data-ready="true"]', { state: 'attached' });
    expect(await resolved(page)).toBe('dark');
    expect(await bg(page)).toBe('rgb(0, 0, 0)');

    await page.click('[data-action="toggle-theme"]');
    expect(await bg(page)).toBe('rgb(255, 255, 255)');
    expect(await page.getAttribute('meta[name="theme-color"]', 'content')).toBe('#ffffff');
  });

  test('les trois choix de thème des paramètres', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    await page.click('.choice[data-theme="dark"]');
    expect(await resolved(page)).toBe('dark');
    await expect(page.locator('.choice[data-theme="dark"]')).toHaveAttribute('aria-pressed', 'true');

    await page.click('.choice[data-theme="light"]');
    expect(await resolved(page)).toBe('light');

    await page.click('.choice[data-theme="auto"]');
    expect((await storedData(page)).settings.theme).toBe('auto');
  });

  test('« Automatique » suit le réglage du téléphone', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, sampleData({ theme: 'auto' }));
    expect(await resolved(page)).toBe('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => resolved(page)).toBe('light');
  });
});

test.describe('Paramètres', () => {
  test('changer la période masque les jours hors période sans les supprimer', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    const before = await storedData(page);
    const daysBefore = Object.keys(before.days).length;

    await page.fill('#start-date', '2026-09-25');
    await page.dispatchEvent('#start-date', 'change');
    await expect(page.locator('#period-error')).toBeHidden();

    await page.goto('/#/');
    await expect(page.locator('.cal-cell:not(.empty)')).toHaveCount(27);

    const after = await storedData(page);
    expect(Object.keys(after.days)).toHaveLength(daysBefore);
    expect(after.settings.startDate).toBe('2026-09-25');
  });

  test('une période invalide est refusée et rien n’est enregistré', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    await page.fill('#end-date', '2026-09-01');
    await page.dispatchEvent('#end-date', 'change');
    await expect(page.locator('#period-error')).toBeVisible();
    expect((await storedData(page)).settings.endDate).toBe('2026-10-21');
  });

  test('les objectifs affichent des barres de progression, vides ils les masquent', async ({ page }) => {
    await open(page, sampleData({ goals: false }));
    await expect(page.locator('.today-card .progress-row')).toHaveCount(0);
    await expect(page.locator('.chart-svg .goal-line')).toHaveCount(0);

    await page.goto('/#/parametres');
    await page.fill('#goal-kcal', '3200');
    await page.fill('#goal-prot', '180');
    await page.goto('/#/');
    await expect(page.locator('.today-card .progress-row')).toHaveCount(2);
    expect(await text(page.locator('.today-card .progress-row').first())).toContain('/ 3 200 kcal');
    await expect(page.locator('.chart-svg .goal-line')).toHaveCount(1);

    await page.goto('/#/jour/2026-09-21');
    await expect(page.locator('.day-total .progress-row')).toHaveCount(2);

    await page.goto('/#/parametres');
    await page.fill('#goal-kcal', '');
    await page.fill('#goal-prot', '');
    await page.goto('/#/');
    await expect(page.locator('.today-card .progress-row')).toHaveCount(0);
  });

  test('la version de l’app est affichée en bas des paramètres', async ({ page }) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    await expect(page.locator('.version-line')).toContainText(`version ${APP_VERSION}`);
  });
});

test.describe('Export / import', () => {
  test('exporter puis réimporter redonne exactement les mêmes données', async ({ page }, testInfo) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    const before = await storedData(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);
    expect(download.suggestedFilename()).toBe('protal-2026-09-21.json');

    const file = testInfo.outputPath('sauvegarde.json');
    await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(exported.foods).toHaveLength(6);

    // On efface tout, puis on réimporte.
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.waitForSelector('[data-ready="true"]', { state: 'attached' });
    await page.goto('/#/');
    await expect(page.locator('.chart-empty')).toBeVisible();

    await page.goto('/#/parametres');
    await page.setInputFiles('#import-file', file);
    await expect(page.locator('.sheet')).toBeVisible();
    expect(await text(page.locator('.summary-list'))).toContain('6');
    expect(await text(page.locator('.summary-list'))).toContain('10');
    await page.click('.sheet [data-confirm]');
    await page.waitForSelector('.sheet', { state: 'detached' });

    const after = await storedData(page);
    expect(after.foods).toEqual(before.foods);
    expect(after.days).toEqual(before.days);
    expect(after.settings).toEqual(before.settings);
  });

  test('un fichier invalide est refusé et ne modifie rien', async ({ page }, testInfo) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    const before = await storedData(page);

    const bad = testInfo.outputPath('casse.json');
    fs.writeFileSync(bad, 'ceci n’est pas du JSON', 'utf8');
    await page.setInputFiles('#import-file', bad);
    await expect(page.locator('.sheet')).toContainText('JSON');
    await expect(page.locator('.sheet')).toContainText('Rien n’a été modifié');
    await page.click('.sheet [data-close]');
    expect(await storedData(page)).toEqual(before);

    // JSON valide mais pas une sauvegarde de l'app.
    const wrong = testInfo.outputPath('autre.json');
    fs.writeFileSync(wrong, JSON.stringify({ hello: 'world' }), 'utf8');
    await page.setInputFiles('#import-file', wrong);
    await expect(page.locator('.sheet')).toContainText('n’est pas une sauvegarde');
    await page.click('.sheet [data-close]');
    expect(await storedData(page)).toEqual(before);

    // Version inconnue.
    const future = testInfo.outputPath('futur.json');
    fs.writeFileSync(future, JSON.stringify({ ...before, version: 99 }), 'utf8');
    await page.setInputFiles('#import-file', future);
    await expect(page.locator('.sheet')).toContainText('99');
    await page.click('.sheet [data-close]');
    expect(await storedData(page)).toEqual(before);
  });

  test('l’import peut être annulé', async ({ page }, testInfo) => {
    await open(page, sampleData(), { hash: '#/parametres' });
    const before = await storedData(page);
    const file = testInfo.outputPath('autre-sauvegarde.json');
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, settings: {}, foods: [], days: {} }),
      'utf8'
    );
    await page.setInputFiles('#import-file', file);
    await expect(page.locator('.sheet')).toBeVisible();
    await page.click('.sheet [data-cancel]');
    await page.waitForSelector('.sheet', { state: 'detached' });
    expect(await storedData(page)).toEqual(before);
  });
});

test.describe('Mise à jour', () => {
  test('un fichier modifié sur le serveur fait apparaître le bandeau', async ({ page }) => {
    const cssPath = fileURLToPath(new URL('../../css/style.css', import.meta.url));
    const original = fs.readFileSync(cssPath);
    try {
      await open(page, sampleData());
      await page.evaluate(() => navigator.serviceWorker.ready);
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
        timeout: 10_000,
      }).toBe(true);
      await expect(page.locator('.update-banner')).toHaveCount(0);

      // Nouvelle version publiée pendant que l'app est installée.
      fs.writeFileSync(cssPath, `${original.toString('utf8')}\n/* version suivante */\n`, 'utf8');

      await page.reload();
      await page.waitForSelector('[data-ready="true"]', { state: 'attached' });

      // Le service worker sert le cache, revalide en fond, et signale le changement.
      await expect(page.locator('.update-banner')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.update-banner')).toContainText('Mise à jour disponible');

      // Recharger redonne une app fonctionnelle, avec les mêmes données.
      // Le bouton efface d'abord le marqueur de mise à jour, donc le rechargement
      // part un instant plus tard : on attend que le document soit vraiment remplacé
      // avant d'interroger la page.
      await page.evaluate(() => {
        window.__avantRechargement = true;
      });
      await page.click('.update-banner [data-reload]');
      await expect
        .poll(
          () =>
            page
              .evaluate(() => window.__avantRechargement === undefined)
              .catch(() => true /* contexte détruit : le rechargement est en cours */),
          { timeout: 15_000 }
        )
        .toBe(true);
      await page.waitForSelector('[data-ready="true"]', { state: 'attached' });
      expect(await text(page.locator('.today-card'))).toContain('Lundi 21 septembre');
      expect((await storedData(page)).foods).toHaveLength(6);
    } finally {
      fs.writeFileSync(cssPath, original);
    }
  });

  test('le bandeau de mise à jour pousse l’app vers le bas sans bloquer l’en-tête', async ({ page }) => {
    await open(page, sampleData());
    const headerTop = (await page.locator('.app-header').boundingBox()).y;

    await page.evaluate(() => {
      document.getElementById('update-root').innerHTML =
        '<div class="update-banner"><span class="u-msg">Mise à jour disponible</span>' +
        '<button class="u-action" type="button" data-reload>Recharger</button></div>';
    });
    await expect(page.locator('.update-banner')).toBeVisible();

    // L'en-tête descend au lieu d'être recouvert.
    expect((await page.locator('.app-header').boundingBox()).y).toBeGreaterThan(headerTop);

    // Et ses boutons restent utilisables.
    await page.click('[aria-label="Paramètres"]', { timeout: 5000 });
    await expect(page).toHaveURL(/#\/parametres$/);

    // Toujours aucun débordement horizontal.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Autonomie', () => {
  test('aucune requête vers un autre domaine', async ({ page, baseURL }) => {
    const foreign = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (!url.startsWith(baseURL)) foreign.push(url);
    });

    await open(page);
    await createFood(page, { name: 'Pâtes', kcal: '350', prot: '12' });
    await page.click('.today-card');
    await addEntry(page, 'soir', 'Pâtes', '300');
    await page.click('[data-action="back-home"]');
    await page.click('[aria-label="Paramètres"]');
    await page.click('[data-action="foods"]');
    await page.goto('/#/');
    await page.waitForTimeout(300);

    expect(foreign, `requêtes externes détectées : ${foreign.join(', ')}`).toEqual([]);
  });

  test('l’app fonctionne hors connexion après un premier chargement', async ({
    page,
    context,
    browserName,
  }) => {
    await open(page, sampleData());
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 10_000,
    }).toBe(true);

    // Tout ce dont l'app a besoin est dans le cache du service worker.
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const name = keys.find((k) => k.startsWith('prise-de-masse-v'));
      const cache = await caches.open(name);
      return { name, paths: (await cache.keys()).map((r) => new URL(r.url).pathname) };
    });
    expect(cached.name).toBe(`prise-de-masse-v${APP_VERSION}`);
    for (const path of [
      '/index.html',
      '/css/style.css',
      '/js/app.js',
      '/js/logic.js',
      '/js/storage.js',
      '/manifest.webmanifest',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
    ]) {
      expect(cached.paths, path).toContain(path);
    }

    if (browserName !== 'chromium') {
      // Sous Playwright, couper le réseau du contexte WebKit tue aussi son service
      // worker : le rechargement échoue côté outil, pas côté app. Le contenu du cache
      // vient d'être vérifié ; le rechargement hors ligne réel est couvert par Chromium.
      return;
    }

    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('[data-ready="true"]', { state: 'attached' });

    expect(await text(page.locator('.today-card'))).toContain('Lundi 21 septembre');
    await expect(page.locator('.cal-cell:not(.empty)')).toHaveCount(31);
    await expect(page.locator('.chart-svg .bar')).toHaveCount(10);

    // On peut continuer à saisir hors ligne.
    await page.goto('/#/jour/2026-09-21');
    await addEntry(page, 'grignotage', 'Amandes', '30');
    expect(
      await text(page.locator('section.meal[data-meal="grignotage"] .entry').last())
    ).toContain('179 kcal');

    await context.setOffline(false);
  });

  test('aucun défilement horizontal à 360 px et à 430 px', async ({ page }) => {
    const routes = ['#/', '#/jour/2026-09-21', '#/parametres', '#/aliments'];
    for (const width of [360, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await open(page, sampleData());
      for (const hash of routes) {
        await page.goto(`/${hash}`);
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(overflow.doc, `${hash} @ ${width}px`).toBeLessThanOrEqual(0);
        expect(overflow.body, `${hash} @ ${width}px`).toBeLessThanOrEqual(0);
      }

      // Une feuille ouverte ne doit pas déborder non plus.
      await page.goto('/#/jour/2026-09-21');
      await page.click('section.meal[data-meal="soir"] .add-btn');
      await page.waitForSelector('.sheet #picker-search');
      const sheetOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(sheetOverflow, `feuille d’ajout @ ${width}px`).toBeLessThanOrEqual(0);
      // La fermeture repasse par l'historique : attendre avant de naviguer.
      await page.keyboard.press('Escape');
      await page.waitForSelector('.sheet', { state: 'detached' });

      // Y compris celle du nouvel aliment, avec sa case à cocher.
      await page.goto('/#/');
      await page.click('.fab');
      await page.waitForSelector('.sheet .check-row');
      const foodSheetOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(foodSheetOverflow, `feuille aliment @ ${width}px`).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.sheet', { state: 'detached' });
    }
  });

  test('l’app ne charge aucune dépendance : seulement ses propres fichiers', async ({ page, baseURL }) => {
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await open(page, sampleData());
    await page.waitForTimeout(400);

    const paths = urls
      .filter((u) => u.startsWith(baseURL))
      .map((u) => new URL(u).pathname)
      .filter((p) => p !== '/favicon.ico');

    for (const p of paths) {
      expect(
        [
          '/',
          '/index.html',
          '/css/style.css',
          '/js/app.js',
          '/js/logic.js',
          '/js/storage.js',
          '/sw.js',
          '/manifest.webmanifest',
        ].includes(p) || p.startsWith('/icons/'),
        `fichier inattendu chargé : ${p}`
      ).toBe(true);
    }
  });
});
