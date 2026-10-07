import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBattleActiveKnockout,
  canEvolveBattleStack,
  createEmptyBattlePlayer,
  getBattleAttackDamageValue,
  getBattleAttackEnergyStatus,
  getBattlePrizeCountForKnockedOutPokemon,
} from "../features/play-lab/battle-engine";
import {
  getCardPlacementType,
  getStageOrder,
  matchesSearchTarget,
  normalizePokemonNameCore,
} from "../features/play-lab/card-rules";
import { getNoBasicOpeningProbability } from "../features/play-lab/game-setup";
import type { SoloCard } from "../features/play-lab/types";

function card(overrides: Partial<SoloCard> = {}): SoloCard {
  return {
    cardId: overrides.cardId || "test-card",
    cardName: overrides.cardName || "テストカード",
    count: 1,
    ...overrides,
  };
}

test("カード名の接尾辞を除いて進化元を比較できる", () => {
  assert.equal(normalizePokemonNameCore("メガリザードンex"), "リザードン");
  assert.equal(normalizePokemonNameCore("ピカチュウVSTAR"), "ピカチュウ");
});

test("カード種別と進化段階をカードマスター情報から判定する", () => {
  const basic = card({ cardKind: "pokemon", stage: "たね", stageCategory: "basic" });
  const evolution = card({ cardKind: "pokemon", stage: "2進化", stageCategory: "evolution" });

  assert.equal(getCardPlacementType(basic), "pokemon");
  assert.equal(getStageOrder(basic), 0);
  assert.equal(getStageOrder(evolution), 2);
});

test("検索対象は基本ポケモンと基本エネルギーを区別する", () => {
  const basicPokemon = card({ cardKind: "pokemon", stage: "たね", stageCategory: "basic" });
  const basicEnergy = card({ cardName: "基本雷エネルギー", cardKind: "energy", subKind: "基本エネルギー" });

  assert.equal(matchesSearchTarget(basicPokemon, "basic_pokemon"), true);
  assert.equal(matchesSearchTarget(basicPokemon, "basic_energy"), false);
  assert.equal(matchesSearchTarget(basicEnergy, "basic_energy"), true);
});

test("初手にたねポケモンが来ない確率を超幾何分布で計算する", () => {
  assert.equal(getNoBasicOpeningProbability(60, 0), 1);
  assert.equal(getNoBasicOpeningProbability(60, 60), 0);
  assert.ok(Math.abs(getNoBasicOpeningProbability(60, 4) - 0.6005003742) < 0.000001);
});

test("場に出したターンのポケモンは進化できず、次ターンは進化できる", () => {
  const basic = card({ cardName: "ヒトカゲ", cardKind: "pokemon", stage: "たね", stageOrder: 0, playedTurn: 1 });
  const evolution = card({
    cardName: "リザード",
    cardKind: "pokemon",
    stage: "1進化",
    stageOrder: 1,
    evolvesFrom: "ヒトカゲ",
    allowedPreEvolutionNames: ["ヒトカゲ"],
  });

  assert.equal(canEvolveBattleStack([basic], evolution, 1), false);
  assert.equal(canEvolveBattleStack([basic], evolution, 2), true);
});

test("ワザの色指定と無色エネルギー要求を検証する", () => {
  const attack = { cost: ["雷", "無色"] };
  const lightning = card({ cardName: "基本雷エネルギー", cardKind: "energy", subKind: "基本エネルギー" });
  const fire = card({ cardName: "基本炎エネルギー", cardKind: "energy", subKind: "基本エネルギー" });

  assert.equal(getBattleAttackEnergyStatus(attack, [lightning, fire]).usable, true);
  assert.equal(getBattleAttackEnergyStatus(attack, [fire, fire]).usable, false);
});

test("ダメージ計算ときぜつ時のカード移動を処理する", () => {
  const attacker = createEmptyBattlePlayer("player", "自分");
  const defender = createEmptyBattlePlayer("opponent", "相手");
  defender.benchStacks[0] = [card({ cardKind: "pokemon", stage: "たね" })];

  assert.equal(
    getBattleAttackDamageValue({ name: "ベンチ連動", damage: 0, text: "相手のベンチポケモンの数×30ダメージ" }, attacker, defender),
    30,
  );

  const active = card({ cardName: "テストex", cardKind: "pokemon", stage: "たね", hp: 100 });
  const energy = card({ cardName: "基本雷エネルギー", cardKind: "energy" });
  const state = {
    ...defender,
    activeStack: [active],
    attachedEnergies: { ...defender.attachedEnergies, active: [energy] },
  };
  const result = applyBattleActiveKnockout(state, 100);

  assert.equal(result.nextState.activeStack.length, 0);
  assert.equal(result.nextState.discard.length, 2);
  assert.equal(getBattlePrizeCountForKnockedOutPokemon(active), 2);
});
