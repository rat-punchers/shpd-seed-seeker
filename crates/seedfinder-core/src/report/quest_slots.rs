//! The `questRewardSlots` section: each quest's reward options in option
//! order, with the classes a deck drift can put in each slot.

use super::drift::{self, Draw};
use super::imp_slots;
use super::quest::{Quest, RewardSlot};
use crate::catalog::{ArmorEffect, Effect, ItemId, WeaponEffect, item};
use crate::quests::{BlacksmithQuest, GhostQuest, QuestState, WandmakerQuest};
use crate::run::{GeneratorState, RunState};
use crate::seed::DungeonSeed;

/// Fills `slots` (and the Imp's totals) of every listed quest.
pub(super) fn fill(quests: &mut [Quest], state: &QuestState, seed: DungeonSeed) {
    // Decks replay from the generator as `Dungeon.init()` leaves it.
    let dungeon_seed = i64::try_from(seed.value()).expect("seed fits i64");
    let initial = &RunState::new(dungeon_seed).generator;
    for quest in quests {
        quest.slots = Some(match quest.quest.as_str() {
            "ghost" => ghost(&state.ghost, initial),
            "wandmaker" => wandmaker(&state.wandmaker, initial),
            "blacksmith" => blacksmith(&state.blacksmith),
            _ => {
                let imp = imp_slots::slots(&state.imp, initial);
                quest.upgrades_pinned = Some(imp.upgrades_pinned);
                quest.total_upgrade_value = Some(imp.total_upgrade_value);
                imp.slots
            }
        });
    }
}

/// A slot whose class and level no drift can change.
pub(super) fn fixed(slot: u8, id: ItemId, level: u8, role: &str) -> RewardSlot {
    RewardSlot {
        slot,
        item: item(id).stable_id.to_owned(),
        level,
        level_pinned: true,
        role: Some(role.to_owned()),
        level_rule: None,
        effect: None,
        candidates: None,
        scenario_count: 1,
    }
}

/// Sets the slot's candidates from its window.
pub(super) fn with_window(mut slot: RewardSlot, draws: &[Draw]) -> RewardSlot {
    let (candidates, scenarios) = drift::candidates(draws);
    slot.candidates = Some(candidates);
    slot.scenario_count = scenarios;
    slot
}

pub(super) fn weapon_effect(effect: Option<WeaponEffect>) -> Option<String> {
    effect.map(|effect| Effect::Weapon(effect).wire_name().to_owned())
}

pub(super) fn armor_effect(effect: Option<ArmorEffect>) -> Option<String> {
    effect.map(|effect| Effect::Armor(effect).wire_name().to_owned())
}

/// The weapon drifts within its tier deck; the armor is drawn by the floor's
/// own RNG. Both levels are one roll after the draws.
fn ghost(quest: &GhostQuest, initial: &GeneratorState) -> Vec<RewardSlot> {
    let (Some(weapon), Some(armor)) = (quest.weapon, quest.armor) else {
        return Vec::new();
    };
    let mut first = fixed(0, weapon.item, weapon.roll.upgrade, "weapon");
    first.effect = weapon_effect(quest.enchantment);
    if let Some(draw) = quest.weapon_draw {
        first = with_window(first, &drift::single(initial, draw));
    }
    let mut second = fixed(1, armor.item, armor.roll.upgrade, "armor");
    second.effect = armor_effect(quest.glyph);
    vec![first, second]
}

/// Wand 1 drifts in the wand deck; wand 2 is the next card of another class.
/// Every skipped duplicate burns floor RNG, so wand 2's level is pinned only
/// when every offset skips as many duplicates as the seed draw.
fn wandmaker(quest: &WandmakerQuest, initial: &GeneratorState) -> Vec<RewardSlot> {
    let (Some(wand1), Some(wand2), Some(draw)) = (quest.wand1, quest.wand2, quest.wand1_draw)
    else {
        return Vec::new();
    };
    let (first, second) = drift::pairs(initial, draw);
    let mut slots = [(0, wand1, &first), (1, wand2, &second)].map(|(slot, wand, draws)| {
        let mut slot = with_window(fixed(slot, wand.item, wand.roll.upgrade, "wand"), draws);
        slot.role = None;
        slot
    });
    slots[1].level_pinned = drift::rejects_pinned(&second);
    slots.into()
}

/// The Blacksmith draws its rewards with `useDefaults`, from the floor's own
/// RNG, so no deck drift reaches them.
fn blacksmith(quest: &BlacksmithQuest) -> Vec<RewardSlot> {
    let Some(rewards) = quest.rewards else {
        return Vec::new();
    };
    let mut slots = Vec::with_capacity(4);
    for (slot, weapon) in (0..).zip(rewards.weapons) {
        let mut entry = fixed(slot, weapon.item, weapon.roll.upgrade, "weapon");
        entry.effect = weapon_effect(quest.enchantment);
        slots.push(entry);
    }
    if let Some(missile) = rewards.missile.kind.item_id() {
        let mut entry = fixed(2, missile, rewards.missile.roll.upgrade, "missile");
        entry.effect = weapon_effect(quest.enchantment);
        slots.push(entry);
    }
    let mut armor = fixed(3, rewards.armor.item, rewards.armor.roll.upgrade, "armor");
    armor.effect = armor_effect(quest.glyph);
    slots.push(armor);
    slots
}
