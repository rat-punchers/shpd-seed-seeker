//! Floor encounters against the official engine and against `level_map`
//! mobs. The drivers in `parity.rs` run these checks.

use serde_json::Value;

use super::encounter::{encounters, mob_id};
use super::test_support::Run;
use super::{Encounter, Floor, SeedReport};
use crate::level_map::LevelMap;

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

pub(super) fn encounters_match_oracle(run: Run<'_>, sample: &Value, report: &SeedReport) {
    let floors = sample["floors"].as_array().unwrap();
    assert_eq!(floors.len(), report.floors.len(), "{run}");
    for floor in floors {
        let depth = usize::try_from(floor["depth"].as_u64().unwrap()).unwrap();
        let encounters = report.floors[depth - 1].encounters.as_ref().unwrap();
        assert_eq!(
            summary(encounters),
            oracle_summary(floor["mobs"].as_array().unwrap()),
            "{run} depth {depth}"
        );
    }
}

pub(super) fn encounters_match_map(run: Run<'_>, floor: &Floor, map: &LevelMap) {
    assert_eq!(
        floor.encounters.as_ref(),
        Some(&encounters(&map.contents.mobs)),
        "{run} depth {}",
        floor.depth
    );
}
