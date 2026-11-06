use serde_json::Value;

use super::{SECTIONS, SeedReport, Status, decode_request, document};
use crate::level_map::{SUPPORTED_BRANCH_DEPTHS, generate_level_map_in_branch};

const FORMAT_DOC: &str = include_str!("../../../../docs/seed-report-format.md");

fn report(request: &str) -> SeedReport {
    decode_request(request).unwrap().generate().unwrap()
}

/// The JSON block under the doc's `## Example` heading.
fn doc_example() -> Value {
    let example = FORMAT_DOC.split("## Example").nth(1).unwrap();
    let block = example.split("```json").nth(1).unwrap();
    serde_json::from_str(block.split("```").next().unwrap()).unwrap()
}

#[test]
fn doc_example_fields_exist_in_types() {
    // Every type denies unknown fields, so reading the example proves each
    // documented field exists; writing it back proves none is renamed.
    let example = doc_example();
    let report: SeedReport = serde_json::from_value(example.clone()).unwrap();
    assert_eq!(serde_json::to_value(&report).unwrap(), example);
}

#[test]
fn reports_survive_a_serde_round_trip() {
    for request in [
        r#"{"seed":"AAA-AAA-AAA"}"#,
        r#"{"seed":"2026-01-01","challenges":["on_diet"],"trinket":"none"}"#,
        r#"{"seed":"rzn lku efs","query":{"requirements":[{"item":"mimic_tooth","select_trinket":true}]}}"#,
    ] {
        let report = report(request);
        let text = serde_json::to_string(&report).unwrap();
        let read: SeedReport = serde_json::from_str(&text).unwrap();
        assert_eq!(read, report, "{request}");
        assert_eq!(serde_json::to_string(&read).unwrap(), text);
    }
}

#[test]
fn unlisted_sections_stay_absent() {
    let report = report(r#"{"seed":"AAA-AAA-AAA"}"#);
    assert_eq!(report.sections, SECTIONS);
    assert_eq!(report.status, Status::Partial);
    assert!(report.query.is_none());
    assert!(report.trinkets.timing.is_some());
    assert_eq!(report.floors.len(), 24);
    for floor in &report.floors {
        assert!(floor.appearances.is_some());
        assert!(floor.encounters.is_none());
        assert!(floor.items.iter().all(|item| {
            item.depth == floor.depth
                && item.prediction.is_some()
                && item.conditions.is_some()
                && item.ranges.is_some()
        }));
    }
    assert!(report.quests.iter().all(|quest| {
        quest.slots.is_some()
            && (quest.upgrades_pinned.is_some() == (quest.quest == "imp"))
            && (quest.total_upgrade_value.is_some() == (quest.quest == "imp"))
    }));
    let text: Value =
        serde_json::from_str(&document(r#"{"seed":"AAA-AAA-AAA"}"#).unwrap()).unwrap();
    assert_eq!(text["format"], "seed-seeker-seed-report");
    assert_eq!(text["schemaVersion"], 1);
    assert_eq!(text["trinkets"]["selected"], Value::Null);
}

#[test]
fn branches_are_exactly_the_quest_sub_levels_level_map_serves() {
    for seed in ["AAA-AAA-AAA", "RZN-LKU-EFS"] {
        let report = report(&format!(r#"{{"seed":"{seed}"}}"#));
        let request = decode_request(&format!(r#"{{"seed":"{seed}"}}"#)).unwrap();
        for depth in SUPPORTED_BRANCH_DEPTHS {
            let listed = &report.floors[usize::from(depth) - 1].branches;
            let map =
                generate_level_map_in_branch(request.seed, depth, 1, request.challenges, None);
            assert_eq!(
                listed.len(),
                usize::from(map.is_ok()),
                "{seed} depth {depth}"
            );
            if let (Ok(map), Some(branch)) = (map, listed.first()) {
                let kind = serde_json::to_value(map.kind).unwrap();
                assert_eq!(kind, branch.kind.as_str(), "{seed} depth {depth}");
                assert!(report.quests.iter().any(|quest| {
                    quest.quest == branch.access.quest
                        && quest.depth == depth
                        && quest.variant == branch.objective
                }));
            }
        }
        assert!(report.floors.iter().all(|floor| {
            SUPPORTED_BRANCH_DEPTHS.contains(&floor.depth) || floor.branches.is_empty()
        }));
    }
}

#[test]
fn seed_and_quest_basics() {
    let daily = report(r#"{"seed":"2026-01-01"}"#);
    assert!(daily.seed.daily);
    assert_eq!(daily.seed.code, "2026-01-01");
    let code = report(r#"{"seed":"aaaaaaaaa"}"#);
    assert_eq!(
        (code.seed.code.as_str(), code.seed.value),
        ("AAA-AAA-AAA", 0)
    );
    assert!(!code.seed.daily);
    assert_eq!(code.identities.scrolls.len(), 12);
    assert_eq!(code.ring_gems.len(), 12);
    assert_eq!(code.trinkets.offers.len(), 4);
    assert_eq!(code.trinkets.transmutation_order.len(), 13);
    assert_eq!(code.trinkets.artifact_decks.len(), 25);
    for quest in &code.quests {
        let range = quest.spawn_depth_range;
        assert!((range.min..=range.max).contains(&quest.depth), "{quest:?}");
        assert_eq!(quest.rewards.selected_count, 1);
    }
}

#[test]
fn rejects_invalid_requests() {
    for (request, message) in [
        ("{", "invalid seed report request JSON"),
        (r#"{"seed":"AAA-AAA-AAA","depth":3}"#, "unknown field"),
        (r#"{"seed":"AAA"}"#, "seed code"),
        (
            r#"{"seed":"AAA-AAA-AAA","challenges":["nope"]}"#,
            "unknown challenge",
        ),
        (
            r#"{"seed":"AAA-AAA-AAA","trinket":"nope"}"#,
            "unknown trinket",
        ),
        (r#"{"seed":"AAA-AAA-AAA","query":{"requirements":"x"}}"#, ""),
    ] {
        let error = decode_request(request).unwrap_err();
        assert!(error.contains(message), "{request}: {error}");
    }
}
