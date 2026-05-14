import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Direction = 0 | 1 | 2 | 3;
type HeroId = "mira" | "oren" | "pip";
type Screen = "title" | "town" | "dungeon" | "battle" | "chest" | "victory" | "gameover";

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
  const leftBlocked = hasWall(state, ((state.dir + 3) % 4) as Direction);
  const rightBlocked = hasWall(state, ((state.dir + 1) % 4) as Direction);
  const cell = currentCell(state);

  return (
    <div className="dungeon-window" aria-label="Dungeon view">
      <div className="ceiling" />
      <div className="floor" />
      <div className={`side-wall left ${leftBlocked ? "blocked" : ""}`} />
      <div className={`side-wall right ${rightBlocked ? "blocked" : ""}`} />
      <div className={`far-wall ${forwardBlocked ? "blocked" : ""}`}>
        {forwardBlocked ? (
          <>
            <div className="brick-grid" />
            <div className="torch torch-left">🔥</div>
            <div className="torch torch-right">🔥</div>
          </>
        ) : (
          <>
            <div className="hall-mouth" />
            <div className="distant-door">▥</div>
          </>
        )}
      </div>
      {cell.event === "chest" && <div className="chest-sprite">▰</div>}
      {cell.event === "stairs" && <div className="stairs-sprite">▟▙</div>}
      {cell.event === "fountain" && <div className="fountain-sprite">♒</div>}
      <div className="place-label">
        F{state.floor + 1} · {cell.label ?? "Passage"} · Facing {DIR_LABELS[state.dir]}
      </div>
    </div>
  );
}

function BattleSprite({ enemy }: { enemy: Enemy }) {
  if (enemy.sprite === "bat") {
    return (
      <div className="enemy-sprite bat" style={{ "--enemy": enemy.color } as CSSProperties}>
        <span>▲</span>
        <b>◆</b>
        <span>▲</span>
      </div>
    );
  }

  if (enemy.sprite === "imp") {
    return (
      <div className="enemy-sprite imp" style={{ "--enemy": enemy.color } as CSSProperties}>
        <span>▲</span>
        <b>☻</b>
        <span>▲</span>
      </div>
    );
  }

  if (enemy.sprite === "knight") {
    return (
      <div className="enemy-sprite knight" style={{ "--enemy": enemy.color } as CSSProperties}>
        <span>◈</span>
        <b>♜</b>
        <small>Lantern Knight</small>
      </div>
    );
  }

  return (
    <div className="enemy-sprite slime" style={{ "--enemy": enemy.color } as CSSProperties}>
      <b>●</b>
      <small>● ●</small>
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

function GameLog({ log }: { log: string[] }) {
  return (
    <div className="message-window" aria-live="polite">
      {log.map((entry, index) => (
        <p key={`${entry}-${index}`}>{entry}</p>
      ))}
    </div>
  );
}

export default function RetroDungeonGame() {
  const saved = useSavedGame();
  const [state, setState] = useState<GameState>(saved);

  const livingHeroes = useMemo(() => aliveHeroes(state.heroes), [state.heroes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // Saving is a convenience feature; private browsing may block it.
    }
  }, [state]);

  function startGame() {
    setState((current) => ({
      ...current,
      screen: "town",
      log: ["Welcome to Moonveil. The gate below the bell tower is open.", ...current.log].slice(0, 7),
    }));
  }

  function newGame() {
    setState({ ...createInitialState(), screen: "town" });
  }

  function resetGame() {
    window.localStorage.removeItem(SAVE_KEY);
    setState(createInitialState());
  }

  function restAtInn() {
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
    setState((current) => ({
      ...current,
      screen: "dungeon",
      log: ["The old gate shuts behind you.", ...current.log].slice(0, 7),
    }));
  }

  function turn(amount: -1 | 1) {
    setState((current) => ({
      ...current,
      dir: ((current.dir + amount + 4) % 4) as Direction,
      log: [`You turn ${amount > 0 ? "right" : "left"}.`, ...current.log].slice(0, 7),
    }));
  }

  function moveForward() {
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

  function runAway() {
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
    <main className="retro-game-shell">
      <section className="game-cabinet">
        <div className="game-header">
          <div>
            <p className="eyebrow">A tiny original dungeon quest</p>
            <h1>Moonveil Gate</h1>
          </div>
          <div className="gold-box">Gold {state.gold}</div>
        </div>

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
            <div className="town-art pixel-panel">
              <div className="shopkeeper">☺</div>
              <div>
                <h2>Moonveil Village</h2>
                <p>
                  Mira, Oren, and Pip stand before the old gate. Mira the shopkeeper
                  has packed the last supplies by candlelight.
                </p>
              </div>
            </div>
            <div className="town-columns">
              <div className="pixel-panel">
                <h3>Village Menu</h3>
                <div className="menu-grid">
                  <button onClick={enterDungeon}>Enter Gate</button>
                  <button onClick={restAtInn}>Rest at Inn · 6g</button>
                  <button onClick={useMoonDrop}>Use Moon Drop</button>
                  <button onClick={resetGame}>Reset Save</button>
                </div>
              </div>
              <div className="pixel-panel">
                <h3>Supply Counter</h3>
                {ITEMS.map((item) => (
                  <button className="shop-row" key={item.id} onClick={() => buyItem(item)}>
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
          <div className="play-layout">
            <DungeonView state={state} />
            <div className="side-stack">
              <HeroPanel heroes={state.heroes} />
              <div className="pixel-panel inventory-panel">
                <h3>Pack</h3>
                <p>Moon Drops: {state.inventory.moonDrops}</p>
                <p>Ember Seeds: {state.inventory.emberSeeds}</p>
                <p>Lantern Oil: {state.inventory.lanternOil}</p>
              </div>
              <MiniMap state={state} />
            </div>
            <div className="command-window pixel-panel">
              <button onClick={() => turn(-1)}>Turn Left</button>
              <button onClick={moveForward}>Forward</button>
              <button onClick={() => turn(1)}>Turn Right</button>
              <button onClick={useMoonDrop}>Moon Drop</button>
              <button onClick={useLanternOil}>Lantern Oil</button>
              <button onClick={descendStairs}>Stairs</button>
              <button onClick={() => setState((current) => ({ ...current, screen: "town" }))}>
                Return Town
              </button>
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
          <div className="battle-layout">
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
            <HeroPanel heroes={state.heroes} />
            <div className="command-window battle-menu pixel-panel">
              <button onClick={attack}>1 Fight</button>
              <button onClick={castSpark}>2 Magic · Spark</button>
              <button onClick={throwEmberSeed}>3 Item · Ember</button>
              <button onClick={runAway}>4 Run</button>
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
            radial-gradient(circle at 15% 10%, rgba(92, 72, 186, 0.32), transparent 28rem),
            radial-gradient(circle at 85% 0%, rgba(39, 158, 216, 0.22), transparent 22rem),
            linear-gradient(180deg, #11112d 0%, #060711 100%);
          color: #fff6cf;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          font-family: "Trebuchet MS", "Lucida Console", monospace;
        }

        .game-cabinet {
          width: min(1180px, 100%);
          min-height: min(760px, calc(100vh - 44px));
          border: 6px solid #f0bd4e;
          border-radius: 18px;
          background: #151540;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55), inset 0 0 0 4px #533a93;
          overflow: hidden;
          position: relative;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          background: linear-gradient(180deg, #28206b, #14133a);
          border-bottom: 4px solid #f0bd4e;
          padding: 18px 22px;
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
          color: #fff0a3;
          font-size: clamp(30px, 5vw, 52px);
          line-height: 0.95;
          margin: 0;
          text-shadow: 4px 4px 0 #53266d;
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
          background: linear-gradient(180deg, #2859bd, #173078);
          color: #fff6cf;
          border: 3px solid #97d7ff;
          border-radius: 8px;
          box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.22), 0 4px 0 #07173e;
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
          border: 4px solid #f0bd4e;
          background: linear-gradient(180deg, #17266e, #0d174c);
          box-shadow: inset 0 0 0 3px #5fb8ff, 0 8px 0 rgba(0, 0, 0, 0.18);
          border-radius: 12px;
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
          padding: 22px;
        }

        .town-art {
          display: flex;
          gap: 24px;
          align-items: center;
          padding: 24px;
          min-height: 180px;
          background:
            linear-gradient(90deg, rgba(247, 190, 77, 0.1), transparent),
            linear-gradient(180deg, #202070, #11164a);
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
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 18px;
          margin-top: 18px;
        }

        .town-columns .pixel-panel,
        .inventory-panel {
          padding: 18px;
        }

        .shop-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          width: 100%;
          margin-bottom: 10px;
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
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 18px;
          padding: 20px;
        }

        .dungeon-window,
        .battle-stage {
          min-height: 390px;
          border: 5px solid #070b25;
          background: #10143c;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 0 0 4px #5fb8ff;
        }

        .dungeon-window {
          perspective: 700px;
          isolation: isolate;
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
          background: repeating-linear-gradient(90deg, #293280 0 38px, #20286d 38px 76px);
          clip-path: polygon(0 0, 100% 0, 70% 50%, 30% 50%);
        }

        .floor {
          bottom: 0;
          background: repeating-linear-gradient(90deg, #1b225c 0 42px, #151b4d 42px 84px);
          clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%);
        }

        .side-wall {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 38%;
          background: repeating-linear-gradient(180deg, #2b358a 0 30px, #222b77 30px 60px);
          opacity: 0.92;
        }

        .side-wall.left {
          left: 0;
          clip-path: polygon(0 0, 78% 26%, 78% 74%, 0 100%);
        }

        .side-wall.right {
          right: 0;
          clip-path: polygon(22% 26%, 100% 0, 100% 100%, 22% 74%);
        }

        .side-wall:not(.blocked) {
          opacity: 0.34;
        }

        .far-wall {
          position: absolute;
          inset: 22% 28%;
          display: grid;
          place-items: center;
          background: #303a91;
          border: 5px solid #11164a;
          box-shadow: inset 0 0 0 4px #5564c5;
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
            linear-gradient(#1f2a75 3px, transparent 3px),
            linear-gradient(90deg, #1f2a75 3px, transparent 3px);
          background-size: 56px 36px;
          opacity: 0.72;
        }

        .hall-mouth {
          width: 58%;
          height: 100%;
          background: linear-gradient(180deg, #080b25, #131946);
          border-left: 7px solid #5564c5;
          border-right: 7px solid #5564c5;
        }

        .distant-door {
          position: absolute;
          color: #ffcf5a;
          font-size: 58px;
        }

        .torch {
          position: absolute;
          top: 22%;
          z-index: 2;
          font-size: 30px;
          filter: drop-shadow(0 0 12px #ffcf5a);
        }

        .torch-left {
          left: 18px;
        }

        .torch-right {
          right: 18px;
        }

        .chest-sprite,
        .stairs-sprite,
        .fountain-sprite {
          position: absolute;
          left: 50%;
          bottom: 17%;
          transform: translateX(-50%);
          z-index: 5;
          display: grid;
          place-items: center;
          width: 92px;
          height: 68px;
          border: 4px solid #fff0a3;
          border-radius: 14px;
          font-size: 46px;
          color: #5b2e21;
          background: linear-gradient(180deg, #ffcf5a, #bd6f32);
          box-shadow: 0 10px 0 rgba(0, 0, 0, 0.24);
        }

        .stairs-sprite {
          color: #cde9ff;
          background: linear-gradient(180deg, #5262c2, #232a75);
        }

        .fountain-sprite {
          color: #08233e;
          background: linear-gradient(180deg, #74e3ff, #4a76db);
        }

        .place-label {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 12px;
          z-index: 8;
          color: #fff0a3;
          background: rgba(8, 11, 37, 0.76);
          border: 3px solid #5fb8ff;
          border-radius: 8px;
          padding: 10px 12px;
          font-weight: 900;
        }

        .side-stack {
          display: grid;
          gap: 14px;
        }

        .hero-panel {
          padding: 12px;
        }

        .hero-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 2px solid rgba(151, 215, 255, 0.28);
        }

        .hero-row:last-child {
          border-bottom: 0;
        }

        .hero-row strong,
        .hero-row span {
          display: block;
        }

        .hero-row strong {
          color: #fff0a3;
        }

        .hero-row span,
        .bars {
          color: #cde9ff;
          font-size: 13px;
        }

        .bars {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .mini-map {
          display: grid;
          grid-template-columns: repeat(4, 34px);
          gap: 5px;
          justify-content: center;
          padding: 13px;
        }

        .map-cell {
          width: 34px;
          height: 34px;
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

        .command-window {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
        }

        .message-window {
          grid-column: 1 / -1;
          min-height: 120px;
          padding: 14px 18px;
        }

        .message-window p {
          margin: 0 0 6px;
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
          min-height: 360px;
          background:
            radial-gradient(circle at 50% 62%, rgba(255, 207, 90, 0.16), transparent 18rem),
            linear-gradient(180deg, #14184b, #090c2a);
        }

        .battle-floor {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 42%;
          background: repeating-linear-gradient(90deg, #1d255f 0 50px, #151b4d 50px 100px);
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
          width: 132px;
          height: 132px;
          display: grid;
          place-items: center;
          color: var(--enemy);
          filter: drop-shadow(0 12px 0 rgba(0, 0, 0, 0.22));
          text-shadow: 4px 4px 0 #080b25;
        }

        .enemy-sprite b {
          font-size: 96px;
          line-height: 0.8;
        }

        .enemy-sprite small {
          color: #080b25;
          font-weight: 900;
        }

        .bat,
        .imp {
          grid-template-columns: 1fr auto 1fr;
          gap: 2px;
        }

        .bat span,
        .imp span {
          font-size: 42px;
        }

        .knight {
          color: #ffcf5a;
        }

        .knight small {
          color: #fff0a3;
          text-shadow: none;
        }

        .battle-layout .hero-panel {
          width: min(760px, 100%);
          margin: 0 auto;
        }

        .battle-menu {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        @media (max-width: 880px) {
          .game-cabinet {
            min-height: auto;
          }

          .play-layout {
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
