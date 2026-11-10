//! Deck replays and the reward-slot windows built from them.

use super::drift::{DRIFT, offsets};
use super::test_support::seed_report;
use super::{Quest, SeedReport};
use crate::generator::{deck_sequence, random_category};
use crate::rng::RandomStack;
use crate::run::{GeneratorCategory, RunState};

fn quest<'a>(report: &'a SeedReport, name: &str) -> Option<&'a Quest> {
    report.quests.iter().find(|quest| quest.quest == name)
}

/// The replay yields the classes real draws take, through deck resets.
#[test]
fn deck_replay_matches_real_draws() {
    for seed in [0_i64, 1, 42, 99_999] {
        let initial = RunState::new(seed).generator;
        for category in [
            GeneratorCategory::Wand,
            GeneratorCategory::Ring,
            GeneratorCategory::Artifact,
            GeneratorCategory::WeaponTier4,
            GeneratorCategory::MissileTier5,
        ] {
            let replay = deck_sequence(&initial, category, 60).unwrap();
            let mut generator = initial.clone();
            let mut random = RandomStack::with_base_seed(0);
            random.push(seed);
            for (index, expected) in replay.iter().enumerate() {
                let item = random_category(&mut random, &mut generator, category, 17).unwrap();
                let drawn = match item {
                    crate::generator::GeneratedItem::Equipment(item) => Some(item.item),
                    // An exhausted artifact deck falls back to a defaults ring.
                    crate::generator::GeneratedItem::Ring(_)
                        if category == GeneratorCategory::Artifact =>
                    {
                        None
                    }
                    crate::generator::GeneratedItem::Ring(ring) => Some(ring.kind.item_id()),
                    crate::generator::GeneratedItem::Missile(missile) => missile.kind.item_id(),
                    crate::generator::GeneratedItem::Artifact(artifact) => artifact.kind.item_id(),
                    other => panic!("unexpected {other:?}"),
                };
                assert_eq!(drawn, *expected, "seed {seed} {category:?} draw {index}");
            }
        }
    }
}

#[test]
fn offsets_are_nearest_first_within_the_deck() {
    assert_eq!(offsets(5), [0, -1, 1, -2, 2, -3, 3]);
    assert_eq!(offsets(1), [0, -1, 1, 2, 3]);
    assert_eq!(offsets(0).len(), usize::try_from(DRIFT).unwrap() + 1);
}

#[test]
fn slots_lead_with_the_seed_draw_and_weigh_the_window() {
    let mut unpinned_wand = false;
    for value in 0..24 {
        let report = seed_report(&crate::seed::DungeonSeed::new(value).unwrap().to_code());
        for quest in &report.quests {
            let slots = quest.slots.as_ref().unwrap();
            assert!(!slots.is_empty(), "seed {value} {}", quest.quest);
            for slot in slots {
                let Some(candidates) = &slot.candidates else {
                    assert_eq!(slot.scenario_count, 1);
                    continue;
                };
                assert_eq!(candidates[0].item, slot.item, "seed {value} {slot:?}");
                assert!(candidates[0].drifts.contains(&0), "seed {value} {slot:?}");
                let weight: u32 = candidates.iter().map(|candidate| candidate.weight).sum();
                assert_eq!(weight, slot.scenario_count, "seed {value} {slot:?}");
            }
        }
        let wands = quest(&report, "wandmaker").unwrap().slots.as_ref().unwrap();
        assert!(wands[0].level_pinned);
        unpinned_wand |= !wands[1].level_pinned;
        let ghost = quest(&report, "ghost").unwrap().slots.as_ref().unwrap();
        assert_eq!(ghost.len(), 2);
        assert!(ghost[1].candidates.is_none());
        if let Some(imp) = quest(&report, "imp") {
            let slots = imp.slots.as_ref().unwrap();
            assert_eq!(slots.len(), 6, "seed {value}");
            let total: u32 = slots
                .iter()
                .map(|slot| match slot.level_rule {
                    Some(super::LevelRule::TransferUpgrade { transfer }) => u32::from(transfer),
                    _ => u32::from(slot.level),
                })
                .sum();
            assert_eq!(imp.total_upgrade_value, Some(total));
            assert!(slots[4].candidates.is_none(), "the Plate Armor has no deck");
        }
        if let Some(blacksmith) = quest(&report, "blacksmith") {
            let slots = blacksmith.slots.as_ref().unwrap();
            assert!(slots.iter().all(|slot| slot.candidates.is_none()));
        }
    }
    assert!(
        unpinned_wand,
        "no seed in 0..24 unpins the second wand's level"
    );
}
