import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Direction = 0 | 1 | 2 | 3;
type HeroId = "mira" | "oren" | "pip";
type Screen = "title" | "town" | "dungeon" | "battle" | "chest" | "victory" | "gameover";
type SfxKind = "menu" | "step" | "turn" | "coin" | "heal" | "hit" | "magic" | "danger" | "win";
type VisualEffect = "step" | "turn" | "hit" | "magic" | "coin" | "heal" | "danger" | "win";

interface Hero {
  id: HeroId;
  name: string;
  role: string;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  attack: number;
  guard: number;
  xp: number;
  level: number;
}

interface EnemyTemplate {
  id: string;
  name: string;
  sprite: string;
  maxHp: number;
  attack: number;
  xp: number;
  gold: number;
  color: string;
}

interface Enemy extends EnemyTemplate {
  hp: number;
}

interface ItemDef {
  id: keyof Inventory;
  name: string;
  price: number;
  description: string;
}

interface Inventory {
  moonDrops: number;
  emberSeeds: number;
  lanternOil: number;
}

interface Position {
  x: number;
  y: number;
}

interface GameState {
  screen: Screen;
  pos: Position;
  dir: Direction;
  floor: 0 | 1;
  heroes: Hero[];
  inventory: Inventory;
  gold: number;
  log: string[];
  visited: string[];
  openedChests: string[];
  battle: Enemy[] | null;
  bossDefeated: boolean;
  steps: number;
}

interface Cell {
  walls: Partial<Record<Direction, boolean>>;
  event?: "chest" | "boss" | "stairs" | "fountain";
  label?: string;
}

const SAVE_KEY = "moonveil-mini-save-v1";
const DIR_LABELS = ["N", "E", "S", "W"] as const;
const DELTAS: Record<Direction, Position> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

const INITIAL_HEROES: Hero[] = [
  {
    id: "mira",
    name: "Mira",
    role: "Wand",
    maxHp: 34,
    hp: 34,
    maxMp: 12,
    mp: 12,
    attack: 8,
    guard: 2,
    xp: 0,
    level: 1,
  },
  {
    id: "oren",
    name: "Oren",
    role: "Blade",
    maxHp: 42,
    hp: 42,
    maxMp: 4,
    mp: 4,
    attack: 11,
    guard: 3,
    xp: 0,
    level: 1,
  },
  {
    id: "pip",
    name: "Pip",
    role: "Scout",
    maxHp: 28,
    hp: 28,
    maxMp: 8,
    mp: 8,
    attack: 7,
    guard: 1,
    xp: 0,
    level: 1,
  },
];

const ITEMS: ItemDef[] = [
  {
    id: "moonDrops",
    name: "Moon Drop",
    price: 12,
    description: "Restores 18 HP to the weakest hero.",
  },
  {
    id: "emberSeeds",
    name: "Ember Seed",
    price: 18,
    description: "Deals 16 fire damage to one enemy.",
  },
  {
    id: "lanternOil",
    name: "Lantern Oil",
    price: 8,
    description: "Reduces the next few wandering encounters.",
  },
];

const ENEMIES: Record<string, EnemyTemplate> = {
  blueSlime: {
    id: "blueSlime",
    name: "Blue Slime",
    sprite: "slime",
    maxHp: 18,
    attack: 5,
    xp: 5,
    gold: 5,
    color: "#49c8ff",
  },
  caveBat: {
    id: "caveBat",
    name: "Cave Bat",
    sprite: "bat",
    maxHp: 14,
    attack: 6,
    xp: 6,
    gold: 6,
    color: "#d477ff",
  },
  thornImp: {
    id: "thornImp",
    name: "Thorn Imp",
    sprite: "imp",
    maxHp: 24,
    attack: 7,
    xp: 9,
    gold: 8,
    color: "#76dd6b",
  },
  lanternKnight: {
    id: "lanternKnight",
    name: "Lantern Knight",
    sprite: "knight",
    maxHp: 78,
    attack: 10,
    xp: 30,
    gold: 40,
    color: "#ffcf5a",
  },
};

const DUNGEON: Cell[][][] = [
  [
    [
      { walls: { 0: true, 3: true }, label: "Gate" },
      { walls: { 0: true }, event: "chest", label: "Old Cache" },
      { walls: { 0: true, 1: true }, event: "fountain", label: "Moonwell" },
      { walls: { 0: true, 1: true, 3: true }, label: "Alcove" },
    ],
    [
      { walls: { 3: true }, label: "Entry Hall" },
      { walls: {}, label: "Crossing" },
      { walls: { 1: true }, label: "Blue Hall" },
      { walls: { 1: true, 3: true }, event: "chest", label: "Hidden Nook" },
    ],
    [
      { walls: { 2: true, 3: true }, label: "Moss Bend" },
      { walls: { 2: true }, label: "Torch Row" },
      { walls: { 2: true }, event: "stairs", label: "Lower Stair" },
      { walls: { 1: true, 2: true }, label: "Sealed Wall" },
    ],
  ],
  [
    [
      { walls: { 0: true, 3: true }, label: "Lower Gate" },
      { walls: { 0: true }, label: "Amber Hall" },
      { walls: { 0: true, 1: true }, event: "chest", label: "Knight Cache" },
      { walls: { 0: true, 1: true, 3: true }, label: "Cracked Room" },
    ],
    [
      { walls: { 3: true }, event: "fountain", label: "Deep Well" },
      { walls: {}, label: "Deep Crossing" },
      { walls: { 1: true }, label: "Lantern Way" },
      { walls: { 1: true, 3: true }, label: "Echo Nook" },
    ],
    [
      { walls: { 2: true, 3: true }, label: "Root Bend" },
      { walls: { 2: true }, event: "chest", label: "Root Cache" },
      { walls: { 2: true }, label: "Boss Door" },
      { walls: { 1: true, 2: true }, event: "boss", label: "Lantern Throne" },
    ],
  ],
];

const CHEST_REWARDS: Record<string, { gold: number; item: keyof Inventory; qty: number; text: string }> = {
  "0:1:0": {
    gold: 12,
    item: "moonDrops",
    qty: 1,
    text: "You found a Moon Drop and 12 gold.",
  },
  "0:3:1": {
    gold: 7,
    item: "emberSeeds",
    qty: 1,
    text: "A warm seed glows inside the old box.",
  },
  "1:2:0": {
    gold: 22,
    item: "lanternOil",
    qty: 2,
    text: "Two flasks of Lantern Oil sit beside 22 gold.",
  },
  "1:1:2": {
    gold: 16,
    item: "moonDrops",
    qty: 2,
    text: "You found two Moon Drops in a root-bound coffer.",
  },
};

function createInitialState(): GameState {
  return {
    screen: "title",
    pos: { x: 0, y: 1 },
    dir: 1,
    floor: 0,
    heroes: INITIAL_HEROES.map((hero) => ({ ...hero })),
    inventory: { moonDrops: 2, emberSeeds: 1, lanternOil: 0 },
    gold: 25,
    log: [
      "Moonveil Village sleeps under a violet moon.",
      "Find the stolen lantern bell beneath the old gate.",
    ],
    visited: ["0:0:1"],
    openedChests: [],
    battle: null,
    bossDefeated: false,
    steps: 0,
  };
}

function keyFor(floor: number, pos: Position): string {
  return `${floor}:${pos.x}:${pos.y}`;
}

function currentCell(state: GameState): Cell {
  return DUNGEON[state.floor][state.pos.y][state.pos.x];
}

function hasWall(state: GameState, dir: Direction): boolean {
  return Boolean(currentCell(state).walls[dir]);
}

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [message, ...state.log].slice(0, 7) };
}

function makeEnemy(id: keyof typeof ENEMIES): Enemy {
  const template = ENEMIES[id];
  return { ...template, hp: template.maxHp };
}

function aliveHeroes(heroes: Hero[]): Hero[] {
  return heroes.filter((hero) => hero.hp > 0);
}

function weakestHeroIndex(heroes: Hero[]): number {
  let index = 0;
  let ratio = Number.POSITIVE_INFINITY;
  heroes.forEach((hero, i) => {
    if (hero.hp <= 0) {
      return;
    }
    const current = hero.hp / hero.maxHp;
    if (current < ratio) {
      ratio = current;
      index = i;
    }
  });
  return index;
}

function healParty(heroes: Hero[], full = false): Hero[] {
  return heroes.map((hero) => ({
    ...hero,
    hp: full ? hero.maxHp : Math.min(hero.maxHp, hero.hp + 18),
    mp: full ? hero.maxMp : Math.min(hero.maxMp, hero.mp + 4),
  }));
}

function levelHeroes(heroes: Hero[]): { heroes: Hero[]; messages: string[] } {
  const messages: string[] = [];
  const nextHeroes = heroes.map((hero) => {
    if (hero.level === 1 && hero.xp >= 22) {
      messages.push(`${hero.name} reached level 2!`);
      return {
        ...hero,
        level: 2,
        maxHp: hero.maxHp + 8,
        hp: hero.maxHp + 8,
        maxMp: hero.maxMp + 3,
        mp: hero.maxMp + 3,
        attack: hero.attack + 3,
        guard: hero.guard + 1,
      };
    }
    return hero;
  });

  return { heroes: nextHeroes, messages };
}

function playRetroTone(kind: SfxKind, audioContextRef: { current: AudioContext | null }): void {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const context = audioContextRef.current ?? new AudioContextCtor();
  audioContextRef.current = context;

  if (context.state === "suspended") {
    void context.resume();
  }

  const patterns: Record<SfxKind, Array<[number, number, OscillatorType]>> = {
    menu: [[660, 0.045, "square"]],
    step: [[130, 0.035, "triangle"], [92, 0.045, "triangle"]],
    turn: [[220, 0.035, "square"]],
    coin: [[740, 0.05, "square"], [988, 0.08, "square"]],
    heal: [[392, 0.08, "sine"], [523, 0.08, "sine"], [659, 0.12, "sine"]],
    hit: [[88, 0.06, "sawtooth"], [64, 0.08, "square"]],
    magic: [[330, 0.06, "triangle"], [660, 0.08, "triangle"], [990, 0.12, "sine"]],
    danger: [[146, 0.08, "square"], [110, 0.12, "square"]],
    win: [[523, 0.08, "square"], [659, 0.08, "square"], [784, 0.16, "square"]],
  };

  let offset = 0;
  patterns[kind].forEach(([frequency, duration, type]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    offset += duration * 0.72;
  });
}

function enemyAttack(state: GameState, enemies: Enemy[], message: string): GameState {
  const attackers = enemies.filter((enemy) => enemy.hp > 0);
  if (attackers.length === 0) {
    return { ...state, log: [message, ...state.log].slice(0, 7) };
  }

  let heroes = [...state.heroes];
  const enemyLines: string[] = [];
  attackers.forEach((enemy, i) => {
    const living = aliveHeroes(heroes);
    if (living.length === 0) {
      return;
    }
    const target = living[(state.steps + i) % living.length];
    const targetIndex = heroes.findIndex((hero) => hero.id === target.id);
    const damage = Math.max(1, enemy.attack - heroes[targetIndex].guard);
    heroes[targetIndex] = {
      ...heroes[targetIndex],
      hp: Math.max(0, heroes[targetIndex].hp - damage),
    };
    enemyLines.push(`${enemy.name} hits ${target.name} for ${damage}.`);
  });

  const defeated = heroes.every((hero) => hero.hp <= 0);
  return {
    ...state,
    screen: defeated ? "gameover" : state.screen,
    heroes,
    battle: enemies,
    log: defeated
      ? ["The party falls back to Moonveil Village...", message, ...enemyLines, ...state.log].slice(0, 7)
      : [message, ...enemyLines, ...state.log].slice(0, 7),
  };
}

function resolveVictory(state: GameState, enemies: Enemy[]): GameState | null {
  if (enemies.some((enemy) => enemy.hp > 0)) {
    return null;
  }

  const xp = enemies.reduce((sum, enemy) => sum + enemy.xp, 0);
  const gold = enemies.reduce((sum, enemy) => sum + enemy.gold, 0);
  const isBoss = enemies.some((enemy) => enemy.id === "lanternKnight");
  const leveled = levelHeroes(
    state.heroes.map((hero) => ({
      ...hero,
      xp: hero.xp + xp,
    })),
  );

  return {
    ...state,
    screen: isBoss ? "victory" : "dungeon",
    heroes: leveled.heroes,
    gold: state.gold + gold,
    battle: null,
    bossDefeated: state.bossDefeated || isBoss,
    log: [
      isBoss ? "The lantern bell rings again. Moonveil is safe!" : `Victory! ${xp} XP and ${gold} gold.`,
      ...leveled.messages,
      ...state.log,
    ].slice(0, 7),
  };
}

function makeEncounter(state: GameState): Enemy[] {
  if (state.floor === 0) {
    return state.steps % 2 === 0
      ? [makeEnemy("blueSlime")]
      : [makeEnemy("caveBat"), makeEnemy("blueSlime")];
  }

  return state.steps % 2 === 0
    ? [makeEnemy("thornImp")]
    : [makeEnemy("caveBat"), makeEnemy("thornImp")];
}

function canMoveTo(state: GameState, dir: Direction): boolean {
  if (hasWall(state, dir)) {
    return false;
  }
  const delta = DELTAS[dir];
  const x = state.pos.x + delta.x;
  const y = state.pos.y + delta.y;
  return Boolean(DUNGEON[state.floor][y]?.[x]);
}

function useSavedGame(): GameState {
  const [state] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? ({ ...createInitialState(), ...JSON.parse(raw) } as GameState) : createInitialState();
    } catch {
      return createInitialState();
    }
  });

  return state;
}

function HeroPanel({ heroes }: { heroes: Hero[] }) {
  return (
    <div className="hero-panel" aria-label="Party status">
      {heroes.map((hero) => (
        <div className="hero-row" key={hero.id}>
          <div>
            <strong>{hero.name}</strong>
            <span>{hero.role}</span>
          </div>
          <div className="bars">
            <span>LV {hero.level}</span>
            <span>HP {hero.hp}/{hero.maxHp}</span>
            <span>MP {hero.mp}/{hero.maxMp}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DungeonView({ state }: { state: GameState }) {
  const forwardBlocked = hasWall(state, state.dir);
  const cell = currentCell(state);
  const wallBlocks = Array.from({ length: 48 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return {
      x: 222 + col * 74 + (row % 2) * 16,
      y: 64 + row * 44,
      width: col === 7 ? 56 : 72,
      height: 42,
    };
  });
  const floorTiles = Array.from({ length: 35 }, (_, i) => {
    const row = Math.floor(i / 7);
    const col = i % 7;
    return {
      x: 206 + col * 88 - row * 24,
      y: 278 + row * 31,
      width: 86,
      height: 30,
    };
  });

  return (
    <div className="dungeon-window art-window" aria-label="Dungeon view">
      <svg className="scene-art" viewBox="0 0 1024 448" role="img" aria-label="Original stone dungeon chamber">
        <defs>
          <linearGradient id="stoneFace" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#65788b" />
            <stop offset="1" stopColor="#33485c" />
          </linearGradient>
          <linearGradient id="stoneSide" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#26384b" />
            <stop offset="1" stopColor="#6c8092" />
          </linearGradient>
          <linearGradient id="floorStone" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#77796a" />
            <stop offset="1" stopColor="#3d433b" />
          </linearGradient>
          <radialGradient id="dungeonTorchGlow" cx="69%" cy="36%" r="32%">
            <stop offset="0" stopColor="#ffe078" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#ff9f35" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="leftWallClip"><polygon points="0,0 228,64 228,330 0,448" /></clipPath>
          <clipPath id="rightWallClip"><polygon points="1024,0 796,64 796,330 1024,448" /></clipPath>
          <clipPath id="floorClip"><polygon points="228,330 796,330 1024,448 0,448" /></clipPath>
        </defs>

        <rect width="1024" height="448" fill="#182435" />
        <g clipPath="url(#leftWallClip)">
          <rect width="260" height="448" fill="url(#stoneSide)" />
          {Array.from({ length: 42 }, (_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            return (
              <rect
                key={`lw-${i}`}
                x={-18 + col * 70 + (row % 2) * 26}
                y={row * 45}
                width="74"
                height="43"
                rx="5"
                fill="none"
                stroke="#172331"
                strokeWidth="4"
              />
            );
          })}
        </g>
        <g clipPath="url(#rightWallClip)">
          <rect x="764" width="260" height="448" fill="url(#stoneSide)" />
          {Array.from({ length: 42 }, (_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            return (
              <rect
                key={`rw-${i}`}
                x={780 + col * 70 + (row % 2) * 26}
                y={row * 45}
                width="74"
                height="43"
                rx="5"
                fill="none"
                stroke="#172331"
                strokeWidth="4"
              />
            );
          })}
        </g>

        <g>
          <rect x="224" y="64" width="572" height="268" fill="url(#stoneFace)" />
          {wallBlocks.map((block, i) => (
            <rect
              key={`wall-${i}`}
              x={block.x}
              y={block.y}
              width={block.width}
              height={block.height}
              rx="5"
              fill="none"
              stroke="#1a2735"
              strokeWidth="4"
            />
          ))}
        </g>

        <g>
          <polygon points="226,0 798,0 796,64 224,64" fill="#2b3746" />
          {Array.from({ length: 24 }, (_, i) => (
            <rect
              key={`ceil-${i}`}
              x={226 + (i % 8) * 72}
              y={Math.floor(i / 8) * 22}
              width="70"
              height="22"
              fill="none"
              stroke="#172331"
              strokeWidth="3"
            />
          ))}
        </g>

        <g clipPath="url(#floorClip)">
          <rect y="300" width="1024" height="148" fill="url(#floorStone)" />
          {floorTiles.map((tile, i) => (
            <rect
              key={`floor-${i}`}
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              rx="4"
              fill="none"
              stroke="#30362f"
              strokeWidth="4"
            />
          ))}
        </g>

        {forwardBlocked ? (
          <g className="door-art">
            <path d="M423 310 V183 C423 126 601 126 601 183 V310 Z" fill="#79858b" />
            <path d="M448 310 V188 C448 150 576 150 576 188 V310 Z" fill="#864b24" />
            <path d="M448 196 H576 M448 254 H576" stroke="#242631" strokeWidth="12" />
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`door-plank-${i}`} x1={470 + i * 24} y1="158" x2={470 + i * 24} y2="310" stroke="#4f2a18" strokeWidth="5" />
            ))}
            <circle cx="548" cy="238" r="18" fill="none" stroke="#1e2630" strokeWidth="7" />
            <circle cx="548" cy="238" r="25" fill="none" stroke="#8e9695" strokeWidth="4" />
          </g>
        ) : (
          <g className="door-art">
            <path d="M412 320 V176 C412 118 612 118 612 176 V320 Z" fill="#111827" />
            <path d="M456 320 V188 C456 154 568 154 568 188 V320 Z" fill="#060913" />
            <rect x="472" y="220" width="80" height="100" fill="#182846" />
          </g>
        )}

        <g className="torch-art">
          <rect x="704" y="178" width="20" height="66" fill="#2a1a16" />
          <rect x="686" y="198" width="56" height="14" fill="#1b1515" />
          <path className="torch-flame" d="M714 106 C746 142 736 177 714 194 C686 171 688 138 714 106 Z" fill="#ff6a26" />
          <path className="torch-flame-core" d="M716 134 C731 154 728 176 714 184 C700 169 703 150 716 134 Z" fill="#fff07a" />
        </g>
        <rect width="1024" height="448" fill="url(#dungeonTorchGlow)" />

        {cell.event === "chest" && (
          <g className="treasure-art">
            <rect x="442" y="312" width="138" height="72" rx="8" fill="#9a5526" stroke="#2b1b15" strokeWidth="8" />
            <rect x="442" y="312" width="138" height="32" rx="8" fill="#d58b35" stroke="#2b1b15" strokeWidth="8" />
            <rect x="500" y="313" width="22" height="70" fill="#f2d168" stroke="#2b1b15" strokeWidth="5" />
          </g>
        )}
        {cell.event === "stairs" && (
          <g className="stairs-art">
            {[0, 1, 2, 3].map((step) => (
              <rect key={step} x={386 + step * 42} y={352 - step * 24} width={252 - step * 48} height="24" fill="#7f8890" stroke="#222d37" strokeWidth="5" />
            ))}
          </g>
        )}
        {cell.event === "fountain" && (
          <g className="fountain-art">
            <ellipse cx="512" cy="358" rx="86" ry="30" fill="#36577a" stroke="#d8e3e5" strokeWidth="7" />
            <ellipse cx="512" cy="350" rx="56" ry="17" fill="#79dfff" />
            <path d="M512 242 C548 290 540 336 512 344 C484 332 476 290 512 242 Z" fill="#75dfff" stroke="#e5fbff" strokeWidth="6" />
            <circle cx="512" cy="278" r="14" fill="#e7fbff" />
          </g>
        )}
      </svg>
      <div className="screen-vignette" />
    </div>
  );
}

function BattleSprite({ enemy }: { enemy: Enemy }) {
  const style = { "--enemy": enemy.color } as CSSProperties;

  if (enemy.sprite === "bat") {
    return (
      <div className="enemy-sprite svg-enemy" style={style}>
        <svg viewBox="0 0 150 120" aria-hidden="true">
          <path d="M72 48 C45 16 20 24 10 56 C29 48 43 62 55 78 Z" fill="#7f62d9" stroke="#1a1740" strokeWidth="6" />
          <path d="M78 48 C105 16 130 24 140 56 C121 48 107 62 95 78 Z" fill="#7f62d9" stroke="#1a1740" strokeWidth="6" />
          <ellipse cx="75" cy="68" rx="30" ry="34" fill="#b778ff" stroke="#1a1740" strokeWidth="6" />
          <circle cx="64" cy="62" r="6" fill="#fff" />
          <circle cx="88" cy="62" r="6" fill="#fff" />
          <path d="M64 82 Q75 92 88 82" fill="none" stroke="#1a1740" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (enemy.sprite === "imp") {
    return (
      <div className="enemy-sprite svg-enemy" style={style}>
        <svg viewBox="0 0 150 130" aria-hidden="true">
          <path d="M35 36 L48 9 L59 40 Z" fill="#6fcc5e" stroke="#17351b" strokeWidth="6" />
          <path d="M115 36 L102 9 L91 40 Z" fill="#6fcc5e" stroke="#17351b" strokeWidth="6" />
          <ellipse cx="75" cy="70" rx="47" ry="48" fill="#75dc65" stroke="#17351b" strokeWidth="7" />
          <circle cx="58" cy="63" r="7" fill="#fff6a3" />
          <circle cx="92" cy="63" r="7" fill="#fff6a3" />
          <path d="M55 91 Q75 104 96 91" fill="none" stroke="#17351b" strokeWidth="6" strokeLinecap="round" />
          <path d="M36 88 L18 108 M114 88 L132 108" stroke="#17351b" strokeWidth="8" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (enemy.sprite === "knight") {
    return (
      <div className="enemy-sprite svg-enemy boss-enemy" style={style}>
        <svg viewBox="0 0 170 150" aria-hidden="true">
          <path d="M86 13 L132 38 L121 124 H49 L38 38 Z" fill="#f4c85a" stroke="#3f2f17" strokeWidth="7" />
          <path d="M58 49 H114 V88 H58 Z" fill="#2d3b66" stroke="#3f2f17" strokeWidth="6" />
          <path d="M62 51 H110 L102 77 H70 Z" fill="#fff0a3" opacity="0.4" />
          <circle cx="85" cy="101" r="19" fill="#ff7a2d" stroke="#3f2f17" strokeWidth="6" />
          <path d="M85 78 C104 99 99 124 85 132 C69 119 68 96 85 78 Z" fill="#ffe667" />
          <path d="M43 73 L15 101 M127 73 L155 101" stroke="#3f2f17" strokeWidth="9" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="enemy-sprite svg-enemy" style={style}>
      <svg viewBox="0 0 150 115" aria-hidden="true">
        <path d="M28 83 C28 35 55 16 75 16 C95 16 122 35 122 83 C122 104 28 104 28 83 Z" fill="#55cfff" stroke="#12446a" strokeWidth="7" />
        <ellipse cx="58" cy="67" rx="8" ry="11" fill="#fff" />
        <ellipse cx="92" cy="67" rx="8" ry="11" fill="#fff" />
        <path d="M60 86 Q75 96 92 86" fill="none" stroke="#12446a" strokeWidth="6" strokeLinecap="round" />
        <path d="M52 36 C66 26 88 27 100 39" fill="none" stroke="#d8fbff" strokeWidth="8" strokeLinecap="round" opacity="0.75" />
      </svg>
    </div>
  );
}

function MiniMap({ state }: { state: GameState }) {
  return (
    <div className="mini-map" aria-label="Dungeon map">
      {DUNGEON[state.floor].map((row, y) =>
        row.map((cell, x) => {
          const key = keyFor(state.floor, { x, y });
          const here = state.pos.x === x && state.pos.y === y;
          const visited = state.visited.includes(key);
          return (
            <div className={`map-cell ${visited ? "seen" : ""} ${here ? "here" : ""}`} key={key}>
              {here ? DIR_LABELS[state.dir] : visited && cell.event ? "•" : ""}
            </div>
          );
        }),
      )}
    </div>
  );
}

function ItemIcon({ id }: { id: keyof Inventory }) {
  if (id === "lanternOil") {
    return (
      <svg className="item-icon" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="17" y="11" width="14" height="7" fill="#44516b" />
        <rect x="13" y="18" width="22" height="22" rx="5" fill="#34425f" stroke="#18223b" strokeWidth="3" />
        <circle cx="24" cy="30" r="9" fill="#ffd95a" />
        <path d="M24 21 C34 30 28 38 24 39 C18 35 19 27 24 21 Z" fill="#ff8b2d" />
      </svg>
    );
  }

  if (id === "emberSeeds") {
    return (
      <svg className="item-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 6 C37 18 35 36 24 43 C13 36 11 19 24 6 Z" fill="#ff6b2f" stroke="#7e2d20" strokeWidth="3" />
        <path d="M25 16 C31 24 29 34 23 37 C19 31 20 23 25 16 Z" fill="#ffe26f" />
      </svg>
    );
  }

  return (
    <svg className="item-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 7 C28 15 39 15 42 24 C34 24 31 31 33 40 C27 35 21 35 15 40 C17 31 14 24 6 24 C9 15 20 15 24 7 Z" fill="#72d85e" stroke="#285c2b" strokeWidth="3" />
      <path d="M24 12 V40" stroke="#285c2b" strokeWidth="3" />
    </svg>
  );
}

function ShopScene() {
  return (
    <div className="shop-scene" aria-label="Cozy village supply shop">
      <svg className="shop-art" viewBox="0 0 960 310" role="img">
        <defs>
          <linearGradient id="woodWall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7a4b24" />
            <stop offset="1" stopColor="#3f2417" />
          </linearGradient>
          <linearGradient id="counterWood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#b77735" />
            <stop offset="1" stopColor="#59321e" />
          </linearGradient>
          <radialGradient id="lampGlow" cx="30%" cy="28%" r="42%">
            <stop offset="0" stopColor="#ffe78a" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#ff9f35" stopOpacity="0.26" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="960" height="310" fill="url(#woodWall)" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 82} y="0" width="6" height="310" fill="#2e1a12" opacity="0.45" />
        ))}
        <rect x="0" y="230" width="960" height="80" fill="url(#counterWood)" />
        <rect x="0" y="218" width="960" height="15" fill="#d99b4f" />
        <rect x="70" y="40" width="120" height="120" rx="8" fill="#9ed8ff" stroke="#4d2a18" strokeWidth="9" />
        <path d="M83 143 L133 82 L190 143 Z" fill="#65b85e" />
        <path d="M83 143 L126 104 L158 143 Z" fill="#d6f2ff" />
        <rect x="640" y="58" width="210" height="112" fill="#4a2a18" stroke="#26160f" strokeWidth="8" />
        {[0, 1, 2].map((row) => (
          <line key={row} x1="650" y1={93 + row * 34} x2="840" y2={93 + row * 34} stroke="#24150e" strokeWidth="6" />
        ))}
        {["#72d85e", "#ffd95a", "#8b6fff", "#4fd6ff", "#ff6b2f"].map((color, i) => (
          <circle key={color} cx={676 + i * 34} cy={78 + (i % 2) * 42} r="13" fill={color} stroke="#25140e" strokeWidth="4" />
        ))}
        <g className="shopkeeper-art">
          <path d="M402 220 C410 130 550 130 558 220 Z" fill="#3d9d5b" />
          <circle cx="480" cy="116" r="58" fill="#ffd0a0" stroke="#5b2a1a" strokeWidth="6" />
          <path d="M420 105 C432 38 532 34 545 108 C506 78 466 78 420 105 Z" fill="#2faa64" />
          <path d="M436 63 C462 20 521 33 537 70 C503 54 469 54 436 63 Z" fill="#3fc774" />
          <rect x="450" y="112" width="9" height="12" fill="#2d2030" />
          <rect x="504" y="112" width="9" height="12" fill="#2d2030" />
          <path d="M458 145 C472 158 493 158 508 145" fill="none" stroke="#9d4c4e" strokeWidth="5" strokeLinecap="round" />
          <path d="M378 226 C390 188 424 172 456 198 L456 232 Z" fill="#fff3d5" />
          <path d="M582 226 C570 188 536 172 504 198 L504 232 Z" fill="#fff3d5" />
        </g>
        <g className="lamp-art">
          <line x1="282" y1="0" x2="282" y2="44" stroke="#23150f" strokeWidth="7" />
          <rect x="258" y="44" width="48" height="64" rx="10" fill="#263449" stroke="#1b1210" strokeWidth="6" />
          <ellipse cx="282" cy="75" rx="17" ry="25" fill="#ffd75e" />
        </g>
        <rect width="960" height="310" fill="url(#lampGlow)" />
      </svg>
    </div>
  );
}

function GameLog({ log }: { log: string[] }) {
  return (
    <div className="message-window" aria-live="polite">
      {log.map((entry, index) => (
        <p key={`${entry}-${index}`}>{entry}</p>
      ))}
    </div>
  );
}

function HeroPortrait({ hero }: { hero: Hero }) {
  const palette = {
    mira: { hair: "#a55a2d", cloak: "#4aa65a", accent: "#f1d476" },
    oren: { hair: "#2b7bd8", cloak: "#2456a8", accent: "#f0b64c" },
    pip: { hair: "#d88b38", cloak: "#7eb94d", accent: "#f1d476" },
  }[hero.id];

  return (
    <svg className="hero-portrait" viewBox="0 0 88 88" aria-hidden="true">
      <rect width="88" height="88" fill="#07133d" />
      <rect x="6" y="6" width="76" height="76" fill="#102d79" />
      <path d="M18 75 C24 50 64 50 70 75 Z" fill={palette.cloak} />
      <path d="M24 28 C26 13 63 11 66 32 L62 54 L27 54 Z" fill={palette.hair} />
      <circle cx="44" cy="42" r="19" fill="#ffd19f" />
      <path d="M22 40 C29 20 60 20 67 40 C54 34 40 33 22 40 Z" fill={palette.hair} />
      <rect x="33" y="40" width="6" height="6" fill="#17214c" />
      <rect x="51" y="40" width="6" height="6" fill="#17214c" />
      <rect x="39" y="55" width="14" height="4" fill="#bb5a62" />
      <path d="M18 76 H70 L62 62 H26 Z" fill={palette.cloak} />
      <rect x="36" y="65" width="16" height="8" fill={palette.accent} />
      {hero.id === "pip" && <path d="M18 29 L46 8 L72 29 Z" fill="#7eb94d" />}
    </svg>
  );
}

function HeroCard({ hero }: { hero: Hero }) {
  const hpPercent = `${Math.max(0, Math.round((hero.hp / hero.maxHp) * 100))}%`;
  const mpPercent = `${Math.max(0, Math.round((hero.mp / hero.maxMp) * 100))}%`;

  return (
    <div className="classic-hero-card">
      <HeroPortrait hero={hero} />
      <div className="classic-hero-info">
        <strong>{hero.name}</strong>
        <span>HP {hero.hp} / {hero.maxHp}</span>
        <div className="stat-bar hp-bar"><i style={{ width: hpPercent }} /></div>
        <span>MP {hero.mp} / {hero.maxMp}</span>
        <div className="stat-bar mp-bar"><i style={{ width: mpPercent }} /></div>
      </div>
    </div>
  );
}

export default function RetroDungeonGame() {
  const saved = useSavedGame();
  const [state, setState] = useState<GameState>(saved);
  const [visualEffect, setVisualEffect] = useState<VisualEffect | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const livingHeroes = useMemo(() => aliveHeroes(state.heroes), [state.heroes]);

  function feedback(sound: SfxKind, effect: VisualEffect | null = null): void {
    playRetroTone(sound, audioContextRef);
    if (effect) {
      setVisualEffect(effect);
      window.setTimeout(() => setVisualEffect(null), 260);
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // Saving is a convenience feature; private browsing may block it.
    }
  }, [state]);

  function startGame() {
    feedback("menu");
    setState((current) => ({
      ...current,
      screen: "town",
      log: ["Welcome to Moonveil. The gate below the bell tower is open.", ...current.log].slice(0, 7),
    }));
  }

  function newGame() {
    feedback("menu");
    setState({ ...createInitialState(), screen: "town" });
  }

  function resetGame() {
    feedback("danger", "danger");
    window.localStorage.removeItem(SAVE_KEY);
    setState(createInitialState());
  }

  function restAtInn() {
    feedback("heal", "heal");
    setState((current) => {
      if (current.gold < 6) {
        return addLog(current, "The innkeeper asks for 6 gold.");
      }
      return {
        ...current,
        gold: current.gold - 6,
        heroes: healParty(current.heroes, true),
        log: ["A short rest restores the party.", ...current.log].slice(0, 7),
      };
    });
  }

  function buyItem(item: ItemDef) {
    feedback("coin", "coin");
    setState((current) => {
      if (current.gold < item.price) {
        return addLog(current, "Not enough gold.");
      }
      return {
        ...current,
        gold: current.gold - item.price,
        inventory: {
          ...current.inventory,
          [item.id]: current.inventory[item.id] + 1,
        },
        log: [`Bought ${item.name}.`, ...current.log].slice(0, 7),
      };
    });
  }

  function enterDungeon() {
    feedback("step", "step");
    setState((current) => ({
      ...current,
      screen: "dungeon",
      log: ["The old gate shuts behind you.", ...current.log].slice(0, 7),
    }));
  }

  function turn(amount: -1 | 1) {
    feedback("turn", "turn");
    setState((current) => ({
      ...current,
      dir: ((current.dir + amount + 4) % 4) as Direction,
      log: [`You turn ${amount > 0 ? "right" : "left"}.`, ...current.log].slice(0, 7),
    }));
  }

  function moveForward() {
    feedback("step", "step");
    setState((current) => {
      if (current.screen !== "dungeon") {
        return current;
      }

      if (!canMoveTo(current, current.dir)) {
        return addLog(current, "A stone wall blocks the way.");
      }

      const delta = DELTAS[current.dir];
      const pos = { x: current.pos.x + delta.x, y: current.pos.y + delta.y };
      const visitedKey = keyFor(current.floor, pos);
      const steps = current.steps + 1;
      let next: GameState = {
        ...current,
        pos,
        steps,
        visited: current.visited.includes(visitedKey)
          ? current.visited
          : [...current.visited, visitedKey],
        log: [`You step into ${DUNGEON[current.floor][pos.y][pos.x].label ?? "a passage"}.`, ...current.log].slice(0, 7),
      };

      const cell = currentCell(next);
      if (cell.event === "boss" && !next.bossDefeated) {
        return {
          ...next,
          screen: "battle",
          battle: [makeEnemy("lanternKnight")],
          log: ["The Lantern Knight raises the stolen bell!", ...next.log].slice(0, 7),
        };
      }

      if (cell.event === "chest" && !next.openedChests.includes(visitedKey)) {
        return { ...next, screen: "chest" };
      }

      if (cell.event === "fountain") {
        next = {
          ...next,
          heroes: healParty(next.heroes),
          log: ["Moonwell light mends your wounds.", ...next.log].slice(0, 7),
        };
      }

      if (steps > 2 && steps % 4 === 0) {
        return {
          ...next,
          screen: "battle",
          battle: makeEncounter(next),
          log: ["A wandering monster appears!", ...next.log].slice(0, 7),
        };
      }

      return next;
    });
  }

  function useMoonDrop() {
    feedback("heal", "heal");
    setState((current) => {
      if (current.inventory.moonDrops <= 0) {
        return addLog(current, "No Moon Drops left.");
      }

      const index = weakestHeroIndex(current.heroes);
      const hero = current.heroes[index];
      const heroes = [...current.heroes];
      heroes[index] = { ...hero, hp: Math.min(hero.maxHp, hero.hp + 18) };
      return {
        ...current,
        heroes,
        inventory: { ...current.inventory, moonDrops: current.inventory.moonDrops - 1 },
        log: [`${hero.name} recovers 18 HP.`, ...current.log].slice(0, 7),
      };
    });
  }

  function useLanternOil() {
    feedback("magic", "magic");
    setState((current) => {
      if (current.inventory.lanternOil <= 0) {
        return addLog(current, "No Lantern Oil left.");
      }

      return {
        ...current,
        steps: current.steps - (current.steps % 4) + 1,
        inventory: { ...current.inventory, lanternOil: current.inventory.lanternOil - 1 },
        log: ["The passage grows calm in the lantern glow.", ...current.log].slice(0, 7),
      };
    });
  }

  function openChest() {
    feedback("coin", "coin");
    setState((current) => {
      const chestKey = keyFor(current.floor, current.pos);
      const reward = CHEST_REWARDS[chestKey];
      if (!reward || current.openedChests.includes(chestKey)) {
        return { ...current, screen: "dungeon" };
      }

      return {
        ...current,
        screen: "dungeon",
        gold: current.gold + reward.gold,
        inventory: {
          ...current.inventory,
          [reward.item]: current.inventory[reward.item] + reward.qty,
        },
        openedChests: [...current.openedChests, chestKey],
        log: [reward.text, ...current.log].slice(0, 7),
      };
    });
  }

  function descendStairs() {
    feedback("step", "step");
    setState((current) => {
      if (current.floor === 1 || currentCell(current).event !== "stairs") {
        return addLog(current, "There are no stairs here.");
      }
      const pos = { x: 0, y: 1 };
      return {
        ...current,
        floor: 1,
        pos,
        dir: 1,
        visited: current.visited.includes(keyFor(1, pos))
          ? current.visited
          : [...current.visited, keyFor(1, pos)],
        log: ["You descend to the lantern crypt.", ...current.log].slice(0, 7),
      };
    });
  }

  function attack() {
    feedback("hit", "hit");
    setState((current) => {
      if (!current.battle) {
        return current;
      }

      const enemies = current.battle.map((enemy) => ({ ...enemy }));
      const targetIndex = enemies.findIndex((enemy) => enemy.hp > 0);
      if (targetIndex === -1) {
        return current;
      }

      const damage = livingHeroes.reduce((sum, hero) => sum + hero.attack, 0);
      enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - damage);
      const victory = resolveVictory({ ...current, battle: enemies }, enemies);
      if (victory) {
        return victory;
      }

      return enemyAttack(
        { ...current, battle: enemies },
        enemies,
        `The party strikes ${enemies[targetIndex].name} for ${damage}.`,
      );
    });
  }

  function castSpark() {
    feedback("magic", "magic");
    setState((current) => {
      if (!current.battle) {
        return current;
      }

      const casterIndex = current.heroes.findIndex((hero) => hero.id === "mira");
      const caster = current.heroes[casterIndex];
      if (!caster || caster.mp < 3 || caster.hp <= 0) {
        return addLog(current, "Mira cannot cast Spark.");
      }

      const enemies = current.battle.map((enemy) => ({ ...enemy }));
      const targetIndex = enemies.findIndex((enemy) => enemy.hp > 0);
      const heroes = [...current.heroes];
      heroes[casterIndex] = { ...caster, mp: caster.mp - 3 };
      enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - 18);

      const victory = resolveVictory({ ...current, heroes, battle: enemies }, enemies);
      if (victory) {
        return victory;
      }

      return enemyAttack(
        { ...current, heroes, battle: enemies },
        enemies,
        `Mira casts Spark for 18 damage.`,
      );
    });
  }

  function throwEmberSeed() {
    feedback("magic", "magic");
    setState((current) => {
      if (!current.battle) {
        return current;
      }
      if (current.inventory.emberSeeds <= 0) {
        return addLog(current, "No Ember Seeds left.");
      }

      const enemies = current.battle.map((enemy) => ({ ...enemy }));
      const targetIndex = enemies.findIndex((enemy) => enemy.hp > 0);
      enemies[targetIndex].hp = Math.max(0, enemies[targetIndex].hp - 16);
      const nextState = {
        ...current,
        inventory: { ...current.inventory, emberSeeds: current.inventory.emberSeeds - 1 },
        battle: enemies,
      };

      const victory = resolveVictory(nextState, enemies);
      if (victory) {
        return victory;
      }

      return enemyAttack(nextState, enemies, "An Ember Seed bursts for 16 damage.");
    });
  }

  function defend() {
    feedback("menu");
    setState((current) => {
      if (!current.battle) {
        return current;
      }
      return enemyAttack(current, current.battle, "The party braces behind their shields.");
    });
  }

  function runAway() {
    feedback("step", "step");
    setState((current) => ({
      ...current,
      screen: "dungeon",
      battle: null,
      log: ["You retreat to the previous corner.", ...current.log].slice(0, 7),
    }));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (state.screen === "dungeon") {
        if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
          event.preventDefault();
          moveForward();
        }
        if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
          event.preventDefault();
          turn(-1);
        }
        if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
          event.preventDefault();
          turn(1);
        }
      }

      if (state.screen === "battle") {
        if (event.key === "1") {
          attack();
        }
        if (event.key === "2") {
          castSpark();
        }
        if (event.key === "3") {
          throwEmberSeed();
        }
        if (event.key === "4") {
          runAway();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.screen, state.dir, state.pos, state.battle, livingHeroes]);

  return (
    <main className={`retro-game-shell ${visualEffect ? `fx-${visualEffect}` : ""}`}>
      <section className="game-cabinet">
        {["title", "town", "victory", "gameover"].includes(state.screen) && (
          <div className="game-header">
            <div>
              <p className="eyebrow">A tiny original dungeon quest</p>
              <h1>Moonveil Gate</h1>
            </div>
            <div className="gold-box">Gold {state.gold}</div>
          </div>
        )}

        {state.screen === "title" && (
          <div className="title-screen pixel-panel">
            <div className="moon-logo">☾</div>
            <h2>Moonveil Gate</h2>
            <p>
              A short, original first-person dungeon crawler with simple menus,
              colorful sprites, treasure, and a boss below the village bell tower.
            </p>
            <div className="menu-grid">
              <button onClick={startGame}>Continue</button>
              <button onClick={newGame}>New Quest</button>
              <button onClick={resetGame}>Reset Save</button>
            </div>
          </div>
        )}

        {state.screen === "town" && (
          <div className="town-screen">
            <div className="town-art">
              <ShopScene />
              <div className="gold-box town-gold">Gold {state.gold} G</div>
            </div>
            <div className="town-columns">
              <div className="pixel-panel town-command-panel">
                <button onClick={enterDungeon}>Enter Gate</button>
                <button onClick={restAtInn}>Rest at Inn</button>
                <button onClick={useMoonDrop}>Use Herb</button>
                <button onClick={resetGame}>Reset</button>
              </div>
              <div className="pixel-panel shop-list-panel">
                {ITEMS.map((item) => (
                  <button className="shop-row" key={item.id} onClick={() => buyItem(item)}>
                    <ItemIcon id={item.id} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                    <b>{item.price}g</b>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(state.screen === "dungeon" || state.screen === "chest") && (
          <div className="play-layout classic-play-layout">
            <DungeonView state={state} />
            <div className="classic-hud-row">
              <div className="classic-menu pixel-panel">
                <button onClick={moveForward}>Forward</button>
                <button onClick={() => turn(-1)}>Turn Left</button>
                <button onClick={() => turn(1)}>Turn Right</button>
                <button onClick={useMoonDrop}>Moon Drop</button>
                <button onClick={useLanternOil}>Lantern Oil</button>
                <button onClick={descendStairs}>Stairs</button>
                <button onClick={() => setState((current) => ({ ...current, screen: "town" }))}>
                  Town
                </button>
              </div>
              {state.heroes.map((hero) => (
                <HeroCard hero={hero} key={hero.id} />
              ))}
            </div>
            <div className="classic-sub-row">
              <div className="pixel-panel inventory-panel">
                <strong>Pack</strong>
                <span>Moon Drops {state.inventory.moonDrops}</span>
                <span>Ember Seeds {state.inventory.emberSeeds}</span>
                <span>Lantern Oil {state.inventory.lanternOil}</span>
              </div>
              <MiniMap state={state} />
            </div>
            <GameLog log={state.log} />
          </div>
        )}

        {state.screen === "chest" && (
          <div className="modal-panel pixel-panel">
            <h2>Treasure Chest</h2>
            <p>A small brass chest waits here. Its lock opens with a soft click.</p>
            <button onClick={openChest}>Open Chest</button>
          </div>
        )}

        {state.screen === "battle" && state.battle && (
          <div className="battle-layout classic-play-layout">
            <div className="battle-stage">
              <div className="battle-floor" />
              <div className="enemy-line">
                {state.battle.map((enemy) => (
                  <div className="enemy-card" key={`${enemy.id}-${enemy.name}`}>
                    <BattleSprite enemy={enemy} />
                    <strong>{enemy.name}</strong>
                    <span>HP {enemy.hp}/{enemy.maxHp}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="classic-hud-row">
              <div className="classic-menu battle-menu pixel-panel">
                <button onClick={attack}>Attack</button>
                <button onClick={castSpark}>Magic</button>
                <button onClick={throwEmberSeed}>Items</button>
                <button onClick={defend}>Defend</button>
                <button onClick={runAway}>Run</button>
              </div>
              {state.heroes.map((hero) => (
                <HeroCard hero={hero} key={hero.id} />
              ))}
            </div>
            <GameLog log={state.log} />
          </div>
        )}

        {state.screen === "victory" && (
          <div className="title-screen pixel-panel">
            <div className="moon-logo">♫</div>
            <h2>The bell rings clear!</h2>
            <p>
              The Lantern Knight kneels, the stolen bell returns to Moonveil, and
              the old gate grows quiet again. You completed the mini quest.
            </p>
            <div className="menu-grid">
              <button onClick={() => setState((current) => ({ ...current, screen: "town" }))}>
                Return to Village
              </button>
              <button onClick={newGame}>Play Again</button>
            </div>
          </div>
        )}

        {state.screen === "gameover" && (
          <div className="title-screen pixel-panel">
            <div className="moon-logo">✕</div>
            <h2>The party retreats</h2>
            <p>The dungeon wins this round. Restock in town and try the gate again.</p>
            <div className="menu-grid">
              <button onClick={() => setState((current) => ({
                ...current,
                screen: "town",
                heroes: healParty(current.heroes, true),
                battle: null,
              }))}>
                Wake at the Inn
              </button>
              <button onClick={newGame}>New Quest</button>
            </div>
          </div>
        )}
      </section>

      <style>{`
        :root {
          color-scheme: dark;
        }

        .retro-game-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at 50% -12%, rgba(68, 90, 211, 0.34), transparent 34rem),
            linear-gradient(180deg, #080b22 0%, #02030c 100%);
          color: #f7f1c5;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 16px;
          font-family: "Trebuchet MS", "Lucida Console", monospace;
        }

        .game-cabinet {
          width: min(1024px, 100%);
          min-height: min(760px, calc(100vh - 32px));
          border: 4px solid #f6d05f;
          border-radius: 8px;
          background: #080b22;
          box-shadow:
            0 18px 60px rgba(0, 0, 0, 0.62),
            inset 0 0 0 3px #121a55,
            inset 0 0 0 7px #1f64b9;
          overflow: hidden;
          position: relative;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          background: linear-gradient(180deg, #182773, #0c1442);
          border-bottom: 4px solid #f6d05f;
          padding: 12px 18px;
        }

        .eyebrow {
          color: #74e3ff;
          font-size: 12px;
          letter-spacing: 0.18em;
          margin: 0 0 4px;
          text-transform: uppercase;
        }

        h1, h2, h3, p {
          margin-top: 0;
        }

        h1 {
          color: #fff4a8;
          font-size: clamp(26px, 4vw, 42px);
          line-height: 0.95;
          margin: 0;
          text-shadow: 3px 3px 0 #15133e;
        }

        h2 {
          color: #fff0a3;
          font-size: clamp(28px, 4vw, 44px);
          margin-bottom: 14px;
          text-shadow: 3px 3px 0 #53266d;
        }

        h3 {
          color: #74e3ff;
          font-size: 18px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        button {
          background: linear-gradient(180deg, #2366c8 0%, #143e91 52%, #0e2870 100%);
          color: #fff7cf;
          border: 3px solid #89d8ff;
          border-radius: 5px;
          box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.24), 0 3px 0 #051646;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
          padding: 12px 14px;
          text-align: left;
          transition: transform 120ms ease, filter 120ms ease;
        }

        button:hover {
          filter: brightness(1.18);
          transform: translateY(-1px);
        }

        button:active {
          transform: translateY(2px);
          box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.22), 0 2px 0 #07173e;
        }

        .gold-box,
        .pixel-panel,
        .message-window,
        .hero-panel,
        .mini-map {
          border: 3px solid #f6d05f;
          background: linear-gradient(180deg, #183d9f, #0d236f);
          box-shadow:
            inset 0 0 0 3px #74ceff,
            inset 0 0 0 7px rgba(4, 13, 48, 0.34),
            0 5px 0 rgba(0, 0, 0, 0.24);
          border-radius: 7px;
        }

        .gold-box {
          color: #fff0a3;
          padding: 12px 16px;
          font-weight: 900;
          white-space: nowrap;
        }

        .title-screen {
          margin: 36px auto;
          max-width: 780px;
          padding: 32px;
          text-align: center;
        }

        .title-screen p {
          color: #cde9ff;
          font-size: 18px;
          line-height: 1.55;
        }

        .moon-logo {
          width: 96px;
          height: 96px;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          color: #fff0a3;
          background: #3e2f88;
          border: 4px solid #97d7ff;
          border-radius: 22px;
          font-size: 62px;
          box-shadow: 0 8px 0 #080b25;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .town-screen {
          padding: 8px;
        }

        .town-art {
          position: relative;
          min-height: 310px;
          overflow: hidden;
          border: 4px solid #06113b;
          box-shadow: inset 0 0 0 4px #ffffff, inset 0 0 0 8px #183d9f;
          background: #5b351f;
        }

        .shop-scene,
        .shop-art {
          width: 100%;
          height: 100%;
          min-height: 310px;
          display: block;
        }

        .shopkeeper-art {
          animation: shopkeeper-bob 2.4s ease-in-out infinite;
          transform-origin: 480px 170px;
        }

        .lamp-art {
          animation: lantern-sway 2.8s ease-in-out infinite;
          transform-origin: 282px 0;
        }

        .town-gold {
          position: absolute;
          right: 18px;
          top: 18px;
          min-width: 170px;
          text-align: center;
        }

        .shopkeeper {
          width: 120px;
          height: 120px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #ffcf5a, #e06a5f);
          color: #222047;
          border: 5px solid #fff0a3;
          border-radius: 24px;
          font-size: 78px;
          flex: 0 0 auto;
        }

        .town-art p,
        .inventory-panel p,
        .message-window p {
          color: #cde9ff;
        }

        .town-columns {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        .town-command-panel {
          display: grid;
          gap: 8px;
          align-content: start;
          padding: 14px;
        }

        .shop-list-panel {
          display: grid;
          gap: 8px;
          padding: 14px;
        }

        .town-columns .pixel-panel,
        .inventory-panel {
          padding: 12px;
        }

        .inventory-panel h3 {
          margin-bottom: 8px;
        }

        .inventory-panel p {
          margin-bottom: 6px;
          font-size: 13px;
        }

        .shop-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          width: 100%;
          margin-bottom: 0;
          min-height: 64px;
        }

        .shop-row > span {
          flex: 1;
        }

        .item-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          image-rendering: pixelated;
          filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.35));
        }

        .shop-row small {
          display: block;
          color: #cde9ff;
          font-size: 12px;
          font-weight: 500;
          margin-top: 4px;
        }

        .play-layout,
        .battle-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 10px;
          padding: 8px;
        }

        .dungeon-window,
        .battle-stage {
          min-height: 438px;
          border: 4px solid #05091c;
          background: #10143c;
          overflow: hidden;
          position: relative;
          box-shadow:
            inset 0 0 0 4px #69ccff,
            inset 0 0 0 8px #112161;
          image-rendering: pixelated;
        }

        .dungeon-window {
          perspective: 620px;
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 42%, rgba(116, 206, 255, 0.16), transparent 17rem),
            linear-gradient(180deg, #1c2d55 0%, #1b273d 50%, #1f232c 100%);
        }

        .art-window {
          background: #182435;
        }

        .scene-art {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          image-rendering: pixelated;
        }

        .screen-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, transparent 0 54%, rgba(0, 0, 0, 0.22) 85%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 20%, rgba(0, 0, 0, 0.2));
          mix-blend-mode: multiply;
        }

        .door-art,
        .treasure-art,
        .stairs-art,
        .fountain-art {
          filter: drop-shadow(0 12px 0 rgba(0, 0, 0, 0.26));
        }

        .ceiling,
        .floor {
          position: absolute;
          left: 0;
          width: 100%;
          height: 50%;
        }

        .ceiling {
          top: 0;
          background:
            linear-gradient(#1b2637 4px, transparent 4px),
            linear-gradient(90deg, #1b2637 4px, transparent 4px),
            linear-gradient(180deg, #405169, #29384f);
          background-size: 100% 46px, 70px 100%, auto;
          clip-path: polygon(0 0, 100% 0, 72% 35%, 28% 35%);
        }

        .floor {
          bottom: 0;
          background:
            linear-gradient(#2b302c 4px, transparent 4px),
            linear-gradient(90deg, #2b302c 4px, transparent 4px),
            linear-gradient(180deg, #596052, #34382f);
          background-size: 100% 50px, 78px 100%, auto;
          clip-path: polygon(28% 0, 72% 0, 100% 100%, 0 100%);
        }

        .side-wall {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 43%;
          background:
            linear-gradient(90deg, rgba(5, 9, 28, 0.44), transparent 55%, rgba(255, 255, 255, 0.1)),
            linear-gradient(#172234 4px, transparent 4px),
            linear-gradient(90deg, #172234 4px, transparent 4px),
            linear-gradient(180deg, #566a82, #34475e);
          background-size: auto, 100% 58px, 82px 100%, auto;
          opacity: 1;
        }

        .side-wall.left {
          left: 0;
          clip-path: polygon(0 0, 82% 24%, 82% 76%, 0 100%);
        }

        .side-wall.right {
          right: 0;
          transform: scaleX(-1);
          clip-path: polygon(18% 24%, 100% 0, 100% 100%, 18% 76%);
        }

        .side-wall:not(.blocked) {
          opacity: 0.52;
          filter: brightness(0.74);
        }

        .far-wall {
          position: absolute;
          inset: 18% 30% 22%;
          display: grid;
          place-items: center;
          background:
            linear-gradient(#182234 4px, transparent 4px),
            linear-gradient(90deg, #182234 4px, transparent 4px),
            linear-gradient(180deg, #60748b, #364a62);
          background-size: 100% 58px, 82px 100%, auto;
          border: 5px solid #111824;
          box-shadow:
            inset 0 0 0 5px rgba(213, 224, 226, 0.25),
            0 14px 0 rgba(0, 0, 0, 0.26);
        }

        .far-wall:not(.blocked) {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
        }

        .brick-grid {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, transparent 0 48%, rgba(255,255,255,0.08) 48% 52%, transparent 52%),
            radial-gradient(circle at 50% 50%, rgba(5, 9, 28, 0.08), transparent 55%);
          opacity: 0.8;
        }

        .hall-mouth {
          width: 56%;
          height: 112%;
          background:
            radial-gradient(circle at 50% 70%, rgba(116, 206, 255, 0.16), transparent 46%),
            linear-gradient(180deg, #070a22, #121a52);
          border-left: 8px solid #6b7cdb;
          border-right: 8px solid #6b7cdb;
          box-shadow: inset 0 0 0 5px #06091c;
        }

        .distant-door {
          position: absolute;
          width: 74px;
          height: 94px;
          display: grid;
          place-items: center;
          color: #ffe184;
          background: linear-gradient(90deg, #8a4d28 0 15%, #c77b39 15% 85%, #8a4d28 85%);
          border: 5px solid #ffe184;
          border-radius: 40px 40px 8px 8px;
          font-size: 0;
        }

        .distant-door::after {
          content: "";
          width: 10px;
          height: 10px;
          margin-left: 34px;
          background: #fff0a3;
          border-radius: 50%;
        }

        .wood-door {
          position: relative;
          width: min(154px, 38%);
          height: 62%;
          align-self: end;
          margin-bottom: -2px;
          background:
            linear-gradient(90deg, transparent 0 20%, rgba(66, 34, 16, 0.45) 20% 23%, transparent 23% 47%, rgba(66, 34, 16, 0.45) 47% 50%, transparent 50% 74%, rgba(66, 34, 16, 0.45) 74% 77%, transparent 77%),
            linear-gradient(180deg, #8a4d28 0 48%, #2a2530 48% 56%, #8a4d28 56% 100%);
          border: 7px solid #222a32;
          border-radius: 72px 72px 8px 8px;
          box-shadow:
            0 0 0 12px #697681,
            0 0 0 18px #263240,
            inset 0 0 0 3px #c1864b;
          z-index: 4;
        }

        .door-ring {
          position: absolute;
          right: 24px;
          top: 52%;
          width: 24px;
          height: 24px;
          border: 5px solid #1e2530;
          border-radius: 50%;
          box-shadow: 0 0 0 3px #74818d;
        }

        .wall-torch {
          position: absolute;
          right: 17%;
          top: 28%;
          width: 54px;
          height: 118px;
          z-index: 6;
          filter: drop-shadow(0 0 18px #ffbd55);
        }

        .flame {
          position: absolute;
          left: 50%;
          top: 0;
          width: 34px;
          height: 54px;
          transform: translateX(-50%);
          background:
            radial-gradient(circle at 50% 62%, #fff6a3 0 18%, transparent 19%),
            radial-gradient(circle at 50% 58%, #ffda55 0 35%, transparent 36%),
            linear-gradient(180deg, #ff4d25, #ff9f2e);
          clip-path: polygon(50% 0, 70% 30%, 92% 58%, 72% 100%, 28% 100%, 8% 58%, 31% 31%);
        }

        .sconce {
          position: absolute;
          left: 50%;
          top: 48px;
          width: 16px;
          height: 54px;
          transform: translateX(-50%);
          background: linear-gradient(180deg, #776a55, #241d1a);
          border: 3px solid #14131a;
        }

        .torch {
          position: absolute;
          top: 26%;
          z-index: 2;
          font-size: 34px;
          filter: drop-shadow(0 0 10px #ffcf5a) drop-shadow(0 0 18px #f06536);
        }

        .torch-left {
          left: 28px;
        }

        .torch-right {
          right: 28px;
        }

        .chest-sprite,
        .stairs-sprite,
        .fountain-sprite {
          position: absolute;
          left: 50%;
          bottom: 15%;
          transform: translateX(-50%);
          z-index: 5;
          display: grid;
          place-items: center;
          width: 104px;
          height: 76px;
          border: 5px solid #fff0a3;
          border-radius: 8px;
          font-size: 0;
          color: #5b2e21;
          background:
            linear-gradient(90deg, transparent 44%, #7b421d 44% 56%, transparent 56%),
            linear-gradient(180deg, #ffdf65 0 45%, #b96b2e 45% 100%);
          box-shadow: 0 10px 0 rgba(0, 0, 0, 0.24);
        }

        .stairs-sprite {
          width: 120px;
          height: 78px;
          background:
            linear-gradient(180deg, transparent 0 22%, #cde9ff 22% 34%, transparent 34% 45%, #91b7ff 45% 58%, transparent 58% 68%, #536dd6 68% 84%, transparent 84%),
            #17215f;
        }

        .fountain-sprite {
          width: 104px;
          height: 104px;
          border-radius: 50% 50% 12px 12px;
          background:
            radial-gradient(circle at 50% 28%, #e7fbff 0 14%, #74e3ff 15% 34%, transparent 35%),
            linear-gradient(180deg, #74e3ff, #4a76db);
        }

        .place-label {
          display: none;
        }

        .side-stack {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(190px, 0.7fr) auto;
          gap: 12px;
          align-items: stretch;
        }

        .hero-panel {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding: 10px;
        }

        .hero-row {
          display: grid;
          gap: 6px;
          padding: 8px;
          min-height: 76px;
          border: 2px solid rgba(116, 206, 255, 0.28);
          background: rgba(4, 13, 48, 0.2);
        }

        .hero-row:last-child {
          border-bottom: 2px solid rgba(116, 206, 255, 0.28);
        }

        .hero-row strong,
        .hero-row span {
          display: block;
        }

        .hero-row strong {
          color: #fff0a3;
          font-size: 16px;
        }

        .hero-row span,
        .bars {
          color: #cde9ff;
          font-size: 12px;
        }

        .bars {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }

        .mini-map {
          display: grid;
          grid-template-columns: repeat(4, 28px);
          gap: 4px;
          justify-content: center;
          align-content: center;
          padding: 10px;
        }

        .map-cell {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          background: #080b25;
          border: 2px solid #26306f;
          color: transparent;
          font-weight: 900;
        }

        .map-cell.seen {
          background: #253083;
          border-color: #5fb8ff;
          color: #97d7ff;
        }

        .map-cell.here {
          background: #ffcf5a;
          color: #14133a;
          border-color: #fff6cf;
        }

        .classic-hud-row {
          display: grid;
          grid-template-columns: 170px repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .classic-menu {
          display: grid;
          align-content: center;
          gap: 0;
          padding: 10px 12px;
        }

        .classic-menu button {
          position: relative;
          background: transparent;
          border: 0;
          box-shadow: none;
          border-radius: 0;
          color: #fff;
          font-size: clamp(18px, 2.2vw, 25px);
          line-height: 1.05;
          padding: 2px 4px 2px 24px;
          text-shadow: 3px 3px 0 #06113b;
        }

        .classic-menu button:first-child::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 8px;
          border-top: 10px solid transparent;
          border-bottom: 10px solid transparent;
          border-left: 14px solid #fff;
          filter: drop-shadow(2px 2px 0 #06113b);
        }

        .classic-menu button:hover {
          transform: none;
          filter: brightness(1.2);
          color: #fff4a8;
        }

        .classic-hero-card {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          min-height: 132px;
          padding: 10px;
          border: 3px solid #f6d05f;
          border-radius: 7px;
          background: linear-gradient(180deg, #183d9f, #0d236f);
          box-shadow:
            inset 0 0 0 3px #74ceff,
            inset 0 0 0 7px rgba(4, 13, 48, 0.34);
        }

        .hero-portrait {
          display: block;
          width: 88px;
          height: 88px;
          border: 4px solid #07133d;
          box-shadow: 0 0 0 2px #74ceff;
          image-rendering: pixelated;
        }

        .classic-hero-info {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .classic-hero-info strong {
          color: #fff;
          font-size: clamp(22px, 2.8vw, 28px);
          line-height: 1;
          text-shadow: 3px 3px 0 #06113b;
        }

        .classic-hero-info span {
          color: #f7f1c5;
          font-size: 17px;
          font-weight: 900;
          line-height: 1;
          text-shadow: 2px 2px 0 #06113b;
        }

        .stat-bar {
          height: 12px;
          background: #07133d;
          border: 2px solid #07133d;
          box-shadow: 0 0 0 1px #74ceff;
        }

        .stat-bar i {
          display: block;
          height: 100%;
        }

        .hp-bar i {
          background: linear-gradient(90deg, #63e965, #b7ff62);
        }

        .mp-bar i {
          background: linear-gradient(90deg, #4ed8ff, #9af0ff);
        }

        .classic-sub-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        .classic-sub-row .inventory-panel {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 44px;
        }

        .classic-sub-row .inventory-panel strong,
        .classic-sub-row .inventory-panel span {
          color: #f7f1c5;
          font-size: 14px;
          font-weight: 900;
          margin: 0;
        }

        .command-window {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          padding: 10px;
        }

        .message-window {
          grid-column: 1 / -1;
          min-height: 78px;
          padding: 14px 18px;
        }

        .message-window p {
          margin: 0 0 6px;
          color: #fff;
          font-size: clamp(18px, 2.4vw, 27px);
          font-weight: 900;
          line-height: 1.12;
          text-shadow: 3px 3px 0 #06113b;
        }

        .message-window p:not(:first-child) {
          display: none;
        }

        .modal-panel {
          position: absolute;
          inset: auto 50% 58px auto;
          transform: translateX(50%);
          width: min(520px, calc(100% - 40px));
          z-index: 30;
          padding: 24px;
          text-align: center;
        }

        .battle-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .battle-stage {
          min-height: 430px;
          background:
            radial-gradient(circle at 50% 58%, rgba(255, 238, 136, 0.22), transparent 17rem),
            linear-gradient(#303d4c 4px, transparent 4px),
            linear-gradient(90deg, #303d4c 4px, transparent 4px),
            linear-gradient(180deg, #647487 0%, #3d4f62 48%, #222b38 100%);
          background-size: auto, 100% 50px, 76px 100%, auto;
        }

        .battle-floor {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 42%;
          background:
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0 3px, transparent 3px 72px),
            repeating-linear-gradient(0deg, #626553 0 34px, #4a4d40 34px 68px);
          clip-path: polygon(18% 0, 82% 0, 100% 100%, 0 100%);
        }

        .enemy-line {
          position: relative;
          z-index: 3;
          min-height: 330px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(20px, 5vw, 70px);
          flex-wrap: wrap;
        }

        .enemy-card {
          display: grid;
          gap: 8px;
          justify-items: center;
          color: #fff0a3;
          text-align: center;
        }

        .enemy-card span {
          color: #cde9ff;
          font-weight: 900;
        }

        .enemy-sprite {
          width: 178px;
          height: 154px;
          display: grid;
          place-items: center;
          color: var(--enemy);
          filter: saturate(1.2) drop-shadow(0 14px 0 rgba(0, 0, 0, 0.28));
          animation: enemy-idle 1.8s ease-in-out infinite;
        }

        .enemy-sprite svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .boss-enemy {
          width: 210px;
          height: 178px;
        }

        .enemy-card strong {
          color: #fff;
          font-size: 18px;
          text-shadow: 2px 2px 0 #06113b;
        }

        .enemy-card span {
          text-shadow: 2px 2px 0 #06113b;
        }

        .fx-hit .enemy-sprite {
          animation: enemy-hit 220ms ease-out;
        }

        .fx-magic .battle-stage::after,
        .fx-heal .game-cabinet::after,
        .fx-coin .game-cabinet::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          animation: screen-flash 260ms ease-out;
        }

        .fx-magic .battle-stage::after {
          background: radial-gradient(circle, rgba(131, 221, 255, 0.45), transparent 58%);
        }

        .fx-heal .game-cabinet::after {
          background: radial-gradient(circle, rgba(125, 255, 125, 0.28), transparent 56%);
        }

        .fx-coin .game-cabinet::after {
          background: radial-gradient(circle, rgba(255, 231, 113, 0.3), transparent 56%);
        }

        .battle-layout .hero-panel {
          width: min(760px, 100%);
          margin: 0 auto;
        }

        .battle-menu {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .fx-step .dungeon-window {
          animation: step-bob 180ms ease-out;
        }

        .fx-turn .dungeon-window {
          animation: turn-bob 180ms ease-out;
        }

        .fx-danger .game-cabinet {
          animation: danger-shake 220ms ease-out;
        }

        .fx-win .game-cabinet {
          animation: win-pop 360ms ease-out;
        }

        .wall-torch,
        .torch-art,
        .torch-flame,
        .torch-flame-core {
          animation: torch-flicker 800ms steps(2, end) infinite;
          transform-origin: center;
        }

        @keyframes step-bob {
          0% { transform: translateY(0) scale(1); }
          45% { transform: translateY(8px) scale(1.012); }
          100% { transform: translateY(0) scale(1); }
        }

        @keyframes turn-bob {
          0% { transform: translateX(0); }
          45% { transform: translateX(9px); }
          100% { transform: translateX(0); }
        }

        @keyframes danger-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }

        @keyframes win-pop {
          0% { transform: scale(1); filter: brightness(1); }
          45% { transform: scale(1.018); filter: brightness(1.35); }
          100% { transform: scale(1); filter: brightness(1); }
        }

        @keyframes screen-flash {
          0% { opacity: 0; }
          35% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes enemy-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes enemy-hit {
          0%, 100% { transform: translateX(0); filter: brightness(1); }
          30% { transform: translateX(-12px); filter: brightness(1.8); }
          60% { transform: translateX(10px); }
        }

        @keyframes torch-flicker {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.06, 0.95); filter: brightness(1.22); }
        }

        @keyframes shopkeeper-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes lantern-sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }

        @media (max-width: 880px) {
          .game-cabinet {
            min-height: auto;
          }

          .play-layout {
            grid-template-columns: 1fr;
          }

          .side-stack {
            grid-template-columns: 1fr;
          }

          .hero-panel {
            grid-template-columns: 1fr;
          }

          .town-columns {
            grid-template-columns: 1fr;
          }

          .command-window,
          .battle-menu {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .town-art {
            align-items: flex-start;
            flex-direction: column;
          }

          .dungeon-window {
            min-height: 330px;
          }
        }

        @media (max-width: 560px) {
          .retro-game-shell {
            padding: 8px;
          }

          .game-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .command-window,
          .battle-menu,
          .menu-grid {
            grid-template-columns: 1fr;
          }

          .bars {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
