export type Lang = 'fr' | 'en'

const STORAGE_KEY = 'impetus.lang.v1'

type Dict = Record<string, string>

const fr: Dict = {
  'nav.play': 'Jouer',
  'nav.history': 'Parties',
  'nav.profile': 'Profil',
  'hero.tagline': 'Glisse. Bloque. Percée.',
  'tile.quick': 'Partie rapide',
  'tile.quick.sub': 'classée si connecté · 5 min',
  'tile.ai': "Contre l'IA",
  'tile.ai.sub': '3 niveaux · entraînement',
  'tile.local': '2 joueurs',
  'tile.local.sub': 'même écran',
  'lobby.rooms': 'Salons ouverts',
  'lobby.empty': "Aucun salon ouvert pour l'instant — crée le premier !",
  'th.code': 'Code',
  'th.host': 'Hôte',
  'th.opp': 'Adversaire',
  'th.clock': 'Cadence',
  'th.ranked': 'Classé',
  'th.status': 'Statut',
  'th.date': 'Date',
  'th.level': 'Niveau',
  'th.color': 'Couleur',
  'th.result': 'Résultat',
  'th.finish': 'Fin',
  'th.moves': 'Coups',
  'lobby.private': 'Salon privé (code)',
  'room.create': 'Créer un salon',
  'room.join': 'Rejoindre',
  'room.placeholder': 'CODE',
  'net.status': 'Multijoueur : lance `npm run server` pour ouvrir un salon.',
  'account.title': 'Compte',
  'auth.pseudo': 'Pseudo',
  'auth.pass': 'Mot de passe',
  'auth.login': 'Se connecter',
  'auth.register': 'Créer un compte',
  'auth.logout': 'Déconnexion',
  'auth.guest': 'visiteur',
  'auth.logged': 'Compte connecté — parties rapides classées.',
  'auth.hint': 'Connecte-toi pour que tes parties rapides comptent pour ton Elo.',
  'auth.required': 'Pseudo et mot de passe requis',
  'panel.side': 'Ta couleur',
  'side.black': 'Noir (commence)',
  'side.white': 'Blanc',
  'panel.level': "Niveau de l'IA",
  'level.facile': 'Facile',
  'level.normal': 'Normal',
  'level.difficile': 'Difficile',
  'level.hotseat': 'Local 2P',
  'level.online': 'En ligne',
  'stats.game': 'partie',
  'stats.games': 'parties',
  'stats.wins': 'V',
  'stats.losses': 'D',
  'stats.draws': 'N',
  'stats.winrate': 'de victoires',
  'stats.streak.win': "victoires d'affilée",
  'stats.streak.loss': "défaites d'affilée",
  'panel.cadence': 'Cadence',
  'cadence.none': 'Sans horloge',
  'delayed.label': 'Percée différée — survivre à une riposte',
  'immediate.label': 'Percée immédiate — arrivée gagnante (rapide)',
  'sound.label': 'Sons',
  'hint.std':
    'Pose sur ta rangée de départ ou glisse une pierre (max 3 cases, percute un ennemi = capture). Trois façons de gagner : percée, anéantissement, immobilisation.',
  'hint.delayed':
    "Expérimental — percée différée : une pierre sur la rangée adverse ne gagne que si elle survit à une riposte (l'adversaire doit la capturer).",
  'analysis.live': 'Analyse en direct',
  'analysis.off': 'Analyse désactivée',
  'analysis.eval': 'Éval (Noir) : {cp}',
  'analysis.forced': 'Percée forcée en ~{n} coups — {side} gagne',
  'analysis.mate': 'percée',
  'new': 'Nouvelle partie',
  'undo': 'Annuler',
  'swap': 'Échanger (swap)',
  'resign': 'Abandonner',
  'rematch': 'Revanche',
  'back.lobby': '← Retour au lobby',
  'banner.newgame': '· Nouvelle partie ?',
  'name.black': 'Noir',
  'name.white': 'Blanc',
  'reason.percée': 'par percée',
  'reason.anéantissement': 'par anéantissement',
  'reason.immobilisation': 'par immobilisation',
  'reason.victoire': 'victoire',
  'reason.temps': 'au temps',
  'win.text': '{name} gagne',
  'turn': 'Tour : {name}',
  'turn.pending': 'Tour : {name} — percée en attente : capture ou perds',
  'you.turn': 'Toi : {color} · Trait : {turn}',
  'ai.thinking': "L'IA réfléchit",
  'ai.name': 'IA · {level}',
  'game.interrupted': 'Partie interrompue',
  'opp.left': "L'adversaire s'est déconnecté",
  'quick.cancel': 'Annuler la recherche',
  'net.searching': "Recherche d'un adversaire… ({n} en file)",
  'net.search.cancelled': 'Recherche annulée.',
  'net.rematch.wait': "Revanche proposée — en attente de l'adversaire…",
  'net.use.resign': 'Utilise « Abandonner » pour quitter la partie en ligne.',
  'net.joined.opp': 'Salon {code} · adversaire : {name}',
  'net.joined.wait': 'Salon {code} — en attente d un adversaire…',
  'net.opp.joined': '{name} a rejoint la partie',
  'net.online.count': '{n} en ligne',
  'net.ranked': 'Partie classée : {delta} Elo → {rating}',
  'history.title': 'Historique local',
  'history.empty': 'Aucune partie enregistrée pour le moment.',
  'badge.win': 'Victoire',
  'badge.loss': 'Défaite',
  'badge.draw': 'Nul',
  'replay.title': 'Relecture',
  'replay.open': 'Revoir',
  'replay.start': 'Début',
  'replay.prev': 'Coup précédent',
  'replay.auto': 'Lecture automatique',
  'replay.next': 'Coup suivant',
  'replay.end': 'Fin',
  'replay.info': 'coup {i} / {total}',
  'notation.place': 'poser',
  'profile.title': 'Joueur local',
  'profile.save': 'Enregistrer',
  'profile.hint':
    "Profil stocké dans ce navigateur. À l'arrivée des comptes en ligne, il sera migré vers ton compte permanent.",
  'ratings.title': 'Classement Elo local',
  'ratings.sub': '{games} · {w} {l}{d} · cible IA {target}',
  'ratings.not.enough': 'pas assez de parties classées',
  'data.title': 'Données',
  'data.reset': 'Effacer profil et historique',
  'confirm.reset': "Effacer définitivement le profil et tout l'historique local ?",
  'theme.toggle': 'Basculer jour / nuit',
  'lang.toggle': 'Changer de langue',
  'you.suffix': 'toi',
  'opp.suffix': 'adversaire',
}

const en: Dict = {
  'nav.play': 'Play',
  'nav.history': 'Games',
  'nav.profile': 'Profile',
  'hero.tagline': 'Slide. Block. Break through.',
  'tile.quick': 'Quick game',
  'tile.quick.sub': 'ranked when signed in · 5 min',
  'tile.ai': 'vs AI',
  'tile.ai.sub': '3 levels · training',
  'tile.local': '2 players',
  'tile.local.sub': 'same screen',
  'lobby.rooms': 'Open rooms',
  'lobby.empty': 'No open rooms yet — create the first one!',
  'th.code': 'Code',
  'th.host': 'Host',
  'th.opp': 'Opponent',
  'th.clock': 'Clock',
  'th.ranked': 'Ranked',
  'th.status': 'Status',
  'th.date': 'Date',
  'th.level': 'Level',
  'th.color': 'Color',
  'th.result': 'Result',
  'th.finish': 'Finish',
  'th.moves': 'Moves',
  'lobby.private': 'Private room (code)',
  'room.create': 'Create room',
  'room.join': 'Join',
  'room.placeholder': 'CODE',
  'net.status': 'Multiplayer: run `npm run server` to open a room.',
  'account.title': 'Account',
  'auth.pseudo': 'Username',
  'auth.pass': 'Password',
  'auth.login': 'Sign in',
  'auth.register': 'Create account',
  'auth.logout': 'Sign out',
  'auth.guest': 'guest',
  'auth.logged': 'Signed in — quick games are ranked.',
  'auth.hint': 'Sign in so your quick games count toward your Elo.',
  'auth.required': 'Username and password required',
  'panel.side': 'Your color',
  'side.black': 'Black (starts)',
  'side.white': 'White',
  'panel.level': 'AI level',
  'level.facile': 'Easy',
  'level.normal': 'Normal',
  'level.difficile': 'Hard',
  'level.hotseat': 'Local 2P',
  'level.online': 'Online',
  'stats.game': 'game',
  'stats.games': 'games',
  'stats.wins': 'W',
  'stats.losses': 'L',
  'stats.draws': 'D',
  'stats.winrate': 'win rate',
  'stats.streak.win': 'win streak',
  'stats.streak.loss': 'loss streak',
  'panel.cadence': 'Clock',
  'cadence.none': 'No clock',
  'delayed.label': 'Delayed breakthrough — must survive a reply',
  'immediate.label': 'Immediate breakthrough — arrival wins (fast)',
  'sound.label': 'Sounds',
  'hint.std':
    'Place on your home row or slide a stone (max 3 squares, hitting an enemy = capture). Three ways to win: breakthrough, annihilation, immobilization.',
  'hint.delayed':
    'Experimental — delayed breakthrough: a stone on the far row only wins if it survives one reply (the opponent must capture it).',
  'analysis.live': 'Live analysis',
  'analysis.off': 'Analysis off',
  'analysis.eval': 'Eval (Black): {cp}',
  'analysis.forced': 'Forced breakthrough in ~{n} moves — {side} wins',
  'analysis.mate': 'breakthrough',
  'new': 'New game',
  'undo': 'Undo',
  'swap': 'Swap',
  'resign': 'Resign',
  'rematch': 'Rematch',
  'back.lobby': '← Back to lobby',
  'banner.newgame': '· New game?',
  'name.black': 'Black',
  'name.white': 'White',
  'reason.percée': 'by breakthrough',
  'reason.anéantissement': 'by annihilation',
  'reason.immobilisation': 'by immobilization',
  'reason.victoire': 'win',
  'reason.temps': 'on time',
  'win.text': '{name} wins',
  'turn': 'Turn: {name}',
  'turn.pending': 'Turn: {name} — breakthrough pending: capture or lose',
  'you.turn': 'You: {color} · Turn: {turn}',
  'ai.thinking': 'AI thinking',
  'ai.name': 'AI · {level}',
  'game.interrupted': 'Game interrupted',
  'opp.left': 'Opponent disconnected',
  'quick.cancel': 'Cancel search',
  'net.searching': 'Looking for an opponent… ({n} in queue)',
  'net.search.cancelled': 'Search cancelled.',
  'net.rematch.wait': 'Rematch offered — waiting for opponent…',
  'net.use.resign': 'Use "Resign" to leave the online game.',
  'net.joined.opp': 'Room {code} · opponent: {name}',
  'net.joined.wait': 'Room {code} — waiting for an opponent…',
  'net.opp.joined': '{name} joined the game',
  'net.online.count': '{n} online',
  'net.ranked': 'Ranked game: {delta} Elo → {rating}',
  'history.title': 'Local history',
  'history.empty': 'No games recorded yet.',
  'badge.win': 'Win',
  'badge.loss': 'Loss',
  'badge.draw': 'Draw',
  'replay.title': 'Replay',
  'replay.open': 'View',
  'replay.start': 'Start',
  'replay.prev': 'Previous move',
  'replay.auto': 'Auto-play',
  'replay.next': 'Next move',
  'replay.end': 'End',
  'replay.info': 'move {i} / {total}',
  'notation.place': 'place',
  'profile.title': 'Local player',
  'profile.save': 'Save',
  'profile.hint':
    'Profile stored in this browser. When online accounts arrive, it will migrate to your permanent account.',
  'ratings.title': 'Local Elo ratings',
  'ratings.sub': '{games} · {w} {l}{d} · AI target {target}',
  'ratings.not.enough': 'not enough ranked games',
  'data.title': 'Data',
  'data.reset': 'Clear profile and history',
  'confirm.reset': 'Permanently clear the profile and all local history?',
  'theme.toggle': 'Toggle day / night',
  'lang.toggle': 'Switch language',
  'you.suffix': 'you',
  'opp.suffix': 'opponent',
}

const dicts: Record<Lang, Dict> = { fr, en }

let lang: Lang = 'fr'
const listeners: (() => void)[] = []

export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? dicts.fr[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export function getLang(): Lang {
  return lang
}

export function onLangChange(fn: () => void): void {
  listeners.push(fn)
}

/** Applique les traductions aux éléments statiques (data-i18n, data-i18n-ph, data-i18n-title). */
export function applyStatic(root: ParentNode = document): void {
  document.documentElement.lang = lang
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPh!))
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle!))
  })
}

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function initI18n(): Lang {
  lang = detect()
  applyStatic()
  return lang
}

export function setLang(l: Lang): void {
  if (l === lang) return
  lang = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    /* stockage indisponible */
  }
  applyStatic()
  for (const fn of listeners) fn()
}

export const LANGS: Lang[] = ['fr', 'en']
