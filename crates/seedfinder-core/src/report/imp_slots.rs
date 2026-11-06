//! The Imp's six vault reward slots (`Imp.Quest.spawn`).
//!
//! Every class in a deck consumes the same floor RNG in its `random()`, so a
//! drift moves a slot's class but not the levels and effects rolled after it.
//! Two draws break that: an Unstable Spellbook in slot 0 burns a scroll-deck
//! loop in its constructor, and when slot 0 falls back to a ring, slot 1's
//! duplicate rejects each burn a ring roll. Either shifts every later roll.

use super::drift::{self, Draw};
use super::quest::{LevelRule, RewardSlot};
use super::quest_slots::{armor_effect, fixed, weapon_effect, with_window};
use crate::catalog::{Effect, ItemId};
use crate::quests::{DeckDraw, ImpQuest, ImpRewardOption};
use crate::run::GeneratorState;

/// `Artifact.transferUpgrade(5)` on the artifact slot.
const TRANSFER: u8 = 5;

pub(super) struct ImpSlots {
    pub slots: Vec<RewardSlot>,
    pub upgrades_pinned: bool,
    /// Scroll of Upgrade equivalents: the artifact counts its transfer amount.
    pub total_upgrade_value: u32,
}

pub(super) fn slots(quest: &ImpQuest, initial: &GeneratorState) -> ImpSlots {
    let mut walk = Walk {
        initial,
        shifted: false,
        second_ring: None,
    };
    let slots: Vec<RewardSlot> = (0_u8..)
        .zip(quest.reward_options.iter().zip(&quest.reward_draws))
        .filter_map(|(slot, (option, draw))| walk.slot(slot, *option, *draw))
        .collect();
    let total_upgrade_value = slots
        .iter()
        .map(|slot| match slot.level_rule {
            Some(LevelRule::TransferUpgrade { transfer }) => u32::from(transfer),
            _ => u32::from(slot.level),
        })
        .sum();
    ImpSlots {
        slots,
        upgrades_pinned: !walk.shifted,
        total_upgrade_value,
    }
}

/// Slots in draw order, tracking what earlier draws do to the floor RNG.
struct Walk<'a> {
    initial: &'a GeneratorState,
    /// A drift before the current slot moves the RNG its level and effect use.
    shifted: bool,
    /// Slot 1's window when slot 0 fell back to a ring: the next ring of
    /// another class.
    second_ring: Option<Vec<Draw>>,
}

impl Walk<'_> {
    fn slot(
        &mut self,
        slot: u8,
        option: ImpRewardOption,
        draw: Option<DeckDraw>,
    ) -> Option<RewardSlot> {
        let (id, level, role, effect, draws) = match option {
            ImpRewardOption::Artifact(artifact) => {
                return Some(self.artifact(slot, artifact.kind.item_id()?, draw));
            }
            ImpRewardOption::Ring(ring) => {
                let draws = self.ring_window(slot, draw);
                (ring.kind.item_id(), ring.roll.upgrade, "ring", None, draws)
            }
            ImpRewardOption::Equipment(equipment) => {
                let (role, effect) = match equipment.roll.effect {
                    Some(Effect::Armor(glyph)) => ("armor", armor_effect(Some(glyph))),
                    Some(Effect::Weapon(enchantment)) => {
                        ("weapon", weapon_effect(Some(enchantment)))
                    }
                    None => ("wand", None),
                };
                let draws = self.window(draw);
                (equipment.item, equipment.roll.upgrade, role, effect, draws)
            }
            ImpRewardOption::Missile(missile) => {
                let effect = match missile.roll.effect {
                    Some(Effect::Weapon(enchantment)) => weapon_effect(Some(enchantment)),
                    _ => None,
                };
                let draws = self.window(draw);
                (
                    missile.kind.item_id()?,
                    missile.roll.upgrade,
                    "missile",
                    effect,
                    draws,
                )
            }
        };
        let mut entry = fixed(slot, id, level, role);
        // The Plate Armor draws from no deck, so it has no window.
        if !draws.is_empty() {
            entry = with_window(entry, &draws);
        }
        // Slot 3 holds the tier-4 half of the weapon pair.
        entry.level_rule = Some(if slot == 3 {
            LevelRule::Range { min: 3, max: 5 }
        } else {
            LevelRule::Range { min: 2, max: 4 }
        });
        entry.level_pinned = !self.shifted;
        entry.effect = effect;
        Some(entry)
    }

    fn artifact(&mut self, slot: u8, id: ItemId, draw: Option<DeckDraw>) -> RewardSlot {
        let draws = self.window(draw);
        let offsets = draw.map_or(0, |draw| drift::offsets(draw.index).len());
        // An exhausted deck at some offset falls back to a ring roll.
        self.shifted |= draws.len() < offsets
            || draws
                .iter()
                .any(|draw| draw.item == ItemId::UnstableSpellbook);
        let mut entry = with_window(fixed(slot, id, transfer_level(id), "artifact"), &draws);
        entry.level_rule = Some(LevelRule::TransferUpgrade { transfer: TRANSFER });
        entry.level_pinned = draws
            .iter()
            .all(|draw| transfer_level(draw.item) == entry.level);
        entry
    }

    fn ring_window(&mut self, slot: u8, draw: Option<DeckDraw>) -> Vec<Draw> {
        if let Some(second) = self.second_ring.take() {
            // The duplicate rejects roll before this slot's own level.
            self.shifted |= !drift::rejects_pinned(&second);
            second
        } else if slot == 0 {
            let (first, second) = draw
                .map(|draw| drift::pairs(self.initial, draw))
                .unwrap_or_default();
            self.second_ring = Some(second);
            first
        } else {
            self.window(draw)
        }
    }

    fn window(&self, draw: Option<DeckDraw>) -> Vec<Draw> {
        draw.map(|draw| drift::single(self.initial, draw))
            .unwrap_or_default()
    }
}

/// `Artifact.transferUpgrade(5)` on a fresh artifact stores
/// `round(5 * levelCap / 10)`. Caps read from the v4.0.2 classes.
fn transfer_level(artifact: ItemId) -> u8 {
    match artifact {
        // Caps 5: round(2.5).
        ItemId::EtherealChains | ItemId::TimekeepersHourglass => 3,
        // Cap 3: round(1.5).
        ItemId::SandalsOfNature => 2,
        // Cap 10.
        _ => TRANSFER,
    }
}
