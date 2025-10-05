document.addEventListener('DOMContentLoaded', function () {
    //Centraliser tous les éléments DOM de l'interface pour un accès facile et éviter les répétitions de document.getElementById
    const UI = {
        screens: {
            welcome: safeGetElement('welcome-screen'),            // Écran d'accueil
            heroSelect1: safeGetElement('hero-selection'),        // Sélection héros (Joueur 1)
            heroSelect2: safeGetElement('hero-selection-2'),      // Sélection héros (Joueur 2)
            de: safeGetElement('dice-screen'),                    // Écran de lancer de dés
            arena: safeGetElement('arena-container'),             // Zone de combat
        },

        buttons: {
            startGame: safeGetElement('start-game-btn'),
            selectHero: document.querySelectorAll('.select-hero-btn'),

            // Joueur 1
            player1: {
                fastAttack: safeGetElement('fast-attack-btn-1'),
                heavyAttack: safeGetElement('heavy-attack-btn-1'),
                special: safeGetElement('special-btn-1'),
                defend: safeGetElement('defend-btn-1'),
                dodge: safeGetElement('dodge-btn-1')
            },

            // Joueur 2
            player2: {
                fastAttack: safeGetElement('fast-attack-btn-2'),
                heavyAttack: safeGetElement('heavy-attack-btn-2'),
                special: safeGetElement('special-btn-2'),
                defend: safeGetElement('defend-btn-2'),
                dodge: safeGetElement('dodge-btn-2')
            }
        },
        actionDiceButton: safeGetElement('actionDiceButton'), // Bouton pour lancer le dé d'action
        actionDiceResult: safeGetElement('actionDiceResult'), // Affichage du résultat du dé
        arena: safeGetElement('arena-grid'),                  // Grille de combat (contient les cases)
        diceElement: document.getElementById('dice'),         // Élément visuel du dé animé
        currentPlayer: safeGetElement('current-player'),      // Affiche le joueur actuel (ex: "Joueur 1")
        winnerDisplay: safeGetElement('winner-display'),      // Affiche le gagnant en fin de partie
    };
    //centralise les paramètres de configuration du jeu
    const CONFIG = {
        arenaSize: 7,
        heroTypes: {
            knight: {
                health: 120,           // Points de vie élevés (tank)
                baseDamage: 30,         // Dégâts importants
                moveRange: 1,           // Déplacement court
                attackRange: 1,         // Combat au corps-à-corps
                specialCooldown: 3,     // Capacité spéciale toutes les 3 tours
                color: '#8B4513',       // Couleur marron (thème chevalier)
                specialName: "Cri de guerre",  // Nom de l'attaque spéciale
                icon: '♞'               // Symbole Unicode
            },
            ninja: {
                health: 90,
                baseDamage: 20,
                moveRange: 2,
                attackRange: 1,
                dodgeChance: 0.5,
                specialCooldown: 3,
                color: '#2c3e50',
                specialName: "Double attaque",
                icon: '🥷'
            },
            wizard: {
                health: 80,
                baseDamage: 25,
                moveRange: 1,
                attackRange: 3,
                specialCooldown: 3,
                color: '#6A0DAD',
                specialName: "Tempête magique",
                icon: '🧙'
            }
        },
        attackTypes: {
            fast: { multiplier: 0.8, priority: 1 },   // Attaque rapide (faible dégâts, prioritaire)
            normal: { multiplier: 1, priority: 0 },   // Standard
            heavy: { multiplier: 1.5, priority: -1 }  // Lourde (dégâts élevés, lente)
        },
        bonusEffects: {
            health: { value: 20, message: "+20 HP", icon: '❤️' },
            damage: { value: 5, message: "+5 dégâts", icon: '⚔️' },
            range: { value: 1, message: "+1 portée", icon: '🎯' }
        },
        cornerPositions: [
            { row: 0, col: 0 },
            { row: 0, col: 6 },
            { row: 6, col: 0 },
            { row: 6, col: 6 }
        ]
    };
    // État du jeu
    const gameState = {
        players: [],
        currentPlayerIndex: 0,
        obstacles: [],
        bonuses: [],
        pendingActions: {},
        turnCount: 0,
        selectedHero1: null,
        selectedHero2: null,
        startingPlayer: null
    };
    // recuperation des elements
    function safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Élément avec ID "${id}" non trouvé`);
        }
        return element;
    }
    //applique les effets d’un bonus à un joueur selon son type 
    function applyBonus(player, bonus) {
        // Récupère l'effet associé au type de bonus depuis la configuration globale
        const effect = CONFIG.bonusEffects[bonus.type];

        // Si aucun effet n'existe pour ce type de bonus, on quitte la fonction
        if (!effect) return;

        let message; // Message à afficher dans le journal du jeu

        // Trouve l'index du joueur dans la liste des joueurs
        const playerIndex = gameState.players.indexOf(player);

        // Sélectionne la carte d'interface HTML correspondant à ce joueur (pour l'animation visuelle)
        const playerCard = playerIndex !== -1 ? document.querySelector(`.player-stat-card.player-${playerIndex + 1}`) : null;

        // Applique un comportement différent selon le type de bonus
        switch (bonus.type) {
            case 'health':
                // Ajoute des points de vie sans dépasser le maximum autorisé
                player.health = Math.min(player.maxHealth, player.health + effect.value);
                message = `${player.name} obtient un bonus: ${effect.message}`;
                break;

            case 'damage':
                // Augmente les dégâts de base et les dégâts d'attaque
                player.baseDamage += effect.value;
                player.attackDamage += effect.value;
                message = `${player.name} obtient un bonus: ${effect.message} (Dégâts: ${player.attackDamage - effect.value} → ${player.attackDamage})`;
                break;

            case 'range':
                // Le bonus de portée est uniquement applicable si le joueur est un sorcier
                if (player.type === 'wizard') {
                    const oldRange = player.attackRange;
                    player.attackRange += effect.value;
                    message = `${player.name} obtient un bonus: ${effect.message} (Portée: ${oldRange} → ${player.attackRange})`;
                } else {
                    // Sinon, on informe que le bonus n’a aucun effet
                    message = `${player.name} obtient un bonus de portée, mais cela n'affecte pas son type de héros.`;
                }
                break;

            default:
                // Cas de sécurité si le type de bonus n'est pas reconnu
                message = `${player.name} obtient un bonus inconnu.`;
                return; // On sort sans appliquer d'effet
        }

        // Affiche le message dans le journal du jeu
        logMessage(message, true);

        // Supprime le bonus de la liste des bonus actifs sur le terrain
        gameState.bonuses = gameState.bonuses.filter(b => b !== bonus);

        // Ajoute une animation visuelle à la carte du joueur
        if (playerCard) {
            playerCard.style.animation = 'pulseBonus 0.5s'; // Applique l'animation
            setTimeout(() => playerCard.style.animation = '', 500); // La réinitialise après 0,5s
        }
    }

    // affiche le message de victoire, désactive les contrôles et permet de redémarrer la partie
    function checkGameEnd() {
        // 1. Filtrer les joueurs encore en vie (health > 0)
        const alivePlayers = gameState.players.filter(p => p.health > 0);

        // 2. Si un seul joueur est en vie → partie terminée
        if (alivePlayers.length === 1) {
            const winner = alivePlayers[0]; // Le joueur gagnant

            // 3. Création du message HTML de victoire
            const winnerMessage = `
            <h2>Victoire 🏆</h2>
            <p style="font-size:1em;color:${winner.color}">
                ${winner.name} : ${winner.type} ${winner.icon} a gagné
            </p>
        `;

            // 4. Journalisation dans la console/interface
            logMessage(`🎉 ${winner.name} (${winner.type}) a gagné la partie avec ${winner.health} PV restants! 🎉`, true);

            // 5. Affichage du message dans l'UI si l'élément existe
            if (UI.winnerDisplay) {
                UI.winnerDisplay.innerHTML = winnerMessage;
                UI.winnerDisplay.style.display = 'block';

                // 6. Gestion du bouton de redémarrage
                const restartBtn = document.getElementById('restart-game-btn');
                if (restartBtn) {
                    restartBtn.style.display = 'block';
                    restartBtn.addEventListener('click', () => {
                        window.location.reload(); // Recharge la page
                    });
                }
            }

            // 7. Désactivation de tous les boutons d'action
            // - Désactive les boutons du Joueur 1
            Object.values(UI.buttons.player1).forEach(btn => {
                if (btn) btn.disabled = true;
            });

            // - Désactive les boutons du Joueur 2
            Object.values(UI.buttons.player2).forEach(btn => {
                if (btn) btn.disabled = true;
            });

            // - Désactive le bouton "Fin du tour"
            if (UI.buttons.endTurn) UI.buttons.endTurn.disabled = true;
        }

        // 8. Mise à jour générale de l'interface
        updateUI();
    }
    // update l'etat des joueurs
    function updatePlayerStats() {
        // Récupère l'élément HTML qui contient les statistiques des joueurs
        const statsContainer = document.getElementById('player-stats');

        // Si le conteneur n'existe pas, on arrête la fonction
        if (!statsContainer) return;

        // Vide le contenu actuel du conteneur des statistiques
        statsContainer.innerHTML = '';

        // Parcourt la liste des joueurs dans l'état du jeu
        gameState.players.forEach((player, index) => {
            // Crée une nouvelle carte HTML pour afficher les stats du joueur
            const playerCard = document.createElement('div');

            // Ajoute une classe CSS avec un identifiant unique basé sur l'index
            playerCard.className = `player-stat-card player-${index + 1}`;

            // Ajoute une bordure colorée à gauche de la carte selon la couleur du joueur
            playerCard.style.borderLeft = `5px solid ${player.color}`;

            // Détermine si le joueur bénéficie de bonus de dégâts ou de portée
            const damageBonus = player.attackDamage > player.baseDamage;
            const rangeBonus = player.attackRange > CONFIG.heroTypes[player.type].attackRange;

            // Remplit le contenu HTML de la carte du joueur
            playerCard.innerHTML = `
            <h3>
                ${player.name} (${player.type} ${player.icon})
                ${damageBonus ? '<span class="bonus-indicator">+Dégâts</span>' : ''}
                ${rangeBonus ? '<span class="bonus-indicator">+Portée</span>' : ''}
                ${player.isDefending ? '<span class="bonus-indicator" style="background:#3498db;">Défense</span>' : ''}
                ${player.dodging ? '<span class="bonus-indicator" style="background:#9b59b6;">Esquive</span>' : ''}
            </h3>
            <p>Vie: <span class="stat-value">${player.health}/${player.maxHealth}</span></p>
            <p>Dégâts: <span class="stat-value">${player.attackDamage}</span></p>
            <p>Portée: <span class="stat-value">${player.attackRange}</span></p>
            ${player.specialCooldown > 0 ?
                    `<p>Spécial: <span class="stat-value" style="color:#e74c3c;">${player.specialCooldown} tours</span></p>` :
                    `<p>Spécial: <span class="stat-value" style="color:#2ecc71;">Prêt</span></p>`
                }
        `;

            // Ajoute la carte du joueur au conteneur principal
            statsContainer.appendChild(playerCard);
        });
    }
    //fonction centrale qui rafraîchit l’ensemble de l’interface utilisateur du jeu
    function updateUI() {
        // Met à jour l'affichage de l'arène de jeu (ex : grille, éléments, personnages, etc.)
        renderArena();

        // Met à jour les boutons d'action (attaque, déplacement, etc.) en fonction du contexte actuel
        updateActionButtons();

        // Surligne les cellules que le joueur peut atteindre (déplacement ou attaque)
        highlightAccessibleCells();

        // Met à jour les cartes d'information des joueurs (vie, portée, état, etc.)
        updatePlayerStats();
    }
    //fonction d'initiallisation du jeu
    function init() {
        // Initialise les gestionnaires d'événements (clics, touches, etc.)
        setupEventListeners();

        // Affiche l'écran de bienvenue au lancement du jeu
        showScreen('welcome');
    }
    //simule le lancer d’un dé à 6 faces
    function rollActionDice() {
        const diceButton = UI.actionDiceButton;
        const resultDisplay = UI.actionDiceResult;

        // Désactiver le bouton pendant l'animation
        diceButton.style.pointerEvents = 'none';

        // Animation
        diceButton.style.transform = 'rotate(360deg) scale(1.2)';
        resultDisplay.style.display = 'none';

        return new Promise(resolve => {
            setTimeout(() => {
                const randomValue = Math.floor(Math.random() * 6) + 1;
                resultDisplay.textContent = randomValue;

                // Déterminer le résultat
                let outcomeClass;
                if (randomValue <= 2) {
                    outcomeClass = 'failure';
                } else if (randomValue <= 5) {
                    outcomeClass = 'success';
                } else {
                    outcomeClass = 'critical';
                }

                // Afficher le résultat
                resultDisplay.className = 'action-dice-result ' + outcomeClass;
                resultDisplay.style.display = 'block';

                // Réinitialiser
                diceButton.style.transform = '';
                diceButton.style.pointerEvents = 'auto';

                // Stocker le résultat dans gameState
                gameState.currentDiceResult = randomValue;

                resolve(randomValue);
            }, 500);
        });
    }
    // Fonction setupEventListeners corrigée
    function setupEventListeners() {
        console.log("Initialisation des écouteurs d'événements...");

        // 1. Navigation principale
        if (!UI.buttons.startGame) {
            console.error("Bouton 'Commencer la partie' non trouvé");
        } else {
            UI.buttons.startGame.addEventListener('click', () => {
                showScreen('heroSelect1');
            });
        }

        // Écouteur pour le dé d'action
        if (UI.actionDiceButton) {
            UI.actionDiceButton.addEventListener('click', rollActionDice);
        } else {
            console.error("Bouton du dé d'action non trouvé");
        }

        // 2. Sélection des héros - Joueur 1
        const heroButtons1 = document.querySelectorAll('#hero-selection .select-hero-btn');
        if (heroButtons1.length === 0) {
            console.error("Aucun bouton de sélection trouvé pour le Joueur 1");
        } else {
            heroButtons1.forEach(btn => {
                btn.addEventListener('click', () => {
                    gameState.selectedHero1 = btn.dataset.hero;
                    console.log(`Joueur 1 sélectionné: ${gameState.selectedHero1}`);
                    showScreen('heroSelect2');
                });
            });
        }

        // 3. Sélection des héros - Joueur 2
        const heroButtons2 = document.querySelectorAll('#hero-selection-2 .select-hero-btn');
        if (heroButtons2.length === 0) {
            console.error("Aucun bouton de sélection trouvé pour le Joueur 2");
        } else {
            heroButtons2.forEach(btn => {
                btn.addEventListener('click', () => {
                    gameState.selectedHero2 = btn.dataset.hero;
                    console.log(`Joueur 2 sélectionné: ${gameState.selectedHero2}`);

                    // Vérification que les deux héros sont sélectionnés
                    if (!gameState.selectedHero1 || !gameState.selectedHero2) {
                        console.error("Les deux héros doivent être sélectionnés");
                        return;
                    }

                    showScreen('de'); // Correction: utiliser 'de' comme défini dans UI.screens

                    // Lancer le dé après un court délai
                    setTimeout(rollDice, 100);
                });
            });
        }

        // 4. Actions de jeu - Joueur 1
        if (UI.buttons.player1.fastAttack) {
            UI.buttons.player1.fastAttack.addEventListener('click', () => prepareAttack('fast'));
        }
        if (UI.buttons.player1.heavyAttack) {
            UI.buttons.player1.heavyAttack.addEventListener('click', () => prepareAttack('heavy'));
        }
        if (UI.buttons.player1.special) {
            UI.buttons.player1.special.addEventListener('click', () => prepareAction('special'));
        }
        if (UI.buttons.player1.defend) {
            UI.buttons.player1.defend.addEventListener('click', () => executeDefend(getCurrentPlayer()));
        }
        if (UI.buttons.player1.dodge) {
            UI.buttons.player1.dodge.addEventListener('click', () => executeDodge(getCurrentPlayer()));
        }

        // 4. Actions de jeu - Joueur 2
        if (UI.buttons.player2.fastAttack) {
            UI.buttons.player2.fastAttack.addEventListener('click', () => prepareAttack('fast'));
        }
        if (UI.buttons.player2.heavyAttack) {
            UI.buttons.player2.heavyAttack.addEventListener('click', () => prepareAttack('heavy'));
        }
        if (UI.buttons.player2.special) {
            UI.buttons.player2.special.addEventListener('click', () => prepareAction('special'));
        }
        if (UI.buttons.player2.defend) {
            UI.buttons.player2.defend.addEventListener('click', () => executeDefend(getCurrentPlayer()));
        }
        if (UI.buttons.player2.dodge) {
            UI.buttons.player2.dodge.addEventListener('click', () => executeDodge(getCurrentPlayer()));
        }

        // 5. Bouton fin de tour
        if (UI.buttons.endTurn) {
            UI.buttons.endTurn.addEventListener('click', endTurn);
        }

        // 6. Écouteurs supplémentaires
        if (UI.diceElement) {
            UI.diceElement.addEventListener('click', rollDice);
        }

        if (UI.arena) {
            UI.arena.addEventListener('click', handleCellClick);
        }
    }
    //simule le lancer d’un dé à 6 faces
    function rollDice() {
        const dice = document.getElementById('dice');
        const resultDisplay = document.getElementById('result');
        const playerInfoDisplay = document.getElementById('playerInfo');

        // Désactiver les clics pendant l'animation
        dice.style.pointerEvents = 'none';
        resultDisplay.textContent = '';
        playerInfoDisplay.textContent = '';

        // Générer un nombre aléatoire entre 1 et 6
        const randomValue = Math.floor(Math.random() * 6) + 1;

        // Animation de rotation aléatoire (plus dynamique)
        dice.style.transform = `rotateX(${Math.random() * 3600}deg) rotateY(${Math.random() * 3600}deg) rotateZ(${Math.random() * 360}deg)`;

        // Après l'animation, afficher la face gagnante et déterminer le joueur qui commence
        setTimeout(() => {
            // Position finale du dé en fonction du résultat
            const transforms = {
                1: 'rotateX(0deg) rotateY(0deg)',
                2: 'rotateX(0deg) rotateY(180deg)',
                3: 'rotateX(0deg) rotateY(90deg)',
                4: 'rotateX(0deg) rotateY(-90deg)',
                5: 'rotateX(90deg) rotateY(0deg)',
                6: 'rotateX(-90deg) rotateY(0deg)'
            };
            dice.style.transform = transforms[randomValue];

            // Déterminer le joueur qui commence (1-3: Joueur 1, 4-6: Joueur 2)
            gameState.startingPlayer = randomValue < 4 ? 'player1' : 'player2';
            playerInfoDisplay.innerHTML = gameState.startingPlayer === 'player1'
                ? '<span class="player1">Le Joueur 1 commence</span>'
                : '<span class="player2">Le Joueur 2 commence</span>';

            // Réactiver les clics et lancer le jeu après 2 secondes
            setTimeout(() => {
                startGame(gameState.selectedHero1, gameState.selectedHero2);
                dice.style.pointerEvents = 'auto';
            }, 2000);
        }, 2000); // Temps d'animation de 2 secondes
    }
    // gère les clics de l’utilisateur sur une cellule de la grille du jeu. Elle détermine si le joueur veut se déplacer, attaquer, ou utiliser une compétence spéciale
    function handleCellClick(e) {
        const targetCell = e.target.closest('.cell');
        if (!targetCell) return;

        const row = parseInt(targetCell.dataset.row);
        const col = parseInt(targetCell.dataset.col);
        const currentPlayer = getCurrentPlayer(); // CORRIGÉ: déclaration de la variable

        const enemy = getEnemy();
        // Si aucune action en cours, tentative de déplacement par défaut
        if (isValidMove(row, col, currentPlayer)) {
            handleMoveAction(row, col, currentPlayer);
        } else {
            logMessage("Déplacement impossible vers cette case");
        }

        // Si une attaque est en préparation
        if (gameState.pendingActions.type === 'attack' &&
            enemy.row === row && enemy.col === col) {
            executeAttack(
                gameState.pendingActions.attackType,
                gameState.pendingActions.attacker,
                gameState.pendingActions.target
            );
            gameState.pendingActions = {};
            endTurn();
            return;
        }
        // Si un spécial est en préparation et que l'ennemi est à portée
        if (gameState.pendingActions.type === 'special' &&
            enemy.row === row && enemy.col === col) {
            executeSpecialAction(gameState.pendingActions.player);
            gameState.pendingActions = {};
            endTurn();
            return;
        }
    }
    /* Gestion des écrans */
    function showScreen(screenName) {
        // Masquer tous les écrans de l'interface utilisateur
        Object.values(UI.screens).forEach(screen => {
            if (screen) {
                screen.style.display = 'none';         // Cacher l'écran
                screen.classList.remove('active');     // Retirer la classe "active" pour désactiver les animations/effets visuels
            }
        });

        // Récupérer l'écran à afficher en fonction du nom passé en paramètre
        const screen = UI.screens[screenName];

        if (screen) {
            screen.style.display = 'flex';             // Afficher l'écran ciblé avec un layout en flexbox

            // Si l'écran à afficher est celui du "dé", on applique une mise en page spécifique
            if (screenName === 'de') {
                screen.style.flexDirection = 'column';        // Organiser les éléments verticalement
                screen.style.alignItems = 'center';           // Centrer horizontalement
                screen.style.justifyContent = 'center';       // Centrer verticalement
                screen.style.textAlign = 'center';            // Centrer le texte
                screen.style.gap = '20px';                    // Espacement entre les éléments
            }

            // Ajouter la classe "active" légèrement après l'affichage pour déclencher les transitions CSS
            setTimeout(() => screen.classList.add('active'), 10);
        } else {
            // Si l'écran demandé n'existe pas, afficher une erreur dans la console
            console.error(`Impossible d'afficher l'écran: ${screenName}`);
        }
    }
    /* Démarrage du jeu */
    function startGame(hero1Type, hero2Type) {
        if (!CONFIG.heroTypes[hero1Type] || !CONFIG.heroTypes[hero2Type]) {
            console.error('Cannot start game - invalid hero types', { hero1Type, hero2Type });
            return;
        }
        generateArena();
        generateObstacles();
        generateBonuses();
        createPlayers(hero1Type, hero2Type);

        // Cacher l'affichage du gagnant s'il est visible
        if (UI.winnerDisplay) {
            UI.winnerDisplay.style.display = 'none';
        }

        // Définir le joueur qui commence
        gameState.currentPlayerIndex = gameState.startingPlayer === 'player1' ? 0 : 1;
        showScreen('arena');

        // Ajoutez cette ligne pour forcer le rendu initial
        renderArena(); // <-- ICI

        startTurn();

        // Initialiser l'affichage des stats
        updatePlayerStats();
    }
    //met à jour l’état des boutons d’action (activer ou désactiver) 
    function updateActionButtons() {
        const currentPlayer = getCurrentPlayer();
        const enemy = getEnemy();
        const enemyInRange = enemy && isEnemyInRange(currentPlayer, enemy);
        const diceResult = gameState.currentDiceResult;

        if (!currentPlayer) return;

        // Désactiver tous les boutons par défaut
        Object.values(UI.buttons.player1).forEach(btn => {
            if (btn) btn.disabled = true;
        });
        Object.values(UI.buttons.player2).forEach(btn => {
            if (btn) btn.disabled = true;
        });

        const playerButtons = gameState.currentPlayerIndex === 0 ?
            UI.buttons.player1 : UI.buttons.player2;

        // Activer les boutons selon le résultat du dé
        if (diceResult) {
            if (diceResult >= 3 && diceResult <= 5) { // Réussite (3-5)
                if (playerButtons.fastAttack) {
                    playerButtons.fastAttack.disabled = !enemyInRange;
                }
            } else if (diceResult === 6) { // Critique (6)
                if (playerButtons.heavyAttack) {
                    playerButtons.heavyAttack.disabled = !enemyInRange;
                }
            }
            // 1-2: aucun bouton d'attaque activé (échec)
        }

        // Toujours activer ces boutons (indépendants du dé)
        if (playerButtons.defend) {
            playerButtons.defend.disabled = false;
        }
        if (playerButtons.dodge && currentPlayer.type === 'ninja') {
            playerButtons.dodge.disabled = false;
        }
        if (UI.buttons.endTurn) {
            UI.buttons.endTurn.disabled = false;
        }

        // Gestion du spécial (cooldown indépendant du dé)
        if (playerButtons.special) {
            playerButtons.special.disabled = currentPlayer.specialCooldown > 0 || !enemyInRange;
        }
    }
    //commence la tour
    function startTurn() {
        const currentPlayer = getCurrentPlayer();
        if (!currentPlayer) return;

        if (UI.currentPlayer) {
            UI.currentPlayer.textContent = currentPlayer.name;
            UI.currentPlayer.style.color = currentPlayer.color;
        }

        if (currentPlayer.specialCooldown > 0) {
            currentPlayer.specialCooldown--;
        }

        currentPlayer.dodging = false;
        currentPlayer.isDefending = false;

        // Réinitialiser le résultat du dé
        gameState.currentDiceResult = null;

        // Lancer le dé d'action au début du tour
        rollActionDice().then(() => {
            updateActionButtons();
            highlightAccessibleCells();
            logMessage(`Tour de ${currentPlayer.name} (${currentPlayer.type})`);
        });
    }
    /* Génération de l'arène */
    function generateArena() {
        // Vérifie que l'élément DOM correspondant à l'arène existe
        if (!UI.arena) {
            console.error("Impossible de générer l'arène - élément manquant");
            return; // Arrête la fonction si l'élément est introuvable
        }

        // Vide le contenu actuel de l'arène (pour la régénérer proprement)
        UI.arena.innerHTML = '';

        // Définit le style CSS de la grille pour avoir CONFIG.arenaSize colonnes de taille égale (1 fraction chacune)
        UI.arena.style.gridTemplateColumns = `repeat(${CONFIG.arenaSize}, 1fr)`;


        // Boucle pour créer autant de cellules que la surface de l'arène (taille * taille)
        for (let i = 0; i < CONFIG.arenaSize * CONFIG.arenaSize; i++) {
            // Crée un élément div qui représentera une cellule
            const cell = document.createElement('div');

            // Assigne la classe CSS 'cell' à la cellule pour le style
            cell.className = 'cell';

            // Ajoute des attributs data pour stocker la position de la cellule dans la grille
            // data-row : numéro de la ligne (partie entière de la division i / taille)
            cell.dataset.row = Math.floor(i / CONFIG.arenaSize);

            // data-col : numéro de la colonne (reste de la division i % taille)
            cell.dataset.col = i % CONFIG.arenaSize;

            // Ajoute la cellule à l'arène dans le DOM
            UI.arena.appendChild(cell);
        }
    }
    //generer les obstacles
    function generateObstacles() {
        const obstacleCount = Math.floor(CONFIG.arenaSize * CONFIG.arenaSize * 0.1);
        const availablePositions = getAvailablePositions();

        for (let i = 0; i < obstacleCount && availablePositions.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePositions.length);
            const { row, col } = availablePositions.splice(randomIndex, 1)[0];
            gameState.obstacles.push({ row, col });
        }
    }
    //generer les bonuses
    function generateBonuses() {
        const bonusCount = Math.floor(CONFIG.arenaSize * CONFIG.arenaSize * 0.05);
        const bonusTypes = Object.keys(CONFIG.bonusEffects);
        const availablePositions = getAvailablePositions();

        for (let i = 0; i < bonusCount && availablePositions.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePositions.length);
            const { row, col } = availablePositions.splice(randomIndex, 1)[0];

            gameState.bonuses.push({
                row,
                col,
                type: bonusTypes[Math.floor(Math.random() * bonusTypes.length)]
            });
        }
    }
    //chercher les places libres
    function getAvailablePositions() {
        const positions = [];
        for (let row = 0; row < CONFIG.arenaSize; row++) {
            for (let col = 0; col < CONFIG.arenaSize; col++) {
                if (!isCornerPosition(row, col) && !isPositionOccupied(row, col)) {
                    positions.push({ row, col });
                }
            }
        }
        return positions;
    }
    //creation des joueurs
    function createPlayers(hero1Type, hero2Type) {
        // Vérifiez que les types de héros sont valides
        if (!CONFIG.heroTypes[hero1Type] || !CONFIG.heroTypes[hero2Type]) {
            console.error('Type de héros invalide', { hero1Type, hero2Type });
            return;
        }

        // Joueur 1
        const pos1 = CONFIG.cornerPositions[0];
        gameState.players.push(createHero(hero1Type, pos1.row, pos1.col, 'Joueur 1'));

        // Joueur 2
        const pos2 = CONFIG.cornerPositions[1];
        gameState.players.push(createHero(hero2Type, pos2.row, pos2.col, 'Joueur 2'));
         

    }
    //creation des heros
    function createHero(type, row, col, name) {
        const heroConfig = CONFIG.heroTypes[type];
        return {
            type,
            name,
            row,
            col,
            health: heroConfig.health,
            maxHealth: heroConfig.health,
            baseDamage: heroConfig.baseDamage,
            attackDamage: heroConfig.baseDamage,
            attackRange: heroConfig.attackRange,
            moveRange: heroConfig.moveRange,
            specialCooldown: 0,
            isDefending: false,
            dodging: false,
            dodgeChance: heroConfig.dodgeChance || 0,
            color: heroConfig.color,
            specialName: heroConfig.specialName,
            icon: heroConfig.icon
        };
    }
    //marque la fin de tour
    function endTurn() {
        gameState.turnCount++;
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.currentDiceResult = null; // Réinitialiser le résultat du dé
        startTurn();
    }
    //highlight les cells accecible
    function highlightAccessibleCells() {
        // Récupère le joueur actuel via une fonction externe
        const currentPlayer = getCurrentPlayer();

        // Si aucun joueur n'est trouvé, on arrête la fonction
        if (!currentPlayer) return;

        // Parcourt toutes les cellules de la grille (éléments avec la classe 'cell')
        document.querySelectorAll('.cell').forEach(cell => {
            // Enlève la classe 'accessible' pour "réinitialiser" l'affichage
            cell.classList.remove('accessible');

            // Récupère la position de la cellule dans la grille depuis ses attributs data
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);

            // Vérifie si la cellule est accessible (c'est-à-dire un mouvement valide pour le joueur actuel)
            if (isValidMove(row, col, currentPlayer)) {
                // Si oui, ajoute la classe 'accessible' pour mettre visuellement en évidence cette cellule
                cell.classList.add('accessible');
            }
        });
    }
    //gere les movements
    function handleMoveAction(row, col, player) {
        // Vérifie si la case cible contient un bonus en recherchant dans la liste des bonus
        const bonusIndex = gameState.bonuses.findIndex(b => b.row === row && b.col === col);

        // Si un bonus est trouvé à cette position...
        if (bonusIndex !== -1) {
            // ...on applique ce bonus au joueur
            applyBonus(player, gameState.bonuses[bonusIndex]);
        }

        // Met à jour la position du joueur avec les nouvelles coordonnées
        player.row = row;
        player.col = col;

        // Enregistre un message dans le journal pour indiquer le déplacement
        logMessage(`${player.name} se déplace en (${row}, ${col})`);

        // Met à jour l'interface utilisateur pour refléter les changements de l'état du jeu
        updateUI();

        // Termine le tour du joueur actuel et passe au suivant
        endTurn();
    }
    /* Fonctions utilitaires */
    function getCurrentPlayer() {
        return gameState.players[gameState.currentPlayerIndex] || null;
    }
    // Vérifie si la position donnée (row, col)
    // correspond à l'une des positions d'angle (coin) définies dans CONFIG.cornerPositions

    function isCornerPosition(row, col) {
        return CONFIG.cornerPositions.some(pos => pos.row === row && pos.col === col);
    }
    function isPositionOccupied(row, col) {
        return gameState.obstacles.some(obs => obs.row === row && obs.col === col) ||
            gameState.bonuses.some(b => b.row === row && b.col === col) ||
            gameState.players.some(p => p.row === row && p.col === col);
    }
    function isValidMove(row, col, player) {
        // Vérifier les limites de l'arène
        if (row < 0 || row >= CONFIG.arenaSize || col < 0 || col >= CONFIG.arenaSize) {
            return false;
        }

        // Vérifier les obstacles seulement (pas les bonus)
        if (gameState.obstacles.some(obs => obs.row === row && obs.col === col)) {
            return false;
        }

        // Vérifier les autres joueurs
        if (gameState.players.some(p => p.row === row && p.col === col && p !== player)) {
            return false;
        }

        // Vérifier la distance
        const distance = Math.abs(row - player.row) + Math.abs(col - player.col);
        return distance <= player.moveRange;
    }
    function applyBonus(player, bonus) {
        const effect = CONFIG.bonusEffects[bonus.type];

        switch (bonus.type) {
            case 'health':
                player.health = Math.min(player.maxHealth, player.health + effect.value);
                break;
            case 'damage':
                player.baseDamage += effect.value;
                player.attackDamage += effect.value;
                break;
            case 'range':
                if (player.type === 'wizard') {
                    player.attackRange += effect.value;
                }
                break;
        }

        logMessage(`${player.name} obtient un bonus: ${effect.message}`);
        gameState.bonuses = gameState.bonuses.filter(b => b !== bonus);
    }
    function logMessage(message, isImportant = false) {
        if (!UI.combatLog) return;

        const entry = document.createElement('p');
        entry.textContent = message;
        if (isImportant) {
            entry.classList.add('important-message');
        }
        UI.combatLog.appendChild(entry);
        UI.combatLog.scrollTop = UI.combatLog.scrollHeight;
    }
    // responsable de mettre à jour visuellement l'état de l'arène du jeu dans le navigateur
    function renderArena() {
        // Récupère le joueur actuel
        const currentPlayer = getCurrentPlayer();
        if (!currentPlayer) return; // Si aucun joueur actif, on ne fait rien

        // Récupère toutes les cellules de l'arène
        const cells = document.querySelectorAll('.cell');

        // Parcourt chaque cellule pour la réinitialiser et la mettre à jour
        cells.forEach(cell => {
            // Nettoie le contenu et le style de la cellule
            cell.innerHTML = '';
            cell.style.backgroundColor = '';
            cell.style.boxShadow = '';
            cell.classList.remove('obstacle', 'bonus', 'player');

            // Récupère la position de la cellule dans la grille
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);

            // --- GESTION DES OBSTACLES ---
            // Si un obstacle se trouve à cette position
            if (gameState.obstacles.some(obs => obs.row === row && obs.col === col)) {
                cell.classList.add('obstacle'); // ajoute la classe CSS
                cell.innerHTML = '<div class="obstacle-icon">🪨</div>'; // ajoute une icône de rocher
                return; // passe à la cellule suivante
            }

            // --- GESTION DES BONUS ---
            // Recherche d'un bonus à cette position
            const bonus = gameState.bonuses.find(b => b.row === row && b.col === col);
            if (bonus) {
                cell.classList.add('bonus'); // ajoute la classe CSS
                const effect = CONFIG.bonusEffects[bonus.type]; // récupère l'effet correspondant
                cell.innerHTML = `<div class="bonus-icon ${bonus.type}">${effect.icon}</div>`; // insère l'icône du bonus
                return; // passe à la cellule suivante
            }

            // --- GESTION DES JOUEURS ---
            // Vérifie si un joueur est présent sur cette cellule
            const heroHere = gameState.players.find(p => p.row === row && p.col === col);
            if (heroHere) {
                cell.classList.add('player'); // ajoute la classe CSS

                // Calcule le pourcentage de vie pour la barre de vie
                const healthPercent = Math.max(0, (heroHere.health / heroHere.maxHealth) * 100);

                // Ajoute l'élément du joueur avec son icône, sa couleur et sa barre de vie
                cell.innerHTML = `
                <div class="hero" style="background-color: ${heroHere.color}">
                    ${heroHere.icon}
                    <div class="health-bar">
                        <div class="health-fill" style="width: ${healthPercent}%"></div>
                    </div>
                </div>
            `;

                // Si c'est le joueur actif, ajoute un effet lumineux autour de la cellule
                if (heroHere === currentPlayer) {
                    cell.style.boxShadow = `0 0 15px ${heroHere.color}`;
                }
            }
        });

        // --- SURBRILLANCE DES ENNEMIS À PORTÉE ---
        // Si le joueur actif existe encore
        if (currentPlayer) {
            cells.forEach(cell => {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);

                // Vérifie si un ennemi est sur cette cellule
                const enemyHere = gameState.players.find(p =>
                    p !== currentPlayer && p.row === row && p.col === col);

                // Si l'ennemi est dans la portée du joueur actif, surligne en rouge
                if (enemyHere && isEnemyInRange(currentPlayer, enemyHere)) {
                    cell.style.boxShadow = `0 0 10px 2px red`; // effet visuel pour cible
                }
            });
        }
    }
    function isEnemyInRange(player, enemy) {
        // Calcule la distance entre le joueur et l'ennemi en utilisant la distance de Manhattan
        const distance = Math.abs(player.row - enemy.row) + Math.abs(player.col - enemy.col);

        // Retourne true si l'ennemi est dans la portée d'attaque du joueur
        return distance <= player.attackRange;
    }
    //retourne true si le joueur peut attaquer l’ennemi selon sa position actuelle et sa portée.
    function getEnemy() {
        const currentPlayer = getCurrentPlayer();
        return gameState.players.find(p => p !== currentPlayer);
    }
    //sert à préparer une attaque du joueur actif contre un ennemi
    function prepareAttack(attackType) {
        const currentPlayer = getCurrentPlayer();
        const enemy = getEnemy();

        if (!enemy) {
            logMessage("Aucun ennemi trouvé!");
            return;
        }

        if (!isEnemyInRange(currentPlayer, enemy)) {
            logMessage("L'ennemi n'est pas à portée d'attaque!");
            return;
        }

        // Stocker l'action d'attaque pour confirmation
        gameState.pendingActions = {
            type: 'attack',
            attackType: attackType,
            attacker: currentPlayer,
            target: enemy
        };

        logMessage(`Prêt à attaquer avec ${attackType === 'fast' ? 'attaque rapide' : 'attaque lourde'}!`);
    }
    // sert à préparer une attaque du joueur actif contre un ennemi
    function prepareAction(actionType) {
        const currentPlayer = getCurrentPlayer();

        switch (actionType) {
            case 'special':
                if (currentPlayer.specialCooldown > 0) {
                    logMessage(`Pouvoir spécial en cooldown! (${currentPlayer.specialCooldown} tours restants)`);
                    return;
                }

                gameState.pendingActions = {
                    type: 'special',
                    player: currentPlayer
                };
                logMessage(`Prêt à utiliser ${currentPlayer.specialName}!`);
                break;

            default:
                console.error('Action non reconnue:', actionType);
        }
    }
    //exécute l’action spéciale d’un joueur
    // Fonction qui exécute l'action spéciale d'un joueur selon son type de héros
    function executeSpecialAction(player) {
        // Récupère l'ennemi actuel ciblé par le joueur
        const enemy = getEnemy();

        // Sélection de l'action spéciale en fonction du type de héros
        switch (player.type) {

            // Cas du chevalier
            case 'knight':
                // Augmente les dégâts d'attaque à 150% de la base
                player.attackDamage = Math.floor(player.baseDamage * 1.5);

                // Soigne le joueur de 20 HP sans dépasser sa vie maximale
                player.health = Math.min(player.maxHealth, player.health + 20);

                // Affiche un message indiquant l'utilisation de la compétence
                logMessage(`${player.name} utilise ${player.specialName}! Dégâts augmentés et soigné de 20 HP.`, true);
                break;

            // Cas du ninja
            case 'ninja':
                // Vérifie si l'ennemi est à portée d'attaque
                if (isEnemyInRange(player, enemy)) {
                    // Calcule les dégâts d'une attaque (80% des dégâts normaux)
                    const damage = Math.floor(player.attackDamage * 0.8);

                    // Inflige les dégâts deux fois
                    enemy.health -= damage;
                    enemy.health -= damage;

                    // Affiche un message indiquant les dégâts totaux infligés
                    logMessage(`${player.name} utilise ${player.specialName}! Deux attaques rapides pour ${damage * 2} dégâts totaux!`, true);
                } else {
                    // Message d'erreur si l'ennemi est trop loin
                    logMessage("L'ennemi n'est pas à portée pour l'attaque spéciale!");
                }
                break;

            // Cas du sorcier
            case 'wizard':
                // Vérifie si l'ennemi est à portée
                if (isEnemyInRange(player, enemy)) {
                    // Calcule les dégâts de la tempête magique (180% des dégâts normaux)
                    const damage = Math.floor(player.attackDamage * 1.8);

                    // Inflige les dégâts à l'ennemi
                    enemy.health -= damage;

                    // Affiche un message avec les dégâts infligés
                    logMessage(`${player.name} utilise ${player.specialName}! Une puissante attaque magique inflige ${damage} dégâts!`, true);
                } else {
                    // Message si l'ennemi est hors de portée
                    logMessage("L'ennemi n'est pas à portée pour l'attaque spéciale!");
                }
                break;
        }

        // Applique le temps de recharge de l'attaque spéciale selon le type de héros
        player.specialCooldown = CONFIG.heroTypes[player.type].specialCooldown;

        // Vérifie si la partie est terminée après l'action spéciale
        checkGameEnd();
    }
    //ère l’exécution complète d’une attaque entre deux personnages dans un jeu
    function executeAttack(attackType, attacker, target) {
        const attackConfig = CONFIG.attackTypes[attackType] || CONFIG.attackTypes.normal;
        let baseDamage = Math.floor(attacker.attackDamage * attackConfig.multiplier);

        // Appliquer bonus critique si le dé était 6
        if (gameState.currentDiceResult === 6) {
            baseDamage *= 2;
            logMessage("Coup critique! Dégâts doublés!", true);
        }

        // Appliquer la défense si active
        let finalDamage = baseDamage;
        if (target.isDefending) {
            finalDamage = Math.floor(baseDamage * 0.5);
            target.isDefending = false;
            logMessage(`${target.name} se défend et réduit les dégâts de ${baseDamage} à ${finalDamage}!`);
        }

        // Vérifier l'esquive (seulement pour Ninja)
        if (target.type === 'ninja' && target.dodging) {
            const diceResult = rollActionDice();
            if (diceResult >= 4) {
                logMessage(`${target.name} lance un dé: ${diceResult}! L'attaque est esquivée!`, true);
                target.dodging = false;
                // Animation d'esquive
                const targetCell = document.querySelector(`.cell[data-row="${target.row}"][data-col="${target.col}"]`);
                if (targetCell) {
                    targetCell.style.animation = 'dodgeAnimation 0.5s';
                    setTimeout(() => {
                        targetCell.style.animation = '';
                    }, 500);
                }
                return; // ← Ce return est crucial, il empêche l'exécution du reste de la fonction
            } else {
                logMessage(`${target.name} lance un dé: ${diceResult}! L'esquive échoue!`);
            }
        }

        target.health -= finalDamage;
        logMessage(`${attacker.name} inflige ${finalDamage} dégâts à ${target.name}! (${target.health}/${target.maxHealth} PV restants)`, true);

        // Animation de dégâts
        const targetCell = document.querySelector(`.cell[data-row="${target.row}"][data-col="${target.col}"]`);
        if (targetCell) {
            targetCell.style.animation = 'damageAnimation 0.5s';
            setTimeout(() => {
                targetCell.style.animation = '';
            }, 500);
        }

        checkGameEnd();
    }
    function executeDefend(player) {
        player.isDefending = true;
        logMessage(`${player.name} se met en position défensive! Les prochains dégâts seront réduits.`);
        endTurn();
    }
    function executeDodge(player) {
        if (player.type !== 'ninja') {
            logMessage("Seul le Ninja peut esquiver!");
            return false; // Renvoyer false si l'action échoue
        }
        if (player.stunned) {
            logMessage(`${player.name} est étourdi et ne peut pas esquiver !`);
            return false;
        }
        player.dodging = true;
        logMessage(`${player.name} se prépare à esquiver la prochaine attaque!`);
        endTurn();
        return true; // Renvoyer true si l'action réussit
    }
    // Démarrer le jeu
    init();
});
