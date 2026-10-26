# Vue d’ensemble : compétences, saisie et suivi

Objectif: regrouper les colonnes Lire/Écrire/Oral par bouton, permettre la saisie directe sans perdre de notes, et proposer une liste de suivi explicable.

Choix: conserver la vue unique et les API existantes. Regroupement facultatif avec en-têtes de compétence, ordre chronologique conservé dans chaque groupe, catégories multiples/non précisées explicites. La saisie est activée par un bouton et reste en points même si les pourcentages sont affichés. Entrée/Tab/quitter une case enregistre; Échap annule. Archives en consultation.

Les enregistrements ne transmettent que la note (jamais une ancienne copie des commentaires). Le serveur compare la note et le maximum vus avant d’enregistrer, puis la transaction existante protège les changements survenus pendant la requête. Erreur visible, navigation/tri attendent la sauvegarde et permettent d’annuler une saisie en erreur; aucune publication Formative/Mozaïk automatique.

Suivi par compétence ET étape, aucune moyenne globale entre étapes. Pondérations positives lorsqu’elles sont complètes; sinon moyenne indicative des pourcentages avec mention explicite. Pondération zéro exclue du calcul. Seuil de vigilance modifiable, seuil d’échec distinct. Notes absentes exclues des moyennes et décrites comme non notées, sans supposer un travail non remis. Raisons et nombre de notes visibles; une seule note est signalée provisoire.

- [x] Tests RED/GREEN : regroupement complet et stable, moyennes/poids/étapes, manquants, seuils et absence de faux échecs; validation serveur des conflits/max; état de sauvegarde/navigation et archives.
- [x] Migration additive du lecteur de vue: compétences/poids/date/année et métadonnées d’édition, aucun résultat modifié.
- [x] Module pur pour classement/suivi, éditeur de cases et interface compacte; protection des changements de groupe/année/tri pendant la sauvegarde.
- [x] Régression Gestion complète, essais Chrome synthétiques d’édition/erreur/reprise et contrôle réel en lecture; publier et comparer les empreintes des données.

