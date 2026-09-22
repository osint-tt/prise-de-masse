# Prise de masse

Petite application mobile pour noter ce que je mange et suivre mes calories et mes
protéines, repas par repas et jour par jour, du 21 septembre au 21 octobre 2026.

**L'app : https://osint-tt.github.io/prise-de-masse/**

Tout reste sur le téléphone : aucun compte, aucun serveur, aucune requête vers
l'extérieur. Elle fonctionne hors connexion une fois ouverte la première fois.

Les aliments se saisissent pour 100 g, ou **à l'unité** (un œuf, une banane) en cochant
« Aliment à l'unité » à la création. L'accueil affiche la moyenne par jour depuis le début
de la période, sur les journées terminées — le jour en cours n'est pas compté.

Le graphique démarre toujours à 2 000 kcal / 60 g plutôt qu'à zéro, pour que les écarts entre
journées restent lisibles (constantes `CHART_FLOORS` dans `js/logic.js`). Une journée sous ce
seuil garde une petite amorce sur la ligne du bas ; son total exact reste lisible au tap.

## Installer sur le téléphone

**iPhone (Safari)** — ouvrir l'URL dans Safari → bouton Partager → « Sur l'écran d'accueil ».

**Android (Chrome)** — ouvrir l'URL dans Chrome → menu ⋮ → « Installer l'application »
(ou « Ajouter à l'écran d'accueil »).

> **Important : installer l'app AVANT de saisir des données.**
> Sur iPhone, Safari et l'app installée ne partagent pas leur stockage : ce qui est
> saisi dans Safari n'apparaîtra pas dans l'app installée.

## Sauvegarder

Les données vivent uniquement sur le téléphone. De temps en temps :
**Paramètres → Exporter** crée un fichier `prise-de-masse-AAAA-MM-JJ.json`
(partage natif sur iPhone, téléchargement ailleurs).
**Paramètres → Importer** le relit, affiche un résumé et demande confirmation
avant de remplacer les données.

## Modifier l'app plus tard

1. Changer le code.
2. Incrémenter `APP_VERSION` dans `js/logic.js` — c'est la source unique de la version :
   l'app l'affiche dans les paramètres et la passe au service worker (`./sw.js?v=…`),
   qui s'en sert pour nommer son cache. Sans ce changement, le téléphone garde l'ancienne version.
3. Lancer les tests : `npm test`.
4. `git push`.

Au prochain lancement, le téléphone détecte la nouvelle version et affiche
« Mise à jour disponible · Recharger ». Une mise à jour ne touche jamais aux données.

## En local

```bash
npm install            # outils de développement uniquement
npm start              # http://127.0.0.1:4173/
npm test               # tests unitaires + end-to-end
npm run test:unit      # tests unitaires seuls (node --test, sans dépendance)
npm run test:e2e       # Playwright, Chromium + WebKit
npm run icons          # régénère les PNG des icônes à partir des SVG
npm run shots          # captures de tous les écrans, dans captures/
```

Playwright a besoin de ses navigateurs la première fois :
`npx playwright install chromium webkit`.

## Comment c'est fait

HTML, CSS et JavaScript (modules ES), sans framework et sans étape de build : les
fichiers du dépôt sont servis tels quels par GitHub Pages. L'app elle-même n'a
aucune dépendance ; Playwright et qrcode-terminal ne servent qu'au développement.

| Fichier | Rôle |
| --- | --- |
| `index.html` | page unique |
| `css/style.css` | thèmes clair / sombre, tout en variables CSS |
| `js/logic.js` | logique pure : calculs, dates, parsing, validation, migration |
| `js/storage.js` | localStorage, export / import |
| `js/app.js` | interface, navigation, graphique SVG |
| `sw.js` | service worker : cache d'abord, `index.html` en secours hors ligne |
| `tests/unit/` | tests unitaires (`node --test`) |
| `tests/e2e/` | tests end-to-end (Playwright) |
| `tests/visual/` | captures d'écran pour la relecture visuelle |
| `tools/serve.js` | serveur statique local, sans dépendance |
