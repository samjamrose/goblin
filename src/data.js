// All static game content: buildings, goblins, regions, research, quests...

export const TILE = 16;
export const MAP_W = 56;
export const MAP_H = 44;

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#b9c4b0', glow: null, prod: 0.10, power: 10, maxLvl: 20, weight: 0 },
  { id: 'rare', name: 'Rare', color: '#4fa3ff', glow: '#4fa3ff', prod: 0.25, power: 20, maxLvl: 30 },
  { id: 'epic', name: 'Epic', color: '#c264ff', glow: '#c264ff', prod: 0.60, power: 40, maxLvl: 40 },
  { id: 'legendary', name: 'Legendary', color: '#ffb12b', glow: '#ffcf4a', prod: 1.50, power: 85, maxLvl: 50 },
  { id: 'mythical', name: 'Mythical', color: '#ff4f7b', glow: '#ff7aa8', prod: 4.00, power: 180, maxLvl: 60 },
];

export const JOBS = {
  miner: { name: 'Miner', icon: 'pick', desc: 'Digs for gold. Sometimes digs for fun.' },
  farmer: { name: 'Farmer', icon: 'shroom', desc: 'Grows mushrooms. Talks to them too.' },
  brewer: { name: 'Brewer', icon: 'mug', desc: 'Brews grog. Tests every batch. Personally.' },
  smith: { name: 'Smith', icon: 'hammer', desc: 'Hits metal until it agrees.' },
  alchemist: { name: 'Alchemist', icon: 'potion', desc: 'Mixes things that should not be mixed.' },
  merchant: { name: 'Merchant', icon: 'coin', desc: 'Sells rocks. Calls them "artisanal".' },
  gambler: { name: 'Gambler', icon: 'dice', desc: 'Has a system. The system is losing.' },
  thief: { name: 'Thief', icon: 'dagger', desc: 'Borrows things permanently.' },
  warrior: { name: 'Warrior', icon: 'sword', desc: 'Bonks first, asks never.' },
  builder: { name: 'Builder', icon: 'hammer', desc: 'Builds things. Mostly upright.' },
  scout: { name: 'Scout', icon: 'map', desc: 'Goes places. Returns. Usually.' },
  medic: { name: 'Medic', icon: 'heart', desc: 'Patches up bonked goblins. Mostly with tape.' },
};

// Combat behavior by job
export const JOB_COMBAT = {
  warrior: { hp: 1.6, atk: 1.1, spd: 1.15, role: 'tank' },
  thief: { hp: 0.8, atk: 1.2, spd: 0.8, crit: 0.35, role: 'crit' },
  alchemist: { hp: 0.8, atk: 0.8, spd: 1.1, splash: 0.5, role: 'splash' },
  scout: { hp: 0.9, atk: 0.9, spd: 0.65, role: 'fast' },
  miner: { hp: 1.2, atk: 1.0, spd: 1.0 },
  smith: { hp: 1.2, atk: 1.05, spd: 1.05 },
  builder: { hp: 1.3, atk: 0.9, spd: 1.0 },
  default: { hp: 1.0, atk: 0.9, spd: 1.0 },
};

export const TRAITS = {
  greedy: { name: 'Greedy', desc: '+15% work output', prod: 0.15 },
  lazy: { name: 'Lazy', desc: '-10% work, +30% HP (well rested)', prod: -0.10, hp: 0.3 },
  brave: { name: 'Brave', desc: '+20% attack', atk: 0.2 },
  cowardly: { name: 'Cowardly', desc: '-15% attack, expeditions 15% faster (runs fast)', atk: -0.15, speed: 0.15 },
  clumsy: { name: 'Clumsy', desc: '+20% loot luck (finds things by tripping)', luck: 0.2, prod: -0.05 },
  genius: { name: 'Genius', desc: '+10% work. Invented the wheel twice.', prod: 0.1 },
  smelly: { name: 'Smelly', desc: '+15% attack (enemies gag)', atk: 0.15 },
  dramatic: { name: 'Dramatic', desc: '+10% HP, +10% attack, -5% work', atk: 0.1, hp: 0.1, prod: -0.05 },
  hungry: { name: 'Hungry', desc: '+20% HP. Eats the furniture.', hp: 0.2 },
  sneaky: { name: 'Sneaky', desc: '+25% loot luck', luck: 0.25 },
  loud: { name: 'Loud', desc: '+10% work (yells at rocks)', prod: 0.1 },
  sleepy: { name: 'Sleepy', desc: '-5% work, +25% HP', prod: -0.05, hp: 0.25 },
  optimist: { name: 'Optimist', desc: '+8% everything', prod: 0.08, atk: 0.08, hp: 0.08, luck: 0.08 },
  paranoid: { name: 'Paranoid', desc: '+25% HP, trusts nobody', hp: 0.25 },
  shiny: { name: 'Shiny-Obsessed', desc: '+20% gold work, +10% luck', prod: 0.2, luck: 0.1, atk: -0.1 },
};

export const PERSONALITY_LINES = {
  greedy: ['Mine. MINE.', 'Is that gold? Let me hold it.', 'I charge for breathing near me.', 'Shiny shiny shiny.'],
  lazy: ['Five more minutes...', 'Work? Tomorrow. Maybe.', 'I am resting my eyes. Aggressively.', 'zzz... nap is a job.'],
  brave: ['I fear NOTHING! Except ducks.', 'Point me at a knight!', 'Bonk first, think never!'],
  cowardly: ['Was that a noise?!', 'I am not hiding. I am... observing.', 'Mommy...'],
  clumsy: ['Oops.', 'Who put the floor there?', 'I meant to do that.', 'Found a coin! By falling on it.'],
  genius: ['I invented a square wheel. It is very stable.', 'What if... hat for feet?', 'Science!'],
  smelly: ['Smell that? That is success.', 'Baths are for fish.', 'My aroma is a weapon.'],
  dramatic: ['NOBODY appreciates my ART!', 'This is the WORST day of my LIFE!', '*faints dramatically*'],
  hungry: ['Is that a mushroom? Is THAT a mushroom?', 'I ate my lunch. And yours.', 'Snack time is all the time.'],
  sneaky: ['You did not see me.', '*sneaks loudly*', 'I was never here.'],
  loud: ['HELLO!!!', 'WHAT A NICE DAY!!!', 'I AM WHISPERING!!!'],
  sleepy: ['*yawn*', 'Is it bedtime? It feels like bedtime.', 'Zzz...'],
  optimist: ['Today we get RICH!', 'The fire is just warm!', 'Every rock might be gold!'],
  paranoid: ['The squirrels are watching.', 'Who moved my rock?', 'They are coming. THEY.'],
  shiny: ['Ooooh shiny!', 'Gold is my best friend.', 'Polish it again!'],
};

export const GENERIC_LINES = [
  'Goblin power!', 'Who stole my sock?', 'Grog o\'clock yet?', 'I love this capital!',
  'Did someone say gold?', 'Hehehe.', 'Snrk.', 'Nice hat.', 'The boss is watching!',
  'Back to work, I guess.', 'I found a rock. It is my friend now.', 'Gobbo rules!',
  'My cousin is a troll.', 'Mushroom soup again?!', 'Taxes? Never heard of her.',
];

export const JOB_LINES = {
  miner: ['Dig dig dig!', 'Struck rock! Again!', 'Pickaxe go TINK.'],
  farmer: ['Grow, little shroomies!', 'This one has a face.', 'Fertilizer is a state of mind.'],
  brewer: ['Grog is basically a vegetable.', 'Taste test number 47...', 'Hic!'],
  smith: ['CLANG!', 'This sword is mostly sword.', 'Hot hot hot!'],
  alchemist: ['Stand back! Maybe!', 'Glow is normal.', 'It only explodes sometimes.'],
  merchant: ['Buy one, get regret free!', 'Very rare rock! 50 gold!', 'No refunds.'],
  gambler: ['Double or nothing!', 'I can feel a win coming.', 'Lucky rat, don\'t fail me.'],
  thief: ['Pocket is full. Get bigger pocket.', 'Not stealing. Collecting.', 'Shhh.'],
  warrior: ['WAAAGH!', 'Who wants a bonk?', 'My sword has a name. It is Sword.'],
  builder: ['Measure once, hammer twice.', 'Is it level? Close enough.', 'Hammer time!'],
  medic: ['Hold still. This will sting. A lot.', 'Have you tried licking it?', 'Next patient!', 'Walk it off. Slowly.'],
  scout: ['I saw a cave! It saw me back.', 'Adventure!', 'Map says: here be snacks.'],
};

// ---------------------------------------------------------------- Buildings
// kind: 'biz' produces gold. 'util' has special effect.
export const BUILDINGS = [
  { id: 'shroom', name: 'Mushroom Patch', kind: 'biz', job: 'farmer', district: 'muck', tx: 19, ty: 18, w: 3, h: 3,
    baseCost: 8, growth: 1.12, income: 0.6, unlock: 1, res: { mushrooms: 0.15 },
    desc: 'Grows mushrooms of mostly-safe varieties. Makes a little gold and lots of mushrooms.' },
  { id: 'mine', name: 'Gold Mine', kind: 'biz', job: 'miner', district: 'muck', tx: 23, ty: 18, w: 3, h: 3,
    baseCost: 90, growth: 1.13, income: 4, unlock: 1, res: { ore: 0.06 },
    desc: 'A hole with gold in it. Goblins love holes. Also produces ore.' },
  { id: 'tavern', name: 'Grog Tavern', kind: 'biz', job: 'brewer', district: 'muck', tx: 19, ty: 25, w: 3, h: 3,
    baseCost: 1200, growth: 1.135, income: 12, unlock: 3,
    desc: 'Serves grog, mystery stew, and regret.' },
  { id: 'smithy', name: 'Scrap Smithy', kind: 'biz', job: 'smith', district: 'market', tx: 39, ty: 18, w: 3, h: 3,
    baseCost: 16000, growth: 1.14, income: 64, unlock: 5, res: { ore: 0.12 },
    desc: 'Turns junk into slightly sharper junk. Produces ore.' },
  { id: 'potion', name: 'Dubious Potions', kind: 'biz', job: 'alchemist', district: 'market', tx: 42, ty: 18, w: 3, h: 3,
    baseCost: 240000, growth: 1.145, income: 480, unlock: 7,
    desc: 'Potions with side effects. The side effects have side effects.' },
  { id: 'market', name: 'Bazaar of Bargains', kind: 'biz', job: 'merchant', district: 'market', tx: 39, ty: 25, w: 4, h: 3,
    baseCost: 4e6, growth: 1.15, income: 4400, unlock: 9,
    desc: 'Everything is for sale. Including the stalls. Including you.' },
  { id: 'casino', name: 'Lucky Rat Casino', kind: 'biz', job: 'gambler', district: 'shady', tx: 2, ty: 18, w: 4, h: 3,
    baseCost: 7e7, growth: 1.155, income: 58000, unlock: 12, variance: true,
    desc: 'The house always wins. The house is a goblin. Income fluctuates wildly.' },
  { id: 'thieves', name: 'Thieves\' Guild', kind: 'biz', job: 'thief', district: 'shady', tx: 11, ty: 18, w: 3, h: 3,
    baseCost: 1.3e9, growth: 1.16, income: 440000, unlock: 15,
    desc: 'Totally legitimate "Acquisitions Department".' },
  { id: 'bank', name: 'Hoard Vault', kind: 'biz', job: 'merchant', district: 'hoard', tx: 2, ty: 9, w: 4, h: 3,
    baseCost: 2.6e10, growth: 1.165, income: 3.4e6, unlock: 18,
    desc: 'A bank. Withdrawals not supported. Deposits mandatory.' },
  { id: 'arena', name: 'Bonk Arena', kind: 'biz', job: 'warrior', district: 'hoard', tx: 11, ty: 8, w: 4, h: 4,
    baseCost: 5.5e11, growth: 1.17, income: 2.7e7, unlock: 22,
    desc: 'Goblins bonk each other for sport. Crowds pay to watch.' },
  { id: 'alchemy', name: 'Mud-to-Gold Lab', kind: 'biz', job: 'alchemist', district: 'dragon', tx: 21, ty: 9, w: 3, h: 3,
    baseCost: 1.4e13, growth: 1.175, income: 2.2e8, unlock: 26,
    desc: 'Turns mud into gold. Mostly turns mud into louder mud.' },
  { id: 'hatchery', name: 'Dragon Egg Hatchery', kind: 'biz', job: 'farmer', district: 'dragon', tx: 31, ty: 8, w: 4, h: 4,
    baseCost: 3.8e14, growth: 1.18, income: 2e9, unlock: 30,
    desc: 'Baby dragons sneeze gold. Also fire. Mostly fire.' },
  { id: 'palace', name: 'Goblin King\'s Palace', kind: 'biz', job: 'merchant', district: 'dragon', tx: 39, ty: 7, w: 5, h: 5,
    baseCost: 1.1e16, growth: 1.185, income: 2e10, unlock: 35,
    desc: 'Gaudiest building in the realm. Tourists pay to gawk.' },
  // Utility buildings
  { id: 'cauldron', name: 'Summoning Cauldron', kind: 'util', job: 'alchemist', district: 'muck', tx: 31, ty: 18, w: 3, h: 3,
    baseCost: 0, growth: 2.2, upCost: 60, unlock: 1, maxLvl: 10, startBuilt: true,
    desc: 'Toss in mushrooms, get goblins. Do not ask how. Upgrades improve rare odds.' },
  { id: 'huts', name: 'Mud Huts', kind: 'util', job: 'builder', district: 'muck', tx: 34, ty: 18, w: 3, h: 3,
    baseCost: 0, growth: 1.9, upCost: 40, unlock: 1, maxLvl: 30, startBuilt: true,
    desc: 'Homes for goblins. Each level adds room for 2 more goblins.' },
  { id: 'lodge', name: 'Expedition Lodge', kind: 'util', job: 'scout', district: 'market', tx: 51, ty: 18, w: 3, h: 3,
    baseCost: 2500, growth: 2.6, upCost: 2500, unlock: 4, maxLvl: 6,
    desc: 'Plan adventures. Each level allows one more expedition at a time and +10% loot.' },
  { id: 'research', name: 'Tinker Shed', kind: 'util', job: 'builder', district: 'market', tx: 47, ty: 18, w: 3, h: 3,
    baseCost: 8000, growth: 3, upCost: 8000, unlock: 6, maxLvl: 1,
    desc: 'Goblin science happens here. Unlocks Research.' },
  { id: 'barracks', name: 'Bonk Barracks', kind: 'util', job: 'warrior', district: 'market', tx: 43, ty: 25, w: 3, h: 3,
    baseCost: 30000, growth: 2.3, upCost: 30000, unlock: 7, maxLvl: 25,
    desc: 'Defenders live here. Each level: +1 defender slot (max 4) and +15% defense power.' },
  { id: 'infirmary', name: 'Goblin Infirmary', kind: 'util', job: 'medic', district: 'muck', tx: 30, ty: 30, w: 3, h: 3,
    baseCost: 400, growth: 4, upCost: 4000, unlock: 4, maxLvl: 6,
    desc: 'Bonked goblins heal here (2 min each). Each medic heals one goblin at a time. Each level adds a medic bed. Comes with one medic; more must be earned.' },
  { id: 'tower', name: 'Squint Tower', kind: 'util', job: 'scout', district: 'shady', tx: 14, ty: 18, w: 3, h: 3,
    baseCost: 5e7, growth: 2.5, upCost: 5e7, unlock: 12, maxLvl: 20,
    desc: 'Lookouts spot invaders early. Each level: +10% defense HP and +5% golden goblin rate.' },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
export const BIZ = BUILDINGS.filter(b => b.kind === 'biz');

export const MILESTONES = [25, 50, 100, 200, 300, 400, 500, 600, 800, 1000];
// tier visuals based on number of milestones reached (cap 4)

export const DECOR_SIZE = { campfire: [2, 2], chiefhut: [3, 3], fountain: [3, 2], statue: [2, 2] };
export const HEAL_MS = 120000;
export const RECOVER_MS = 90000; // time for a wounded goblin to go from 0 to full health in town
export const MEDIC_NAMES = ['Nurse Bandagewart', 'Doc Scabbins', 'Sister Stitchgob', 'Medic Mossfoot', 'Dr. Pokewell', 'Nurse Plasterpants', 'Healer Hobnob', 'Doc Leechlove', 'Sawbones Snik', 'Nurse Gauzegrin'];
export const DECOR = [
  { type: 'campfire', tx: 29, ty: 25 },
  { type: 'chiefhut', tx: 31, ty: 24 },
  { type: 'fountain', tx: 49, ty: 25 },
  { type: 'statue', tx: 23, ty: 25 },
];

export const DISTRICTS = [
  { id: 'muck', name: 'Muck Camp', x: 18, y: 14, w: 20, h: 16, unlock: 1, cost: 0, ground: 'mud',
    desc: 'Where it all began. Smells like it, too.' },
  { id: 'market', name: 'Market Ward', x: 38, y: 14, w: 18, h: 16, unlock: 4, cost: 2000, ground: 'cobble',
    desc: 'Proper streets! Well, streets.' },
  { id: 'shady', name: 'Shady Alley', x: 0, y: 14, w: 18, h: 16, unlock: 11, cost: 4e7, ground: 'dark',
    desc: 'Nobody asks questions here. Nobody answers them either.' },
  { id: 'hoard', name: 'Hoard Hill', x: 0, y: 0, w: 18, h: 14, unlock: 17, cost: 1.5e10, ground: 'gold',
    desc: 'The hill where gold goes to live.' },
  { id: 'dragon', name: 'Dragonview Heights', x: 18, y: 0, w: 38, h: 14, unlock: 25, cost: 8e12, ground: 'rock',
    desc: 'Great view of the dragons. Great view FOR the dragons.' },
];
export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));

// Roads in tile coordinates [x1,y1,x2,y2] inclusive
export const ROADS = [
  [1, 21, 54, 21],
  [1, 28, 54, 28],
  [1, 12, 54, 12],
  [27, 12, 27, 42],
  [9, 12, 9, 28],
  [46, 12, 46, 28],
  [36, 21, 36, 28],
];

export const RANKS = [
  [1, 'Muck Camp'], [3, 'Hovel Huddle'], [5, 'Goblin Hamlet'], [8, 'Snot Village'],
  [12, 'Grub Town'], [16, 'Wart City'], [20, 'Grand Gobburg'], [25, 'Goblin Capital'],
  [30, 'Mega Capital'], [35, 'Empire of Mud'], [40, 'Gold-Toothed Empire'], [50, 'Eternal Gobtopia'],
];

export function xpForLevel(l) { return Math.floor(150 * Math.pow(1.55, l - 1) + 100 * l); }

// ----------------------------------------------------------------- Goblins
export const NAME_A = ['Snik', 'Grub', 'Mog', 'Zib', 'Nag', 'Krik', 'Blort', 'Fizz', 'Gob', 'Snot', 'Rik', 'Bog', 'Wiz', 'Gnar',
  'Skab', 'Drib', 'Muk', 'Zog', 'Pip', 'Grot', 'Nub', 'Squee', 'Dreg', 'Lurk', 'Tik', 'Wart', 'Bub', 'Grem', 'Slag', 'Yik', 'Fungo', 'Glob'];
export const NAME_B = ['nose', 'toe', 'wart', 'ears', 'bottom', 'gut', 'foot', 'tooth', 'snout', 'bags', 'knees', 'gob', 'fingers',
  'belly', 'chin', 'whistle', 'pants', 'lump', 'stink', 'grin', 'muck', 'sock'];
export const NAME_C = ['the Small', 'the Smelly', 'the Bold', 'the Damp', 'Jr.', 'III', 'the Loud', 'the Shiny', 'the Mild',
  'the Hungry', 'the Unwashed', 'Esq.', 'the Sticky', 'the Quick-ish', 'the Lucky', ''];

export const SKINS = ['#6cbf45', '#5aa83a', '#7dcc52', '#8fbf3a', '#4f9b5a', '#9ccf5a', '#6fae6a', '#a3c24a'];
export const RARE_SKINS = ['#4fbf9a', '#b8d24a', '#58c0b0', '#9ad06a'];
export const OUTFITS = ['#8a5a32', '#6b4a2b', '#7a6a4a', '#5a4a6a', '#8a3a2a', '#4a5a3a', '#6a6a6a', '#a07040'];
export const HATS = ['none', 'none', 'bandana', 'pot', 'hood', 'cap', 'helmet', 'leaf', 'beanie', 'tophat', 'mushcap', 'horns', 'chef', 'wizard', 'hardhat', 'candlehelm'];

// Jobs' default tools
export const JOB_TOOL = {
  miner: 'pick', farmer: 'shroom', brewer: 'mug', smith: 'hammer', alchemist: 'potion', merchant: 'bag',
  gambler: 'dice', thief: 'dagger', warrior: 'sword', builder: 'hammer', scout: 'spyglass', medic: 'medkit',
};

// Named collectible goblins (Epic+). look overrides procedural appearance.
export const NAMED = [
  // Epic
  { id: 'grizzlenose', name: 'Grizzlenose the Haggler', rarity: 'epic', job: 'merchant', trait: 'greedy',
    look: { skin: '#7dbb4a', hat: 'tophat', outfit: '#3a3a6a', tool: 'bag', nose: 3, extra: 'monocle' },
    ability: { type: 'bmult', target: 'market', v: 1.0 }, bio: 'Once sold a cloud. Twice.' },
  { id: 'boomwick', name: 'Boomwick', rarity: 'epic', job: 'alchemist', trait: 'clumsy',
    look: { skin: '#8fbf3a', hat: 'goggles', outfit: '#6a3a2a', tool: 'potion', extra: 'soot' },
    ability: { type: 'bmult', target: 'potion', v: 1.0 }, bio: 'Eyebrows: 0. Explosions: many.' },
  { id: 'snotsworth', name: 'Sir Snotsworth', rarity: 'epic', job: 'warrior', trait: 'brave',
    look: { skin: '#6cbf45', hat: 'pot', outfit: '#8a8a9a', tool: 'bigsword', extra: 'cape_red' },
    ability: { type: 'combat', v: 0.15 }, bio: 'Knighted himself. Twice, for emphasis.' },
  { id: 'mugwort', name: 'Mama Mugwort', rarity: 'epic', job: 'farmer', trait: 'optimist',
    look: { skin: '#9ccf5a', hat: 'scarf', outfit: '#a04a6a', tool: 'bigshroom' },
    ability: { type: 'mushrooms', v: 0.5 }, bio: 'Her mushrooms are big. Her love is bigger.' },
  { id: 'pickles', name: 'Pickles', rarity: 'epic', job: 'miner', trait: 'loud',
    look: { skin: '#5aa83a', hat: 'candlehelm', outfit: '#6b4a2b', tool: 'pick', extra: 'beard' },
    ability: { type: 'bmult', target: 'mine', v: 1.0 }, bio: 'Talks to rocks. Rocks talk back. Gold rocks.' },
  { id: 'fingers', name: 'Fingers McGee', rarity: 'epic', job: 'thief', trait: 'sneaky',
    look: { skin: '#4f9b5a', hat: 'hood', outfit: '#2a2a3a', tool: 'sack', extra: 'mask' },
    ability: { type: 'bmult', target: 'thieves', v: 1.0 }, bio: 'Stole his own name. Kept it.' },
  { id: 'dicey', name: 'Dicey Dez', rarity: 'epic', job: 'gambler', trait: 'optimist',
    look: { skin: '#7dcc52', hat: 'visor', outfit: '#2a6a3a', tool: 'dice' },
    ability: { type: 'bmult', target: 'casino', v: 1.0 }, bio: 'Bet his left ear. Won a third ear.' },
  { id: 'hammerknock', name: 'Hammerknock', rarity: 'epic', job: 'builder', trait: 'loud',
    look: { skin: '#6fae6a', hat: 'hardhat', outfit: '#c08030', tool: 'hammer', extra: 'beard' },
    ability: { type: 'discount', v: 0.08 }, bio: 'Built a house. Then built it again, correctly.' },
  { id: 'twigsy', name: 'Twigsy', rarity: 'epic', job: 'scout', trait: 'cowardly',
    look: { skin: '#9ccf5a', hat: 'leaf', outfit: '#4a6a2a', tool: 'spyglass' },
    ability: { type: 'expspeed', v: 0.15 }, bio: 'Has been everywhere. Ran away from most of it.' },
  { id: 'brewbelly', name: 'Brewbelly', rarity: 'epic', job: 'brewer', trait: 'hungry',
    look: { skin: '#8fbf3a', hat: 'bandana', outfit: '#8a5a32', tool: 'mug', extra: 'belly' },
    ability: { type: 'bmult', target: 'tavern', v: 1.0 }, bio: 'His belly has its own zip code.' },
  // Legendary
  { id: 'gobbo', name: 'Gobbo the Golden', rarity: 'legendary', job: 'merchant', trait: 'shiny',
    look: { skin: '#e8c040', hat: 'crown', outfit: '#8a2a2a', tool: 'bag', extra: 'cape_red' },
    ability: { type: 'gold', v: 0.25 }, bio: 'Fell in a vat of gold. Refused to leave.' },
  { id: 'grimtooth', name: 'Madame Grimtooth', rarity: 'legendary', job: 'gambler', trait: 'paranoid',
    look: { skin: '#58c0b0', hat: 'turban', outfit: '#5a2a7a', tool: 'orb', extra: 'earrings' },
    ability: { type: 'golden', v: 0.3 }, bio: 'Sees the future. It has goblins in it.' },
  { id: 'skullsplitta', name: 'Warchief Skullsplitta', rarity: 'legendary', job: 'warrior', trait: 'brave',
    look: { skin: '#4f9b5a', hat: 'horns', outfit: '#5a3a2a', tool: 'axe', extra: 'warpaint' },
    ability: { type: 'combat', v: 0.3 }, bio: 'Split a skull once. It was a coconut. Still counts.' },
  { id: 'fizzwhistle', name: 'Professor Fizzwhistle', rarity: 'legendary', job: 'alchemist', trait: 'genius',
    look: { skin: '#b8d24a', hat: 'wizard', outfit: '#2a4a8a', tool: 'book', extra: 'glasses' },
    ability: { type: 'research', v: 0.3 }, bio: 'Has a degree. Drew it himself.' },
  { id: 'stinkbeard', name: 'Captain Stinkbeard', rarity: 'legendary', job: 'scout', trait: 'smelly',
    look: { skin: '#6cbf45', hat: 'pirate', outfit: '#3a2a5a', tool: 'sword', extra: 'eyepatch' },
    ability: { type: 'loot', v: 0.4 }, bio: 'Sailed the seven puddles.' },
  { id: 'gilda', name: 'Lady Gilda Coinsworth', rarity: 'legendary', job: 'merchant', trait: 'greedy',
    look: { skin: '#9ad06a', hat: 'fancy', outfit: '#a0306a', tool: 'fan', extra: 'earrings' },
    ability: { type: 'bmult', target: 'bank', v: 2.0 }, bio: 'Old money. Very old. It smells.' },
  { id: 'rattigan', name: 'Rattigan the Rat King', rarity: 'legendary', job: 'thief', trait: 'sneaky',
    look: { skin: '#7a9a5a', hat: 'ratcrown', outfit: '#4a4a4a', tool: 'dagger', extra: 'rats' },
    ability: { type: 'offline', v: 0.5 }, bio: 'The rats work nights for him.' },
  // Mythical
  { id: 'gobzilla', name: 'Gob-Zilla', rarity: 'mythical', job: 'warrior', trait: 'hungry',
    look: { skin: '#3a8a4a', hat: 'spikes', outfit: '#2a2a2a', tool: 'club', extra: 'tail' },
    ability: { type: 'combat', v: 0.6 }, bio: 'Was a normal goblin. Then he ate a mountain.' },
  { id: 'moonEater', name: 'The Goblin Who Ate the Moon', rarity: 'mythical', job: 'alchemist', trait: 'hungry',
    look: { skin: '#8a6ad8', hat: 'stars', outfit: '#1a1a4a', tool: 'moon', extra: 'cosmic' },
    ability: { type: 'gold', v: 1.0 }, bio: 'Nights have been darker lately. He looks full.' },
  { id: 'snikTime', name: 'Grandmaster Snik, Thief of Time', rarity: 'mythical', job: 'thief', trait: 'sneaky',
    look: { skin: '#58c0b0', hat: 'hood', outfit: '#3a2a6a', tool: 'hourglass', extra: 'mask' },
    ability: { type: 'expspeed', v: 0.35 }, bio: 'Stole Tuesday. Nobody noticed.' },
  { id: 'mudthrone', name: 'Emperor Mudthrone I', rarity: 'mythical', job: 'merchant', trait: 'dramatic',
    look: { skin: '#9ccf5a', hat: 'bigcrown', outfit: '#6a1a8a', tool: 'scepter', extra: 'cape_purple' },
    ability: { type: 'teeth', v: 0.25 }, bio: 'Rules from a throne of mud. It is a very nice mud.' },
  { id: 'zixxa', name: 'Dragon-Tamer Zixxa', rarity: 'mythical', job: 'farmer', trait: 'brave',
    look: { skin: '#a3c24a', hat: 'dragonhelm', outfit: '#8a2a1a', tool: 'whip', extra: 'babydragon' },
    ability: { type: 'bmult', target: 'hatchery', v: 4.0 }, bio: 'Dragons fear her. Mostly her singing.' },
  { id: 'ghostking', name: 'Ghost of Gobbo Past', rarity: 'mythical', job: 'merchant', trait: 'dramatic',
    look: { skin: '#cfe8ff', hat: 'crown', outfit: '#9ab0d0', tool: 'chain', extra: 'ghost' },
    ability: { type: 'gold', v: 0.75 }, bio: 'Haunts the treasury. Counts the coins. Every night.', prestigeOnly: true },
];
export const NAMED_BY_ID = Object.fromEntries(NAMED.map(n => [n.id, n]));

export const ABILITY_TEXT = {
  bmult: (a) => `+${Math.round(a.v * 100)}% ${BUILDING_BY_ID[a.target]?.name || ''} income (anywhere)`,
  gold: (a) => `+${Math.round(a.v * 100)}% ALL gold income`,
  combat: (a) => `+${Math.round(a.v * 100)}% team combat power`,
  mushrooms: (a) => `+${Math.round(a.v * 100)}% mushroom production`,
  discount: (a) => `-${Math.round(a.v * 100)}% building costs`,
  expspeed: (a) => `Expeditions ${Math.round(a.v * 100)}% faster`,
  golden: (a) => `Golden Goblins appear ${Math.round(a.v * 100)}% more often`,
  research: (a) => `-${Math.round(a.v * 100)}% research costs`,
  loot: (a) => `+${Math.round(a.v * 100)}% expedition loot`,
  offline: (a) => `+${Math.round(a.v * 100)}% offline earnings`,
  teeth: (a) => `+${Math.round(a.v * 100)}% Golden Teeth from prestige`,
};

// ----------------------------------------------------------------- Regions
export const ENEMIES = {
  squirrel: { name: 'Angry Squirrel', hp: 0.7, atk: 0.9, spd: 0.7 },
  wolf: { name: 'Hungry Wolf', hp: 1, atk: 1.1, spd: 0.85 },
  treant: { name: 'Grumpy Treant', hp: 2, atk: 0.8, spd: 1.4 },
  bat: { name: 'Cave Bat', hp: 0.6, atk: 0.9, spd: 0.6 },
  slime: { name: 'Gloop Slime', hp: 1.5, atk: 0.7, spd: 1.1 },
  troll: { name: 'Rock Troll', hp: 2, atk: 1.2, spd: 1.4 },
  peasant: { name: 'Pitchfork Peasant', hp: 0.8, atk: 0.9, spd: 1 },
  knight: { name: 'Shiny Knight', hp: 1.6, atk: 1.0, spd: 1.2 },
  archer: { name: 'Snooty Archer', hp: 0.8, atk: 1.3, spd: 1.0 },
  skeleton: { name: 'Rattly Skeleton', hp: 0.9, atk: 1.1, spd: 0.9 },
  golem: { name: 'Ruin Golem', hp: 2.4, atk: 1.0, spd: 1.5 },
  mummy: { name: 'Mummified Goblin', hp: 1.3, atk: 1.0, spd: 1.1 },
  rivalgob: { name: 'Snaggletooth Raider', hp: 1, atk: 1.1, spd: 0.9 },
  frog: { name: 'Bog Frog', hp: 1.1, atk: 0.9, spd: 0.8 },
  yeti: { name: 'Fluffy Yeti', hp: 2, atk: 1.2, spd: 1.3 },
  icewolf: { name: 'Frost Wolf', hp: 1.1, atk: 1.2, spd: 0.8 },
  kobold: { name: 'Kobold Fanboy', hp: 0.9, atk: 1.0, spd: 0.8 },
  drake: { name: 'Lesser Drake', hp: 1.8, atk: 1.3, spd: 1.2 },
  dragon: { name: 'Dragon', hp: 3, atk: 1.5, spd: 1.5 },
};

export const REGIONS = [
  { id: 'woods', name: 'Whispering Woods', unlock: 4, enemies: ['squirrel', 'wolf', 'wolf', 'knight'],
    boss: { type: 'treant', name: 'Old Barkbeard', tint: '#5a8a3a' }, power: 45,
    sky: ['#8fd3ff', '#cdeccf'], ground: '#4f8a3a', props: 'trees',
    desc: 'The trees whisper. Mostly rude things.', reward: { gold: 0.10, text: '+10% all income' },
    treasures: ['acorn', 'oldboot', 'fairyjar', 'ringstump'] },
  { id: 'caves', name: 'Grumble Caves', unlock: 8, enemies: ['bat', 'slime', 'bat', 'troll'],
    boss: { type: 'slime', name: 'Mother Gloop', tint: '#6adf6a' }, power: 150,
    sky: ['#2a2238', '#4a3a58'], ground: '#5a4a5a', props: 'crystals',
    desc: 'Dark, damp, and full of grumbling.', reward: { ore: 0.5, text: '+50% ore production' },
    treasures: ['glowcrystal', 'batwing', 'cavepearl', 'echostone'] },
  { id: 'knightshire', name: 'Knightshire Fields', unlock: 12, enemies: ['peasant', 'archer', 'knight', 'knight'],
    boss: { type: 'knight', name: 'Sir Reginald the Unwashed', tint: '#d0d0e0' }, power: 500,
    sky: ['#9ad8ff', '#fff2c8'], ground: '#7ab84a', props: 'fences',
    desc: 'Humans! They have castles, taxes, and opinions about goblins.', reward: { gold: 0.25, text: '+25% all income' },
    treasures: ['knighthelm', 'royalspoon', 'taxscroll', 'shinyshield'] },
  { id: 'ruins', name: 'Ancient Ruins', unlock: 16, enemies: ['skeleton', 'mummy', 'golem', 'skeleton'],
    boss: { type: 'golem', name: 'The Forgotten Tax Collector', tint: '#c0a060' }, power: 1700,
    sky: ['#f0c890', '#f8e8c0'], ground: '#c8a868', props: 'pillars',
    desc: 'Ruins of the first goblin empire. It fell over.', reward: { research: 0.2, text: '-20% research costs' },
    treasures: ['goldidol', 'oldcoin', 'cursedmask', 'starmap'] },
  { id: 'swamp', name: 'Snaggletooth Swamp', unlock: 20, enemies: ['frog', 'rivalgob', 'rivalgob', 'troll'],
    boss: { type: 'rivalgob', name: 'Chief Snaggletooth', tint: '#7a5a2a' }, power: 5000,
    sky: ['#9ab88a', '#c8d8a0'], ground: '#4a6a3a', props: 'reeds',
    desc: 'Rival goblin tribe. They think THEIR capital is better. Wrong.', reward: { mushrooms: 1.0, text: '+100% mushroom production' },
    treasures: ['rivalbanner', 'swampgem', 'frogcrown', 'bogtrophy'] },
  { id: 'frostfang', name: 'Frostfang Mountains', unlock: 25, enemies: ['icewolf', 'yeti', 'icewolf', 'yeti'],
    boss: { type: 'yeti', name: 'Yeti Grandma', tint: '#e0f0ff' }, power: 15000,
    sky: ['#a8c8f0', '#f0f8ff'], ground: '#e8f0f8', props: 'snow',
    desc: 'Cold. Very cold. Bring a scarf. Bring two.', reward: { gold: 0.5, text: '+50% all income' },
    treasures: ['icecrown', 'yetifur', 'frozenfish', 'snowglobe'] },
  { id: 'ember', name: 'Ember Peaks (Dragon Territory)', unlock: 30, enemies: ['kobold', 'drake', 'kobold', 'drake'],
    boss: { type: 'dragon', name: 'Vorgath the Hoarder', tint: '#d04a2a' }, power: 45000,
    sky: ['#3a1a1a', '#a04a2a'], ground: '#4a2a2a', props: 'lava',
    desc: 'Dragons. Gold. More dragons. More gold. Goblin heaven/death.', reward: { gold: 1.0, text: '+100% all income' },
    treasures: ['dragonscale', 'dragonegg', 'hoardcoin', 'dragontooth'] },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export const STAGES_PER_REGION = 10;

export const MISSIONS = [
  { id: 'scout', name: 'Quick Scout', dur: 60, diff: 0.5, loot: 1, icon: 'map' },
  { id: 'hunt', name: 'Treasure Hunt', dur: 600, diff: 0.9, loot: 3.2, icon: 'chest' },
  { id: 'delve', name: 'Deep Delve', dur: 3600, diff: 1.3, loot: 9, icon: 'pick' },
  { id: 'epic', name: 'Legendary Quest', dur: 4 * 3600, diff: 1.8, loot: 22, icon: 'crown' },
];

export const TREASURES = {
  acorn: { name: 'Suspiciously Large Acorn', set: 'woods' },
  oldboot: { name: 'Left Boot of Destiny', set: 'woods' },
  fairyjar: { name: 'Jar of Angry Fairy', set: 'woods' },
  ringstump: { name: 'Ring From a Stump', set: 'woods' },
  glowcrystal: { name: 'Glow Crystal', set: 'caves' },
  batwing: { name: 'Bat Wing Umbrella', set: 'caves' },
  cavepearl: { name: 'Cave Pearl', set: 'caves' },
  echostone: { name: 'Echo Stone (stone)', set: 'caves' },
  knighthelm: { name: 'Dented Knight Helm', set: 'knightshire' },
  royalspoon: { name: 'Royal Spoon', set: 'knightshire' },
  taxscroll: { name: 'Unpaid Tax Scroll', set: 'knightshire' },
  shinyshield: { name: 'Very Shiny Shield', set: 'knightshire' },
  goldidol: { name: 'Golden Goblin Idol', set: 'ruins' },
  oldcoin: { name: 'First Coin Ever Stolen', set: 'ruins' },
  cursedmask: { name: 'Cursed Mask (mild)', set: 'ruins' },
  starmap: { name: 'Map of the Stars', set: 'ruins' },
  rivalbanner: { name: 'Rival Tribe Banner', set: 'swamp' },
  swampgem: { name: 'Swamp Gem (wet)', set: 'swamp' },
  frogcrown: { name: 'Frog Prince Crown', set: 'swamp' },
  bogtrophy: { name: 'Bog Trophy', set: 'swamp' },
  icecrown: { name: 'Crown of Frost', set: 'frostfang' },
  yetifur: { name: 'Yeti Fur Coat', set: 'frostfang' },
  frozenfish: { name: 'Eternally Frozen Fish', set: 'frostfang' },
  snowglobe: { name: 'Snowglobe of a Capital', set: 'frostfang' },
  dragonscale: { name: 'Dragon Scale', set: 'ember' },
  dragonegg: { name: 'Fossilized Dragon Egg', set: 'ember' },
  hoardcoin: { name: 'Coin From The Hoard', set: 'ember' },
  dragontooth: { name: 'Dragon Tooth', set: 'ember' },
};
export const TREASURE_SETS = {
  woods: { name: 'Forest Oddities', bonus: { gold: 0.1 }, text: '+10% all income' },
  caves: { name: 'Cave Curios', bonus: { ore: 0.25 }, text: '+25% ore' },
  knightshire: { name: 'Human Junk', bonus: { combat: 0.15 }, text: '+15% combat power' },
  ruins: { name: 'Ancient Relics', bonus: { gold: 0.25 }, text: '+25% all income' },
  swamp: { name: 'Rival Trophies', bonus: { loot: 0.25 }, text: '+25% expedition loot' },
  frostfang: { name: 'Frozen Finds', bonus: { offline: 0.5 }, text: '+50% offline earnings' },
  ember: { name: 'Dragon Hoard', bonus: { gold: 1.0 }, text: '+100% all income' },
};

// ----------------------------------------------------------------- Research
export const RESEARCH = [
  { id: 'r_shroom', name: 'Fungus Fertilizer (Don\'t Ask)', desc: 'Mushroom Patch ×3, mushrooms +50%', cost: 1e4, ore: 20, lvl: 6, eff: { b: 'shroom', m: 3, mush: 0.5 } },
  { id: 'r_mine', name: 'Pointier Pickaxes', desc: 'Gold Mine ×3', cost: 4e4, ore: 40, lvl: 6, eff: { b: 'mine', m: 3 } },
  { id: 'r_tavern', name: 'Bigger Mugs', desc: 'Grog Tavern ×3', cost: 3e5, ore: 80, lvl: 7, eff: { b: 'tavern', m: 3 } },
  { id: 'r_wheel', name: 'The Wheel (Square Edition)', desc: 'All income +50%', cost: 1e6, ore: 150, lvl: 8, eff: { gold: 0.5 } },
  { id: 'r_union', name: 'Goblin Unions', desc: 'Worker bonuses +50%', cost: 2.5e6, ore: 200, lvl: 8, eff: { worker: 0.5 } },
  { id: 'r_smithy', name: 'Hammer-Hammering Hammers', desc: 'Scrap Smithy ×3', cost: 8e6, ore: 300, lvl: 9, eff: { b: 'smithy', m: 3 } },
  { id: 'r_sticks', name: 'Pointy Sticks', desc: 'Combat attack +30%', cost: 1e7, ore: 300, lvl: 9, eff: { atk: 0.3 } },
  { id: 'r_maps', name: 'Maps With Fewer Monsters Drawn On', desc: 'Expeditions 20% faster', cost: 2e7, ore: 400, lvl: 10, eff: { expspeed: 0.2 } },
  { id: 'r_potion', name: 'Labels On Potions', desc: 'Dubious Potions ×3', cost: 6e7, ore: 500, lvl: 10, eff: { b: 'potion', m: 3 } },
  { id: 'r_stew', name: 'Stew Recipes', desc: 'Goblin training costs -30%', cost: 1.2e8, ore: 600, lvl: 11, eff: { train: 0.3 } },
  { id: 'r_shields', name: 'Dented Shields', desc: 'Combat HP +30%', cost: 3e8, ore: 800, lvl: 11, eff: { hp: 0.3 } },
  { id: 'r_market', name: 'Haggling 101', desc: 'Bazaar ×3', cost: 1e9, ore: 1000, lvl: 12, eff: { b: 'market', m: 3 } },
  { id: 'r_lures', name: 'Shiny Lures', desc: 'Golden Goblins 30% more often', cost: 3e9, ore: 1200, lvl: 13, eff: { golden: 0.3 } },
  { id: 'r_bunks', name: 'Bunk Beds', desc: '+6 goblin housing', cost: 8e9, ore: 1500, lvl: 13, eff: { housing: 6 } },
  { id: 'r_casino', name: 'Loaded Dice', desc: 'Lucky Rat Casino ×3', cost: 4e10, ore: 2000, lvl: 14, eff: { b: 'casino', m: 3 } },
  { id: 'r_night', name: 'Night Shift', desc: 'Offline earnings +50%, offline cap +2h', cost: 1e11, ore: 2500, lvl: 15, eff: { offline: 0.5, offcap: 2 } },
  { id: 'r_bombs', name: 'Bomb Science', desc: 'Goblin Bomb damage ×2', cost: 3e11, ore: 3000, lvl: 16, eff: { bomb: 1 } },
  { id: 'r_thieves', name: 'Quieter Shoes', desc: 'Thieves\' Guild ×3', cost: 8e11, ore: 4000, lvl: 17, eff: { b: 'thieves', m: 3 } },
  { id: 'r_walls', name: 'Walls (Now With Doors)', desc: 'Defense power +50%', cost: 2e12, ore: 5000, lvl: 18, eff: { defense: 0.5 } },
  { id: 'r_cauldron', name: 'Bigger Spoon', desc: 'Better recruit odds', cost: 5e12, ore: 6000, lvl: 19, eff: { luck: 0.25 } },
  { id: 'r_bank', name: 'Compound Interest (Stolen Idea)', desc: 'Hoard Vault ×3', cost: 2e13, ore: 8000, lvl: 20, eff: { b: 'bank', m: 3 } },
  { id: 'r_wheel2', name: 'The Wheel (Round Edition!)', desc: 'All income +100%', cost: 1e14, ore: 12000, lvl: 22, eff: { gold: 1 } },
  { id: 'r_arena', name: 'Ticket Sales', desc: 'Bonk Arena ×3', cost: 6e14, ore: 16000, lvl: 24, eff: { b: 'arena', m: 3 } },
  { id: 'r_union2', name: 'Goblin Union Pension Plan', desc: 'Worker bonuses +100%', cost: 3e15, ore: 22000, lvl: 26, eff: { worker: 1 } },
  { id: 'r_alchemy', name: 'Mud Purity Standards', desc: 'Mud-to-Gold Lab ×3', cost: 2e16, ore: 30000, lvl: 28, eff: { b: 'alchemy', m: 3 } },
  { id: 'r_hatch', name: 'Dragon Lullabies', desc: 'Dragon Hatchery ×3', cost: 6e17, ore: 45000, lvl: 31, eff: { b: 'hatchery', m: 3 } },
  { id: 'r_palace', name: 'Golden Toilets', desc: 'Palace ×3', cost: 4e19, ore: 70000, lvl: 36, eff: { b: 'palace', m: 3 } },
  { id: 'r_wheel3', name: 'The Wheel (On Fire)', desc: 'All income +200%', cost: 1e21, ore: 100000, lvl: 38, eff: { gold: 2 } },
];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map(r => [r.id, r]));

// ----------------------------------------------------------------- Prestige perks (Golden Teeth)
export const PERKS = [
  { id: 'headstart', name: 'Head Start', desc: 'Start each run with gold: 1K / 1M / 1B / 1T', max: 4, cost: [5, 40, 300, 2500] },
  { id: 'pockets', name: 'Bigger Pockets', desc: '+4h offline earnings cap per level', max: 3, cost: [8, 60, 400] },
  { id: 'luck', name: 'Lucky Tooth', desc: '+15% better recruit odds per level', max: 5, cost: [10, 50, 200, 800, 3000] },
  { id: 'golden', name: 'Shiny Magnet', desc: '+20% Golden Goblin frequency per level', max: 5, cost: [6, 30, 150, 600, 2500] },
  { id: 'veteran', name: 'Veteran Recruits', desc: 'New goblins start at level +3 per level', max: 3, cost: [15, 120, 900] },
  { id: 'districts', name: 'Land Deeds', desc: 'Districts cost 75% less', max: 1, cost: [25] },
  { id: 'wisdom', name: 'Ancestral Wisdom', desc: 'Research costs -25% per level', max: 3, cost: [20, 150, 1200] },
  { id: 'autobubble', name: 'Coin Butler', desc: 'Coin bubbles are collected automatically', max: 1, cost: [30] },
  { id: 'party', name: 'Bigger Expeditions', desc: '+1 expedition slot', max: 2, cost: [40, 600] },
  { id: 'mushrooms', name: 'Spore Hoard', desc: '+50% mushrooms per level', max: 4, cost: [8, 50, 300, 2000] },
];
export const PERK_BY_ID = Object.fromEntries(PERKS.map(p => [p.id, p]));
export const PRESTIGE_MIN_GOLD = 1e9;
// Total teeth ever claimable from all-time gold (across runs). Diminishing returns keep prestige from running away.
export function teethFor(totalGold) { return Math.floor(10 * Math.pow(Math.max(0, totalGold) / 1e9, 0.3)); }

// ----------------------------------------------------------------- Items
export const ITEM_WEAPONS = ['Spoon', 'Stick', 'Club', 'Dagger', 'Fork', 'Ladle', 'Axe', 'Sword', 'Pickaxe', 'Frying Pan', 'Bone', 'Rubber Chicken', 'Trident', 'Plunger'];
export const ITEM_TRINKETS = ['Sock', 'Ring', 'Amulet', 'Lucky Rock', 'Button', 'Tooth Necklace', 'Earring', 'Monocle', 'Belt Buckle', 'Rabbit Foot', 'Bottle Cap', 'Feather'];
export const ITEM_ADJ = ['Rusty', 'Sticky', 'Slightly Haunted', 'Shiny', 'Bent', 'Stolen', 'Very Old', 'Suspicious', 'Glorious', 'Smelly', 'Ancient', 'Cursed', 'Blessed', 'Spicy', 'Moist', 'Royal'];
export const ITEM_OF = ['of Doom', 'of Bonking', 'of Greed', 'of the Swamp', 'of Grandma', 'of Mild Danger', 'of Gold', 'of the Dragon', 'of Snacks', 'of Luck', 'of Kings', 'of Stink'];

// ----------------------------------------------------------------- Events
// Each choice: { t: label, o: [ [weight, outcomeKey, text] ] }
// outcome keys interpreted in game.js
export const FUNNY_EVENTS = [
  { id: 'spoon', title: 'The Great Spoon Debate', text: '{a} and {b} are arguing over who invented the spoon. Fists are being raised. Spoons are being raised.',
    choices: [
      { t: 'Let them fight', o: [[1, 'gold_s', 'They fought. The crowd paid admission! +{gold} gold.'], [1, 'nothing', 'They both tripped. Nobody won. Nobody learned anything.']] },
      { t: 'Invent the fork', o: [[1, 'xp', 'You invented the fork! Both are furious. +{xp} capital XP.']] } ] },
  { id: 'stew', title: 'Accident at the Tavern', text: '{a} fell into the stew pot. The stew is now... "meaty".',
    choices: [
      { t: 'Serve it anyway', o: [[2, 'buff_tavern', 'Customers LOVE it. Tavern income ×3 for 2 minutes!'], [1, 'nothing', 'Health inspector fainted. Business as usual.']] },
      { t: 'Fish them out', o: [[1, 'mush', '{a} is fine. Found mushrooms in their pockets. +{mush} mushrooms.']] } ] },
  { id: 'hat', title: 'Hat Theft!', text: '{a} stole the mayor\'s hat. The mayor is you. You are hatless.',
    choices: [
      { t: 'Demand it back', o: [[1, 'gems', '{a} returns it with a gem stuck to it. +{gems} gems.'], [1, 'nothing', '{a} ate the hat. Problem solved?']] },
      { t: 'Let them keep it', o: [[1, 'buff_gold', 'Everyone respects your generosity. Income ×2 for 60s!']] } ] },
  { id: 'chicken', title: 'Chicken on the Loose', text: 'A chicken has escaped and is terrorizing the capital. {a} is leading the hunt, armed with a spoon.',
    choices: [
      { t: 'CHASE IT', o: [[1, 'gold_s', 'Caught it! The chicken had gold eggs?! +{gold} gold.'], [1, 'nothing', 'The chicken won. The chicken is now mayor.']] },
      { t: 'Make it a citizen', o: [[1, 'xp', 'Citizen Cluck is very productive. +{xp} capital XP.']] } ] },
  { id: 'rock', title: 'A Very Good Rock', text: '{a} found a very good rock. They want to put it in the treasury.',
    choices: [
      { t: 'Accept the rock', o: [[1, 'ore', 'It was ore! +{ore} ore.'], [1, 'gold_s', 'It was gold-ish! +{gold} gold.']] },
      { t: 'Reject the rock', o: [[1, 'nothing', '{a} is heartbroken and writes rock-themed poetry.']] } ] },
  { id: 'dragonsneeze', title: 'Dragon Sneeze', text: 'A passing dragon sneezed on the capital. Everything is a bit singed. And a bit golden?',
    choices: [
      { t: 'Scrape off the gold', o: [[1, 'gold_m', 'Scraped {gold} gold off the rooftops!']] },
      { t: 'Bless you!', o: [[1, 'gems', 'The dragon appreciated the manners. Dropped {gems} gems.']] } ] },
  { id: 'nap', title: 'Union Nap Strike', text: 'The workers demand a mandatory nap. {a} is already asleep at the picket line.',
    choices: [
      { t: 'Grant the nap', o: [[1, 'buff_gold', 'Well-rested goblins work harder! Income ×2 for 60s.']] },
      { t: 'Offer snacks instead', o: [[1, 'mush_cost', 'They accepted the snacks. -{mush} mushrooms, but morale is up.']] } ] },
  { id: 'bard', title: 'Traveling Bard', text: 'A bard is singing songs about the capital. They are mostly insults, but catchy.',
    choices: [
      { t: 'Pay the bard', o: [[1, 'xp', 'The song goes viral across the realm. +{xp} capital XP.']] },
      { t: 'Throw mushrooms', o: [[1, 'nothing', 'The bard catches them and eats them. Rude.'], [1, 'gems', 'The bard drops a gem while fleeing! +{gems} gems.']] } ] },
  { id: 'mushroomtalk', title: 'The Mushroom Spoke', text: '{a} claims a mushroom in the patch just said "hello".',
    choices: [
      { t: 'Say hello back', o: [[1, 'buff_shroom', 'The mushrooms are happy. Mushroom Patch ×5 for 2 minutes!']] },
      { t: 'Eat it', o: [[1, 'xp', '{a} sees colors for a week. Writes a philosophy book. +{xp} XP.']] } ] },
  { id: 'tax', title: 'A Human Tax Collector', text: 'A human tax collector has arrived demanding taxes for "existing".',
    choices: [
      { t: 'Pay up', o: [[1, 'gold_cost', 'You paid {gold} gold. He left confused that it worked.']] },
      { t: 'Hide everyone', o: [[1, 'nothing', 'He saw nobody. He reports the capital as "very empty, smells".'], [1, 'gems', 'He tripped over {a} and dropped his pouch. +{gems} gems!']] } ] },
  { id: 'boomwick', title: 'Explosion!', text: 'There was an explosion at the potion district. Nobody is hurt. Everybody is green(er).',
    choices: [
      { t: 'Investigate', o: [[1, 'ore', 'Found melted ore in the crater. +{ore} ore.']] },
      { t: 'Pretend it didn\'t happen', o: [[1, 'nothing', 'It didn\'t happen. Officially.']] } ] },
  { id: 'twins', title: 'Identical Twins?', text: '{a} and {b} claim they are identical twins. They look nothing alike.',
    choices: [
      { t: 'Believe them', o: [[1, 'xp', 'They are touched. +{xp} XP.']] },
      { t: 'Demand proof', o: [[1, 'gold_s', 'They perform a twin dance for coins. +{gold} gold.']] } ] },
  { id: 'statue', title: 'Statue Proposal', text: '{a} wants to build a giant statue of themselves. In the middle of the road.',
    choices: [
      { t: 'Approve', o: [[1, 'buff_gold', 'Tourists flock to mock it! Income ×2 for 60s.']] },
      { t: 'Build one of ME instead', o: [[1, 'xp', 'Magnificent. +{xp} XP.']] } ] },
  { id: 'rats', title: 'Rat Negotiations', text: 'The rats have formed a union. They want cheese. You have no cheese.',
    choices: [
      { t: 'Offer mushrooms', o: [[1, 'mush_cost', 'Deal! -{mush} mushrooms. Rats start a mushroom farm next door.']] },
      { t: 'Hire them', o: [[1, 'ore', 'The rats dig tunnels and find ore! +{ore} ore.']] } ] },
  { id: 'wizard', title: 'Lost Wizard', text: 'A confused human wizard asks for directions to "anywhere but here".',
    choices: [
      { t: 'Give directions', o: [[1, 'gems', 'He tips in gems! +{gems} gems.']] },
      { t: 'Steal his hat', o: [[1, 'buff_gold', 'The hat is MAGIC. Income ×2 for 60s.'], [1, 'nothing', 'He turned {a} into a frog. Then back. Mostly.']] } ] },
  { id: 'well', title: 'Wishing Well', text: '{a} dug a hole and calls it a "wishing well". It is just a hole.',
    choices: [
      { t: 'Toss a coin in', o: [[2, 'gold_m', 'The hole was above a gold vein! +{gold} gold.'], [1, 'nothing', 'The coin is gone. The hole is pleased.']] },
      { t: 'Fill it in', o: [[1, 'xp', 'Sensible. Boring. +{xp} XP.']] } ] },
  { id: 'contest', title: 'Ugliest Goblin Contest', text: 'The annual Ugliest Goblin Contest is on! {a} and {b} are in the final.',
    choices: [
      { t: 'Vote for {a}', o: [[1, 'gems', '{a} wins! Ugliness is beauty. +{gems} gems.']] },
      { t: 'Vote for {b}', o: [[1, 'gold_s', '{b} wins and throws a party! +{gold} gold in tips.']] } ] },
  { id: 'mimic', title: 'Suspicious Chest', text: 'A treasure chest appeared in the square. It has teeth. It is smiling.',
    choices: [
      { t: 'Open it', o: [[1, 'gold_m', 'Mimic was friendly! Coughed up {gold} gold.'], [1, 'nothing', 'It bit {a}. {a} bit it back. Both are sulking.']] },
      { t: 'Pet it', o: [[1, 'gems', 'The mimic purrs and spits out {gems} gems.']] } ] },
];

export const AMBIENT_EVENTS = [
  '{a} tripped over a chicken.', '{a} and {b} are arguing about hats.', '{a} is napping on the job.',
  '{a} stole {b}\'s lunch.', '{a} challenged a rock to a duel. The rock won.', '{a} is singing badly.',
  '{a} found a shiny button! Best day ever.', '{a} accidentally set their own pants on fire.', '{b} is chasing {a} with a spoon.',
  '{a} sold {b}\'s shoes back to {b}.', '{a} invented a new swear word.', '{a} is teaching a mushroom to dance.',
  '{a} tried to tax a squirrel.', '{a} and {b} started a band. It is just yelling.', '{a} fell in the well. Again.',
];

// ----------------------------------------------------------------- Quests
export const DAILY_TEMPLATES = [
  { id: 'upgrades', text: 'Upgrade buildings {n} times', stat: 'upgrades', n: [25, 50, 100], reward: { gems: 15 } },
  { id: 'bubbles', text: 'Pop {n} coin bubbles', stat: 'bubbles', n: [10, 20, 35], reward: { gems: 15 } },
  { id: 'recruit', text: 'Recruit {n} goblins', stat: 'recruits', n: [2, 3, 5], reward: { gems: 20 } },
  { id: 'battles', text: 'Win {n} battles', stat: 'battlesWon', n: [3, 5, 8], reward: { gems: 20 }, needs: 'combat' },
  { id: 'exped', text: 'Complete {n} expeditions', stat: 'expeditions', n: [2, 3, 5], reward: { gems: 20 }, needs: 'explore' },
  { id: 'golden', text: 'Catch {n} Golden Goblins', stat: 'golden', n: [1, 2, 3], reward: { gems: 25 } },
  { id: 'events', text: 'Handle {n} goblin incidents', stat: 'events', n: [2, 3, 4], reward: { gems: 15 } },
  { id: 'train', text: 'Train goblins {n} times', stat: 'trains', n: [5, 10, 20], reward: { gems: 15 } },
  { id: 'taps', text: 'Poke enemies {n} times in battle', stat: 'pokes', n: [30, 60, 100], reward: { gems: 15 }, needs: 'combat' },
];

// Guided story quests (onboarding + long goals). check(state, G) returns progress 0..1 handled in game.js
export const STORY = [
  { text: 'Build the Mushroom Patch', goal: { build: 'shroom' }, reward: { gold: 15 }, hint: 'Tap the empty plot with the sign, then BUILD.' },
  { text: 'Build the Gold Mine', goal: { build: 'mine' }, reward: { gold: 50 }, hint: 'Tap the empty plot next to the Mushroom Patch.' },
  { text: 'Upgrade Mushroom Patch to level 5', goal: { blvl: ['shroom', 5] }, reward: { mushrooms: 20 } },
  { text: 'Recruit a goblin at the Cauldron', goal: { stat: ['recruits', 1] }, reward: { gold: 150 }, hint: 'Tap the bubbling cauldron.' },
  { text: 'Assign a goblin to a building', goal: { assigned: 1 }, reward: { gems: 10 }, hint: 'Open a building and tap an empty worker slot.' },
  { text: 'Pop 3 coin bubbles', goal: { stat: ['bubbles', 3] }, reward: { gold: 300 } },
  { text: 'Upgrade Gold Mine to level 10', goal: { blvl: ['mine', 10] }, reward: { gems: 10 } },
  { text: 'Reach Capital Level 3', goal: { level: 3 }, reward: { mushrooms: 50 } },
  { text: 'Build the Grog Tavern', goal: { build: 'tavern' }, reward: { gold: 2000 } },
  { text: 'Reach Capital Level 4', goal: { level: 4 }, reward: { gems: 15 } },
  { text: 'Unlock the Market Ward', goal: { district: 'market' }, reward: { gold: 3000 } },
  { text: 'Build the Expedition Lodge', goal: { build: 'lodge' }, reward: { gems: 15 } },
  { text: 'Win a battle in Whispering Woods', goal: { stat: ['battlesWon', 1] }, reward: { mushrooms: 80 } },
  { text: 'Build the Goblin Infirmary', goal: { build: 'infirmary' }, reward: { gems: 15 }, hint: 'Injured goblins heal there. Place it anywhere you like.' },
  { text: 'Send an expedition', goal: { stat: ['expSent', 1] }, reward: { gems: 15 } },
  { text: 'Own 6 goblins', goal: { goblins: 6 }, reward: { gems: 20 } },
  { text: 'Build the Scrap Smithy', goal: { build: 'smithy' }, reward: { ore: 30 } },
  { text: 'Build the Tinker Shed', goal: { build: 'research' }, reward: { ore: 30 } },
  { text: 'Complete a research project', goal: { research: 1 }, reward: { gems: 20 } },
  { text: 'Build the Bonk Barracks', goal: { build: 'barracks' }, reward: { gems: 20 } },
  { text: 'Defeat Old Barkbeard (Woods boss)', goal: { boss: 'woods' }, reward: { gems: 50 } },
  { text: 'Upgrade any building to level 50', goal: { anyLvl: 50 }, reward: { gems: 25 } },
  { text: 'Earn 1 Billion gold this run', goal: { runGold: 1e9 }, reward: { gems: 30 } },
  { text: 'Unlock Shady Alley', goal: { district: 'shady' }, reward: { gems: 30 } },
  { text: 'Pack Up the Capital (Prestige)', goal: { stat: ['prestiges', 1] }, reward: { gems: 100 }, hint: 'Open More → Prestige once you\'ve earned enough Golden Teeth.' },
  { text: 'Defeat Mother Gloop (Caves boss)', goal: { boss: 'caves' }, reward: { gems: 60 } },
  { text: 'Own a Legendary goblin', goal: { rarity: 3 }, reward: { gems: 50 } },
  { text: 'Unlock Hoard Hill', goal: { district: 'hoard' }, reward: { gems: 50 } },
  { text: 'Defeat Sir Reginald the Unwashed', goal: { boss: 'knightshire' }, reward: { gems: 80 } },
  { text: 'Complete a treasure set', goal: { sets: 1 }, reward: { gems: 80 } },
  { text: 'Unlock Dragonview Heights', goal: { district: 'dragon' }, reward: { gems: 100 } },
  { text: 'Own a Mythical goblin', goal: { rarity: 4 }, reward: { gems: 100 } },
  { text: 'Defeat Vorgath the Hoarder', goal: { boss: 'ember' }, reward: { gems: 300 } },
  { text: 'Build the Goblin King\'s Palace', goal: { build: 'palace' }, reward: { gems: 300 } },
];

// ----------------------------------------------------------------- Achievements
export const ACHIEVEMENTS = [
  { id: 'gold1k', name: 'Pocket Change', desc: 'Earn 1K gold total', check: s => s.lifetimeGold >= 1e3, gems: 5 },
  { id: 'gold1m', name: 'Millionaire Goblin', desc: 'Earn 1M gold total', check: s => s.lifetimeGold >= 1e6, gems: 10 },
  { id: 'gold1b', name: 'Billion Bottoms', desc: 'Earn 1B gold total', check: s => s.lifetimeGold >= 1e9, gems: 20 },
  { id: 'gold1t', name: 'Trillionaire Troublemaker', desc: 'Earn 1T gold total', check: s => s.lifetimeGold >= 1e12, gems: 40 },
  { id: 'gold1qa', name: 'Too Much Gold', desc: 'Earn 1Qa gold total', check: s => s.lifetimeGold >= 1e15, gems: 80 },
  { id: 'gold1qi', name: 'The Gold Has Gold', desc: 'Earn 1Qi gold total', check: s => s.lifetimeGold >= 1e18, gems: 150 },
  { id: 'lvl5', name: 'Hamlet Hero', desc: 'Reach Capital Level 5', check: s => s.level >= 5, gems: 10 },
  { id: 'lvl12', name: 'Town Tyrant', desc: 'Reach Capital Level 12', check: s => s.level >= 12, gems: 25 },
  { id: 'lvl25', name: 'Capital Crown', desc: 'Reach Capital Level 25', check: s => s.level >= 25, gems: 60 },
  { id: 'lvl40', name: 'Emperor of Mud', desc: 'Reach Capital Level 40', check: s => s.level >= 40, gems: 150 },
  { id: 'b10', name: 'Getting Somewhere', desc: 'Any building to level 10', check: (s, G) => G.maxBuildingLvl() >= 10, gems: 5 },
  { id: 'b100', name: 'Centurion', desc: 'Any building to level 100', check: (s, G) => G.maxBuildingLvl() >= 100, gems: 30 },
  { id: 'b250', name: 'Skyscraper (Goblin Scale)', desc: 'Any building to level 250', check: (s, G) => G.maxBuildingLvl() >= 250, gems: 80 },
  { id: 'allbiz', name: 'Diversified Portfolio', desc: 'Build every business', check: (s) => BIZ.every(b => s.buildings[b.id]?.lvl > 0), gems: 100 },
  { id: 'gob5', name: 'Small Gang', desc: 'Own 5 goblins', check: s => s.goblins.length >= 5, gems: 5 },
  { id: 'gob15', name: 'Rowdy Crowd', desc: 'Own 15 goblins', check: s => s.goblins.length >= 15, gems: 20 },
  { id: 'gob30', name: 'Goblin Horde', desc: 'Own 30 goblins', check: s => s.goblins.length >= 30, gems: 50 },
  { id: 'rare', name: 'Ooh, Blue', desc: 'Recruit a Rare goblin', check: (s, G) => G.bestRarity() >= 1, gems: 5 },
  { id: 'epic', name: 'Epic Find', desc: 'Recruit an Epic goblin', check: (s, G) => G.bestRarity() >= 2, gems: 15 },
  { id: 'legend', name: 'Living Legend', desc: 'Recruit a Legendary goblin', check: (s, G) => G.bestRarity() >= 3, gems: 40 },
  { id: 'myth', name: 'Myth Made Flesh', desc: 'Recruit a Mythical goblin', check: (s, G) => G.bestRarity() >= 4, gems: 100 },
  { id: 'codex10', name: 'Collector', desc: 'Discover 10 named goblins', check: s => Object.keys(s.codex).length >= 10, gems: 50 },
  { id: 'codexall', name: 'Gotta Gob \'Em All', desc: 'Discover every named goblin', check: s => NAMED.every(n => s.codex[n.id]), gems: 500 },
  { id: 'win1', name: 'First Bonk', desc: 'Win a battle', check: s => s.stats.battlesWon >= 1, gems: 5 },
  { id: 'win50', name: 'Bonk Veteran', desc: 'Win 50 battles', check: s => s.stats.battlesWon >= 50, gems: 30 },
  { id: 'win200', name: 'Bonk Legend', desc: 'Win 200 battles', check: s => s.stats.battlesWon >= 200, gems: 80 },
  { id: 'boss1', name: 'Tree Trimmer', desc: 'Defeat a region boss', check: s => s.stats.bosses >= 1, gems: 20 },
  { id: 'bossall', name: 'Dragon Slayer-ish', desc: 'Defeat every region boss', check: s => REGIONS.every(r => (s.regions[r.id]?.stage || 0) >= STAGES_PER_REGION), gems: 300 },
  { id: 'exp5', name: 'Wanderers', desc: 'Complete 5 expeditions', check: s => s.stats.expeditions >= 5, gems: 10 },
  { id: 'exp50', name: 'Explorers Club', desc: 'Complete 50 expeditions', check: s => s.stats.expeditions >= 50, gems: 40 },
  { id: 'gg1', name: 'Shiny!', desc: 'Catch a Golden Goblin', check: s => s.stats.golden >= 1, gems: 5 },
  { id: 'gg25', name: 'Gold Rush', desc: 'Catch 25 Golden Goblins', check: s => s.stats.golden >= 25, gems: 40 },
  { id: 'bub100', name: 'Bubble Popper', desc: 'Pop 100 coin bubbles', check: s => s.stats.bubbles >= 100, gems: 15 },
  { id: 'bub1000', name: 'Bubble Wrap Addict', desc: 'Pop 1000 coin bubbles', check: s => s.stats.bubbles >= 1000, gems: 50 },
  { id: 'fire10', name: 'Fire Goblin (Fighter)', desc: 'Extinguish 10 fires', check: s => s.stats.fires >= 10, gems: 15 },
  { id: 'rats25', name: 'Pied Piper', desc: 'Squash 25 rats', check: s => s.stats.rats >= 25, gems: 15 },
  { id: 'def1', name: 'Not Today, Knights', desc: 'Repel an invasion', check: s => s.stats.invasionsWon >= 1, gems: 15 },
  { id: 'def10', name: 'Fortress of Mud', desc: 'Repel 10 invasions', check: s => s.stats.invasionsWon >= 10, gems: 50 },
  { id: 'ev10', name: 'Drama Manager', desc: 'Handle 10 goblin incidents', check: s => s.stats.events >= 10, gems: 15 },
  { id: 'res10', name: 'Mad Scientist', desc: 'Complete 10 research projects', check: s => Object.keys(s.research).length >= 10, gems: 30 },
  { id: 'pres1', name: 'Moving Day', desc: 'Prestige once', check: s => s.stats.prestiges >= 1, gems: 50 },
  { id: 'pres5', name: 'Serial Mover', desc: 'Prestige 5 times', check: s => s.stats.prestiges >= 5, gems: 150 },
  { id: 'set1', name: 'Hoarder', desc: 'Complete a treasure set', check: (s, G) => G.completedSets() >= 1, gems: 30 },
  { id: 'trade10', name: 'Shady Dealings', desc: 'Make 10 trades with the merchant', check: s => s.stats.trades >= 10, gems: 20 },
  { id: 'streak7', name: 'Loyal Overlord', desc: 'Log in 7 days in a row', check: s => s.daily.streak >= 7, gems: 50 },
  { id: 'league1', name: 'Top Goblin', desc: 'Finish #1 in a weekly league', check: s => s.stats.leagueWins >= 1, gems: 100 },
];

// ----------------------------------------------------------------- League rivals
export const RIVAL_NAMES = [
  'Chief Snaggletooth', 'Queen Mucklebottom', 'Lord Gristlechin', 'Boss Wartface', 'Grandma Gnash', 'King Bogbreath',
  'Duchess Drool', 'Baron von Stink', 'Chieftain Nosepick', 'Mayor Mudpie', 'Sly Snivel', 'Count Crumbleteeth',
  'Big Mama Grub', 'Overlord Ookle', 'Tribe of Tiny Tom', 'The Sock Gang', 'Gutrot Clan', 'Fungus Federation',
  'Muckmire Mob', 'Hornswoggle Horde',
];

export const LOGIN_REWARDS = [
  { gems: 10 }, { mushrooms: 100 }, { gems: 20 }, { ore: 100 }, { gems: 30 }, { mushrooms: 300 }, { gems: 60, ticket: 1 },
];

export const MERCHANT_NAMES = ['Gribble the Wandering Trader'];
