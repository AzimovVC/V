/**
 * ЕДИНЫЙ КОНФИГ БАЛАНСА.
 * Все числа игры живут здесь. Содержание (тексты, раскладка комнат) — в src/data/*.json.
 * Время — в секундах реальной игры (мир стоит, пока открыто окно выбора/мебели).
 * Расстояния — в «пикселях мира» (комната шириной 520).
 */
export const balance = {
  // ───────── Огонёк (единый ресурс) ─────────
  energy: {
    max: 100,
    start: 70,
    darkDrain: 1.0, // /с — тает вне света (умножается на погоду)
    hiddenDrain: 0.25, // /с — пока прячешься в шкафу/нише
    lampRestRate: 5.0, // /с — отдых у лампы (умножается на предметы)
    respawnEnergy: 22, // с чем возвращаешься к лампе, если огонёк погас
    welcomeBackFloor: 50, // при загрузке сохранения огонёк не ниже (пропущенные дни не наказываются)
    lowThreshold: 25, // ниже — огонёк «мерцает», ходишь медленнее
    lowSpeedMult: 0.8,
    // Малое действие «Подышать»: доступно всегда, даже в плохой день
    breathGain: 3,
    breathTime: 2.5, // с удержания
    breathCooldown: 4, // с до следующего вдоха
  },

  // ───────── Игрок и свет ─────────
  player: {
    speed: 150, // пикс/с
  },
  light: {
    lampRadius: 235, // радиус света лампы в комнате «Я»
    lampRadiusPerRoot: 45, // каждая расчищенная комната делает лампу теплее
    lampRadiusPerTidy: 18, // …и каждая полностью прибранная
    furnaceRadius: 210, // свет печи Котельной после ремонта
    pantryWindowRadius: 150, // тихий свет окна Кладовой
    hearthRadius: 250, // очаг Мастерской
    hearthRadiusCleared: 310, // …после расчистки
    flameMin: 36, // собственный свет «Я» при пустом огоньке
    flameMax: 120, // …при полном
    darkness: 0.84, // 0..1 насколько тёмно вне света (только вид)
  },

  // ───────── Погода = состояние дня ─────────
  weather: {
    // Базовая «тяжесть» (0 тишина … 3 лютая буря) по стадиям: нет корней → корень Котельной → коробка в Кладовой
    baseSeverityByStage: [2.0, 1.1, 0.3],
    debtSeverity: 0.35, // за каждую единицу долга
    shockSeverity: 0.6, // выбитое окно/провал — временная «тряска»
    shockDuration: 90, // с, затухает линейно
    changeRate: 0.08, // как быстро реальная погода тянется к целевой (ед/с)
    // Пороги и эффекты уровней (проверяются по порядку: severity < max)
    levels: [
      { id: 'quiet', max: 0.6, drainMult: 0.8, restMult: 1.1, tenantIntervalMult: 1.5 },
      { id: 'drizzle', max: 1.6, drainMult: 1.15, restMult: 1.0, tenantIntervalMult: 1.0 },
      { id: 'storm', max: 99, drainMult: 1.5, restMult: 0.9, tenantIntervalMult: 0.7 },
    ],
    thunderMin: 9, // с между раскатами (только буря)
    thunderMax: 22,
  },

  // ───────── Труба: «заплатка / настоящий ремонт» (без таймеров) ─────────
  boiler: {
    patchRags: 2, // тряпок за заплатку
    patchRagsPerDebt: 1, // +тряпок за каждую единицу долга (чем больше «затыкал», тем дороже)
    patchDebt: 1, // долг за заплатку (остаётся, пока не починишь по-настоящему)
    leakBase: 1, // уровень течи без заплатки и без долга
    leakMax: 3,
    leakDrain: 0.6, // /с за уровень течи, пока стоишь у лужи
    leakPuddleRadius: 90,
    leakTenantNoise: 0.25, // насколько каждый уровень течи учащает визиты гостей
  },

  // ───────── Воспоминания (ключи-подсказки) ─────────
  memory: {
    notebookCost: 4,
    boxCost: 5,
  },

  // ───────── Материалы, находки, крафт, расчистка ─────────
  // Находки: id точки (fixture) → что в ней лежит. Берётся один раз.
  loot: {
    drawer: { scrap: 2, rag: 2, board: 1 },
    crate: { scrap: 2, pipepart: 1, rag: 1 }, // нужен лом
    shelf: { rag: 2, scrap: 2, board: 1 },
  } as Record<string, Record<string, number>>,
  // Куча хлама: можно рыться снова и снова, каждый раз что-то одно — за огонёк
  scavenge: {
    cost: 4,
    cycle: ['rag', 'scrap', 'scrap', 'board', 'rag', 'scrap'] as string[],
  },
  // Завалы: чем разбирать, сколько стоит огонька и что внутри
  clear: {
    barricade: { cost: 3, yield: { board: 3, scrap: 1 }, opens: 'pantry' },
    debris_a: { cost: 3, yield: { board: 2, scrap: 1 } },
    debris_b: { cost: 3, yield: { rag: 3, scrap: 1 } },
    debris_c: { cost: 3, yield: { scrap: 3, pipepart: 1 } },
  } as Record<string, { cost: number; yield: Record<string, number>; opens?: string }>,
  // Рецепты верстака: что стоят и что дают (kind: tool — инструмент, item — мебель, mat — материал)
  recipes: {
    crowbar: { kind: 'tool', cost: { scrap: 1, board: 1 }, qty: 1 },
    broom: { kind: 'tool', cost: { board: 1, rag: 1 }, qty: 1 },
    wrench: { kind: 'tool', cost: { scrap: 2 }, qty: 1 },
    pipepart: { kind: 'mat', cost: { scrap: 1, rag: 1 }, qty: 1 },
    bolt: { kind: 'item', cost: { board: 2, scrap: 1 }, qty: 1 },
    rug: { kind: 'item', cost: { rag: 4 }, qty: 1 },
    stove: { kind: 'item', cost: { scrap: 4, pipepart: 1 }, qty: 1 },
  } as Record<string, { kind: 'tool' | 'item' | 'mat'; cost: Record<string, number>; qty: number }>,
  startRecipes: ['crowbar', 'wrench', 'broom', 'pipepart'] as string[],
  // Уборка: пыль, беспорядок, перекошенное. Каждое дело — немного огонька; комната «прибрана», когда сделано всё.
  tidy: {
    dust: { cost: 1, tool: 'broom', yield: {} },
    mess: { cost: 1.5, tool: '', yield: { scrap: 1 } },
    fix: { cost: 1.5, tool: '', mats: { scrap: 1 }, yield: {} },
  } as Record<string, { cost: number; tool: string; mats?: Record<string, number>; yield: Record<string, number> }>,
  // Угощение Починщика и награда за расчистку его мастерской
  mender: {
    teaEnergy: 100, // огонёк после чая (до max)
  },

  // ───────── Враждебный жилец (безымянный): стук, шаги, обход ─────────
  tenant: {
    firstVisitDelay: 50, // с до первого визита
    minInterval: 70, // с между визитами (до множителей)
    maxInterval: 110,
    debtIntervalRate: 0.12, // каждая единица долга ускоряет визиты на 12%
    minIntervalFactor: 0.4, // но не быстрее, чем 40% от базы
    stepsTime: 5, // с шагов до первого стука
    knockCount: 3,
    knockInterval: 1.8,
    walkSpeed: 62, // пикс/с внутри дома
    leaveSpeed: 95,
    pauseAtStop: 3.2, // с задерживается в каждой комнате маршрута
    sightRange: 175, // с какого расстояния замечает
    noticeTime: 1.7, // с до «заметил» (шкала видна игроку)
    noticeDecay: 1.5, // как быстро шкала спадает, когда ты вне зоны
    boundaryCost: 8, // огонёк за «отпор»
    afterBoundaryDelayMult: 1.6, // следующий визит позже
    afterCaughtDelay: 60, // с тишины после того, как заметили
    boltRepelsDelayMult: 1.2,
  },

  // ───────── Наказание за провалы (без game over) ─────────
  penalty: {
    energyLossFrac: 0.4, // теряешь долю огонька
    energyFloor: 15, // …но не ниже
    windowCrackMax: 3,
    windowRepair: { board: 1, rag: 1 } as Record<string, number>, // материалы на заделку окна
    restPerCrack: 0.15, // выбитое окно снижает отдых у лампы
    breakItemOnCaught: true, // ломается случайный предмет (чинится материалами)
    tearsPatch: true, // заплатка срывается, если заметили
    fadeTime: 1.6,
  },

  // ───────── Обустройство ─────────
  furnish: {
    slots: { myroom: 3 } as Record<string, number>, // лампа занимает один слот навсегда
  },
  // Эффекты предметов (имена/описания — в items.json)
  items: {
    lamp: { fixed: true, repair: {} },
    chair: { restMult: 0.35, repair: { board: 1 } }, // +к отдыху
    bolt: { blocksEntryOnce: true, extraDelayMult: 1.2, repair: { board: 1, scrap: 1 } }, // дверь не поддаётся, но засов ломается
    rug: { tenantIntervalMult: 1.25, repair: { rag: 2 } }, // тише дом → реже гости
    stove: { darkDrainMult: 0.75, restMult: 0.15, repair: { scrap: 2 } }, // тепло, которое носишь с собой
  } as Record<string, ItemBalance>,

  // ───────── Прочее ─────────
  ui: {
    toastTime: 3.6,
    toastMaxAge: 7, // с — подсказка, пролежавшая в очереди дольше, не показывается
    subtitleTime: 3.4,
    autosaveEvery: 8,
  },
};

export interface ItemBalance {
  fixed?: boolean;
  repair: Record<string, number>; // материалы на починку
  restMult?: number;
  darkDrainMult?: number;
  tenantIntervalMult?: number;
  blocksEntryOnce?: boolean;
  extraDelayMult?: number;
}

export type Balance = typeof balance;
