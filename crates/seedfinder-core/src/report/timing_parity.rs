//! Trinket timing, alchemy pots and builders against the official engine
//! (run by the driver in `parity.rs`), and the timing against the floors the
//! replay generates with the trinket.

use serde_json::Value;

use super::SeedReport;
use super::test_support::Run;
use crate::challenges::Challenges;
use crate::seed::DungeonSeed;

/// The report's name for an oracle builder or room class.
fn report_name(class: &str) -> &str {
    match class {
        "LoopBuilder" => "loop",
        "FigureEightBuilder" => "figure_eight",
        "LaboratoryRoom" => "laboratory",
        "SecretLaboratoryRoom" => "secret_laboratory",
        other => panic!("unexpected oracle class {other}"),
    }
}

pub(super) fn timing_matches_oracle(run: Run<'_>, sample: &Value, report: &SeedReport) {
    let context = run.to_string();
    let floors = sample["floors"].as_array().unwrap();
    assert_eq!(floors.len(), 24, "{context}");
    let mut catalyst_depth = None;
    let mut first_pot = None;
    for floor in floors {
        let depth = u8::try_from(floor[0].as_u64().unwrap()).unwrap();
        let listed = &report.floors[usize::from(depth) - 1];
        let builder = floor[1].as_str().map(report_name);
        assert_eq!(
            listed.builder.as_deref(),
            builder,
            "{context} depth {depth}"
        );
        let rooms: Vec<&str> = floor[3]
            .as_array()
            .unwrap()
            .iter()
            .map(|room| report_name(room.as_str().unwrap()))
            .collect();
        let pots = listed.appearances.as_ref().unwrap();
        let listed_rooms: Vec<&str> = pots
            .iter()
            .map(|pot| pot.room.as_deref().unwrap())
            .collect();
        assert_eq!(listed_rooms, rooms, "{context} depth {depth}");
        for pot in pots {
            assert_eq!(pot.kind, "alchemy_pot");
            assert_eq!(pot.secret, pot.room.as_deref() == Some("secret_laboratory"));
        }
        if floor[2].as_bool().unwrap() && catalyst_depth.is_none() {
            catalyst_depth = Some(depth);
        }
        if !pots.is_empty() && first_pot.is_none() {
            first_pot = Some((depth, pots.iter().all(|pot| pot.secret)));
        }
    }
    let timing = report.trinkets.timing.as_ref().unwrap();
    let (pot_depth, pot_secret) = first_pot.unwrap();
    assert_eq!(Some(timing.catalyst_depth), catalyst_depth, "{context}");
    assert_eq!(timing.first_alchemy_pot_depth, pot_depth, "{context}");
    assert_eq!(timing.first_alchemy_pot_secret, pot_secret, "{context}");
    assert!(timing.selection_depth <= 4, "{context}");
}

/// The selected trinket is active exactly from `firstEffectiveDepth`.
#[test]
fn trinket_is_active_from_the_first_effective_depth() {
    for value in [0, 1, 7, 42, 1_000, 99_999, 5_000_000, 123_456_789] {
        let seed = DungeonSeed::new(value).unwrap();
        let offers = crate::trinkets::trinket_order(seed);
        let observed = super::observe::observe(seed, Challenges::NONE, Some(offers[0])).unwrap();
        let timing = super::timing::timing(&observed.world, &observed.floors).unwrap();
        assert_eq!(
            timing.selection_depth,
            timing.catalyst_depth.max(timing.first_alchemy_pot_depth)
        );
        assert_eq!(timing.first_effective_depth, timing.selection_depth + 1);
        for floor in observed
            .floors
            .iter()
            .filter(|floor| floor.builder.is_some())
        {
            assert_eq!(
                floor.trinket_active,
                floor.depth >= timing.first_effective_depth && floor.depth != 5,
                "seed {value} depth {}",
                floor.depth
            );
        }
        assert_eq!(timing.option_effects.len(), 4);
    }
}
