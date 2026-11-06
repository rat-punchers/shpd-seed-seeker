//! The `allItems` section: predictions, conditions, ranges and choice groups.

use std::collections::{BTreeMap, BTreeSet};

use super::{Accessibility, Condition, Item, Prediction, SeedReport, TrinketEvent, decode_request};

fn report(request: &str) -> SeedReport {
    decode_request(request).unwrap().generate().unwrap()
}

fn items(report: &SeedReport) -> impl Iterator<Item = &Item> {
    report.floors.iter().flat_map(|floor| &floor.items)
}

fn is_equipment(item: &Item) -> bool {
    crate::catalog::item_by_stable_id(&item.id).is_some()
}

fn has_trinket_condition(item: &Item) -> bool {
    item.conditions
        .as_ref()
        .unwrap()
        .iter()
        .any(|condition| matches!(condition, Condition::Trinket { .. }))
}

#[test]
fn predictions_follow_the_spawn_conditions() {
    let report = report(r#"{"seed":"AAA-AAA-AAA"}"#);
    for item in items(&report) {
        let conditions = item.conditions.as_ref().unwrap();
        let runtime = conditions
            .iter()
            .any(|condition| matches!(condition, Condition::Runtime { .. }));
        match item.prediction.unwrap() {
            Prediction::Exact => assert!(conditions.is_empty(), "{item:?}"),
            Prediction::Constrained => assert!(!conditions.is_empty(), "{item:?}"),
            Prediction::Variable => assert!(runtime, "{item:?}"),
        }
        let ranges = item.ranges.as_ref().unwrap();
        for range in [ranges.quantity, ranges.tier, ranges.level]
            .into_iter()
            .flatten()
        {
            assert_eq!(range.min, range.max, "{item:?}");
        }
        assert_ne!(item.id, "trinket_catalyst", "listed as its four offers");
    }
    let ghost: Vec<&Item> = items(&report)
        .filter(|item| item.source == "ghost_reward")
        .collect();
    assert_eq!(ghost.len(), 2);
    for item in ghost {
        assert_eq!(item.prediction, Some(Prediction::Constrained));
        assert_eq!(
            item.conditions.as_deref().unwrap(),
            [
                Condition::Quest {
                    quest: "ghost".to_owned(),
                    depth: Some(3),
                },
                Condition::Choice {
                    group: "ghost_reward".to_owned(),
                    option_count: 2,
                    selected_count: 1,
                    favor_requirement: None,
                },
            ]
        );
    }
    let floor_ten: Vec<(&str, Option<Prediction>)> = report.floors[9]
        .items
        .iter()
        .map(|item| (item.id.as_str(), item.prediction))
        .collect();
    assert_eq!(floor_ten, [("iron_key", Some(Prediction::Exact))]);
    let shop = &report.floors[19].items;
    assert!(shop.iter().any(|item| item.category == "potion"));
    assert!(shop.iter().all(|item| {
        item.conditions
            .as_ref()
            .unwrap()
            .contains(&Condition::Quest {
                quest: "imp".to_owned(),
                depth: Some(19),
            })
    }));
    let first = &report.floors[0].items;
    let potion = first.iter().find(|item| item.category == "potion").unwrap();
    assert_eq!(potion.prediction, Some(Prediction::Exact));
    assert_eq!(potion.ranges.as_ref().unwrap().quantity.unwrap().min, 1);
    for (id, state) in [
        ("random_potion", "unseeded_selection"),
        ("scroll_holder", "shop_bag"),
    ] {
        let item = items(&report).find(|item| item.id == id).unwrap();
        assert_eq!(item.prediction, Some(Prediction::Variable));
        assert_eq!(
            item.conditions.as_deref().unwrap(),
            [Condition::Runtime {
                state: state.to_owned()
            }]
        );
    }
}

#[test]
fn a_selected_generation_trinket_conditions_the_floors_it_changes() {
    let report = report(r#"{"seed":"AAA-AAA-AAA","trinket":"mimic_tooth"}"#);
    let first = items(&report)
        .find(|item| has_trinket_condition(item))
        .unwrap()
        .depth;
    for floor in &report.floors {
        let changed = floor.depth >= first && ![5, 10, 15].contains(&floor.depth);
        for item in &floor.items {
            assert_eq!(has_trinket_condition(item), changed, "{item:?}");
            if changed {
                assert_ne!(item.prediction, Some(Prediction::Exact));
                assert!(
                    item.conditions
                        .as_ref()
                        .unwrap()
                        .contains(&Condition::Trinket {
                            events: vec![TrinketEvent {
                                before_depth: floor.depth,
                                kind: "acquired".to_owned(),
                                trinket: Some("mimic_tooth".to_owned()),
                                min_upgrades: Some(3),
                            }],
                        })
                );
            }
        }
    }
    assert!(
        first > 1 && first < 24,
        "activates after the first alchemy floor"
    );
    // Dimensional Sundial changes no floor generation in this engine.
    let neutral = report_for("dimensional_sundial");
    assert!(!items(&neutral).any(has_trinket_condition));
}

fn report_for(trinket: &str) -> SeedReport {
    report(&format!(
        r#"{{"seed":"AAA-AAA-AAA","trinket":"{trinket}"}}"#
    ))
}

#[test]
fn choice_groups_never_span_floors() {
    let mut shared_with_equipment = false;
    let mut crystal_path = false;
    for value in 0..48_u64 {
        let seed = crate::seed::DungeonSeed::new(value * 113_097_991_229).unwrap();
        let report = report(&format!(r#"{{"seed":"{}"}}"#, seed.to_code()));
        let mut depths: BTreeMap<u16, BTreeSet<u8>> = BTreeMap::new();
        let mut equipment_groups = BTreeSet::new();
        for item in items(&report) {
            let group = match item.accessibility {
                Accessibility::Independent => continue,
                Accessibility::Choice { group, .. } | Accessibility::Scenarios { group, .. } => {
                    group
                }
            };
            depths.entry(group).or_default().insert(item.depth);
            if is_equipment(item) {
                equipment_groups.insert(group);
            }
        }
        for item in items(&report) {
            if is_equipment(item) {
                continue;
            }
            match item.accessibility {
                Accessibility::Choice { group, .. } => {
                    shared_with_equipment |= equipment_groups.contains(&group);
                }
                Accessibility::Scenarios { group, .. } => {
                    crystal_path |= !equipment_groups.contains(&group);
                }
                Accessibility::Independent => {}
            }
        }
        for (group, floors) in depths {
            assert_eq!(floors.len(), 1, "{seed} group {group} spans {floors:?}");
        }
    }
    assert!(shared_with_equipment, "a crystal choice room in the sample");
    assert!(crystal_path, "a crystal path room in the sample");
}
