// Questions originales. Le premier choix du fichier source est la bonne réponse;
// le moteur mélange les quatre choix indépendamment pour chaque nouvelle partie.
export const LOCAL_THEMES=[{id:'quartiers',name:'Quartiers & toponymie'},{id:'histoire',name:'Histoire municipale'},{id:'patrimoine',name:'Patrimoine & architecture'},{id:'culture',name:'Culture & sports'},{id:'nature',name:'Nature & territoire'}];
export const CATEGORIES = [
 {id:'local',name:'Québec & Saint-Émile',icon:'⌂',color:'#8ebcff'},
 {id:'geo',name:'Québec & Canada',icon:'⚜',color:'#6eafff'},
 {id:'histoire',name:'Histoire',icon:'⌛',color:'#f7c85e'},
 {id:'culture',name:'Arts & culture',icon:'♫',color:'#c8a0ff'},
 {id:'sport',name:'Sports & jeux',icon:'★',color:'#ff956e'},
 {id:'science',name:'Sciences & nature',icon:'✿',color:'#77d8b1'},
 {id:'mots',name:'Mots & logique',icon:'✎',color:'#f3a1c5'}
];
const S={
 regions:'https://www.canada.ca/fr/immigration-refugies-citoyennete/organisation/publications-guides/decouvrir-canada/lisez-ligne/regions-canada.html',
 symbols:'https://www.canada.ca/en/canadian-heritage/services/official-symbols-canada.html',
 qc:'https://www.quebec.ca/gouvernement/portrait-quebec/drapeau-symboles-nationaux',
 history:'https://www.canada.ca/fr/immigration-refugies-citoyennete/organisation/publications-guides/decouvrir-canada/lisez-ligne/histoire-canada.html',
 provinces:'https://www.canada.ca/en/intergovernmental-affairs/services/provinces-territories.html',
 nelligan:'https://www.patrimoine-culturel.gouv.qc.ca/detail.do?id=9356&methode=consulter&type=pge',
 roy:'https://www.patrimoine-culturel.gouv.qc.ca/detail.do?id=9208&methode=consulter&type=pge',
 tremblay:'https://www.patrimoine-culturel.gouv.qc.ca/rpcq/detail.do?id=27405&methode=consulter&type=pge',
 vigneault:'https://www.patrimoine-culturel.gouv.qc.ca/detail.do?id=33481&methode=consulter&type=pge',
 leclerc:'https://www.patrimoine-culturel.gouv.qc.ca/rpcq/detail.do?id=7697&methode=consulter&type=pge',
 hemon:'https://acdps.umontreal.accesstomemory.org/fonds-louis-hemon',
 planets:'https://science.nasa.gov/solar-system/solar-system-facts/',
 sun:'https://science.nasa.gov/sun/facts/',
 words:'https://dictionnaire.lerobert.com/',
 math:'https://www.alloprof.qc.ca/fr/eleves/bv/mathematiques',
 music:'https://www.alloprof.qc.ca/fr/eleves/bv/musique',
 science:'https://www.alloprof.qc.ca/fr/eleves/bv/sciences',
 sports:'https://olympic.ca/sports/',
};
const bank=[];
function add(cat,level,source,rows){for(const line of rows.trim().split('\n')){const [text,a,b,c,d,explanation,key]=line.split('|');bank.push({id:`${cat}-${level}-${bank.filter(q=>q.category===cat&&q.level===level).length+1}`,category:cat,level,text,options:[a,b,c,d],correct:0,explanation,source:S[key||source]||key||source});}}
add('geo',1,'regions',`
Quelle est la capitale du Canada?|Ottawa|Toronto|Montréal|Vancouver|Ottawa est la capitale fédérale du Canada.
Quelle est la capitale du Québec?|Québec|Montréal|Laval|Sherbrooke|La ville de Québec est la capitale de la province.
Combien de provinces le Canada compte-t-il?|10|8|12|13|Le Canada comprend dix provinces et trois territoires.
Dans quelle province se trouve Toronto?|Ontario|Québec|Alberta|Manitoba|Toronto est aussi la capitale de l'Ontario.
Quelle province canadienne est une île située dans le golfe du Saint-Laurent?|Île-du-Prince-Édouard|Alberta|Saskatchewan|Manitoba|L'Île-du-Prince-Édouard est la plus petite province du Canada.
Quel océan borde la Colombie-Britannique?|Pacifique|Atlantique|Indien|Austral|La Colombie-Britannique se trouve sur la côte pacifique du Canada.
Quelle feuille figure sur le drapeau canadien?|Érable|Chêne|Bouleau|Peuplier|Une feuille d'érable rouge occupe le centre du drapeau canadien.|symbols
Quelle est la devise du Québec?|Je me souviens|L'union fait la force|Toujours plus haut|D'un océan à l'autre|La devise du Québec est « Je me souviens ».|qc
Quel oiseau est l'emblème aviaire du Québec?|Harfang des neiges|Geai bleu|Huard|Cardinal rouge|Le harfang des neiges est un des trois emblèmes officiels du Québec.|qc
Combien de territoires le Canada compte-t-il?|3|2|4|5|Il s'agit du Yukon, des Territoires du Nord-Ouest et du Nunavut.
`);
add('geo',2,'regions',`
Quelle est la capitale de la Colombie-Britannique?|Victoria|Vancouver|Kelowna|Kamloops|Victoria, située sur l'île de Vancouver, est la capitale provinciale.
Quelle est la capitale de l'Alberta?|Edmonton|Calgary|Banff|Red Deer|Edmonton est la capitale de l'Alberta.
Quelle est la capitale du Manitoba?|Winnipeg|Regina|Brandon|Saskatoon|Winnipeg est la capitale du Manitoba.
Quelle est la capitale de la Nouvelle-Écosse?|Halifax|Fredericton|Charlottetown|Moncton|Halifax est la capitale de la Nouvelle-Écosse.
Quelle est la capitale du Nouveau-Brunswick?|Fredericton|Moncton|Saint John|Bathurst|Fredericton est la capitale du Nouveau-Brunswick.
Quelle est la capitale de la Saskatchewan?|Regina|Saskatoon|Winnipeg|Medicine Hat|Regina est la capitale de la Saskatchewan.
Quel est l'emblème floral officiel du Québec?|Iris versicolore|Lys blanc|Rose rouge|Trille blanc|L'iris versicolore a été adopté comme emblème floral en 1999.|qc
Quel arbre est l'emblème forestier du Québec?|Bouleau jaune|Érable à sucre|Sapin baumier|Pin blanc|Le bouleau jaune est l'emblème forestier du Québec.|qc
Quelle province canadienne est officiellement bilingue français-anglais?|Nouveau-Brunswick|Ontario|Manitoba|Nouvelle-Écosse|Le Nouveau-Brunswick est la seule province officiellement bilingue français-anglais.
Quelle province comprend le Labrador?|Terre-Neuve-et-Labrador|Québec|Nouvelle-Écosse|Nouveau-Brunswick|Le Labrador constitue la partie continentale de Terre-Neuve-et-Labrador.
`);
add('geo',3,'regions',`
Quelle est la capitale du Nunavut?|Iqaluit|Yellowknife|Whitehorse|Rankin Inlet|Iqaluit est la capitale du Nunavut.
Quelle est la capitale des Territoires du Nord-Ouest?|Yellowknife|Iqaluit|Whitehorse|Inuvik|Yellowknife est la capitale des Territoires du Nord-Ouest.
Quelle est la capitale du Yukon?|Whitehorse|Dawson|Yellowknife|Iqaluit|Whitehorse est la capitale du Yukon.
Quelle est la capitale de Terre-Neuve-et-Labrador?|St. John's|Saint John|Halifax|Corner Brook|St. John's est à Terre-Neuve; Saint John est au Nouveau-Brunswick.
Quelle province canadienne possède la plus grande superficie totale?|Québec|Ontario|Alberta|Colombie-Britannique|Le Québec est la plus vaste province; le Nunavut est un territoire.
Quel territoire canadien a la plus grande superficie totale?|Nunavut|Yukon|Territoires du Nord-Ouest|Labrador|Le Nunavut est le plus vaste des territoires canadiens.
Quelle province possède la ville de Charlottetown comme capitale?|Île-du-Prince-Édouard|Nouvelle-Écosse|Nouveau-Brunswick|Terre-Neuve-et-Labrador|Charlottetown est la capitale de l'Île-du-Prince-Édouard.
Quel groupe contient uniquement les trois provinces maritimes?|Nouveau-Brunswick, Nouvelle-Écosse, Île-du-Prince-Édouard|Québec, Ontario, Manitoba|Nouvelle-Écosse, Terre-Neuve-et-Labrador, Québec|Alberta, Saskatchewan, Manitoba|Les Maritimes ne comprennent pas Terre-Neuve-et-Labrador, qui fait partie des provinces de l'Atlantique.
Quelles provinces forment les Prairies canadiennes?|Alberta, Saskatchewan, Manitoba|Ontario, Québec, Manitoba|Colombie-Britannique, Alberta, Yukon|Nouvelle-Écosse, Nouveau-Brunswick, Québec|Les trois provinces des Prairies sont le Manitoba, la Saskatchewan et l'Alberta.
Sur le drapeau du Québec, combien de fleurs de lys voit-on?|4|3|5|6|Le fleurdelisé porte quatre fleurs de lys blanches sur fond bleu.|qc
`);
add('histoire',1,'history',`
En quelle année la Confédération canadienne a-t-elle eu lieu?|1867|1763|1905|1982|La Confédération entre en vigueur le 1er juillet 1867.
Qui fonde Québec en 1608?|Samuel de Champlain|Jacques Cartier|Jean Talon|Louis-Joseph Papineau|Samuel de Champlain fonde l'établissement de Québec en 1608.
Quel explorateur français arrive dans le golfe du Saint-Laurent en 1534?|Jacques Cartier|Samuel de Champlain|Louis Jolliet|Pierre Le Moyne d'Iberville|Jacques Cartier effectue son premier voyage au Canada en 1534.
À quelle date célèbre-t-on la fête du Canada?|1er juillet|24 juin|11 novembre|15 février|Le 1er juillet rappelle l'entrée en vigueur de la Confédération.
Quelle guerre mondiale commence en 1914?|Première Guerre mondiale|Deuxième Guerre mondiale|Guerre de Sept Ans|Guerre de 1812|La Première Guerre mondiale se déroule de 1914 à 1918.
Quelle guerre mondiale se termine en 1945?|Deuxième Guerre mondiale|Première Guerre mondiale|Guerre de Sept Ans|Guerre de Crimée|La Deuxième Guerre mondiale se termine en 1945.
Quel animal est étroitement associé à la traite des fourrures au Canada?|Castor|Bison|Orignal|Ours polaire|La fourrure de castor occupait une place majeure dans la traite.
Quel pays contrôlait la Nouvelle-France avant la conquête britannique?|France|Espagne|Portugal|Italie|La Nouvelle-France était une colonie française.
Quel jour est consacré au souvenir des militaires morts en service au Canada?|11 novembre|1er avril|24 juin|25 décembre|Le jour du Souvenir est observé le 11 novembre.
Quelle ville a accueilli l'Expo 67?|Montréal|Québec|Toronto|Ottawa|L'Exposition universelle de 1967 a lieu à Montréal.
`);
add('histoire',2,'history',`
Qui est le premier premier ministre du Canada?|John A. Macdonald|Wilfrid Laurier|Lester B. Pearson|Pierre Elliott Trudeau|John A. Macdonald devient le premier premier ministre en 1867.
En quelle année la bataille des plaines d'Abraham a-t-elle lieu?|1759|1608|1763|1837|La bataille oppose les forces de Wolfe et de Montcalm en 1759.
Quelle province rejoint la Confédération en 1949?|Terre-Neuve|Alberta|Manitoba|Colombie-Britannique|Terre-Neuve rejoint le Canada en 1949; son nom officiel change ensuite.|provinces
En quelle année le Nunavut est-il créé?|1999|1967|1982|2005|Le Nunavut est créé le 1er avril 1999.|provinces
Combien de provinces forment le Canada en 1867?|4|3|6|10|Les provinces fondatrices sont le Québec, l'Ontario, le Nouveau-Brunswick et la Nouvelle-Écosse.|provinces
Quelle province entre dans la Confédération en 1871?|Colombie-Britannique|Alberta|Saskatchewan|Terre-Neuve|La Colombie-Britannique entre dans la Confédération en 1871.|provinces
Quel premier ministre est associé au début de la Révolution tranquille en 1960?|Jean Lesage|Maurice Duplessis|Robert Bourassa|René Lévesque|L'élection du gouvernement de Jean Lesage en 1960 marque le début de cette période.
En quelle année le drapeau canadien à la feuille d'érable est-il inauguré?|1965|1867|1945|1982|Le drapeau est inauguré le 15 février 1965.|symbols
En quelle année le Québec adopte-t-il son fleurdelisé?|1948|1867|1960|1976|Le drapeau du Québec est adopté le 21 janvier 1948.|qc
Quelle ville accueille la conférence de septembre 1864 liée à la Confédération?|Charlottetown|Winnipeg|Calgary|Vancouver|La conférence de Charlottetown est une étape du projet de Confédération.
`);
add('histoire',3,'history',`
Quel traité de 1763 met fin à la guerre de Sept Ans entre la France et la Grande-Bretagne?|Traité de Paris|Traité de Gand|Traité de Versailles de 1919|Traité de Maastricht|Le traité de Paris de 1763 cède le Canada à la Grande-Bretagne.
En quelle année l'Acte de Québec est-il adopté?|1774|1759|1791|1840|L'Acte de Québec est adopté par le Parlement britannique en 1774.
Quel texte crée le Haut-Canada et le Bas-Canada en 1791?|Acte constitutionnel|Acte de Québec|Acte d'Union|Statut de Westminster|L'Acte constitutionnel de 1791 divise la province de Québec.
En quelle année le Statut de Westminster est-il adopté?|1931|1867|1914|1982|Le Statut de Westminster de 1931 élargit l'autonomie législative des dominions.|provinces
En quelle année la Constitution canadienne est-elle rapatriée?|1982|1965|1976|1999|Le rapatriement et la Charte canadienne des droits et libertés datent de 1982.|provinces
Quel premier ministre canadien reçoit le prix Nobel de la paix en 1957?|Lester B. Pearson|John Diefenbaker|William Lyon Mackenzie King|Wilfrid Laurier|Lester B. Pearson est récompensé pour son rôle dans la crise de Suez.
Quelles deux provinces sont créées en 1905?|Alberta et Saskatchewan|Manitoba et Ontario|Québec et Nouvelle-Écosse|Colombie-Britannique et Terre-Neuve|L'Alberta et la Saskatchewan deviennent des provinces le 1er septembre 1905.|provinces
En quelle année le Manitoba devient-il une province?|1870|1867|1873|1905|Le Manitoba entre dans la Confédération en 1870.|provinces
Quelle province rejoint le Canada en 1873?|Île-du-Prince-Édouard|Manitoba|Colombie-Britannique|Terre-Neuve|L'Île-du-Prince-Édouard entre dans la Confédération en 1873.|provinces
Quel conflit commence en 1812 entre les États-Unis et la Grande-Bretagne, notamment en Amérique du Nord?|Guerre de 1812|Guerre de Sécession|Guerre de Sept Ans|Guerre des Boers|La guerre de 1812 oppose les États-Unis à la Grande-Bretagne et à ses alliés.
`);
add('culture',1,'music',`
Quel instrument possède des touches noires et blanches?|Piano|Violon|Trompette|Flûte traversière|Le clavier du piano alterne touches blanches et touches noires.
Quel art associe habituellement acteurs, scène et public?|Théâtre|Sculpture|Photographie|Gravure|Le théâtre est un art de la représentation scénique.|words
Comment appelle-t-on la personne qui écrit un roman?|Romancier ou romancière|Chorégraphe|Architecte|Chef d'orchestre|Le romancier ou la romancière est l'auteur d'un roman.|words
Quel instrument se joue principalement avec un archet?|Violon|Trompette|Piano|Tambour|L'archet fait vibrer les cordes du violon.
Dans quel domaine remet-on les Oscars?|Cinéma|Cuisine|Littérature|Architecture|Les Oscars récompensent des réalisations du cinéma.|https://www.oscars.org/oscars
Quel art consiste à modeler ou tailler des formes en volume?|Sculpture|Poésie|Photographie|Danse|La sculpture produit des œuvres en trois dimensions.|words
Comment appelle-t-on un ensemble de musiciens dirigés par un chef?|Orchestre|Chorale de lecteurs|Atelier d'écriture|Troupe de théâtre|Un orchestre réunit des instrumentistes sous la direction d'un chef.
Quel instrument appartient à la famille des cuivres?|Trompette|Clarinette|Violon|Harpe|La trompette est un instrument à vent de la famille des cuivres.
Quel mot désigne les paroles échangées entre personnages au théâtre?|Dialogue|Paysage|Préface|Sommaire|Le dialogue est un échange de paroles entre plusieurs personnes.|words
Quel signe musical sert notamment à indiquer la hauteur des notes sur une portée?|Clé|Virgule|Guillemet|Parenthèse|La clé, comme la clé de sol, fixe des repères de hauteur sur la portée.
`);
add('culture',2,'words',`
Qui a écrit Les Belles-sœurs?|Michel Tremblay|Michel Marc Bouchard|Marcel Dubé|Robert Lepage|La pièce de Michel Tremblay est créée sur scène en 1968.|tremblay
Qui a écrit Bonheur d'occasion?|Gabrielle Roy|Anne Hébert|Marie-Claire Blais|Kim Thúy|Le premier roman de Gabrielle Roy paraît en 1945.|roy
Quel poète québécois a écrit Le Vaisseau d'or?|Émile Nelligan|Gaston Miron|Paul Éluard|Hector de Saint-Denys Garneau|Le Vaisseau d'or est un célèbre poème d'Émile Nelligan.|nelligan
Quel auteur a écrit Maria Chapdelaine?|Louis Hémon|Félix-Antoine Savard|Claude-Henri Grignon|Yves Thériault|Louis Hémon écrit Maria Chapdelaine après son séjour à Péribonka.|hemon
Quel chanteur a créé Gens du pays, avec Gaston Rochon pour la musique?|Gilles Vigneault|Félix Leclerc|Jean-Pierre Ferland|Robert Charlebois|Gilles Vigneault crée Gens du pays en 1975; Gaston Rochon en cosigne la musique.|vigneault
Quel auteur-compositeur a aussi écrit Pieds nus dans l'aube?|Félix Leclerc|Gilles Vigneault|Claude Léveillée|Richard Desjardins|Le roman Pieds nus dans l'aube de Félix Leclerc paraît en 1947.|leclerc
Comment nomme-t-on l'auteur d'une pièce de théâtre?|Dramaturge|Chorégraphe|Scénographe|Projectionniste|Le dramaturge écrit des œuvres pour le théâtre.
Combien de cordes possède un violon classique?|4|5|6|8|Le violon classique possède quatre cordes.|music
Comment appelle-t-on le texte chanté d'un opéra?|Livret|Synopsis|Partition d'orchestre|Générique|Le livret contient le texte littéraire d'un opéra.
Dans quel art travaille un chorégraphe?|Danse|Peinture|Bande dessinée|Architecture|Le chorégraphe conçoit l'organisation des mouvements d'une danse.
`);
add('culture',3,'words',`
En quelle année Les Belles-sœurs est-elle créée sur scène?|1968|1948|1976|1988|La première représentation de la pièce de Michel Tremblay a lieu en 1968.|tremblay
En quelle année paraît Bonheur d'occasion?|1945|1930|1960|1975|Bonheur d'occasion paraît en 1945.|roy
Quel roman de Gabrielle Roy porte le nom d'un employé de banque?|Alexandre Chenevert|Maria Chapdelaine|Menaud, maître-draveur|Trente arpents|Alexandre Chenevert est un roman de Gabrielle Roy publié en 1954.|roy
Quel est le titre du premier roman de Félix Leclerc?|Pieds nus dans l'aube|Le fou de l'île|Carcajou ou Le diable des bois|La Route d'Altamont|Pieds nus dans l'aube paraît en 1947, avant ses autres romans.|leclerc
Quel recueil de Gabrielle Roy porte le nom d'une rue?|Rue Deschambault|La rue Principale|Rue du Trésor|La rue Saint-Denis|Rue Deschambault, de Gabrielle Roy, paraît en 1955.|roy
Quel mot désigne une peinture réalisée sur un enduit encore frais?|Fresque|Lithographie|Mosaïque|Eau-forte|Au sens technique, la fresque utilise un enduit frais.
Quel procédé de gravure utilise une pierre calcaire ou une plaque préparée?|Lithographie|Broderie|Céramique|Tapisserie|La lithographie repose sur un support de pierre ou un support équivalent préparé.
Comment appelle-t-on la répétition d'un son consonantique dans un vers?|Allitération|Assonance|Anaphore|Oxymore|L'allitération répète des consonnes; l'assonance répète des voyelles.
Quelle figure rapproche deux termes contradictoires, comme « obscure clarté »?|Oxymore|Métonymie|Gradation|Euphémisme|Un oxymore associe des mots de sens apparemment contradictoires.
Quel mot désigne une œuvre musicale composée pour neuf exécutants?|Nonette|Octuor|Septuor|Quintette|Un nonette réunit neuf exécutants; un octuor en réunit huit.
`);
add('sport',1,'sports',`
Quel sport se joue avec une rondelle?|Hockey sur glace|Soccer|Basketball|Tennis|Au hockey sur glace, les joueurs déplacent une rondelle.|https://olympic.ca/sports/ice-hockey/
Dans quel sport cherche-t-on à faire un panier?|Basketball|Baseball|Curling|Badminton|Le but du basketball est de marquer dans le panier adverse.|https://olympic.ca/sports/basketball/
Quel sport utilise un volant?|Badminton|Tennis|Golf|Squash|Le badminton utilise un volant, et non une balle.|https://olympic.ca/sports/badminton/
Au soccer, quel joueur peut normalement prendre le ballon avec les mains dans sa propre surface de réparation?|Gardien de but|Attaquant|Défenseur central|Milieu de terrain|Le gardien bénéficie de cette permission dans sa propre surface de réparation.|https://www.theifab.com/laws/latest/the-players/
Dans quel sport lance-t-on des pierres vers une cible sur la glace?|Curling|Hockey|Patinage artistique|Skeleton|Le curling se joue avec des pierres et une cible appelée maison.|https://olympic.ca/sports/curling/
Combien de joueurs une équipe de basketball aligne-t-elle sur le terrain en jeu à cinq?|5|6|7|11|Le basketball classique oppose deux équipes de cinq joueurs.|https://olympic.ca/sports/basketball/
Quel sport comprend les styles crawl, dos et papillon?|Natation|Plongeon|Aviron|Water-polo|Ces techniques sont des styles de nage.|https://olympic.ca/sports/swimming/
Quel objet frappe-t-on au golf?|Balle|Rondelle|Volant|Disque|Au golf, on frappe une balle avec un bâton.|https://olympic.ca/sports/golf/
Dans quel jeu trouve-t-on un roi et une reine?|Échecs|Dominos|Scrabble|Mikado|Le roi et la reine font partie des pièces du jeu d'échecs.|https://handbook.fide.com/chapter/E012023
Quel sport comporte un saut en longueur?|Athlétisme|Escrime|Cyclisme|Judo|Le saut en longueur est une discipline de l'athlétisme.|https://olympic.ca/sports/athletics/
`);
add('sport',2,'sports',`
Quelle ville canadienne accueille les Jeux olympiques d'été de 1976?|Montréal|Toronto|Vancouver|Calgary|Montréal organise les Jeux d'été de 1976.|https://olympic.ca/games/1976-montreal/
Quelle ville canadienne accueille les Jeux olympiques d'hiver de 1988?|Calgary|Montréal|Québec|Ottawa|Calgary accueille les Jeux d'hiver de 1988.|https://olympic.ca/games/1988-calgary/
Quelle ville canadienne accueille les Jeux olympiques d'hiver de 2010?|Vancouver|Calgary|Toronto|Winnipeg|Les Jeux d'hiver de 2010 ont lieu à Vancouver et à Whistler.|https://olympic.ca/games/2010-vancouver/
Quel Canadien invente le basketball en 1891?|James Naismith|Wayne Gretzky|Terry Fox|George Beers|James Naismith invente le basketball à Springfield, aux États-Unis.|https://olympic.ca/sports/basketball/
Au basketball, combien vaut un lancer franc réussi?|1 point|2 points|3 points|4 points|Un lancer franc réussi vaut un point.|https://olympic.ca/sports/basketball/
Au tennis, quel score vient après 30 dans un jeu ordinaire?|40|35|45|60|Dans un jeu ordinaire, les points se comptent 0, 15, 30, 40.|https://olympic.ca/sports/tennis/
Au volleyball intérieur, combien de joueurs d'une équipe sont sur le terrain?|6|5|7|8|Chaque équipe de volleyball intérieur aligne six joueurs.|https://olympic.ca/sports/indoor-volleyball/
Quelle est la distance officielle d'un marathon?|42,195 km|40 km|42 km|45,195 km|La distance officielle est de 42 kilomètres et 195 mètres.|https://worldathletics.org/disciplines/road-running/marathon
Combien de cases compte un échiquier standard?|64|60|81|100|Un échiquier a huit rangées de huit cases, soit 64 cases.|https://handbook.fide.com/chapter/E012023
Quel est le sport national d'été du Canada?|Crosse|Baseball|Soccer|Canoë-kayak|La crosse est le sport national d'été; le hockey sur glace est celui d'hiver.|symbols
`);
add('sport',3,'sports',`
Au curling, comment appelle-t-on la cible circulaire?|Maison|En-but|Cercle de service|Zone franche|La maison est la cible formée de cercles concentriques.|https://olympic.ca/sports/curling/
Au curling traditionnel à quatre joueurs, combien de pierres une équipe lance-t-elle par manche?|8|4|6|10|Chaque joueur lance deux pierres, donc huit pierres par équipe.|https://olympic.ca/sports/curling/
Au décathlon, combien d'épreuves un athlète dispute-t-il?|10|7|8|12|Le décathlon réunit dix épreuves d'athlétisme.|https://olympic.ca/sports/athletics/
Quel sport combine ski de fond et tir à la carabine?|Biathlon|Combiné nordique|Triathlon|Pentathlon moderne|Le biathlon associe ski de fond et tir à la carabine.|https://olympic.ca/sports/biathlon/
Dans quel sport utilise-t-on le terme « ippon »?|Judo|Escrime|Boxe|Lutte gréco-romaine|Au judo, un ippon permet de remporter immédiatement le combat.|https://olympic.ca/sports/judo/
Quelle pièce d'échecs se déplace en « L » et peut sauter par-dessus d'autres pièces?|Cavalier|Fou|Tour|Roi|Le cavalier se déplace de deux cases dans un axe et d'une dans l'autre.|https://handbook.fide.com/chapter/E012023
Au tennis, quel terme désigne un score de zéro?|Love|Ace|Let|Break|En anglais, « love » correspond à zéro au tennis.|https://www.tenniscanada.com/play/tennis-101/tennis-points-rules
Dans une course de relais 4 × 100 m, quelle distance chaque relayeur court-il?|100 m|200 m|400 m|25 m|Quatre relayeurs courent chacun une portion de 100 mètres.|https://olympic.ca/sports/athletics/
Au volleyball intérieur, de combien de points faut-il normalement mener pour gagner une manche?|2|1|3|5|Une manche se gagne avec au moins deux points d'écart.|https://olympic.ca/sports/indoor-volleyball/
Quel sport associe traditionnellement fleuret, épée et sabre?|Escrime|Tir à l'arc|Pentathlon antique|Kendo|Le fleuret, l'épée et le sabre sont les trois armes de l'escrime sportive.|https://olympic.ca/sports/fencing/
`);
add('science',1,'science',`
Quelle planète est surnommée la planète rouge?|Mars|Vénus|Jupiter|Neptune|Les oxydes de fer présents à sa surface donnent à Mars sa teinte rougeâtre.|https://science.nasa.gov/mars/facts/
Combien de planètes notre Système solaire compte-t-il?|8|7|9|10|Le Système solaire compte huit planètes; Pluton est une planète naine.|planets
Quelle étoile se trouve au centre du Système solaire?|Soleil|Sirius|Étoile polaire|Bételgeuse|Le Soleil est l'étoile autour de laquelle orbitent les planètes.|sun
Quelle est la formule chimique de l'eau?|H₂O|CO₂|O₂|NaCl|Une molécule d'eau contient deux atomes d'hydrogène et un d'oxygène.
Quel organe pompe le sang dans le corps humain?|Cœur|Poumon|Foie|Estomac|Le cœur propulse le sang dans les vaisseaux sanguins.
Quelle partie d'une plante capte généralement la lumière pour la photosynthèse?|Feuilles|Racines|Graines|Écorce|Les feuilles contiennent la chlorophylle nécessaire à la photosynthèse.
Comment appelle-t-on le passage de l'eau liquide en glace?|Solidification|Évaporation|Condensation|Sublimation|La solidification est le passage de l'état liquide à l'état solide.
Quel gaz de l'air les humains utilisent-ils pour la respiration cellulaire?|Oxygène|Hélium|Néon|Argon|L'oxygène participe à la respiration cellulaire.
Quel satellite naturel tourne autour de la Terre?|Lune|Mars|Titan|Vénus|La Lune est le satellite naturel de la Terre.|https://science.nasa.gov/moon/facts/
À quelle classe animale appartient le castor?|Mammifères|Reptiles|Amphibiens|Oiseaux|Le castor est un mammifère rongeur.
`);
add('science',2,'science',`
Quelle est la plus grande planète du Système solaire?|Jupiter|Saturne|Neptune|Terre|Jupiter est la planète la plus grande et la plus massive du Système solaire.|https://science.nasa.gov/jupiter/facts/
Quelle planète est la plus proche du Soleil?|Mercure|Vénus|Terre|Mars|Mercure est la première planète à partir du Soleil.|https://science.nasa.gov/mercury/facts/
Quel gaz constitue environ 78 % de l'atmosphère terrestre sèche?|Azote|Oxygène|Dioxyde de carbone|Hydrogène|L'azote est le principal gaz de l'atmosphère terrestre sèche.
Quelle unité sert à mesurer la résistance électrique?|Ohm|Volt|Ampère|Watt|La résistance électrique se mesure en ohms.
Quel métal a pour symbole chimique Fe?|Fer|Fluor|Francium|Fermium|Fe vient du latin ferrum et désigne le fer.|https://periodic-table.rsc.org/element/26/iron
Quel phénomène permet aux plantes de fabriquer des sucres grâce à la lumière?|Photosynthèse|Fermentation|Érosion|Évaporation|La photosynthèse transforme l'énergie lumineuse en énergie chimique.
Quel instrument mesure la pression atmosphérique?|Baromètre|Thermomètre|Anémomètre|Pluviomètre|Un baromètre sert à mesurer la pression de l'air.
Quelle force maintient les planètes en orbite autour du Soleil?|Gravitation|Frottement|Poussée d'Archimède|Force élastique|La gravitation attire les corps ayant une masse.|sun
Combien de pattes un insecte adulte possède-t-il normalement?|6|4|8|10|Les insectes possèdent trois paires de pattes.
Quel organe humain filtre le sang et produit l'urine?|Rein|Pancréas|Estomac|Rate|Les reins filtrent le sang et contribuent à former l'urine.
`);
add('science',3,'science',`
Quelle planète possède une inclinaison de rotation d'environ 98 degrés et semble rouler sur son orbite?|Uranus|Mars|Jupiter|Mercure|L'axe de rotation d'Uranus est fortement incliné, à environ 98 degrés.|https://science.nasa.gov/uranus/facts/
Quelle planète a la température moyenne de surface la plus élevée?|Vénus|Mercure|Mars|Jupiter|L'effet de serre intense de Vénus la rend plus chaude que Mercure.|https://science.nasa.gov/venus/facts/
Comment appelle-t-on le passage direct d'un solide à un gaz?|Sublimation|Fusion|Liquéfaction|Condensation liquide|La sublimation se produit sans passage par l'état liquide.
Quel est le symbole chimique du potassium?|K|P|Po|Pt|Le symbole K provient du nom latin kalium.|https://periodic-table.rsc.org/element/19/potassium
Quelle unité du Système international mesure la fréquence?|Hertz|Joule|Newton|Pascal|Un hertz correspond à un cycle par seconde.
Une solution aqueuse de pH 3 est généralement...|Acide|Basique|Neutre|Toujours salée|À température ambiante, un pH inférieur à 7 indique une solution acide.
Quel type de roche se forme par refroidissement du magma ou de la lave?|Roche ignée|Roche sédimentaire|Roche métamorphique|Roche organique|Les roches ignées, aussi dites magmatiques, proviennent d'un magma refroidi.
Dans une cellule eucaryote, quel organite contient l'essentiel de l'ADN?|Noyau|Ribosome|Lysosome|Vacuole|La plus grande partie de l'ADN d'une cellule eucaryote est située dans son noyau.
Quel scientifique formule la loi de la gravitation universelle au XVIIe siècle?|Isaac Newton|Albert Einstein|Charles Darwin|Louis Pasteur|Newton expose cette loi dans les Principia, publiés en 1687.
Quel est le principal constituant du Soleil par masse?|Hydrogène|Oxygène|Fer|Carbone|Le Soleil est surtout composé d'hydrogène, puis d'hélium.|sun
`);
add('mots',1,'math',`
Combien font 7 × 8?|56|48|54|64|Sept groupes de huit donnent 56.
Combien de minutes compte une heure?|60|30|90|100|Une heure correspond à soixante minutes.
Quel est le double de 25?|50|40|75|100|Doubler 25 donne 25 + 25, soit 50.
Combien de côtés possède un triangle?|3|4|5|6|Un triangle est un polygone à trois côtés.
Quelle fraction équivaut à la moitié?|1/2|1/3|1/4|2/3|Une moitié représente une part sur deux parts égales.
Quel mot est un verbe?|Courir|Maison|Bleu|Demain|« Courir » est un verbe à l'infinitif.|words
Quel est le contraire de « généreux » parmi ces choix?|Avare|Patient|Souriant|Courageux|« Avare » s'oppose ici à « généreux ».|words
Quel mot désigne un animal?|Orignal|Érable|Granite|Ruisseau|L'orignal est un grand mammifère de la famille des cervidés.|words
Quel nombre complète 2, 4, 6, 8, ... si l'on ajoute toujours 2?|10|9|11|12|On ajoute deux à chaque étape; après huit vient dix.
Combien vaut 10 % de 100?|10|1|20|100|Dix pour cent signifie dix parts sur cent.
`);
add('mots',2,'math',`
Un article coûte 80 $. Quel montant représente un rabais de 25 %?|20 $|15 $|25 $|30 $|Le quart de 80 $ vaut 20 $.
Quel est le périmètre d'un carré de côté 6 cm?|24 cm|12 cm|18 cm|36 cm|Le périmètre est 4 × 6 cm, soit 24 cm.
Quelle est la moyenne de 4, 8 et 12?|8|6|10|12|La somme est 24; divisée par trois, elle donne huit.
Combien de diagonales possède un carré?|2|1|3|4|Un carré a deux segments reliant des sommets opposés.
Quel nombre est premier?|17|21|27|33|17 n'a que deux diviseurs positifs : 1 et 17.
Quel est le pluriel de « cheval »?|Chevaux|Chevals|Chevaus|Chevaulx|Le pluriel courant de « cheval » est « chevaux ».|words
Quel mot est un adverbe?|Rapidement|Rapide|Rapidité|Accélérer|« Rapidement » est un adverbe de manière.|words
Quel mot contient un préfixe qui exprime la négation?|Impossible|Possible|Possibilité|Possiblement|Le préfixe im- exprime la négation dans « impossible ».|words
Quel est le féminin de « acteur »?|Actrice|Acteuse|Acteurelle|Actorice|Le féminin usuel d'« acteur » est « actrice ».|words
Si un train part à 14 h 35 et roule 50 minutes, à quelle heure arrive-t-il?|15 h 25|15 h 15|15 h 35|14 h 85|Il reste 25 minutes jusqu'à 15 h, puis encore 25 minutes.
`);
add('mots',3,'math',`
Quel résultat donne 3 + 4 × 5 selon la priorité des opérations?|23|35|27|20|On effectue d'abord 4 × 5 = 20, puis on ajoute trois.
Une valeur passe de 50 à 60. Quel est son pourcentage d'augmentation?|20 %|10 %|15 %|25 %|L'augmentation de 10 divisée par la valeur initiale 50 donne 20 %.
Quelle est la somme des angles intérieurs d'un triangle dans le plan euclidien?|180°|90°|270°|360°|Dans le plan euclidien, les trois angles d'un triangle totalisent 180 degrés.
Quelle fraction est égale à 0,125?|1/8|1/4|1/5|1/12|Un huitième vaut 0,125.
Combien de résultats distincts obtient-on en lançant deux dés distinguables à six faces?|36|12|18|24|Chaque résultat du premier dé peut être associé à six résultats du second : 6 × 6.
Quel mot est invariable parmi ces quatre choix?|Parmi|Petit|Heureux|Journal|« Parmi » est une préposition, donc un mot invariable.|words
Dans « Les pommes que j'ai mangées », avec quoi s'accorde « mangées »?|Les pommes|Je|Avoir|Que seul, sans antécédent|Avec avoir, le participe s'accorde avec le complément direct placé avant : « que », dont l'antécédent est « pommes ».|https://vitrinelinguistique.oqlf.gouv.qc.ca/
Quel mot désigne deux mots de sens contraire?|Antonymes|Homonymes|Paronymes|Synonymes|Des antonymes sont des mots de sens opposé.|words
Quel résultat donne la racine carrée positive de 144?|12|14|16|72|12 × 12 = 144; la racine carrée positive de 144 est donc 12.
Un prix de 100 $ baisse de 20 %, puis augmente de 20 %. Quel est le prix final?|96 $|100 $|80 $|104 $|Après la baisse : 80 $. Puis 80 × 1,20 = 96 $.
`);
const CITY='https://www.ville.quebec.qc.ca/citoyens/patrimoine/archives/jalons_historiques/chronologie_de_la_ville.aspx';
const EMILE='https://toponymie.gouv.qc.ca/ct/ToposWeb/Fiche.aspx?no_seq=282276';
const HAUTE='https://www.ville.quebec.qc.ca/citoyens/arrondissements/lahautesaintcharles/index.aspx';
const DUFFERIN='https://www.quebec-cite.com/fr/quoi-faire-quebec/terrasse-dufferin';
add('local',1,DUFFERIN,`
Dans quel arrondissement se trouve Saint-Émile?|La Haute-Saint-Charles|Beauport|Charlesbourg|Les Rivières|Saint-Émile fait partie de La Haute-Saint-Charles.|${HAUTE}
En quelle année le Jardin zoologique de Québec ferme-t-il ses portes?|2006|1998|2012|2018|Le zoo de Québec ferme en 2006.|${CITY}
En quelle année le pont de Québec s'ouvre-t-il aux automobiles?|1929|1917|1939|1959|Une voie carrossable ouvre en 1929; le pont accueillait déjà trains et piétons.|${CITY}
Dans quelle ancienne municipalité inaugure-t-on l'aéroport de Québec en 1941?|L'Ancienne-Lorette|Saint-Émile|Beauport|Sillery|L'aéroport de L'Ancienne-Lorette est inauguré en 1941.|${CITY}
Quel équipement sportif de Québec est inauguré en 1939 pour le baseball?|Stade municipal|Colisée|Centre Vidéotron|PEPS|Le stade municipal est inauguré en 1939.|${CITY}
Avec quelle ville de l'Alberta Québec conclut-elle un jumelage en 1956?|Calgary|Edmonton|Banff|Lethbridge|L'entente de jumelage avec Calgary date de 1956.|${CITY}
En quelle année la fontaine de Tourny est-elle inaugurée à Québec?|2007|2008|1985|1993|L'inauguration a lieu le 3 juillet 2007, avant le 400e anniversaire.|https://www.ville.quebec.qc.ca/citoyens/patrimoine/quartiers/saint_jean_baptiste/interet/fontaine_tourny.aspx
Combien d'arrondissements la ville de Québec compte-t-elle?|6|4|8|12|Québec est divisée en six arrondissements.|https://www.ville.quebec.qc.ca/apropos/portrait/quelques_chiffres/quartiers/index.aspx
En quelle année la bibliothèque centrale de Québec, future Gabrielle-Roy, est-elle inaugurée?|1983|1971|1985|1993|Elle ouvre en 1983 et reçoit le nom Gabrielle-Roy en 1985.|${CITY}
Dans quel quartier de Québec se trouve le parc Réal-Cloutier?|Saint-Émile|Saint-Roch|Montcalm|Sillery|Le parc Réal-Cloutier se trouve à Saint-Émile, rue de l'Accueil.|https://www.ville.quebec.qc.ca/nous_joindre/311/banque-info/info.aspx?NoFiche=AC-000907
`);
add('local',2,CITY,`
En quelle année la municipalité de Saint-Émile est-elle créée?|1929|1608|1867|1956|La municipalité de Saint-Émile est érigée en 1929.|${EMILE}
En quelle année Saint-Émile est-elle intégrée à la nouvelle ville de Québec?|2002|1993|2006|2010|La fusion municipale prend effet le 1er janvier 2002.
Comment appelle-t-on les habitants de Saint-Émile?|Émilois et Émiloises|Émiliens et Émiliennes|Saint-Émiliens et Saint-Émiliennes|Émilevillois et Émilevilloises|Le gentilé reconnu est Émilois, Émiloise.|https://toponymie.gouv.qc.ca/ct/toponymie-municipale/gentiles/lesgentilesliste.aspx?L=t
Sur quelle rue se trouve le centre communautaire Saint-Émile?|Rue de la Faune|Rue Saint-Jean|Grande Allée|Rue Dalhousie|Le centre est au 2200, rue de la Faune.|https://animee.ville.quebec.qc.ca/lieux/centre-communautaire-saint-emile/
Quelle est la hauteur de la chute Montmorency?|83 mètres|30 mètres|125 mètres|212 mètres|La chute Montmorency mesure 83 mètres.|https://www.sepaq.com/destinations/parc-chute-montmorency/index.dot
En quelle année le Vieux-Québec entre-t-il au patrimoine mondial de l'UNESCO?|1985|1967|1995|2008|L'inscription au patrimoine mondial date de 1985.|https://whc.unesco.org/en/list/300
En quelle année se tient la première édition du Festival d'été de Québec?|1968|1954|1976|1984|Le Festival d'été de Québec débute en 1968.
En quelle année les Nordiques de Québec entrent-ils dans la LNH?|1979|1967|1972|1985|Les Nordiques passent de l'AMH à la LNH en 1979.
Dans quel arrondissement se trouve Loretteville?|La Haute-Saint-Charles|La Cité-Limoilou|Les Rivières|Beauport|Loretteville fait partie de La Haute-Saint-Charles.|${HAUTE}
Quel édifice de Québec est aussi connu sous le nom de « complexe G »?|Édifice Marie-Guyart|Édifice Price|Édifice André-Laurendeau|Palais Montcalm|Le complexe G est nommé édifice Marie-Guyart.
`);
add('local',3,EMILE,`
En quelle année Saint-Émile obtient-elle le statut de ville?|1993|1929|1956|2002|Saint-Émile devient une ville en 1993.
En quelle année ouvre le bureau de poste Saint-Émile-de-Québec?|1904|1867|1925|1948|Le bureau de poste est créé en 1904.
En quelle année la paroisse de Saint-Émile est-elle érigée?|1925|1794|1904|1956|La paroisse est érigée en 1925.
Quel ancien nom de village est associé au territoire de Saint-Émile?|Saint-Romain|Saint-Pascal|Saint-Sauveur|Saint-Jean-Baptiste|Le village de Saint-Romain précède Saint-Émile.
De quelle seigneurie le territoire de Saint-Émile fait-il partie en 1647?|Saint-Ignace|Beauport|Sillery|Cap-Rouge|Le territoire relève alors de la seigneurie Saint-Ignace.
Quel curé est honoré par le nom Saint-Émile, selon la Commission de toponymie?|Joseph-Nazaire-Émile Bédard|François de Laval|Louis-Honoré Pâquet|Elzéar-Alexandre Taschereau|Le nom honore notamment le curé Joseph-Nazaire-Émile Bédard.
En quelle année le pont Pierre-Laporte est-il inauguré?|1970|1917|1959|1984|Le pont Pierre-Laporte est inauguré en 1970.|${CITY}
De quelle ville française provient la fontaine de Tourny de Québec?|Bordeaux|Paris|Lyon|Marseille|La fontaine ornait autrefois les allées de Tourny à Bordeaux.|https://www.ville.quebec.qc.ca/citoyens/patrimoine/quartiers/saint_jean_baptiste/interet/fontaine_tourny.aspx
Quel arrondissement de Québec est connu pour son Trait-Carré historique?|Charlesbourg|Beauport|Les Rivières|La Haute-Saint-Charles|Le Trait-Carré est au cœur historique de Charlesbourg.
En quelle année le Centre Vidéotron ouvre-t-il ses portes?|2015|2008|2012|2018|Le nouvel amphithéâtre ouvre en 2015.|${CITY}
`);
const localTopics={quartiers:['1-1','1-4','1-6','2-3','2-4','2-9','3-4','3-6','3-9'],histoire:['1-3','2-1','2-2','3-1','3-2','3-3','3-5'],patrimoine:['1-7','2-6','2-10','3-7','3-8'],culture:['1-5','1-9','1-10','2-7','2-8','3-10'],nature:['1-2','1-8','2-5']};
for(const q of bank)if(q.category==='local')q.theme=Object.entries(localTopics).find(([theme,ids])=>ids.includes(q.id.replace('local-','')))?.[0]||'histoire';
export const QUESTIONS=bank;
