use crate::level_map::json as maps;
use serde_json::Value;

const FRESH: &str = r#","lorePages":true"#;

fn map(seed: &str, depth: u8, options: &str) -> Value {
    let request = format!(r#"{{"seed":"{seed}","depth":{depth}{options}}}"#);
    let json = maps::decode_request(&request)
        .unwrap()
        .generate_document()
        .unwrap();
    serde_json::from_str(&json).unwrap()
}

fn item_cells(map: &Value, kind: &str, deterministic: bool) -> Vec<u64> {
    let mut cells = map["contents"]["heaps"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|heap| {
            heap["items"]
                .as_array()
                .unwrap()
                .iter()
                .any(|item| item["kind"] == kind && item["deterministic"] == deterministic)
        })
        .map(|heap| heap["cell"].as_u64().unwrap())
        .collect::<Vec<_>>();
    cells.sort_unstable();
    cells
}

#[test]
fn fresh_journal_matches_seeded_java_oracle_pages() {
    // tooling/oracle-4.0/run.sh <seed> <depth> --fresh-journal
    for (seed, depth, guides, alchemy) in [
        ("AAA-AAA-AAA", 4, &[][..], &[250][..]),
        ("AAA-AAA-AAA", 9, &[1075][..], &[767, 768][..]),
        ("FVX-YTN-SLC", 3, &[544][..], &[402][..]),
    ] {
        let fresh = map(seed, depth, FRESH);
        assert_eq!(item_cells(&fresh, "GuidePage", true), guides);
        assert_eq!(item_cells(&fresh, "AlchemyPage", true), alchemy);
    }
}

#[test]
fn replay_marks_the_unseeded_entrance_page_and_keeps_default_halls_page() {
    let seed = "AAA-AAA-AAA";
    let depth_two = map(seed, 2, FRESH);
    let cells = item_cells(&depth_two, "GuidePage", false);
    assert_eq!(cells.len(), 1);
    // Java's WaterBridge entrance room is [12, 30, 18, 38].
    let cell = cells[0];
    assert!((13..=17).contains(&(cell % 35)));
    assert!((31..=36).contains(&(cell / 35)));
    assert_ne!(cell, depth_two["entrance"].as_u64().unwrap());
    assert!(item_cells(&map(seed, 2, ""), "GuidePage", false).is_empty());
    assert_eq!(
        item_cells(&map(seed, 24, ""), "RegionLorePage$Halls", true),
        [743]
    );
    assert!(item_cells(&map(seed, 24, FRESH), "RegionLorePage$Halls", true).is_empty());
}

#[test]
fn report_replays_journal_and_scheduled_challenge_content() {
    let report = |options: &str| {
        super::decode_request(&format!(r#"{{"seed":"AAA-AAA-AAA"{options}}}"#))
            .unwrap()
            .generate()
            .unwrap()
    };
    let normal = report("");
    let fresh = report(r#","lorePages":true,"challenges":["into_darkness","forbidden_runes"]"#);
    let item_count = |report: &super::SeedReport, id: &str| {
        report
            .floors
            .iter()
            .flat_map(|floor| &floor.items)
            .filter(|item| item.id == id)
            .count()
    };
    assert_eq!(item_count(&normal, "alchemy_page"), 0);
    assert!(item_count(&fresh, "alchemy_page") > 0);
    assert!(item_count(&fresh, "guide_page") > 0);
    assert!(item_count(&fresh, "torch") > item_count(&normal, "torch"));
    assert!(item_count(&fresh, "scroll_of_upgrade") < item_count(&normal, "scroll_of_upgrade"));
}

#[test]
fn challenged_maps_change_plants_and_boss_wires() {
    let seed = "AAA-AAA-AAA";
    let normal = map(seed, 4, "");
    let barren = map(seed, 4, r#","challenges":["barren_land"]"#);
    assert!(!normal["contents"]["plants"].as_array().unwrap().is_empty());
    assert!(barren["contents"]["plants"].as_array().unwrap().is_empty());
    let wires = |options| {
        map(seed, 15, options)["terrain"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|tile| **tile == crate::geometry::terrain::INACTIVE_TRAP)
            .count()
    };
    assert!(wires(r#","challenges":["badder_bosses"]"#) > wires(""));
}
