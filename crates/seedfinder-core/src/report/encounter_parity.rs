//! Floor encounters against the official engine and against `level_map` mobs.

use serde_json::Value;

use super::encounter::{encounters, mob_id};
use super::{Encounter, SeedReport, decode_request};
use crate::catalog::{ItemId, item_by_stable_id};
use crate::challenges::Challenges;
use crate::level_map::{SUPPORTED_DEPTHS, generate_level_map};

fn report(seed: &str, challenges: u16, trinket: Option<ItemId>) -> SeedReport {
    let mut request = decode_request(&format!(r#"{{"seed":"{seed}"}}"#)).unwrap();
    request.challenges = Challenges::new(challenges).unwrap();
    request.selected_trinket = trinket;
    request.generate().unwrap()
}

/// `(mob, quantity, sorted reward ids)` per encounter.
fn summary(encounters: &[Encounter]) -> Vec<(String, u32, Vec<String>)> {
    encounters
        .iter()
        .map(|encounter| {
            let mut rewards: Vec<String> = encounter
                .rewards
                .iter()
                .flatten()
                .map(|reward| reward.item.clone().expect("carried items are generated"))
                .collect();
            rewards.sort();
            (encounter.mob.clone(), encounter.quantity, rewards)
        })
        .collect()
}

/// The oracle's `[mob class, [carried item ids]]` list as a summary.
fn oracle_summary(mobs: &[Value]) -> Vec<(String, u32, Vec<String>)> {
    let mut output: Vec<(String, u32, Vec<String>)> = Vec::new();
    for mob in mobs {
        let id = mob_id(mob[0].as_str().unwrap());
        let items = mob[1]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item.as_str().unwrap().to_owned());
        match output.iter_mut().find(|entry| entry.0 == id) {
            Some(entry) => {
                entry.1 += 1;
                entry.2.extend(items);
            }
            None => output.push((id, 1, items.collect())),
        }
    }
    for entry in &mut output {
        entry.2.sort();
    }
    output.sort();
    output
}

#[test]
fn floor_encounters_match_official_engine() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/seed-report-encounters.json"
    ))
    .unwrap();
    for sample in fixture["samples"].as_array().unwrap() {
        let seed = sample["seed"].as_str().unwrap();
        let challenges = u16::try_from(sample["challenges"].as_u64().unwrap()).unwrap();
        let trinket = sample["trinket"]
            .as_str()
            .map(|id| item_by_stable_id(id).unwrap().id);
        let report = report(seed, challenges, trinket);
        let floors = sample["floors"].as_array().unwrap();
        assert_eq!(floors.len(), report.floors.len(), "{seed}");
        for floor in floors {
            let depth = usize::try_from(floor["depth"].as_u64().unwrap()).unwrap();
            let encounters = report.floors[depth - 1].encounters.as_ref().unwrap();
            assert_eq!(
                summary(encounters),
                oracle_summary(floor["mobs"].as_array().unwrap()),
                "{seed} challenges {challenges} {trinket:?} depth {depth}"
            );
        }
    }
}

#[test]
fn floor_encounters_match_level_map_mobs() {
    for (seed, challenges, trinket) in [
        ("AAA-AAA-AAA", 0, None),
        ("BAD-RAT-KNG", 0, None),
        ("AAA-AAA-AAA", 0, Some(ItemId::MimicTooth)),
        ("RZN-LKU-EFS", 0, Some(ItemId::RatSkull)),
    ] {
        let report = report(seed, challenges, trinket);
        let dungeon_seed = crate::seed::DungeonSeed::new(report.seed.value).unwrap();
        for depth in SUPPORTED_DEPTHS {
            let map = generate_level_map(
                dungeon_seed,
                depth,
                Challenges::new(challenges).unwrap(),
                trinket,
            )
            .unwrap();
            assert_eq!(
                report.floors[usize::from(depth) - 1].encounters.as_ref(),
                Some(&encounters(&map.contents.mobs)),
                "{seed} {trinket:?} depth {depth}"
            );
        }
    }
}
