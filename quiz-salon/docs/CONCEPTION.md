# Quiz de salon

Jeu de culture générale en français pour télé et téléphones Android/iPhone. Écran hôte avec QR et code de six caractères, aucun compte joueur. 1 à 32 joueurs, six catégories, niveaux facile/intermédiaire/expert ou progression, parties 10/20/30 questions, quatre réponses, explications sourcées, score serveur, podium et revanche sans rescanner.

Choix du réalisateur : pages statiques autonomes dans `quiz-salon/` du dépôt public existant Exercices-francais, déjà publié sur GitHub Pages. Synchronisation par la nouvelle fonction Supabase `quiz-salon`, sans toucher aux fonctions scolaires. Un serveur est nécessaire pour partager une partie entre appareils. Alternatives écartées : état local seul (pas de multijoueur), nouveau service Node à héberger (configuration supplémentaire).

Le serveur possède les questions, l'horloge, les jetons et les scores. Jetons aléatoires séparés hôte/joueurs, hachés au stockage, jamais dans les QR. Tables préfixées `quiz_salon_`, RLS, aucune permission anonyme. Écritures concurrentes par comparaison de révision avec nouvelle tentative. Expiration 24 h. Retour d'un téléphone sans perdre le score. Les départs ne bloquent pas la partie : l'hôte peut révéler ou retirer un joueur.

Le rythme est manuel entre les questions; le chrono est réglable (20, 30, 45 s ou sans limite). Révélation automatique si tous ont répondu ou si le délai expire. 1000 points par bonne réponse, bonus de vitesse jusqu'à 500 avec chrono, égalités partagées. Six pastilles de catégorie gagnées en répondant correctement; le classement dépend du total. Mode solo local de découverte utilisable sans réseau.

Contrainte pratique : ouvrir la page sur un navigateur télé ou un ordinateur branché/casté vers la télé. Internet requis pour une partie partagée. Banque de 180 questions fixes, culture Québec/Canada et culture générale, sans actualité périssable. Les bonnes réponses ne sont pas envoyées avant la révélation; le code source du jeu est public.

Ajout demandé en cours de réalisation : effets sonores originaux par synthèse Web Audio (clic, arrivée, lancement, question, cinq dernières secondes, fin du chrono, bonne/mauvaise réponse, révélation, victoire), bouton de son, animations d'entrée, points qui apparaissent, confettis et podium. Respect du réglage système de réduction des animations. QR maintenu sur la télé pendant la partie; interface téléphone distincte avec choix et score personnel.

Version finale : thème bleu, 210 questions, sept catégories dont Québec et Saint-Émile, nombre libre de 1 à 210 (limité au contenu des filtres). Accès Fire TV par navigateur Silk ou raccourci URL AFTVnews; navigation par pavé directionnel/clavier.
