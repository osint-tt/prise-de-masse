// Captures de chaque écran et de chaque feuille, en clair et en sombre.
// Sortie : captures/<theme>/<nom>.png (dossier ignoré par git).
// Lancement : npm run shots

import path from 'node:path';
import { test } from '@playwright/test';
import { open } from '../e2e/helpers.js';
import { sampleData, emptyData } from '../fixtures/sample-data.js';

const OUT = path.resolve('captures');

function shooter(page, theme) {
  let n = 0;
  return async (name, wait = 260) => {
    await page.waitForTimeout(wait);
    // Un message temporaire d'une étape précédente ne doit pas polluer la capture suivante.
    if (!name.startsWith('message')) {
      await page.evaluate(() => {
        const root = document.getElementById('toast-root');
        if (root) root.innerHTML = '';
      });
    }
    n += 1;
    await page.screenshot({
      path: path.join(OUT, theme, `${String(n).padStart(2, '0')}-${name}.png`),
    });
  };
}

for (const theme of ['light', 'dark']) {
  test(`captures avec données — ${theme}`, async ({ page }) => {
    const shot = shooter(page, theme);
    await open(page, sampleData({ theme }));

    await shot('accueil');

    await page.click('[data-metric="prot"]');
    await shot('accueil-proteines');

    // Feuille « Nouvel aliment » depuis le bouton +
    await page.click('.fab');
    await shot('feuille-nouvel-aliment', 400);
    await page.click('.sheet .check-row');
    await page.fill('#f-name', 'Œuf');
    await page.fill('#f-kcal', '72');
    await page.fill('#f-prot', '6,3');
    await shot('feuille-nouvel-aliment-unite');
    await page.click('.sheet .check-row');
    await page.fill('#f-name', 'Pâtes');
    await page.fill('#f-kcal', '9999');
    await shot('feuille-nouvel-aliment-erreur');
    await page.keyboard.press('Escape');

    // Journée remplie
    await page.goto('/#/jour/2026-09-21');
    await shot('jour-rempli');
    await page.evaluate(() => document.querySelector('.day-main').scrollTo(0, 9999));
    await shot('jour-rempli-bas');

    // Feuille « Ajouter à Repas soir » : sélecteur puis quantité
    await page.click('section.meal[data-meal="soir"] .add-btn');
    await shot('feuille-ajouter-selecteur', 400);
    await page.fill('.sheet #picker-search', 'zzz');
    await shot('feuille-ajouter-aucun-resultat');
    await page.fill('.sheet #picker-search', '');
    await page.click('.sheet .food-row:has-text("Pâtes")');
    await page.fill('.sheet #q-grams', '300');
    await shot('feuille-ajouter-quantite');
    await page.keyboard.press('Escape');

    // Feuille « Modifier » une entrée
    await page.click('section.meal[data-meal="soir"] .entry');
    await shot('feuille-modifier-entree', 400);
    await page.keyboard.press('Escape');

    // Message « Entrée supprimée · Annuler »
    await page.click('section.meal[data-meal="grignotage"] .entry');
    await page.click('.sheet [data-delete]');
    await shot('message-suppression', 400);

    // Jour sans aucune entrée
    await page.goto('/#/jour/2026-10-12');
    await shot('jour-vide');

    // Bornes de navigation
    await page.goto('/#/jour/2026-10-21');
    await shot('jour-dernier');

    // Paramètres
    await page.goto('/#/parametres');
    await shot('parametres');
    await page.evaluate(() => document.querySelector('.plain-main').scrollTo(0, 9999));
    await shot('parametres-bas');

    // Mes aliments
    await page.goto('/#/aliments');
    await shot('aliments-liste');
    await page.click('.food-row:has-text("Fromage")');
    await shot('feuille-modifier-aliment', 400);
    await page.click('.sheet [data-delete]');
    await shot('feuille-supprimer-aliment');
    await page.keyboard.press('Escape');
    await page.fill('#foods-search', 'poul');
    await shot('aliments-recherche');

    // Feuille d'import : résumé et erreur
    await page.evaluate(() => {
      const input = document.querySelector('#import-file');
      if (input) input.click();
    });
  });

  test(`captures états vides — ${theme}`, async ({ page }) => {
    const shot = shooter(page, `${theme}-vide`);
    await open(page, emptyData({ theme }));

    await shot('accueil-vide');

    await page.goto('/#/jour/2026-09-21');
    await shot('jour-vide');

    await page.click('section.meal[data-meal="midi"] .add-btn');
    await shot('feuille-ajouter-sans-aliment', 400);
    await page.keyboard.press('Escape');

    await page.goto('/#/parametres');
    await shot('parametres-vide');

    await page.goto('/#/aliments');
    await shot('aliments-vide');

    await page.click('[aria-label="Nouvel aliment"]');
    await shot('feuille-nouvel-aliment-vide', 400);
  });
}

test('captures des feuilles d’import', async ({ page }, testInfo) => {
  const fs = await import('node:fs');
  const shot = shooter(page, 'import');
  await open(page, sampleData({ theme: 'light' }), { hash: '#/parametres' });

  const good = testInfo.outputPath('bonne.json');
  fs.writeFileSync(good, JSON.stringify(sampleData({ theme: 'light' })), 'utf8');
  await page.setInputFiles('#import-file', good);
  await shot('import-resume', 400);
  await page.keyboard.press('Escape');

  const bad = testInfo.outputPath('mauvaise.json');
  fs.writeFileSync(bad, 'pas du json', 'utf8');
  await page.setInputFiles('#import-file', bad);
  await shot('import-erreur', 400);
});
