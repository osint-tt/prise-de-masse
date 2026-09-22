// storage.js — lecture / écriture localStorage, migration, export / import.

import { APP_VERSION, defaultData, migrate, validateData, dateKey } from './logic.js';

export const STORAGE_KEY = 'prise-de-masse';

/** Lit les données. Toujours un objet valide, même si le stockage est vide ou corrompu. */
export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: defaultData(), warning: "Stockage indisponible : les données ne seront pas conservées." };
  }
  if (!raw) return { data: defaultData() };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: defaultData(), warning: 'Données illisibles : repartir de zéro.' };
  }
  const migrated = migrate(parsed);
  if (!migrated) return { data: defaultData(), warning: 'Données illisibles : repartir de zéro.' };
  return { data: migrated };
}

/** Écrit les données. Jamais d'échec silencieux : le résultat est toujours vérifié. */
export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (err) {
    const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    return {
      ok: false,
      error: full
        ? 'Mémoire pleine : impossible d’enregistrer.'
        : 'Enregistrement impossible sur cet appareil.',
    };
  }
}

/** Demande au navigateur de ne pas effacer le stockage. */
export async function requestPersist() {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
  } catch {
    /* sans importance */
  }
  return false;
}

export function exportFilename(now = new Date()) {
  return `protal-${dateKey(now)}.json`;
}

export function exportJson(data) {
  return JSON.stringify({ ...data, exportedWith: APP_VERSION }, null, 2);
}

/**
 * Partage natif si disponible (iPhone), sinon téléchargement classique.
 * @returns {Promise<'share'|'download'|'cancelled'>}
 */
export async function exportData(data, now = new Date()) {
  const json = exportJson(data);
  const filename = exportFilename(now);
  const blob = new Blob([json], { type: 'application/json' });

  if (typeof File === 'function' && navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'share';
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // sinon : on retombe sur le téléchargement
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'download';
}

/**
 * Analyse un fichier de sauvegarde sans rien modifier.
 * @returns {{ok:true, data:Object, summary:{foods:number,days:number}}|{ok:false, error:string}}
 */
export function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Fichier illisible : ce n’est pas du JSON.' };
  }
  return validateData(parsed);
}
