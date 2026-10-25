// Renouvellement du 24 octobre 2026 : 200 nouvelles questions. Aucune des 210 anciennes n'est sélectionnable.
// Réponse vraie en position 0; moteur mélange les choix pour chaque partie.
export const LOCAL_THEMES=[
 {id:'quartiers',name:'Quartiers et toponymie'},
 {id:'histoire',name:'Histoire municipale'},
 {id:'patrimoine',name:'Patrimoine et architecture'},
 {id:'culture',name:'Culture et sports'},
 {id:'nature',name:'Nature et territoire'}
];
export const CATEGORIES=[
 {id:'local',name:'Québec et Saint-Émile',icon:'⌂',color:'#8ebcff'},
 {id:'geo',name:'Géographie',icon:'🌍',color:'#6eafff'},
 {id:'histoire',name:'Histoire',icon:'⌛',color:'#f7c85e'},
 {id:'culture',name:'Arts et culture',icon:'♫',color:'#c8a0ff'},
 {id:'sport',name:'Sports et jeux',icon:'★',color:'#ff956e'},
 {id:'science',name:'Sciences et nature',icon:'✿',color:'#77d8b1'},
 {id:'mots',name:'Mots et logique',icon:'✎',color:'#f3a1c5'}
];
export const QUESTIONS=
[
 {
  "id": "2026-local-001",
  "category": "local",
  "level": 3,
  "text": "Quelle superficie approximative possède le lac Saint-Charles?",
  "options": [
   "3,6 km²",
   "0,4 km²",
   "12 km²",
   "25 km²"
  ],
  "correct": 0,
  "explanation": "La Ville indique une superficie d'environ 3,6 kilomètres carrés.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/espace/2025/billet-lac-saint-charles.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-002",
  "category": "local",
  "level": 1,
  "text": "Quel axe traverse le cœur du quartier Saint-Émile du nord au sud?",
  "options": [
   "Avenue Lapierre",
   "Boulevard Charest",
   "Avenue Cartier",
   "Boulevard René-Lévesque"
  ],
  "correct": 0,
  "explanation": "L'avenue Lapierre est un axe principal du quartier, croisant la rue de la Faune.",
  "source": "https://www.ville.quebec.qc.ca/apropos/avis-publics/reglements-fiche.aspx?IdAvis=6067",
  "theme": "quartiers"
 },
 {
  "id": "2026-local-003",
  "category": "local",
  "level": 3,
  "text": "À quelle fonction servait le bâtiment construit en 1927 au 1596, avenue Lapierre, à Saint-Émile?",
  "options": [
   "Un presbytère",
   "Une caserne de pompiers",
   "Une école de rang",
   "Une mairie"
  ],
  "correct": 0,
  "explanation": "Le répertoire patrimonial de la Ville identifie le bâtiment comme l'ancien presbytère de Saint-Émile.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/bati/fiche.aspx?fiche=5216",
  "theme": "patrimoine"
 },
 {
  "id": "2026-local-004",
  "category": "local",
  "level": 1,
  "text": "Quelle activité a marqué le lac Saint-Charles dès la fin du XVIIIe siècle?",
  "options": [
   "La villégiature",
   "La pêche hauturière",
   "La sidérurgie",
   "L'extraction du sel"
  ],
  "correct": 0,
  "explanation": "La beauté du lac a attiré touristes et villégiateurs pendant plus de deux siècles.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/espace/2025/billet-lac-saint-charles.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-005",
  "category": "local",
  "level": 3,
  "text": "En 1975, combien de fabriques de chaussures ou de mocassins comptait encore Saint-Émile?",
  "options": [
   "Neuf",
   "Deux",
   "Dix-sept",
   "Vingt-huit"
  ],
  "correct": 0,
  "explanation": "Une publication patrimoniale de la Ville en dénombre neuf à cette date.",
  "source": "https://www.ville.quebec.qc.ca/publications/patrimoine/docs/D%C3%A9couvrir%20Qu%C3%A9bec%20-%20Arrondissement%20de%20La%20Haute-Saint-Charles.pdf",
  "theme": "histoire"
 },
 {
  "id": "2026-local-006",
  "category": "local",
  "level": 2,
  "text": "Quel autre axe important croise l'avenue Lapierre à Saint-Émile?",
  "options": [
   "Rue de la Faune",
   "Chemin Sainte-Foy",
   "Boulevard Hamel",
   "Rue Saint-Jean"
  ],
  "correct": 0,
  "explanation": "La rue de la Faune forme l'axe est-ouest du noyau de Saint-Émile.",
  "source": "https://www.ville.quebec.qc.ca/apropos/avis-publics/reglements-fiche.aspx?IdAvis=6067",
  "theme": "quartiers"
 },
 {
  "id": "2026-local-007",
  "category": "local",
  "level": 1,
  "text": "Quelle spécialité industrielle a fait la réputation historique de Saint-Émile?",
  "options": [
   "Les pantoufles et les mocassins",
   "La construction navale",
   "Les instruments de musique",
   "La transformation du papier"
  ],
  "correct": 0,
  "explanation": "Plusieurs entreprises locales fabriquaient des pantoufles et des mocassins en cuir.",
  "source": "https://www.ville.quebec.qc.ca/publications/patrimoine/docs/histoire_de_raconter_travail_du_cuir.pdf",
  "theme": "culture"
 },
 {
  "id": "2026-local-008",
  "category": "local",
  "level": 2,
  "text": "Quelle particularité distingue La Haute-Saint-Charles parmi les six arrondissements de Québec?",
  "options": [
   "C'est le plus vaste en superficie",
   "C'est le plus ancien quartier habité",
   "Il est entièrement insulaire",
   "Il borde directement la rive sud"
  ],
  "correct": 0,
  "explanation": "Avec plus de 148 km², il est le plus vaste arrondissement de Québec.",
  "source": "https://www.ville.quebec.qc.ca/apropos/portrait/geographie/arrondissements/lahautesaintcharles/index.aspx",
  "theme": "quartiers"
 },
 {
  "id": "2026-local-009",
  "category": "local",
  "level": 2,
  "text": "Dans quel secteur de Québec se trouve la manufacture patrimoniale Alfred-Cloutier?",
  "options": [
   "Saint-Émile",
   "Limoilou",
   "Montcalm",
   "Cap-Rouge"
  ],
  "correct": 0,
  "explanation": "Cette ancienne manufacture témoigne de l'industrie du cuir de Saint-Émile.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/bati/fiche.aspx?fiche=5222",
  "theme": "patrimoine"
 },
 {
  "id": "2026-local-010",
  "category": "local",
  "level": 2,
  "text": "Quel type d'activité a surtout assuré le développement ancien de Neufchâtel, à Québec?",
  "options": [
   "L'agriculture",
   "La navigation océanique",
   "Les mines de cuivre",
   "L'aéronautique"
  ],
  "correct": 0,
  "explanation": "Neufchâtel s'est développé principalement grâce à l'agriculture.",
  "source": "https://www.ville.quebec.qc.ca/apropos/portrait/geographie/arrondissements/lahautesaintcharles/index.aspx",
  "theme": "histoire"
 },
 {
  "id": "2026-local-011",
  "category": "local",
  "level": 1,
  "text": "Quelle activité économique a fortement contribué à la naissance de Lac-Saint-Charles?",
  "options": [
   "L'exploitation du bois",
   "L'industrie textile",
   "La pêche à la morue",
   "La fabrication de trains"
  ],
  "correct": 0,
  "explanation": "La Ville associe l'essor ancien de Lac-Saint-Charles à l'exploitation du bois.",
  "source": "https://www.ville.quebec.qc.ca/apropos/portrait/geographie/arrondissements/lahautesaintcharles/index.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-012",
  "category": "local",
  "level": 1,
  "text": "Quel grand lac de Québec alimente la rivière Saint-Charles à sa source?",
  "options": [
   "Lac Saint-Charles",
   "Lac Beauport",
   "Lac Saint-Joseph",
   "Lac Delage"
  ],
  "correct": 0,
  "explanation": "La rivière Saint-Charles prend sa source dans le lac du même nom.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/espace/2025/billet-lac-saint-charles.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-013",
  "category": "local",
  "level": 2,
  "text": "Quel secteur se joint à l'arrondissement de La Haute-Saint-Charles en 2009?",
  "options": [
   "Val-Bélair",
   "Sillery",
   "Cap-Rouge",
   "Montcalm"
  ],
  "correct": 0,
  "explanation": "Val-Bélair y est intégré depuis le remaniement des arrondissements de 2009.",
  "source": "https://www.ville.quebec.qc.ca/apropos/portrait/geographie/arrondissements/lahautesaintcharles/index.aspx",
  "theme": "quartiers"
 },
 {
  "id": "2026-local-014",
  "category": "local",
  "level": 2,
  "text": "Quelle entreprise de cuir de Saint-Émile ferme ses portes en 1990?",
  "options": [
   "Bastien et Frères",
   "Alfred Cloutier",
   "La Cordée",
   "La Baie"
  ],
  "correct": 0,
  "explanation": "Bastien et Frères ferme en 1990; son bâtiment est ensuite transformé pour un usage communautaire.",
  "source": "https://www.ville.quebec.qc.ca/publications/patrimoine/docs/D%C3%A9couvrir%20Qu%C3%A9bec%20-%20Arrondissement%20de%20La%20Haute-Saint-Charles.pdf",
  "theme": "histoire"
 },
 {
  "id": "2026-local-015",
  "category": "local",
  "level": 3,
  "text": "À qui le nom du lac Saint-Charles rend-il hommage?",
  "options": [
   "Charles Desboves",
   "Charles de Gaulle",
   "Charles Dickens",
   "Charles de Montmagny"
  ],
  "correct": 0,
  "explanation": "Le lac porte le prénom d'un bienfaiteur des Récollets, Charles Desboves.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/espace/2025/billet-lac-saint-charles.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-016",
  "category": "local",
  "level": 3,
  "text": "En quelle année un barrage hausse-t-il le niveau du lac Saint-Charles?",
  "options": [
   "1934",
   "1879",
   "1908",
   "1967"
  ],
  "correct": 0,
  "explanation": "Un barrage aménagé en 1934 modifie les rives du lac; il est remplacé en 1948.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/espace/2025/billet-lac-saint-charles.aspx",
  "theme": "nature"
 },
 {
  "id": "2026-local-017",
  "category": "local",
  "level": 3,
  "text": "Quel drame entraîne la reconstruction de la maison Hilaire-Barbeau en 1950?",
  "options": [
   "Un incendie",
   "Une inondation",
   "Un glissement de terrain",
   "Un tremblement de terre"
  ],
  "correct": 0,
  "explanation": "La fiche patrimoniale précise que le bâtiment est reconstruit après un incendie.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/bati/fiche.aspx?fiche=208075",
  "theme": "patrimoine"
 },
 {
  "id": "2026-local-018",
  "category": "local",
  "level": 2,
  "text": "Quel bâtiment de Saint-Émile est associé au commerçant et conseiller municipal Hilaire Barbeau?",
  "options": [
   "Une maison de la rue de la Faune",
   "Le Château Frontenac",
   "La gare du Palais",
   "Le Morrin Centre"
  ],
  "correct": 0,
  "explanation": "La maison Hilaire-Barbeau est recensée au 2351, rue de la Faune.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/bati/fiche.aspx?fiche=208075",
  "theme": "patrimoine"
 },
 {
  "id": "2026-local-019",
  "category": "local",
  "level": 2,
  "text": "Quel ancien secteur de Québec s'est développé notamment grâce à la villégiature et à l'agriculture?",
  "options": [
   "Val-Bélair",
   "Vieux-Limoilou",
   "Saint-Roch",
   "Montcalm"
  ],
  "correct": 0,
  "explanation": "La Ville associe l'origine de Val-Bélair à la villégiature et à l'agriculture.",
  "source": "https://www.ville.quebec.qc.ca/apropos/portrait/geographie/arrondissements/lahautesaintcharles/index.aspx",
  "theme": "quartiers"
 },
 {
  "id": "2026-local-020",
  "category": "local",
  "level": 3,
  "text": "Sur quelle rue se trouve la manufacture Alfred-Cloutier?",
  "options": [
   "William-Marsh",
   "Saint-Vallier",
   "Cartier",
   "Saint-Joseph"
  ],
  "correct": 0,
  "explanation": "La Ville répertorie la manufacture au 1737, rue William-Marsh.",
  "source": "https://www.ville.quebec.qc.ca/citoyens/patrimoine/bati/fiche.aspx?fiche=5222",
  "theme": "patrimoine"
 },
 {
  "id": "2026-geo-001",
  "category": "geo",
  "level": 2,
  "text": "Quel golfe sépare l'Iran de plusieurs États de la péninsule Arabique?",
  "options": [
   "Golfe Persique",
   "Golfe de Gascogne",
   "Golfe du Saint-Laurent",
   "Golfe d'Oman"
  ],
  "correct": 0,
  "explanation": "Le golfe Persique s'étend entre l'Iran et la péninsule Arabique.",
  "source": "https://www.britannica.com/place/Persian-Gulf"
 },
 {
  "id": "2026-geo-002",
  "category": "geo",
  "level": 3,
  "text": "Quelle fosse océanique abrite le point connu le plus profond des océans?",
  "options": [
   "Fosse des Mariannes",
   "Fosse de Porto Rico",
   "Fosse du Pérou-Chili",
   "Fosse de Java"
  ],
  "correct": 0,
  "explanation": "Le Challenger Deep se trouve dans la fosse des Mariannes, dans le Pacifique.",
  "source": "https://oceanservice.noaa.gov/facts/oceandepth.html"
 },
 {
  "id": "2026-geo-003",
  "category": "geo",
  "level": 1,
  "text": "Quel pays est situé à l'extrémité sud du continent africain?",
  "options": [
   "Afrique du Sud",
   "Namibie",
   "Mozambique",
   "Botswana"
  ],
  "correct": 0,
  "explanation": "Le cap des Aiguilles, à la pointe méridionale de l'Afrique, est en Afrique du Sud.",
  "source": "https://www.britannica.com/place/Cape-Agulhas"
 },
 {
  "id": "2026-geo-004",
  "category": "geo",
  "level": 3,
  "text": "Quels trois pays se partagent l’île de Bornéo?",
  "options": [
   "Indonésie, Malaisie et Brunéi",
   "Thaïlande, Myanmar et Laos",
   "Vietnam, Cambodge et Laos",
   "Philippines, Japon et Taïwan"
  ],
  "correct": 0,
  "explanation": "Bornéo est partagé entre l'Indonésie, la Malaisie et le Brunéi.",
  "source": "https://www.britannica.com/place/Borneo-island-Pacific-Ocean"
 },
 {
  "id": "2026-geo-005",
  "category": "geo",
  "level": 3,
  "text": "Quel grand fleuve du Canada se jette dans la mer de Beaufort?",
  "options": [
   "Mackenzie",
   "Nelson",
   "Fraser",
   "Saint-Jean"
  ],
  "correct": 0,
  "explanation": "Le Mackenzie s'écoule vers l'océan Arctique et débouche dans la mer de Beaufort.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/fleuve-mackenzie"
 },
 {
  "id": "2026-geo-006",
  "category": "geo",
  "level": 1,
  "text": "Sur quel continent se trouve le massif de l'Atlas?",
  "options": [
   "Afrique",
   "Asie",
   "Amérique du Sud",
   "Europe"
  ],
  "correct": 0,
  "explanation": "L'Atlas traverse notamment le Maroc, l'Algérie et la Tunisie.",
  "source": "https://www.britannica.com/place/Atlas-Mountains"
 },
 {
  "id": "2026-geo-007",
  "category": "geo",
  "level": 1,
  "text": "Dans quel pays se dresse le mont Kilimandjaro?",
  "options": [
   "Tanzanie",
   "Kenya",
   "Ouganda",
   "Éthiopie"
  ],
  "correct": 0,
  "explanation": "Le Kilimandjaro est situé dans le nord-est de la Tanzanie.",
  "source": "https://whc.unesco.org/en/list/403/"
 },
 {
  "id": "2026-geo-008",
  "category": "geo",
  "level": 2,
  "text": "Quelle province abrite le parc national de Gros-Morne?",
  "options": [
   "Terre-Neuve-et-Labrador",
   "Québec",
   "Manitoba",
   "Alberta"
  ],
  "correct": 0,
  "explanation": "Le parc se trouve sur l'île de Terre-Neuve et est reconnu par l'UNESCO.",
  "source": "https://parcs.canada.ca/pn-np/nl/grosmorne"
 },
 {
  "id": "2026-geo-009",
  "category": "geo",
  "level": 2,
  "text": "Quelle mer intérieure a fortement rétréci après le détournement des fleuves qui l'alimentaient?",
  "options": [
   "Mer d'Aral",
   "Mer Caspienne",
   "Mer de Marmara",
   "Mer d'Azov"
  ],
  "correct": 0,
  "explanation": "La mer d'Aral a perdu une grande partie de sa superficie en raison de prélèvements fluviaux.",
  "source": "https://www.britannica.com/place/Aral-Sea"
 },
 {
  "id": "2026-geo-010",
  "category": "geo",
  "level": 2,
  "text": "Quel canal relie directement la Méditerranée à la mer Rouge?",
  "options": [
   "Canal de Suez",
   "Canal de Panama",
   "Canal de Corinthe",
   "Canal de Kiel"
  ],
  "correct": 0,
  "explanation": "Le canal de Suez traverse l'isthme égyptien de Suez.",
  "source": "https://www.britannica.com/topic/Suez-Canal"
 },
 {
  "id": "2026-geo-011",
  "category": "geo",
  "level": 3,
  "text": "Dans quel pays le delta intérieur de l'Okavango se déploie-t-il principalement?",
  "options": [
   "Botswana",
   "Namibie",
   "Zambie",
   "Angola"
  ],
  "correct": 0,
  "explanation": "L'Okavango forme un delta intérieur dans le nord du Botswana.",
  "source": "https://whc.unesco.org/en/list/1432/"
 },
 {
  "id": "2026-geo-012",
  "category": "geo",
  "level": 1,
  "text": "Quel lac sépare en partie l'Ontario des États-Unis, au nord du Michigan?",
  "options": [
   "Lac Supérieur",
   "Grand lac de l'Ours",
   "Lac Winnipeg",
   "Lac Athabasca"
  ],
  "correct": 0,
  "explanation": "Le lac Supérieur appartient au système des Grands Lacs et borde l'Ontario et le Michigan.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/lac-superieur"
 },
 {
  "id": "2026-geo-013",
  "category": "geo",
  "level": 1,
  "text": "Quel pays africain a pour capitale Addis-Abeba?",
  "options": [
   "Éthiopie",
   "Érythrée",
   "Djibouti",
   "Ouganda"
  ],
  "correct": 0,
  "explanation": "Addis-Abeba est la capitale fédérale de l'Éthiopie.",
  "source": "https://www.britannica.com/place/Addis-Ababa"
 },
 {
  "id": "2026-geo-014",
  "category": "geo",
  "level": 1,
  "text": "Quel détroit sépare la Russie de l'Alaska?",
  "options": [
   "Béring",
   "Gibraltar",
   "Ormuz",
   "Davis"
  ],
  "correct": 0,
  "explanation": "Le détroit de Béring sépare l'Asie de l'Amérique du Nord.",
  "source": "https://www.britannica.com/place/Bering-Strait"
 },
 {
  "id": "2026-geo-015",
  "category": "geo",
  "level": 2,
  "text": "Quelle ville québécoise se trouve à l'embouchure de la rivière Rimouski?",
  "options": [
   "Rimouski",
   "Matane",
   "Amqui",
   "Rivière-du-Loup"
  ],
  "correct": 0,
  "explanation": "Rimouski est située au bord du Saint-Laurent, près de l'embouchure de sa rivière homonyme.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/rimouski"
 },
 {
  "id": "2026-geo-016",
  "category": "geo",
  "level": 3,
  "text": "Quelle île du Québec est célèbre pour son immense cratère d'impact?",
  "options": [
   "Île René-Levasseur",
   "Île d'Orléans",
   "Île Bonaventure",
   "Île de Montréal"
  ],
  "correct": 0,
  "explanation": "L'île René-Levasseur occupe le centre de l'astroblème de Manicouagan.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/reservoir-manicouagan"
 },
 {
  "id": "2026-geo-017",
  "category": "geo",
  "level": 2,
  "text": "Quel détroit constitue une voie de passage entre l'Atlantique et la mer Méditerranée?",
  "options": [
   "Gibraltar",
   "Bosphore",
   "Dardanelles",
   "Malacca"
  ],
  "correct": 0,
  "explanation": "Le détroit de Gibraltar sépare le sud de l'Espagne du nord-ouest de l'Afrique.",
  "source": "https://www.britannica.com/place/Strait-of-Gibraltar"
 },
 {
  "id": "2026-geo-018",
  "category": "geo",
  "level": 2,
  "text": "Quels deux pays partagent les eaux du lac Titicaca?",
  "options": [
   "Pérou et Bolivie",
   "Pérou et Équateur",
   "Chili et Argentine",
   "Bolivie et Paraguay"
  ],
  "correct": 0,
  "explanation": "Le lac Titicaca se trouve à la frontière du Pérou et de la Bolivie.",
  "source": "https://www.britannica.com/place/Lake-Titicaca"
 },
 {
  "id": "2026-geo-019",
  "category": "geo",
  "level": 3,
  "text": "Dans quel pays se trouve l'embouchure principale du Mékong?",
  "options": [
   "Vietnam",
   "Cambodge",
   "Laos",
   "Thaïlande"
  ],
  "correct": 0,
  "explanation": "Le delta du Mékong débouche dans la mer de Chine méridionale au Vietnam.",
  "source": "https://www.britannica.com/place/Mekong-River"
 },
 {
  "id": "2026-geo-020",
  "category": "geo",
  "level": 1,
  "text": "Dans quelle mer débouche le Danube après avoir traversé l'Europe?",
  "options": [
   "Mer Noire",
   "Mer Baltique",
   "Mer Adriatique",
   "Mer Égée"
  ],
  "correct": 0,
  "explanation": "Le Danube forme un delta sur le littoral de la mer Noire.",
  "source": "https://www.britannica.com/place/Danube-River"
 },
 {
  "id": "2026-geo-021",
  "category": "geo",
  "level": 1,
  "text": "Quel archipel québécois se situe au milieu du golfe du Saint-Laurent?",
  "options": [
   "Îles de la Madeleine",
   "Îles Mingan",
   "Îles de Boucherville",
   "Îles du Pot à l'Eau-de-Vie"
  ],
  "correct": 0,
  "explanation": "Les Îles de la Madeleine forment un archipel habité dans le golfe du Saint-Laurent.",
  "source": "https://www.quebec.ca/tourisme-et-loisirs/activites-et-sites-touristiques/regions-touristiques"
 },
 {
  "id": "2026-geo-022",
  "category": "geo",
  "level": 2,
  "text": "Quel détroit relie la mer Noire à la mer de Marmara?",
  "options": [
   "Bosphore",
   "Dardanelles",
   "Gibraltar",
   "Messine"
  ],
  "correct": 0,
  "explanation": "Le Bosphore traverse Istanbul et relie la mer Noire à la mer de Marmara.",
  "source": "https://www.britannica.com/place/Bosporus"
 },
 {
  "id": "2026-geo-023",
  "category": "geo",
  "level": 3,
  "text": "Dans quel pays se trouvent les îles Açores?",
  "options": [
   "Portugal",
   "Espagne",
   "Italie",
   "France"
  ],
  "correct": 0,
  "explanation": "Les Açores forment une région autonome portugaise dans l'Atlantique.",
  "source": "https://www.britannica.com/place/Azores"
 },
 {
  "id": "2026-geo-024",
  "category": "geo",
  "level": 3,
  "text": "Quel fleuve coule sur le territoire du Nouveau-Brunswick et rejoint la baie de Fundy?",
  "options": [
   "Fleuve Saint-Jean",
   "Fleuve Churchill",
   "Fleuve Nelson",
   "Fleuve Mackenzie"
  ],
  "correct": 0,
  "explanation": "Le fleuve Saint-Jean se jette dans la baie de Fundy près de Saint John.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/fleuve-saint-jean"
 },
 {
  "id": "2026-geo-025",
  "category": "geo",
  "level": 1,
  "text": "Quel archipel du Pacifique comprend les îles de Maui et d'Oahu?",
  "options": [
   "Hawaï",
   "Samoa",
   "Fidji",
   "Tonga"
  ],
  "correct": 0,
  "explanation": "Maui et Oahu font partie de l'archipel d'Hawaï.",
  "source": "https://www.britannica.com/place/Hawaii-state"
 },
 {
  "id": "2026-geo-026",
  "category": "geo",
  "level": 2,
  "text": "Entre quels territoires se trouve principalement la mer Rouge?",
  "options": [
   "Afrique du Nord-Est et péninsule Arabique",
   "Europe et Asie Mineure",
   "Amérique du Sud et Antarctique",
   "Inde et Sri Lanka"
  ],
  "correct": 0,
  "explanation": "La mer Rouge s'étend entre la côte africaine et la péninsule Arabique.",
  "source": "https://www.britannica.com/place/Red-Sea"
 },
 {
  "id": "2026-geo-027",
  "category": "geo",
  "level": 3,
  "text": "Quel parc national du Manitoba est situé en bordure du lac Clear?",
  "options": [
   "Mont-Riding",
   "Wapusk",
   "Prince-Albert",
   "Kootenay"
  ],
  "correct": 0,
  "explanation": "Le parc du Mont-Riding entoure notamment le lac Clear, au Manitoba.",
  "source": "https://parcs.canada.ca/pn-np/mb/riding"
 },
 {
  "id": "2026-geo-028",
  "category": "geo",
  "level": 2,
  "text": "Quel territoire canadien comprend l'île d'Ellesmere?",
  "options": [
   "Nunavut",
   "Yukon",
   "Territoires du Nord-Ouest",
   "Île-du-Prince-Édouard"
  ],
  "correct": 0,
  "explanation": "L'île d'Ellesmere appartient au Nunavut, dans l'archipel arctique canadien.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/ile-dellesmere"
 },
 {
  "id": "2026-geo-029",
  "category": "geo",
  "level": 2,
  "text": "Dans quelle province se trouve le lac Louise, célèbre pour son eau turquoise?",
  "options": [
   "Alberta",
   "Québec",
   "Ontario",
   "Colombie-Britannique"
  ],
  "correct": 0,
  "explanation": "Le lac Louise fait partie du parc national Banff, en Alberta.",
  "source": "https://parcs.canada.ca/pn-np/ab/banff"
 },
 {
  "id": "2026-geo-030",
  "category": "geo",
  "level": 1,
  "text": "Quelle grande rivière traverse la ville de Winnipeg?",
  "options": [
   "Rivière Rouge",
   "Rivière Bow",
   "Rivière Richelieu",
   "Rivière Liard"
  ],
  "correct": 0,
  "explanation": "La rivière Rouge traverse Winnipeg avant de poursuivre vers le lac Winnipeg.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/riviere-rouge"
 },
 {
  "id": "2026-geo-031",
  "category": "geo",
  "level": 1,
  "text": "Quel pays administre les îles Canaries?",
  "options": [
   "Espagne",
   "Portugal",
   "Maroc",
   "Cap-Vert"
  ],
  "correct": 0,
  "explanation": "Les Canaries constituent une communauté autonome espagnole au large de l'Afrique.",
  "source": "https://www.britannica.com/place/Canary-Islands"
 },
 {
  "id": "2026-geo-032",
  "category": "geo",
  "level": 3,
  "text": "Dans quelle province se trouve la ville de Medicine Hat?",
  "options": [
   "Alberta",
   "Manitoba",
   "Saskatchewan",
   "Ontario"
  ],
  "correct": 0,
  "explanation": "Medicine Hat est une ville du sud-est de l'Alberta.",
  "source": "https://www.canada.ca/fr/immigration-refugies-citoyennete/organisation/publications-guides/decouvrir-canada/lisez-ligne/regions-canada.html"
 },
 {
  "id": "2026-geo-033",
  "category": "geo",
  "level": 3,
  "text": "Quel massif montagneux traverse le parc national de la Gaspésie?",
  "options": [
   "Monts Chic-Chocs",
   "Monts Torngat",
   "Monts Groulx",
   "Monts Adirondacks"
  ],
  "correct": 0,
  "explanation": "Les monts Chic-Chocs occupent une grande partie du parc national de la Gaspésie.",
  "source": "https://www.sepaq.com/pq/gas/"
 },
 {
  "id": "2026-geo-034",
  "category": "geo",
  "level": 2,
  "text": "Quel élément géographique a donné son nom à Trois-Rivières?",
  "options": [
   "Les trois bras de la Saint-Maurice",
   "Trois îles du Saint-Laurent",
   "Trois cascades du Richelieu",
   "Trois baies du lac Saint-Pierre"
  ],
  "correct": 0,
  "explanation": "La rivière Saint-Maurice se divise en plusieurs chenaux à son embouchure.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/trois-rivieres"
 },
 {
  "id": "2026-geo-035",
  "category": "geo",
  "level": 1,
  "text": "Quel État européen n'a aucune frontière terrestre avec un autre État?",
  "options": [
   "Islande",
   "Irlande",
   "Portugal",
   "Danemark"
  ],
  "correct": 0,
  "explanation": "L'Islande est un État insulaire de l'Atlantique Nord sans frontière terrestre internationale.",
  "source": "https://www.britannica.com/place/Iceland"
 },
 {
  "id": "2026-geo-036",
  "category": "geo",
  "level": 3,
  "text": "Quel détroit sépare la péninsule Malaise de l'île de Sumatra?",
  "options": [
   "Malacca",
   "Béring",
   "Torres",
   "Ormuz"
  ],
  "correct": 0,
  "explanation": "Le détroit de Malacca se trouve entre la péninsule Malaise et Sumatra.",
  "source": "https://www.britannica.com/place/Strait-of-Malacca"
 },
 {
  "id": "2026-geo-037",
  "category": "geo",
  "level": 2,
  "text": "Quelle île abrite la ville de Victoria et la ville de Nanaimo?",
  "options": [
   "Île de Vancouver",
   "Île de Montréal",
   "Île de Baffin",
   "Île du Cap-Breton"
  ],
  "correct": 0,
  "explanation": "Victoria et Nanaimo se trouvent toutes deux sur l'île de Vancouver.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/ile-de-vancouver"
 },
 {
  "id": "2026-geo-038",
  "category": "geo",
  "level": 2,
  "text": "Quel grand lac canadien se trouve entièrement à l'intérieur de l'Ontario?",
  "options": [
   "Lac Nipigon",
   "Lac Michigan",
   "Lac Ontario",
   "Lac Érié"
  ],
  "correct": 0,
  "explanation": "Le lac Nipigon est un grand lac situé entièrement en Ontario.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/lac-nipigon"
 },
 {
  "id": "2026-geo-039",
  "category": "geo",
  "level": 3,
  "text": "Quelle ville canadienne est surnommée la « ville des roses » et se trouve en Ontario, à la frontière américaine?",
  "options": [
   "Windsor",
   "Kingston",
   "Thunder Bay",
   "Barrie"
  ],
  "correct": 0,
  "explanation": "Windsor se situe face à Detroit, sur la rive canadienne de la rivière Detroit.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/windsor"
 },
 {
  "id": "2026-geo-040",
  "category": "geo",
  "level": 3,
  "text": "Quel bras de mer borde la ville d'Halifax?",
  "options": [
   "Port d'Halifax",
   "Baie d'Ungava",
   "Baie James",
   "Baie de Quinte"
  ],
  "correct": 0,
  "explanation": "Halifax s'étend autour d'un vaste port naturel de l'Atlantique.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/halifax"
 },
 {
  "id": "2026-geo-041",
  "category": "geo",
  "level": 3,
  "text": "Quels trois pays se partagent le lac Victoria?",
  "options": [
   "Kenya, Ouganda et Tanzanie",
   "Kenya, Éthiopie et Somalie",
   "Tanzanie, Zambie et Malawi",
   "Ouganda, Rwanda et Burundi"
  ],
  "correct": 0,
  "explanation": "Le lac Victoria est partagé par le Kenya, l'Ouganda et la Tanzanie.",
  "source": "https://www.britannica.com/place/Lake-Victoria"
 },
 {
  "id": "2026-geo-042",
  "category": "geo",
  "level": 2,
  "text": "Quelle ville du Québec est située au confluent des rivières Saint-François et Magog?",
  "options": [
   "Sherbrooke",
   "Drummondville",
   "Granby",
   "Rimouski"
  ],
  "correct": 0,
  "explanation": "Sherbrooke s'est développée au confluent de ces deux rivières.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/sherbrooke"
 },
 {
  "id": "2026-geo-043",
  "category": "geo",
  "level": 2,
  "text": "Quelle est la plus grande île de la mer Méditerranée?",
  "options": [
   "Sicile",
   "Sardaigne",
   "Chypre",
   "Crète"
  ],
  "correct": 0,
  "explanation": "La Sicile est la plus vaste île de la Méditerranée.",
  "source": "https://www.britannica.com/place/Sicily"
 },
 {
  "id": "2026-geo-044",
  "category": "geo",
  "level": 1,
  "text": "Dans quel pays se trouve le lac Baïkal?",
  "options": [
   "Russie",
   "Mongolie",
   "Kazakhstan",
   "Chine"
  ],
  "correct": 0,
  "explanation": "Le lac Baïkal se trouve en Sibérie, dans le sud de la Russie.",
  "source": "https://whc.unesco.org/en/list/754/"
 },
 {
  "id": "2026-geo-045",
  "category": "geo",
  "level": 1,
  "text": "Quel détroit sépare Terre-Neuve du Labrador?",
  "options": [
   "Détroit de Belle Isle",
   "Détroit de Juan de Fuca",
   "Détroit de Davis",
   "Détroit d'Hudson"
  ],
  "correct": 0,
  "explanation": "Le détroit de Belle Isle sépare la péninsule du Labrador de l'île de Terre-Neuve.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/detroit-de-belle-isle"
 },
 {
  "id": "2026-geo-046",
  "category": "geo",
  "level": 1,
  "text": "Quels deux États occupent la majeure partie de la péninsule Ibérique?",
  "options": [
   "Espagne et Portugal",
   "France et Italie",
   "Grèce et Turquie",
   "Croatie et Slovénie"
  ],
  "correct": 0,
  "explanation": "L'Espagne et le Portugal constituent l'essentiel de la péninsule Ibérique.",
  "source": "https://www.britannica.com/place/Iberian-Peninsula"
 },
 {
  "id": "2026-geo-047",
  "category": "geo",
  "level": 3,
  "text": "Quel État d'Asie centrale est bordé par la mer Caspienne à l'ouest et la Chine à l'est?",
  "options": [
   "Kazakhstan",
   "Kirghizistan",
   "Tadjikistan",
   "Ouzbékistan"
  ],
  "correct": 0,
  "explanation": "Le Kazakhstan s'étend de la mer Caspienne vers la frontière chinoise.",
  "source": "https://www.britannica.com/place/Kazakhstan"
 },
 {
  "id": "2026-geo-048",
  "category": "geo",
  "level": 2,
  "text": "De quel pays la ville de Dubrovnik fait-elle partie?",
  "options": [
   "Croatie",
   "Slovénie",
   "Monténégro",
   "Albanie"
  ],
  "correct": 0,
  "explanation": "Dubrovnik est une ville côtière croate sur la mer Adriatique.",
  "source": "https://whc.unesco.org/en/list/95/"
 },
 {
  "id": "2026-geo-049",
  "category": "geo",
  "level": 3,
  "text": "Quel golfe borde une partie de la côte atlantique de l'Afrique de l'Ouest?",
  "options": [
   "Golfe de Guinée",
   "Golfe du Bengale",
   "Golfe d'Aden",
   "Golfe de Thaïlande"
  ],
  "correct": 0,
  "explanation": "Le golfe de Guinée se trouve dans l'Atlantique oriental.",
  "source": "https://www.britannica.com/place/Gulf-of-Guinea"
 },
 {
  "id": "2026-geo-050",
  "category": "geo",
  "level": 2,
  "text": "Dans quel plan d'eau se jette la rivière Saguenay?",
  "options": [
   "Fleuve Saint-Laurent",
   "Lac Saint-Jean",
   "Baie James",
   "Lac Saint-Pierre"
  ],
  "correct": 0,
  "explanation": "Le Saguenay rencontre le Saint-Laurent à Tadoussac.",
  "source": "https://parcs.canada.ca/pn-np/qc/saguenay"
 },
 {
  "id": "2026-geo-051",
  "category": "geo",
  "level": 2,
  "text": "À quelle mer le Rhône se jette-t-il en formant un delta dans le sud de la France?",
  "options": [
   "Méditerranée",
   "Mer du Nord",
   "Mer Adriatique",
   "Mer Noire"
  ],
  "correct": 0,
  "explanation": "Le Rhône forme un delta en Camargue et rejoint la Méditerranée.",
  "source": "https://www.britannica.com/place/Rhone-River"
 },
 {
  "id": "2026-geo-052",
  "category": "geo",
  "level": 1,
  "text": "Dans quel pays se trouve le désert d'Atacama?",
  "options": [
   "Chili",
   "Pérou",
   "Namibie",
   "Mongolie"
  ],
  "correct": 0,
  "explanation": "L'Atacama est une région désertique du nord du Chili.",
  "source": "https://www.britannica.com/place/Atacama-Desert"
 },
 {
  "id": "2026-geo-053",
  "category": "geo",
  "level": 3,
  "text": "Quel parc national du Québec est particulièrement associé à une vallée glaciaire dans Charlevoix?",
  "options": [
   "Parc des Hautes-Gorges-de-la-Rivière-Malbaie",
   "Parc d'Oka",
   "Parc du Mont-Saint-Bruno",
   "Parc de Plaisance"
  ],
  "correct": 0,
  "explanation": "Les Hautes-Gorges abritent une vallée encaissée creusée par les glaces.",
  "source": "https://www.sepaq.com/pq/hgo/"
 },
 {
  "id": "2026-geo-054",
  "category": "geo",
  "level": 2,
  "text": "Quel lac des Territoires du Nord-Ouest est célèbre pour sa grande profondeur?",
  "options": [
   "Grand lac des Esclaves",
   "Lac Simcoe",
   "Lac Saint-Pierre",
   "Lac Memphrémagog"
  ],
  "correct": 0,
  "explanation": "Le Grand lac des Esclaves est l'un des lacs les plus profonds d'Amérique du Nord.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/grand-lac-des-esclaves"
 },
 {
  "id": "2026-geo-055",
  "category": "geo",
  "level": 1,
  "text": "Quel canal naturel sépare Madagascar du continent africain?",
  "options": [
   "Canal du Mozambique",
   "Canal de Sicile",
   "Détroit de Béring",
   "Détroit de Magellan"
  ],
  "correct": 0,
  "explanation": "Le canal du Mozambique sépare Madagascar de la côte africaine.",
  "source": "https://www.britannica.com/place/Mozambique-Channel"
 },
 {
  "id": "2026-geo-056",
  "category": "geo",
  "level": 1,
  "text": "Quel mont représente le plus haut sommet du Canada?",
  "options": [
   "Mont Logan",
   "Mont Robson",
   "Mont Tremblant",
   "Mont Jacques-Cartier"
  ],
  "correct": 0,
  "explanation": "Le mont Logan, au Yukon, culmine à près de 5 960 mètres.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/mont-logan"
 },
 {
  "id": "2026-geo-057",
  "category": "geo",
  "level": 2,
  "text": "Quel petit État se trouve dans les Pyrénées entre la France et l'Espagne?",
  "options": [
   "Andorre",
   "Saint-Marin",
   "Monaco",
   "Liechtenstein"
  ],
  "correct": 0,
  "explanation": "La principauté d'Andorre se trouve dans les Pyrénées.",
  "source": "https://www.britannica.com/place/Andorra"
 },
 {
  "id": "2026-geo-058",
  "category": "geo",
  "level": 3,
  "text": "Quel fleuve traverse Turin avant de se jeter dans la mer Adriatique?",
  "options": [
   "Pô",
   "Tibre",
   "Arno",
   "Adige"
  ],
  "correct": 0,
  "explanation": "Le Pô traverse la plaine du nord de l'Italie et coule par Turin.",
  "source": "https://www.britannica.com/place/Po-River"
 },
 {
  "id": "2026-geo-059",
  "category": "geo",
  "level": 3,
  "text": "Quelle chaîne montagneuse traverse le nord du Nouveau-Brunswick?",
  "options": [
   "Appalaches",
   "Rocheuses",
   "Cordillère côtière",
   "Monts Saint-Élie"
  ],
  "correct": 0,
  "explanation": "Les Appalaches traversent l'est du Canada, y compris le nord du Nouveau-Brunswick.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/appalaches"
 },
 {
  "id": "2026-geo-060",
  "category": "geo",
  "level": 3,
  "text": "Sur quelle île canadienne se trouve le parc national des Hautes-Terres-du-Cap-Breton?",
  "options": [
   "Île du Cap-Breton",
   "Île du Prince-Édouard",
   "Île d'Anticosti",
   "Île de Vancouver"
  ],
  "correct": 0,
  "explanation": "Le parc national occupe une partie du nord de l'île du Cap-Breton, en Nouvelle-Écosse.",
  "source": "https://parcs.canada.ca/pn-np/ns/cbreton"
 },
 {
  "id": "2026-histoire-001",
  "category": "histoire",
  "level": 1,
  "text": "Quel événement spatial américain de 1969 permet aux premiers humains de marcher sur la Lune?",
  "options": [
   "Apollo 11",
   "Apollo 8",
   "Gemini 4",
   "Apollo 13"
  ],
  "correct": 0,
  "explanation": "Neil Armstrong et Buzz Aldrin marchent sur la Lune pendant Apollo 11.",
  "source": "https://www.nasa.gov/mission/apollo-11/"
 },
 {
  "id": "2026-histoire-002",
  "category": "histoire",
  "level": 3,
  "text": "Quel royaume africain fut dirigé par Mansa Moussa au XIVe siècle?",
  "options": [
   "Empire du Mali",
   "Empire du Ghana",
   "Royaume du Kongo",
   "Empire zoulou"
  ],
  "correct": 0,
  "explanation": "Mansa Moussa est célèbre pour son règne sur l'Empire du Mali.",
  "source": "https://www.britannica.com/biography/Musa-I-of-Mali"
 },
 {
  "id": "2026-histoire-003",
  "category": "histoire",
  "level": 3,
  "text": "Quel scientifique est jugé par l'Inquisition en 1633 pour ses positions sur le système solaire?",
  "options": [
   "Galilée",
   "Newton",
   "Darwin",
   "Pasteur"
  ],
  "correct": 0,
  "explanation": "Le procès de Galilée porte notamment sur la défense de l'héliocentrisme.",
  "source": "https://www.britannica.com/biography/Galileo-Galilei"
 },
 {
  "id": "2026-histoire-004",
  "category": "histoire",
  "level": 1,
  "text": "Quelle civilisation construit le Machu Picchu dans les Andes?",
  "options": [
   "Incas",
   "Mayas",
   "Aztèques",
   "Olmèques"
  ],
  "correct": 0,
  "explanation": "Machu Picchu est une cité inca du XVe siècle au Pérou.",
  "source": "https://whc.unesco.org/en/list/274/"
 },
 {
  "id": "2026-histoire-005",
  "category": "histoire",
  "level": 3,
  "text": "Quel mouvement de réforme religieuse est associé à Martin Luther en 1517?",
  "options": [
   "Réforme protestante",
   "Contre-Réforme",
   "Grand Schisme d'Orient",
   "Concile de Trente"
  ],
  "correct": 0,
  "explanation": "La diffusion des thèses de Luther contribue au déclenchement de la Réforme.",
  "source": "https://www.britannica.com/event/Reformation"
 },
 {
  "id": "2026-histoire-006",
  "category": "histoire",
  "level": 2,
  "text": "Quelle ville est la capitale de l'Empire aztèque lors de l'arrivée des Espagnols?",
  "options": [
   "Tenochtitlan",
   "Cuzco",
   "Teotihuacan",
   "Palenque"
  ],
  "correct": 0,
  "explanation": "Tenochtitlan s'élevait sur le site de l'actuelle ville de Mexico.",
  "source": "https://www.britannica.com/place/Tenochtitlan"
 },
 {
  "id": "2026-histoire-007",
  "category": "histoire",
  "level": 2,
  "text": "Quel événement commence traditionnellement l'Antiquité en histoire occidentale?",
  "options": [
   "L'invention de l'écriture",
   "La chute de Rome",
   "La découverte de l'Amérique",
   "La Révolution française"
  ],
  "correct": 0,
  "explanation": "L'apparition de l'écriture sert souvent de repère pour le début de l'Antiquité.",
  "source": "https://www.britannica.com/topic/history"
 },
 {
  "id": "2026-histoire-008",
  "category": "histoire",
  "level": 1,
  "text": "Quel navire britannique coule lors de son voyage inaugural en 1912?",
  "options": [
   "Titanic",
   "Lusitania",
   "Britannic",
   "Carpathia"
  ],
  "correct": 0,
  "explanation": "Le Titanic heurte un iceberg et coule dans l'Atlantique Nord en avril 1912.",
  "source": "https://www.britannica.com/topic/Titanic"
 },
 {
  "id": "2026-histoire-009",
  "category": "histoire",
  "level": 2,
  "text": "Quelle guerre oppose le Nord et le Sud des États-Unis de 1861 à 1865?",
  "options": [
   "Guerre de Sécession",
   "Guerre de Crimée",
   "Guerre des Boers",
   "Guerre de Corée"
  ],
  "correct": 0,
  "explanation": "La guerre de Sécession oppose l'Union aux États confédérés.",
  "source": "https://www.britannica.com/event/American-Civil-War"
 },
 {
  "id": "2026-histoire-010",
  "category": "histoire",
  "level": 2,
  "text": "Quel traité met fin à la Première Guerre mondiale entre l'Allemagne et les Alliés en 1919?",
  "options": [
   "Traité de Versailles",
   "Traité de Tordesillas",
   "Traité d'Utrecht",
   "Traité de Westphalie"
  ],
  "correct": 0,
  "explanation": "Le traité de Versailles est signé le 28 juin 1919.",
  "source": "https://www.britannica.com/event/Treaty-of-Versailles-1919"
 },
 {
  "id": "2026-histoire-011",
  "category": "histoire",
  "level": 2,
  "text": "Quel événement de 1944 désigne le débarquement allié en Normandie?",
  "options": [
   "Opération Overlord",
   "Opération Barbarossa",
   "Opération Market Garden",
   "Opération Torch"
  ],
  "correct": 0,
  "explanation": "L'opération Overlord comprend le débarquement du 6 juin 1944.",
  "source": "https://www.britannica.com/event/Normandy-Invasion"
 },
 {
  "id": "2026-histoire-012",
  "category": "histoire",
  "level": 1,
  "text": "Quelle ville a été détruite par l'éruption du Vésuve en 79 de notre ère?",
  "options": [
   "Pompéi",
   "Carthage",
   "Athènes",
   "Sparte"
  ],
  "correct": 0,
  "explanation": "Pompéi est ensevelie sous les matériaux volcaniques de l'éruption.",
  "source": "https://whc.unesco.org/en/list/829/"
 },
 {
  "id": "2026-histoire-013",
  "category": "histoire",
  "level": 1,
  "text": "Quel appareil volant réalise un premier vol motorisé contrôlé et soutenu en 1903?",
  "options": [
   "Flyer des frères Wright",
   "Spirit of St. Louis",
   "Concorde",
   "Enola Gay"
  ],
  "correct": 0,
  "explanation": "Le Flyer décolle à Kitty Hawk lors des essais des frères Wright.",
  "source": "https://www.britannica.com/biography/Wright-brothers"
 },
 {
  "id": "2026-histoire-014",
  "category": "histoire",
  "level": 3,
  "text": "Quel général carthaginois traverse les Alpes avec son armée pendant la deuxième guerre punique?",
  "options": [
   "Hannibal",
   "Scipion l'Africain",
   "Jules César",
   "Pompée"
  ],
  "correct": 0,
  "explanation": "Hannibal conduit les forces carthaginoises en Italie en 218 avant notre ère.",
  "source": "https://www.britannica.com/biography/Hannibal-Carthaginian-general"
 },
 {
  "id": "2026-histoire-015",
  "category": "histoire",
  "level": 1,
  "text": "Quelle bataille de 1815 marque la défaite finale de Napoléon Ier?",
  "options": [
   "Waterloo",
   "Austerlitz",
   "Marengo",
   "Iéna"
  ],
  "correct": 0,
  "explanation": "Napoléon est vaincu à Waterloo par les forces alliées.",
  "source": "https://www.britannica.com/event/Battle-of-Waterloo"
 },
 {
  "id": "2026-histoire-016",
  "category": "histoire",
  "level": 3,
  "text": "Quel dirigeant français est renversé lors de la révolution de 1848 en France?",
  "options": [
   "Louis-Philippe Ier",
   "Napoléon III",
   "Louis XVI",
   "Charles X"
  ],
  "correct": 0,
  "explanation": "L'abdication de Louis-Philippe Ier marque la fin de la monarchie de Juillet en 1848.",
  "source": "https://www.britannica.com/event/Revolutions-of-1848"
 },
 {
  "id": "2026-histoire-017",
  "category": "histoire",
  "level": 2,
  "text": "Qui dirige l'Union soviétique durant la majeure partie de la Seconde Guerre mondiale?",
  "options": [
   "Joseph Staline",
   "Vladimir Lénine",
   "Mikhaïl Gorbatchev",
   "Nikita Khrouchtchev"
  ],
  "correct": 0,
  "explanation": "Staline dirige l'URSS de la fin des années 1920 jusqu'en 1953.",
  "source": "https://www.britannica.com/biography/Joseph-Stalin"
 },
 {
  "id": "2026-histoire-018",
  "category": "histoire",
  "level": 2,
  "text": "Quelle révolution commence avec la prise de la Bastille en juillet 1789?",
  "options": [
   "Révolution française",
   "Révolution russe",
   "Révolution américaine",
   "Révolution industrielle"
  ],
  "correct": 0,
  "explanation": "La prise de la Bastille devient un symbole du soulèvement révolutionnaire en France.",
  "source": "https://www.britannica.com/event/French-Revolution"
 },
 {
  "id": "2026-histoire-019",
  "category": "histoire",
  "level": 3,
  "text": "Quel événement réunit les puissances européennes pour redessiner les frontières après les guerres napoléoniennes?",
  "options": [
   "Congrès de Vienne",
   "Conférence de Yalta",
   "Congrès de Berlin de 1884",
   "Accords de Camp David"
  ],
  "correct": 0,
  "explanation": "Le Congrès de Vienne se déroule de 1814 à 1815.",
  "source": "https://www.britannica.com/event/Congress-of-Vienna"
 },
 {
  "id": "2026-histoire-020",
  "category": "histoire",
  "level": 2,
  "text": "Quelle scientifique reçoit deux prix Nobel dans deux disciplines différentes?",
  "options": [
   "Marie Curie",
   "Rosalind Franklin",
   "Ada Lovelace",
   "Jane Goodall"
  ],
  "correct": 0,
  "explanation": "Marie Curie reçoit le Nobel de physique en 1903 et celui de chimie en 1911.",
  "source": "https://www.nobelprize.org/womenwhochangedscience/stories/marie-curie"
 },
 {
  "id": "2026-culture-001",
  "category": "culture",
  "level": 3,
  "text": "Quelle artiste mexicaine est célèbre pour ses nombreux autoportraits?",
  "options": [
   "Frida Kahlo",
   "Leonora Carrington",
   "Remedios Varo",
   "María Izquierdo"
  ],
  "correct": 0,
  "explanation": "Frida Kahlo utilise souvent son propre visage comme sujet.",
  "source": "https://www.britannica.com/biography/Frida-Kahlo"
 },
 {
  "id": "2026-culture-002",
  "category": "culture",
  "level": 3,
  "text": "Quel écrivain est à l'origine du vaste cycle de romans La Comédie humaine?",
  "options": [
   "Honoré de Balzac",
   "Émile Zola",
   "Gustave Flaubert",
   "Stendhal"
  ],
  "correct": 0,
  "explanation": "La Comédie humaine rassemble une grande partie de l'œuvre romanesque de Balzac.",
  "source": "https://www.britannica.com/topic/La-Comedie-humaine"
 },
 {
  "id": "2026-culture-003",
  "category": "culture",
  "level": 1,
  "text": "Dans le film Le Seigneur des anneaux : Le Retour du roi, qui réalise la mise en scène?",
  "options": [
   "Peter Jackson",
   "Guillermo del Toro",
   "Christopher Nolan",
   "Sam Raimi"
  ],
  "correct": 0,
  "explanation": "Peter Jackson réalise la trilogie cinématographique Le Seigneur des anneaux.",
  "source": "https://www.britannica.com/biography/Peter-Jackson-New-Zealand-director"
 },
 {
  "id": "2026-culture-004",
  "category": "culture",
  "level": 1,
  "text": "Quel compositeur italien a écrit Les Quatre Saisons?",
  "options": [
   "Antonio Vivaldi",
   "Giacomo Puccini",
   "Giuseppe Verdi",
   "Gioachino Rossini"
  ],
  "correct": 0,
  "explanation": "Les Quatre Saisons forment un ensemble de quatre concertos pour violon.",
  "source": "https://www.britannica.com/topic/The-Four-Seasons-by-Vivaldi"
 },
 {
  "id": "2026-culture-005",
  "category": "culture",
  "level": 3,
  "text": "Quel groupe de rock indépendant est formé à Montréal au début des années 2000?",
  "options": [
   "Arcade Fire",
   "The Tragically Hip",
   "Rush",
   "The Guess Who"
  ],
  "correct": 0,
  "explanation": "Arcade Fire se forme à Montréal et lance Funeral en 2004.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/arcade-fire"
 },
 {
  "id": "2026-culture-006",
  "category": "culture",
  "level": 1,
  "text": "Quel roman commence par l'annonce de la mort de la mère du narrateur Meursault?",
  "options": [
   "L'Étranger",
   "La Peste",
   "La Chute",
   "Le Mythe de Sisyphe"
  ],
  "correct": 0,
  "explanation": "Meursault est le personnage central de L'Étranger d'Albert Camus.",
  "source": "https://www.britannica.com/topic/The-Stranger-novel-by-Camus"
 },
 {
  "id": "2026-culture-007",
  "category": "culture",
  "level": 2,
  "text": "Quel auteur a publié le roman dystopique 1984?",
  "options": [
   "George Orwell",
   "Aldous Huxley",
   "Ray Bradbury",
   "H. G. Wells"
  ],
  "correct": 0,
  "explanation": "Le roman 1984 met en scène une société surveillée par Big Brother.",
  "source": "https://www.britannica.com/topic/Nineteen-Eighty-four"
 },
 {
  "id": "2026-culture-008",
  "category": "culture",
  "level": 2,
  "text": "Quel opéra de Mozart fait intervenir la Reine de la nuit?",
  "options": [
   "La Flûte enchantée",
   "Don Giovanni",
   "Les Noces de Figaro",
   "Così fan tutte"
  ],
  "correct": 0,
  "explanation": "La Reine de la nuit est un personnage de La Flûte enchantée.",
  "source": "https://www.britannica.com/topic/The-Magic-Flute"
 },
 {
  "id": "2026-culture-009",
  "category": "culture",
  "level": 2,
  "text": "Quel auteur français a écrit la pièce Tartuffe?",
  "options": [
   "Molière",
   "Racine",
   "Corneille",
   "Beaumarchais"
  ],
  "correct": 0,
  "explanation": "Tartuffe est une comédie de Molière sur l'hypocrisie religieuse.",
  "source": "https://www.britannica.com/biography/Moliere-French-dramatist"
 },
 {
  "id": "2026-culture-010",
  "category": "culture",
  "level": 3,
  "text": "Quel film québécois raconte l'arrivée d'un enseignant d'origine algérienne dans une école montréalaise?",
  "options": [
   "Monsieur Lazhar",
   "C.R.A.Z.Y.",
   "Polytechnique",
   "Le Déclin de l'empire américain"
  ],
  "correct": 0,
  "explanation": "Monsieur Lazhar est réalisé par Philippe Falardeau.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/monsieur-lazhar"
 },
 {
  "id": "2026-culture-011",
  "category": "culture",
  "level": 3,
  "text": "Quel romancier colombien a écrit Cent ans de solitude?",
  "options": [
   "Gabriel García Márquez",
   "Jorge Luis Borges",
   "Mario Vargas Llosa",
   "Julio Cortázar"
  ],
  "correct": 0,
  "explanation": "Ce roman de 1967 raconte l'histoire de la famille Buendía.",
  "source": "https://www.britannica.com/topic/One-Hundred-Years-of-Solitude"
 },
 {
  "id": "2026-culture-012",
  "category": "culture",
  "level": 1,
  "text": "Quelle chanteuse québécoise est surnommée « La Bolduc »?",
  "options": [
   "Mary Travers",
   "Alys Robi",
   "Pauline Julien",
   "Félixine Dubé"
  ],
  "correct": 0,
  "explanation": "Mary Travers, dite La Bolduc, est une pionnière de la chanson populaire québécoise.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/la-bolduc"
 },
 {
  "id": "2026-culture-013",
  "category": "culture",
  "level": 1,
  "text": "Qui a peint La Nuit étoilée en 1889?",
  "options": [
   "Vincent van Gogh",
   "Paul Gauguin",
   "Paul Cézanne",
   "Henri Matisse"
  ],
  "correct": 0,
  "explanation": "Van Gogh réalise ce tableau pendant son séjour à Saint-Rémy.",
  "source": "https://www.britannica.com/topic/The-Starry-Night"
 },
 {
  "id": "2026-culture-014",
  "category": "culture",
  "level": 1,
  "text": "Quel réalisateur québécois signe le film Incendies sorti en 2010?",
  "options": [
   "Denis Villeneuve",
   "Denys Arcand",
   "Xavier Dolan",
   "Jean-Marc Vallée"
  ],
  "correct": 0,
  "explanation": "Denis Villeneuve adapte la pièce de Wajdi Mouawad au cinéma.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/denis-villeneuve"
 },
 {
  "id": "2026-culture-015",
  "category": "culture",
  "level": 3,
  "text": "Qui a peint Le Baiser, tableau doré associé à la Sécession viennoise?",
  "options": [
   "Gustav Klimt",
   "Egon Schiele",
   "Oskar Kokoschka",
   "Alphonse Mucha"
  ],
  "correct": 0,
  "explanation": "Le Baiser est une œuvre majeure de Gustav Klimt.",
  "source": "https://www.britannica.com/biography/Gustav-Klimt"
 },
 {
  "id": "2026-culture-016",
  "category": "culture",
  "level": 2,
  "text": "Quel peintre a donné son nom à l'impressionnisme avec Impression, soleil levant?",
  "options": [
   "Claude Monet",
   "Édouard Manet",
   "Auguste Renoir",
   "Edgar Degas"
  ],
  "correct": 0,
  "explanation": "Le titre du tableau de Monet inspire le mot impressionnisme.",
  "source": "https://www.britannica.com/art/Impressionism-art"
 },
 {
  "id": "2026-culture-017",
  "category": "culture",
  "level": 2,
  "text": "Quel film québécois de 2006 mélange comédie policière et tensions linguistiques?",
  "options": [
   "Bon Cop, Bad Cop",
   "Incendies",
   "Mommy",
   "Les Invasions barbares"
  ],
  "correct": 0,
  "explanation": "Bon Cop, Bad Cop réunit deux policiers francophone et anglophone.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/bon-cop-bad-cop"
 },
 {
  "id": "2026-culture-018",
  "category": "culture",
  "level": 2,
  "text": "Qui a écrit Crime et Châtiment?",
  "options": [
   "Fiodor Dostoïevski",
   "Léon Tolstoï",
   "Anton Tchekhov",
   "Nicolas Gogol"
  ],
  "correct": 0,
  "explanation": "Le protagoniste du roman est Rodion Raskolnikov.",
  "source": "https://www.britannica.com/topic/Crime-and-Punishment-novel"
 },
 {
  "id": "2026-culture-019",
  "category": "culture",
  "level": 2,
  "text": "Dans quelle pièce de Shakespeare retrouve-t-on les trois sorcières annonçant une prophétie?",
  "options": [
   "Macbeth",
   "Hamlet",
   "Othello",
   "Le Roi Lear"
  ],
  "correct": 0,
  "explanation": "Les sorcières jouent un rôle important dans la tragédie Macbeth.",
  "source": "https://www.britannica.com/topic/Macbeth-by-Shakespeare"
 },
 {
  "id": "2026-culture-020",
  "category": "culture",
  "level": 3,
  "text": "Dans quelle œuvre de Debussy trouve-t-on Clair de lune?",
  "options": [
   "Suite bergamasque",
   "La Mer",
   "Prélude à l'après-midi d'un faune",
   "Images"
  ],
  "correct": 0,
  "explanation": "Clair de lune est le troisième mouvement de la Suite bergamasque.",
  "source": "https://www.britannica.com/topic/Clair-de-lune-by-Debussy"
 },
 {
  "id": "2026-culture-021",
  "category": "culture",
  "level": 1,
  "text": "Quel cinéaste signe les films Jurassic Park et E.T. l'extra-terrestre?",
  "options": [
   "Steven Spielberg",
   "George Lucas",
   "James Cameron",
   "Ridley Scott"
  ],
  "correct": 0,
  "explanation": "Spielberg réalise E.T. en 1982 puis Jurassic Park en 1993.",
  "source": "https://www.britannica.com/biography/Steven-Spielberg"
 },
 {
  "id": "2026-culture-022",
  "category": "culture",
  "level": 3,
  "text": "Quel réalisateur québécois signe le film Léolo?",
  "options": [
   "Jean-Claude Lauzon",
   "Claude Jutra",
   "Denis Villeneuve",
   "Philippe Falardeau"
  ],
  "correct": 0,
  "explanation": "Le film Léolo sort en 1992 sous la direction de Jean-Claude Lauzon.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/jean-claude-lauzon"
 },
 {
  "id": "2026-culture-023",
  "category": "culture",
  "level": 1,
  "text": "Quel peintre espagnol réalise Guernica en 1937?",
  "options": [
   "Pablo Picasso",
   "Salvador Dalí",
   "Francisco Goya",
   "Joan Miró"
  ],
  "correct": 0,
  "explanation": "Picasso peint Guernica en réaction au bombardement de cette ville.",
  "source": "https://www.britannica.com/topic/Guernica-by-Picasso"
 },
 {
  "id": "2026-culture-024",
  "category": "culture",
  "level": 3,
  "text": "Quel groupe québécois a popularisé la chanson La ziguezon?",
  "options": [
   "La Bottine Souriante",
   "Les Trois Accords",
   "Harmonium",
   "Beau Dommage"
  ],
  "correct": 0,
  "explanation": "La Bottine Souriante s'inscrit dans la musique traditionnelle québécoise.",
  "source": "https://www.thecanadianencyclopedia.ca/fr/article/la-bottine-souriante"
 },
 {
  "id": "2026-culture-025",
  "category": "culture",
  "level": 1,
  "text": "Quelle œuvre musicale de Beethoven se termine par un chœur sur l'Ode à la joie?",
  "options": [
   "Neuvième Symphonie",
   "Cinquième Symphonie",
   "Sonate au clair de lune",
   "Concerto pour violon"
  ],
  "correct": 0,
  "explanation": "Le dernier mouvement de la Neuvième met en musique un texte de Schiller.",
  "source": "https://www.britannica.com/topic/Symphony-No-9-in-D-Minor-Op-125"
 },
 {
  "id": "2026-sport-001",
  "category": "sport",
  "level": 3,
  "text": "Dans quelle discipline olympique trouve-t-on l'épreuve du keirin?",
  "options": [
   "Cyclisme sur piste",
   "Patinage de vitesse",
   "Natation",
   "Aviron"
  ],
  "correct": 0,
  "explanation": "Le keirin est une course de vitesse du cyclisme sur piste.",
  "source": "https://olympics.com/en/sports/cycling-track/"
 },
 {
  "id": "2026-sport-002",
  "category": "sport",
  "level": 1,
  "text": "Quelle équipe gagne la première Coupe du monde masculine de soccer en 1930?",
  "options": [
   "Uruguay",
   "Argentine",
   "Brésil",
   "Italie"
  ],
  "correct": 0,
  "explanation": "L'Uruguay remporte le tournoi inaugural organisé chez lui.",
  "source": "https://www.fifa.com/tournaments/mens/worldcup/1930"
 },
 {
  "id": "2026-sport-003",
  "category": "sport",
  "level": 3,
  "text": "Au curling, comment appelle-t-on la dernière pierre d'une manche, avantage détenu par une équipe?",
  "options": [
   "Le marteau",
   "La garde",
   "La maison",
   "Le balayage"
  ],
  "correct": 0,
  "explanation": "L'équipe qui possède le marteau lance la dernière pierre de la manche.",
  "source": "https://worldcurling.org/about/curling/"
 },
 {
  "id": "2026-sport-004",
  "category": "sport",
  "level": 1,
  "text": "Au tennis, sur quelle surface se dispute Roland-Garros?",
  "options": [
   "Terre battue",
   "Gazon",
   "Bois",
   "Glace"
  ],
  "correct": 0,
  "explanation": "Roland-Garros se joue sur des courts en terre battue.",
  "source": "https://www.rolandgarros.com/"
 },
 {
  "id": "2026-sport-005",
  "category": "sport",
  "level": 1,
  "text": "Au soccer, à quelle distance du but se situe le point de penalty?",
  "options": [
   "11 mètres",
   "9,15 mètres",
   "16,5 mètres",
   "18 mètres"
  ],
  "correct": 0,
  "explanation": "Le point de réparation se trouve à 11 mètres de la ligne de but.",
  "source": "https://www.theifab.com/laws/latest/the-penalty-kick/"
 },
 {
  "id": "2026-sport-006",
  "category": "sport",
  "level": 2,
  "text": "Au hockey sur glace, combien de minutes dure normalement une pénalité mineure?",
  "options": [
   "2 minutes",
   "1 minute",
   "4 minutes",
   "5 minutes"
  ],
  "correct": 0,
  "explanation": "Une pénalité mineure ordinaire dure deux minutes, avec certaines possibilités de fin anticipée.",
  "source": "https://www.nhl.com/info/nhl-rulebook"
 },
 {
  "id": "2026-sport-007",
  "category": "sport",
  "level": 2,
  "text": "Au baseball, combien de retraits une équipe défensive doit-elle obtenir pour terminer une demi-manche?",
  "options": [
   "3",
   "2",
   "4",
   "5"
  ],
  "correct": 0,
  "explanation": "Trois retraits mettent fin au tour offensif d'une équipe.",
  "source": "https://www.mlb.com/glossary/rules/innings"
 },
 {
  "id": "2026-sport-008",
  "category": "sport",
  "level": 1,
  "text": "Dans un match de baseball professionnel standard, combien de manches réglementaires joue-t-on?",
  "options": [
   "9",
   "7",
   "8",
   "12"
  ],
  "correct": 0,
  "explanation": "Un match de baseball de la MLB est normalement prévu pour neuf manches.",
  "source": "https://www.mlb.com/glossary/rules/innings"
 },
 {
  "id": "2026-sport-009",
  "category": "sport",
  "level": 1,
  "text": "Dans quel sport utilise-t-on un bateau appelé skiff?",
  "options": [
   "Aviron",
   "Canoë de slalom",
   "Voile",
   "Surf"
  ],
  "correct": 0,
  "explanation": "Le skiff est une embarcation d'aviron pour une seule personne.",
  "source": "https://worldrowing.com/"
 },
 {
  "id": "2026-sport-010",
  "category": "sport",
  "level": 1,
  "text": "Dans un match de football américain, combien rapporte un touché avant transformation?",
  "options": [
   "6 points",
   "3 points",
   "7 points",
   "2 points"
  ],
  "correct": 0,
  "explanation": "Un touchdown vaut six points; la transformation vient ensuite.",
  "source": "https://operations.nfl.com/the-rules/nfl-rulebook/"
 },
 {
  "id": "2026-sport-011",
  "category": "sport",
  "level": 3,
  "text": "Dans une partie de poker, quelle main est supérieure à un carré?",
  "options": [
   "Quinte flush",
   "Full",
   "Couleur",
   "Brelan"
  ],
  "correct": 0,
  "explanation": "Une quinte flush surclasse un carré dans les classements traditionnels du poker.",
  "source": "https://www.pokerstars.com/poker/games/rules/hand-rankings/"
 },
 {
  "id": "2026-sport-012",
  "category": "sport",
  "level": 2,
  "text": "Au golf, quel score réalise-t-on en faisant trois coups sous le par sur un trou?",
  "options": [
   "Albatros",
   "Aigle",
   "Birdie",
   "Bogey"
  ],
  "correct": 0,
  "explanation": "Trois coups sous le par constituent un albatros, appelé aussi double eagle.",
  "source": "https://www.randa.org/en/rog"
 },
 {
  "id": "2026-sport-013",
  "category": "sport",
  "level": 3,
  "text": "Au basketball, à quelle distance de l'arceau se trouve la ligne FIBA à trois points, mesurée au centre de l'arc?",
  "options": [
   "6,75 mètres",
   "6,25 mètres",
   "7,24 mètres",
   "5,80 mètres"
  ],
  "correct": 0,
  "explanation": "La ligne FIBA se situe à 6,75 mètres de l'axe du panier au centre de l'arc.",
  "source": "https://www.fiba.basketball/documents/official-basketball-rules"
 },
 {
  "id": "2026-sport-014",
  "category": "sport",
  "level": 2,
  "text": "Aux échecs, quelles sont les deux pièces qui participent au roque?",
  "options": [
   "Roi et tour",
   "Roi et cavalier",
   "Dame et fou",
   "Tour et cavalier"
  ],
  "correct": 0,
  "explanation": "Le roque déplace le roi et l'une des tours du même camp.",
  "source": "https://handbook.fide.com/chapter/E012023"
 },
 {
  "id": "2026-sport-015",
  "category": "sport",
  "level": 2,
  "text": "Au tennis, quelle surface recouvre traditionnellement les courts de Wimbledon?",
  "options": [
   "Gazon",
   "Terre battue",
   "Béton poreux",
   "Tapis synthétique"
  ],
  "correct": 0,
  "explanation": "Wimbledon est le tournoi du Grand Chelem historiquement disputé sur gazon.",
  "source": "https://www.wimbledon.com/"
 },
 {
  "id": "2026-sport-016",
  "category": "sport",
  "level": 1,
  "text": "Quel exercice de gymnastique artistique masculine utilise deux anneaux suspendus?",
  "options": [
   "Anneaux",
   "Barres asymétriques",
   "Poutre",
   "Cheval d'arçons"
  ],
  "correct": 0,
  "explanation": "L'épreuve des anneaux fait partie du programme masculin de gymnastique artistique.",
  "source": "https://olympics.com/en/sports/artistic-gymnastics/"
 },
 {
  "id": "2026-sport-017",
  "category": "sport",
  "level": 3,
  "text": "Quel sport olympique combine course à pied, natation, escrime, équitation et tir dans son format historique avant sa réforme?",
  "options": [
   "Pentathlon moderne",
   "Décathlon",
   "Biathlon",
   "Triathlon"
  ],
  "correct": 0,
  "explanation": "Le pentathlon moderne comportait ces cinq disciplines dans son ancienne formule.",
  "source": "https://olympics.com/en/sports/modern-pentathlon/"
 },
 {
  "id": "2026-sport-018",
  "category": "sport",
  "level": 1,
  "text": "Au soccer, quel coup de pied est accordé quand le ballon franchit entièrement la ligne de but, touché en dernier par un défenseur, sans but marqué?",
  "options": [
   "Coup de pied de coin",
   "Coup franc indirect",
   "Coup d'envoi",
   "Balle à terre"
  ],
  "correct": 0,
  "explanation": "La règle prévoit un corner lorsque le défenseur touche le ballon en dernier.",
  "source": "https://www.theifab.com/laws/latest/the-corner-kick/"
 },
 {
  "id": "2026-sport-019",
  "category": "sport",
  "level": 1,
  "text": "Quel jeu de raquette fait intervenir un volant plutôt qu'une balle?",
  "options": [
   "Badminton",
   "Squash",
   "Padel",
   "Racquetball"
  ],
  "correct": 0,
  "explanation": "Le badminton se joue avec un volant, généralement en plumes ou synthétique.",
  "source": "https://olympics.com/en/sports/badminton/"
 },
 {
  "id": "2026-sport-020",
  "category": "sport",
  "level": 2,
  "text": "Au hockey, quel terme désigne une équipe ayant davantage de joueurs sur la glace à cause d'une pénalité adverse?",
  "options": [
   "Avantage numérique",
   "Dégagement refusé",
   "Hors-jeu différé",
   "Temps mort"
  ],
  "correct": 0,
  "explanation": "Une pénalité peut donner un avantage numérique à l'équipe adverse.",
  "source": "https://www.nhl.com/info/nhl-rulebook"
 },
 {
  "id": "2026-sport-021",
  "category": "sport",
  "level": 3,
  "text": "Au tennis, quelle condition doit normalement être atteinte pour remporter un jeu décisif classique de set?",
  "options": [
   "7 points avec 2 points d'avance",
   "6 points avec 1 point d'avance",
   "10 points sans écart minimal",
   "5 points avec 2 points d'avance"
  ],
  "correct": 0,
  "explanation": "Le tie-break classique se gagne à au moins sept points et avec deux points d'écart.",
  "source": "https://www.itftennis.com/en/about-us/governance/rules-and-regulations/"
 },
 {
  "id": "2026-sport-022",
  "category": "sport",
  "level": 2,
  "text": "Quel sport d'hiver utilise une piste glacée et une luge pour une personne allongée pieds devant?",
  "options": [
   "Luge",
   "Skeleton",
   "Bobsleigh",
   "Patinage de vitesse"
  ],
  "correct": 0,
  "explanation": "En luge, l'athlète descend sur le dos, les pieds vers l'avant.",
  "source": "https://olympics.com/en/sports/luge/"
 },
 {
  "id": "2026-sport-023",
  "category": "sport",
  "level": 2,
  "text": "Combien de tuiles compte un jeu de dominos traditionnel « double-six »?",
  "options": [
   "28",
   "21",
   "32",
   "36"
  ],
  "correct": 0,
  "explanation": "Il y a 28 combinaisons non ordonnées de deux valeurs de zéro à six.",
  "source": "https://www.britannica.com/topic/domino-game"
 },
 {
  "id": "2026-sport-024",
  "category": "sport",
  "level": 1,
  "text": "Quelle discipline de lancer utilise un disque circulaire plutôt qu'une sphère ou un engin pointu?",
  "options": [
   "Lancer du disque",
   "Lancer du poids",
   "Lancer du javelot",
   "Lancer du marteau"
  ],
  "correct": 0,
  "explanation": "Le disque est un engin plat et circulaire lancé depuis un cercle.",
  "source": "https://worldathletics.org/disciplines/throws/discus-throw"
 },
 {
  "id": "2026-sport-025",
  "category": "sport",
  "level": 1,
  "text": "Au basketball, comment appelle-t-on une reprise de dribble après l'avoir arrêté avec les deux mains?",
  "options": [
   "Double dribble",
   "Marcher",
   "Retour en zone",
   "Écran mobile"
  ],
  "correct": 0,
  "explanation": "Recommencer à dribbler après avoir arrêté constitue une violation.",
  "source": "https://www.fiba.basketball/documents/official-basketball-rules"
 },
 {
  "id": "2026-science-001",
  "category": "science",
  "level": 1,
  "text": "Dans l'ADN, quelle base s'apparie normalement à l'adénine?",
  "options": [
   "Thymine",
   "Cytosine",
   "Guanine",
   "Uracile"
  ],
  "correct": 0,
  "explanation": "Dans une double hélice d'ADN, l'adénine forme une paire avec la thymine.",
  "source": "https://www.genome.gov/genetics-glossary/Base-Pair"
 },
 {
  "id": "2026-science-002",
  "category": "science",
  "level": 1,
  "text": "Quel organe humain assure principalement les échanges d'oxygène et de dioxyde de carbone avec l'air?",
  "options": [
   "Poumons",
   "Foie",
   "Rate",
   "Pancréas"
  ],
  "correct": 0,
  "explanation": "Les alvéoles des poumons permettent les échanges gazeux avec le sang.",
  "source": "https://www.britannica.com/science/lung"
 },
 {
  "id": "2026-science-003",
  "category": "science",
  "level": 3,
  "text": "Quelle planète du système solaire est célèbre pour sa rotation rétrograde très lente?",
  "options": [
   "Vénus",
   "Mercure",
   "Mars",
   "Neptune"
  ],
  "correct": 0,
  "explanation": "Vénus tourne très lentement sur elle-même dans le sens opposé à la plupart des planètes.",
  "source": "https://science.nasa.gov/venus/facts/"
 },
 {
  "id": "2026-science-004",
  "category": "science",
  "level": 1,
  "text": "Quel phénomène donne à la Terre ses tremblements de terre à cause du déplacement brutal de failles?",
  "options": [
   "Séisme tectonique",
   "Éclipse solaire",
   "Marée atmosphérique",
   "Convection pulmonaire"
  ],
  "correct": 0,
  "explanation": "Les ruptures sur les failles libèrent des ondes sismiques.",
  "source": "https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-basics"
 },
 {
  "id": "2026-science-005",
  "category": "science",
  "level": 2,
  "text": "Combien d'atomes d'oxygène contient une molécule de dioxyde de carbone CO₂?",
  "options": [
   "Deux",
   "Un",
   "Trois",
   "Quatre"
  ],
  "correct": 0,
  "explanation": "La formule CO₂ indique un atome de carbone et deux d'oxygène.",
  "source": "https://www.britannica.com/science/carbon-dioxide"
 },
 {
  "id": "2026-science-006",
  "category": "science",
  "level": 3,
  "text": "Quel phénomène solaire expulse de grandes quantités de plasma et peut perturber les télécommunications sur Terre?",
  "options": [
   "Éjection de masse coronale",
   "Éruption phréatique",
   "Aurore boréale",
   "Tache solaire isolée"
  ],
  "correct": 0,
  "explanation": "Une éjection de masse coronale expulse de la matière magnétisée dans l'espace.",
  "source": "https://science.nasa.gov/sun/"
 },
 {
  "id": "2026-science-007",
  "category": "science",
  "level": 2,
  "text": "Quel gaz est majoritairement absorbé par les plantes pendant la photosynthèse?",
  "options": [
   "Dioxyde de carbone",
   "Dioxyde de soufre",
   "Méthane",
   "Ozone"
  ],
  "correct": 0,
  "explanation": "Les plantes utilisent le CO₂ pour former leurs molécules organiques.",
  "source": "https://www.britannica.com/science/photosynthesis"
 },
 {
  "id": "2026-science-008",
  "category": "science",
  "level": 3,
  "text": "Quel monde du système solaire abrite un océan sous une croûte glacée et orbite autour de Jupiter?",
  "options": [
   "Europe",
   "Io",
   "Triton",
   "Phobos"
  ],
  "correct": 0,
  "explanation": "Europe, lune de Jupiter, cache probablement un océan global.",
  "source": "https://science.nasa.gov/jupiter/moons/europa/"
 },
 {
  "id": "2026-science-009",
  "category": "science",
  "level": 2,
  "text": "Quel phénomène permet au système immunitaire de réagir plus rapidement après un vaccin?",
  "options": [
   "Mémoire immunitaire",
   "Mutations instantanées",
   "Hibernation cellulaire",
   "Changement du groupe sanguin"
  ],
  "correct": 0,
  "explanation": "La vaccination déclenche notamment la formation de cellules immunitaires mémoire.",
  "source": "https://www.who.int/news-room/questions-and-answers/item/vaccines-and-immunization-what-is-vaccination"
 },
 {
  "id": "2026-science-010",
  "category": "science",
  "level": 1,
  "text": "Quelle particule du noyau atomique n'a pas de charge électrique nette?",
  "options": [
   "Neutron",
   "Proton",
   "Électron",
   "Positron"
  ],
  "correct": 0,
  "explanation": "Le neutron est électriquement neutre.",
  "source": "https://www.britannica.com/science/neutron"
 },
 {
  "id": "2026-science-011",
  "category": "science",
  "level": 1,
  "text": "À quelle famille du vivant appartiennent les levures utilisées pour faire lever le pain?",
  "options": [
   "Champignons",
   "Bactéries",
   "Algues vertes",
   "Protozoaires"
  ],
  "correct": 0,
  "explanation": "Les levures sont des champignons microscopiques unicellulaires.",
  "source": "https://www.britannica.com/science/yeast-fungus"
 },
 {
  "id": "2026-science-012",
  "category": "science",
  "level": 3,
  "text": "Quel organite cellulaire fabrique la majorité de l'ATP dans une cellule animale par respiration aérobie?",
  "options": [
   "Mitochondrie",
   "Ribosome",
   "Lysosome",
   "Appareil de Golgi"
  ],
  "correct": 0,
  "explanation": "La mitochondrie est le siège de la phosphorylation oxydative.",
  "source": "https://www.britannica.com/science/mitochondrion"
 },
 {
  "id": "2026-science-013",
  "category": "science",
  "level": 3,
  "text": "Quel groupe animal comprend les coraux bâtisseurs de récifs?",
  "options": [
   "Cnidaires",
   "Mollusques",
   "Échinodermes",
   "Annélides"
  ],
  "correct": 0,
  "explanation": "Les coraux appartiennent à l'embranchement des cnidaires.",
  "source": "https://www.britannica.com/animal/coral"
 },
 {
  "id": "2026-science-014",
  "category": "science",
  "level": 3,
  "text": "Comment appelle-t-on la science qui étudie les champignons?",
  "options": [
   "Mycologie",
   "Ornithologie",
   "Entomologie",
   "Ichtyologie"
  ],
  "correct": 0,
  "explanation": "La mycologie est l'étude scientifique des champignons.",
  "source": "https://www.britannica.com/science/mycology"
 },
 {
  "id": "2026-science-015",
  "category": "science",
  "level": 1,
  "text": "Quel élément chimique a pour symbole Na?",
  "options": [
   "Sodium",
   "Azote",
   "Nickel",
   "Néon"
  ],
  "correct": 0,
  "explanation": "Na vient du latin natrium.",
  "source": "https://www.rsc.org/periodic-table/element/11/sodium"
 },
 {
  "id": "2026-science-016",
  "category": "science",
  "level": 2,
  "text": "Quel élément chimique a pour symbole Au?",
  "options": [
   "Or",
   "Argent",
   "Cuivre",
   "Aluminium"
  ],
  "correct": 0,
  "explanation": "Au dérive du nom latin aurum, qui désigne l'or.",
  "source": "https://www.rsc.org/periodic-table/element/79/gold"
 },
 {
  "id": "2026-science-017",
  "category": "science",
  "level": 2,
  "text": "Combien de cœurs possède une pieuvre?",
  "options": [
   "Trois",
   "Un",
   "Deux",
   "Quatre"
  ],
  "correct": 0,
  "explanation": "La pieuvre possède deux cœurs branchiaux et un cœur systémique.",
  "source": "https://www.britannica.com/animal/octopus-mollusk"
 },
 {
  "id": "2026-science-018",
  "category": "science",
  "level": 1,
  "text": "Quelle unité sert à mesurer la puissance dans le Système international?",
  "options": [
   "Watt",
   "Joule",
   "Newton",
   "Pascal"
  ],
  "correct": 0,
  "explanation": "Le watt est l'unité de puissance, soit un joule par seconde.",
  "source": "https://www.bipm.org/en/measurement-units"
 },
 {
  "id": "2026-science-019",
  "category": "science",
  "level": 1,
  "text": "À quoi est surtout liée la salinité moyenne des océans?",
  "options": [
   "Aux sels dissous",
   "Aux microplastiques",
   "Aux gaz nobles",
   "Aux particules de sable"
  ],
  "correct": 0,
  "explanation": "L'eau de mer contient notamment des ions sodium et chlorure.",
  "source": "https://oceanservice.noaa.gov/facts/salinity.html"
 },
 {
  "id": "2026-science-020",
  "category": "science",
  "level": 1,
  "text": "Quel mammifère pratique le vol battu véritable?",
  "options": [
   "Chauve-souris",
   "Écureuil volant",
   "Péteur volant",
   "Galéopithèque"
  ],
  "correct": 0,
  "explanation": "Les chauves-souris sont les seuls mammifères capables d'un vol activement propulsé.",
  "source": "https://www.britannica.com/animal/bat-mammal"
 },
 {
  "id": "2026-science-021",
  "category": "science",
  "level": 2,
  "text": "Quel élément de la cellule végétale renferme la chlorophylle photosynthétique?",
  "options": [
   "Chloroplaste",
   "Noyau",
   "Vacuole",
   "Ribosome"
  ],
  "correct": 0,
  "explanation": "Les chloroplastes contiennent les pigments impliqués dans la capture de lumière.",
  "source": "https://www.britannica.com/science/chloroplast"
 },
 {
  "id": "2026-science-022",
  "category": "science",
  "level": 2,
  "text": "Comment s'appelle la couche terrestre située directement sous la croûte?",
  "options": [
   "Manteau",
   "Noyau interne",
   "Atmosphère",
   "Hydrosphère"
  ],
  "correct": 0,
  "explanation": "Le manteau se situe entre la croûte et le noyau de la Terre.",
  "source": "https://www.usgs.gov/programs/earthquake-hazards/science/inside-earth"
 },
 {
  "id": "2026-science-023",
  "category": "science",
  "level": 2,
  "text": "Quel organe cellulaire participe directement à la synthèse des protéines en lisant l'ARN messager?",
  "options": [
   "Ribosome",
   "Lysosome",
   "Centrosome",
   "Peroxysome"
  ],
  "correct": 0,
  "explanation": "Les ribosomes traduisent les instructions de l'ARN messager en chaînes protéiques.",
  "source": "https://www.britannica.com/science/ribosome"
 },
 {
  "id": "2026-science-024",
  "category": "science",
  "level": 3,
  "text": "Quel satellite naturel de Saturne possède des lacs de méthane et d'éthane?",
  "options": [
   "Titan",
   "Encelade",
   "Mimas",
   "Japet"
  ],
  "correct": 0,
  "explanation": "Titan possède des mers et des lacs d'hydrocarbures liquides.",
  "source": "https://science.nasa.gov/saturn/moons/titan/facts/"
 },
 {
  "id": "2026-science-025",
  "category": "science",
  "level": 3,
  "text": "Quelle période géologique précède immédiatement le Jurassique?",
  "options": [
   "Trias",
   "Crétacé",
   "Permien",
   "Dévonien"
  ],
  "correct": 0,
  "explanation": "Dans le Mésozoïque, l'ordre est Trias, Jurassique, Crétacé.",
  "source": "https://www.britannica.com/science/Triassic-Period"
 },
 {
  "id": "2026-mots-001",
  "category": "mots",
  "level": 1,
  "text": "Quel terme qualifie un mot créé récemment ou introduit dans une langue?",
  "options": [
   "Néologisme",
   "Archaïsme",
   "Homonyme",
   "Antonyme"
  ],
  "correct": 0,
  "explanation": "Un néologisme peut être une création ou un emploi nouveau.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-002",
  "category": "mots",
  "level": 3,
  "text": "Un réservoir passe de 40 à 64 litres. Quelle fraction de son volume initial représente l'augmentation?",
  "options": [
   "3/5",
   "2/5",
   "5/8",
   "3/8"
  ],
  "correct": 0,
  "explanation": "L'augmentation est de 24 litres; 24/40 se simplifie en 3/5.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-003",
  "category": "mots",
  "level": 1,
  "text": "Dans « La ville s'endormait », quelle figure attribue une action humaine à un lieu?",
  "options": [
   "Personnification",
   "Ellipse",
   "Antiphrase",
   "Parallélisme"
  ],
  "correct": 0,
  "explanation": "La ville est présentée comme un être qui peut dormir.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/francais"
 },
 {
  "id": "2026-mots-004",
  "category": "mots",
  "level": 1,
  "text": "Quelle est la somme des nombres entiers de 1 à 20 inclusivement?",
  "options": [
   "210",
   "200",
   "190",
   "220"
  ],
  "correct": 0,
  "explanation": "La somme vaut (20 × 21)/2 = 210.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-005",
  "category": "mots",
  "level": 2,
  "text": "Quel terme désigne un récit composé d'échanges de lettres?",
  "options": [
   "Roman épistolaire",
   "Roman picaresque",
   "Essai polémique",
   "Épopée héroïque"
  ],
  "correct": 0,
  "explanation": "Un roman épistolaire raconte son intrigue au moyen de correspondances.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-006",
  "category": "mots",
  "level": 2,
  "text": "Quel est le volume d'un cube dont chaque arête mesure 3 cm?",
  "options": [
   "27 cm³",
   "9 cm³",
   "18 cm³",
   "81 cm³"
  ],
  "correct": 0,
  "explanation": "Le volume d'un cube est le produit de ses trois arêtes, soit 3 × 3 × 3.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-007",
  "category": "mots",
  "level": 1,
  "text": "Si a = 7 et b = 2, que vaut (a - b)²?",
  "options": [
   "25",
   "45",
   "9",
   "49"
  ],
  "correct": 0,
  "explanation": "La différence est 5; son carré vaut 25.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-008",
  "category": "mots",
  "level": 1,
  "text": "Quelle est la médiane de 3, 4, 9, 17 et 21?",
  "options": [
   "9",
   "4",
   "10,8",
   "17"
  ],
  "correct": 0,
  "explanation": "La valeur centrale de cette liste déjà triée est 9.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-009",
  "category": "mots",
  "level": 3,
  "text": "Quel mot désigne une parole brève et remarquable exprimant une pensée?",
  "options": [
   "Aphorisme",
   "Épopée",
   "Pastiche",
   "Diatribe"
  ],
  "correct": 0,
  "explanation": "L'aphorisme est une formule courte qui énonce une idée générale.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-010",
  "category": "mots",
  "level": 1,
  "text": "Quel terme désigne une expression inutilement redondante, comme « monter en haut »?",
  "options": [
   "Pléonasme",
   "Néologisme",
   "Calembour",
   "Antiphrase"
  ],
  "correct": 0,
  "explanation": "Un pléonasme répète une information déjà contenue dans un autre mot.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/francais"
 },
 {
  "id": "2026-mots-011",
  "category": "mots",
  "level": 3,
  "text": "Combien de paires distinctes peut-on former parmi cinq personnes?",
  "options": [
   "10",
   "5",
   "15",
   "20"
  ],
  "correct": 0,
  "explanation": "On peut choisir deux personnes parmi cinq de dix façons.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-012",
  "category": "mots",
  "level": 2,
  "text": "Une voiture roule 90 km en 75 minutes à vitesse constante. Quelle distance parcourt-elle en 50 minutes?",
  "options": [
   "60 km",
   "50 km",
   "65 km",
   "75 km"
  ],
  "correct": 0,
  "explanation": "La vitesse est de 72 km/h; en 50 minutes elle parcourt 60 km.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-013",
  "category": "mots",
  "level": 2,
  "text": "Quel mot désigne le contraire de « taciturne »?",
  "options": [
   "Bavard",
   "Discret",
   "Silencieux",
   "Réservé"
  ],
  "correct": 0,
  "explanation": "Une personne taciturne parle peu; une personne bavarde parle beaucoup.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-014",
  "category": "mots",
  "level": 3,
  "text": "Quel mot signifie « qui résiste aux tentatives de persuasion »?",
  "options": [
   "Récalcitrant",
   "Désinvolte",
   "Diligent",
   "Circonspect"
  ],
  "correct": 0,
  "explanation": "Récalcitrant désigne notamment une personne qui résiste à l'autorité ou à une demande.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-015",
  "category": "mots",
  "level": 2,
  "text": "Comment appelle-t-on un malentendu fondé sur une confusion entre personnes ou propos?",
  "options": [
   "Quiproquo",
   "Anaphore",
   "Oxymore",
   "Gradation"
  ],
  "correct": 0,
  "explanation": "Un quiproquo est une méprise qui provoque un échange fondé sur une fausse interprétation.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-016",
  "category": "mots",
  "level": 3,
  "text": "Quelle figure consiste à dire moins pour laisser entendre davantage?",
  "options": [
   "Litote",
   "Hyperbole",
   "Pléonasme",
   "Accumulation"
  ],
  "correct": 0,
  "explanation": "La litote exprime une idée de façon atténuée afin d'en suggérer plus.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/francais"
 },
 {
  "id": "2026-mots-017",
  "category": "mots",
  "level": 1,
  "text": "Quelle figure atténue volontairement une expression jugée brutale ou pénible?",
  "options": [
   "Euphémisme",
   "Gradation",
   "Chiasme",
   "Anaphore"
  ],
  "correct": 0,
  "explanation": "L'euphémisme remplace une formulation trop directe par une expression adoucie.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/francais"
 },
 {
  "id": "2026-mots-018",
  "category": "mots",
  "level": 3,
  "text": "Quel nom donne-t-on à un mot ou une phrase qui se lit dans les deux sens, sans tenir compte des espaces?",
  "options": [
   "Palindrome",
   "Anagramme",
   "Paronyme",
   "Homophone"
  ],
  "correct": 0,
  "explanation": "Un palindrome conserve le même ordre de lettres de gauche à droite ou l'inverse.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-019",
  "category": "mots",
  "level": 1,
  "text": "Si 3x + 7 = 25, quelle est la valeur de x?",
  "options": [
   "6",
   "4",
   "8",
   "9"
  ],
  "correct": 0,
  "explanation": "En soustrayant 7, il reste 18, puis en divisant par 3, on obtient 6.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-020",
  "category": "mots",
  "level": 2,
  "text": "Un manteau de 240 $ bénéficie d’une réduction unique de 15 %. Quel est le montant du rabais?",
  "options": [
   "36 $",
   "24 $",
   "30 $",
   "40 $"
  ],
  "correct": 0,
  "explanation": "15 % de 240 $ correspondent à 36 $.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-021",
  "category": "mots",
  "level": 2,
  "text": "Quel mot désigne un texte dont les premières lettres successives composent un nom ou un message?",
  "options": [
   "Acrostiche",
   "Calligramme",
   "Sonnet",
   "Épitaphe"
  ],
  "correct": 0,
  "explanation": "Dans un acrostiche, certaines lettres initiales forment un autre texte.",
  "source": "https://dictionnaire.lerobert.com/"
 },
 {
  "id": "2026-mots-022",
  "category": "mots",
  "level": 3,
  "text": "On lance trois pièces de monnaie distinctes. Combien de suites possibles de pile ou face existe-t-il?",
  "options": [
   "8",
   "6",
   "12",
   "9"
  ],
  "correct": 0,
  "explanation": "Deux choix pour chacune des trois pièces donnent 2 × 2 × 2 = 8.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-023",
  "category": "mots",
  "level": 2,
  "text": "Quelle est la nature du mot « quoique » dans « Quoique fatiguée, elle poursuit sa route »?",
  "options": [
   "Conjonction de subordination",
   "Adverbe de négation",
   "Préposition",
   "Pronom relatif"
  ],
  "correct": 0,
  "explanation": "« Quoique » introduit la subordonnée concessive « Quoique fatiguée ».",
  "source": "https://vitrinelinguistique.oqlf.gouv.qc.ca/23831/la-grammaire/les-conjonctions/la-conjonction-quoique"
 },
 {
  "id": "2026-mots-024",
  "category": "mots",
  "level": 1,
  "text": "Combien de périodes complètes de 15 secondes y a-t-il dans cinq minutes?",
  "options": [
   "20",
   "15",
   "25",
   "30"
  ],
  "correct": 0,
  "explanation": "Cinq minutes valent 300 secondes et 300 ÷ 15 = 20.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 },
 {
  "id": "2026-mots-025",
  "category": "mots",
  "level": 3,
  "text": "Combien de façons peut-on disposer quatre livres différents en une seule rangée?",
  "options": [
   "24",
   "12",
   "16",
   "32"
  ],
  "correct": 0,
  "explanation": "Le nombre de permutations est 4 × 3 × 2 × 1 = 24.",
  "source": "https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques"
 }
];
