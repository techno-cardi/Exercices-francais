# Cardinal - Synchronisation Mozaïk

Extension Chrome Manifest V3 pour envoyer directement une activité et ses résultats depuis la console Cardinal vers une session Mozaïk déjà ouverte.

## Installation locale

1. Télécharge ou clone le dépôt `techno-cardi/Exercices-francais`.
2. Ouvre `chrome://extensions`.
3. Active **Mode développeur**.
4. Clique **Charger l’extension non empaquetée**.
5. Sélectionne le dossier `resultats/mozaik/extension`.
6. Ouvre Mozaïk Portail et connecte-toi normalement.
7. Ouvre la console de synchronisation Cardinal, puis utilise **Envoyer dans Mozaïk**.

## Sécurité

- Le jeton de session Mozaïk reste dans l’onglet Mozaïk.
- L’extension n’envoie jamais ce jeton à GitHub ou Supabase.
- Les numéros de fiche utilisés pour associer les élèves sont lus localement depuis Mozaïk au moment de la synchronisation.
- L’extension ne reçoit de la console que le lot de synchronisation déjà préparé.

## Portée

Version 0.1.0 :
- création et mise à jour d’activités;
- envoi des résultats;
- résolution automatique de Lire / Écrire / Communiquer oralement;
- adaptation automatique du préfixe d’année scolaire dans les identifiants de groupe;
- arrêt complet si un élève ne peut pas être associé sans ambiguïté.
