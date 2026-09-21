// Fixe le fuseau AVANT le chargement de js/logic.js.
// Les imports ES sont évalués dans l'ordre : ce module doit être importé en premier.
process.env.TZ = 'Europe/Paris';
