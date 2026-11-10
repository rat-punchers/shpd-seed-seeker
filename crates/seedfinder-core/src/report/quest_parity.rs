//! Quest reward slots against the official engine: the seed's own draws,
//! and the classes and levels after run history draws extra deck cards.

use serde_json::Value;

use super::test_support::seed_report;
use super::{RewardSlot, SeedReport};

fn text(value: &Value) -> Option<&str> {
    value.as_str()
}

fn number(value: &Value) -> u64 {
    value.as_u64().unwrap()
}

fn slot<'a>(report: &'a SeedReport, quest: &str, option: u64) -> &'a RewardSlot {
    let quest = report
        .quests
        .iter()
        .find(|entry| entry.quest == quest)
        .unwrap();
    let slots = quest.slots.as_ref().unwrap();
    slots
        .iter()
        .find(|slot| u64::from(slot.slot) == option)
        .unwrap_or_else(|| panic!("{} has no slot {option}", quest.quest))
}

#[test]
fn quest_slots_match_official_engine() {
    let fixture: Value =
        serde_json::from_str(include_str!("../../tests/fixtures/seed-report-quests.json")).unwrap();
    for sample in fixture["samples"].as_array().unwrap() {
        let seed = sample["seed"].as_str().unwrap();
        let report = seed_report(seed);
        // The plain dart is outside the catalog and has no slot.
        let rows: Vec<&Value> = sample["rewards"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|row| text(&row[3]) != Some("dart"))
            .collect();
        for quest in &report.quests {
            let expected: Vec<&&Value> = rows
                .iter()
                .filter(|row| text(&row[0]) == Some(&quest.quest))
                .collect();
            let slots = quest.slots.as_ref().unwrap();
            assert_eq!(slots.len(), expected.len(), "{seed} {}", quest.quest);
            for row in expected {
                let context = format!("{seed} {row}");
                assert_eq!(u64::from(quest.depth), number(&row[1]), "{context}");
                let slot = slot(&report, &quest.quest, number(&row[2]));
                assert_eq!(Some(slot.item.as_str()), text(&row[3]), "{context}");
                assert_eq!(u64::from(slot.level), number(&row[4]), "{context}");
                assert_eq!(slot.effect.as_deref(), text(&row[5]), "{context}");
            }
        }
        let quests: Vec<&str> = report
            .quests
            .iter()
            .map(|quest| quest.quest.as_str())
            .collect();
        assert!(
            rows.iter()
                .all(|row| quests.contains(&text(&row[0]).unwrap())),
            "{seed}"
        );
        for (drift, rows) in sample["drifted"].as_object().unwrap() {
            let drift: i32 = drift.parse().unwrap();
            for row in rows.as_array().unwrap() {
                if text(&row[2]) == Some("dart") {
                    continue;
                }
                let context = format!("{seed} drift {drift} {row}");
                let quest = text(&row[0]).unwrap();
                let shifted = report
                    .quests
                    .iter()
                    .any(|entry| entry.quest == quest && entry.upgrades_pinned == Some(false));
                // A shifted floor RNG can flip the coin that orders the
                // Imp's melee and thrown slots.
                if shifted && matches!(number(&row[1]), 2 | 3) {
                    continue;
                }
                let slot = slot(&report, quest, number(&row[1]));
                let item = slot
                    .candidates
                    .as_ref()
                    .map_or(Some(slot.item.as_str()), |list| {
                        list.iter()
                            .find(|candidate| candidate.drifts.contains(&drift))
                            .map(|candidate| candidate.item.as_str())
                    });
                assert_eq!(item, text(&row[2]), "{context}");
                if slot.level_pinned {
                    assert_eq!(u64::from(slot.level), number(&row[3]), "{context}");
                }
            }
        }
    }
}
