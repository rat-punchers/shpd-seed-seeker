//! Floor items against the official engine and against `level_map` heaps,
//! and the two drivers that generate each sampled run's report (and maps)
//! once for the item, encounter and timing checks.

use serde_json::Value;

use super::test_support::{Run, distinct_runs, samples};
use super::{Item, Prediction, SeedReport, encounter_parity, timing_parity};
use crate::catalog::{ItemId, item_by_stable_id};
use crate::level_map::{MapContents, SUPPORTED_DEPTHS};

const EQUIPMENT: [&str; 6] = ["weapon", "armor", "wand", "ring", "trinket", "artifact"];
/// Sources whose items lie in a floor heap or a carrier on the floor.
const PLACED: [&str; 12] = [
    "heap",
    "chest",
    "locked_chest",
    "crystal_chest",
    "tomb",
    "skeleton",
    "mimic",
    "golden_mimic",
    "crystal_mimic",
    "statue",
    "armored_statue",
    "shop",
];

fn is_listed_other(item: &Item) -> bool {
    !EQUIPMENT.contains(&item.category.as_str())
}

/// Potions, scrolls and bags: what a `variable` entry stands for.
fn variable_image(image: u64) -> bool {
    (304..336).contains(&image) || (352..384).contains(&image) || (481..=485).contains(&image)
}

/// Each run's report is generated once and checked against every oracle
/// fixture that samples it.
#[test]
fn floors_match_official_engine() {
    let fixtures: [Value; 3] = [
        include_str!("../../tests/fixtures/seed-report-items.json"),
        include_str!("../../tests/fixtures/seed-report-encounters.json"),
        include_str!("../../tests/fixtures/seed-report-timing.json"),
    ]
    .map(|text| serde_json::from_str(text).unwrap());
    let lists = [
        samples(&fixtures[0]),
        samples(&fixtures[1]),
        samples(&fixtures[2]),
    ];
    for (run, [items, encounters, timing]) in distinct_runs(lists, Run::of_sample) {
        let report = run.report();
        if let Some(sample) = items {
            floor_items_match_oracle(run, sample, &report);
        }
        if let Some(sample) = encounters {
            encounter_parity::encounters_match_oracle(run, sample, &report);
        }
        if let Some(sample) = timing {
            timing_parity::timing_matches_oracle(run, sample, &report);
        }
    }
}

fn floor_items_match_oracle(run: Run<'_>, sample: &Value, report: &SeedReport) {
    for floor in sample["floors"].as_array().unwrap() {
        let depth = floor["depth"].as_u64().unwrap();
        let context = format!("{run} depth {depth}");
        let mut expected: Vec<(u64, u64)> = floor["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| (item[1].as_u64().unwrap(), item[2].as_u64().unwrap()))
            .collect();
        let listed: Vec<&Item> = report.floors[usize::try_from(depth).unwrap() - 1]
            .items
            .iter()
            .filter(|item| is_listed_other(item))
            .collect();
        if depth == 20 {
            // The Imp shop stock is cached, not placed, until the quest ends.
            assert!(expected.is_empty(), "{context}");
            assert!(listed.iter().all(|item| item.source == "shop"), "{context}");
            continue;
        }
        let mut variable = 0;
        for item in listed {
            if item.prediction == Some(Prediction::Variable) {
                variable += 1;
                continue;
            }
            let quantity = item.ranges.as_ref().unwrap().quantity.unwrap().min;
            let entry = (u64::from(item.sprite_index), u64::from(quantity));
            let index = expected
                .iter()
                .position(|&other| other == entry)
                .unwrap_or_else(|| panic!("{context}: {} not in the oracle", item.id));
            expected.remove(index);
        }
        assert_eq!(expected.len(), variable, "{context}: unlisted {expected:?}");
        assert!(
            expected.iter().all(|&(image, _)| variable_image(image)),
            "{context}"
        );
    }
}

/// `(sprite, quantity, exact identity)` for other items; `(id, level,
/// effect, cursed)` for equipment, both sorted.
type Placed = (
    Vec<(u16, u32, bool)>,
    Vec<(String, u8, Option<String>, bool)>,
);

fn map_placed(contents: &MapContents) -> Placed {
    let items = contents
        .heaps
        .iter()
        .flat_map(|heap| &heap.items)
        .chain(contents.mobs.iter().flat_map(|mob| &mob.items));
    let mut others = Vec::new();
    let mut equipment = Vec::new();
    for item in items {
        if let Some(definition) = item_by_stable_id(&item.kind) {
            let roll = item.roll.unwrap();
            equipment.push((
                definition.stable_id.to_owned(),
                roll.upgrade,
                roll.effect.map(|effect| effect.wire_name().to_owned()),
                roll.cursed,
            ));
        } else if item.kind != "TrinketCatalyst" {
            let quantity = u32::try_from(item.quantity).unwrap();
            others.push((item.image, quantity, item.deterministic));
        }
    }
    others.sort_unstable();
    equipment.sort();
    (others, equipment)
}

fn report_placed(items: &[Item]) -> Placed {
    let mut others = Vec::new();
    let mut equipment = Vec::new();
    for item in items {
        if is_listed_other(item) {
            let quantity = item.ranges.as_ref().unwrap().quantity.unwrap().min;
            let exact = item.prediction != Some(Prediction::Variable);
            others.push((item.sprite_index, quantity, exact));
        } else if PLACED.contains(&item.source.as_str()) && item.category != "trinket" {
            equipment.push((
                item.id.clone(),
                item.upgrade,
                item.effect.as_ref().map(|effect| effect.name.clone()),
                item.cursed,
            ));
        }
    }
    others.sort_unstable();
    equipment.sort();
    (others, equipment)
}

/// Each run's report and maps are generated once and checked for both the
/// placed items and the encounters.
#[test]
fn floors_match_level_maps() {
    for run in [
        Run::new("AAA-AAA-AAA", 0, None),
        Run::new("RZN-LKU-EFS", 0, None),
        Run::new("BAD-RAT-KNG", 0, None),
        Run::new("AAA-AAA-AAA", 111, None),
        Run::new("AAA-AAA-AAA", 0, Some(ItemId::MimicTooth)),
        Run::new("RZN-LKU-EFS", 0, Some(ItemId::RatSkull)),
    ] {
        let report = run.report();
        // Maps assume a found hourglass is taken, which changes later shops.
        let last = report
            .floors
            .iter()
            .find(|floor| floor.items.iter().any(|i| i.id == "timekeepers_hourglass"))
            .map_or(24, |floor| floor.depth);
        for depth in SUPPORTED_DEPTHS {
            let map = run.level_map(&report, depth);
            let floor = &report.floors[usize::from(depth) - 1];
            if depth <= last {
                assert_eq!(
                    report_placed(&floor.items),
                    map_placed(&map.contents),
                    "{run} depth {depth}"
                );
            }
            encounter_parity::encounters_match_map(run, floor, &map);
        }
    }
}
