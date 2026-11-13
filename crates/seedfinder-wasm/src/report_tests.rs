//! `seed_report` selection, query marks and wire metadata, read from the
//! JSON the browser receives.

use serde_json::{Value, json};
use shpd_seedfinder_core::catalog::{RING_SPRITE_BASE, item, item_by_stable_id};
use shpd_seedfinder_core::main_world::generate_main_world;
use shpd_seedfinder_core::report::decode_request;
use shpd_seedfinder_core::seed::DungeonSeed;

use crate::filter_seeds_impl;
use crate::seed_report::seed_report_impl;

fn report(request: &Value) -> Value {
    serde_json::from_str(&seed_report_impl(&request.to_string()).unwrap()).unwrap()
}

fn items(report: &Value) -> impl Iterator<Item = &Value> {
    report["floors"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|floor| floor["items"].as_array().unwrap())
}

/// Floors list the Magical Catalyst, which carries its four offers' marks.
fn catalyst(report: &Value) -> &Value {
    items(report)
        .find(|entry| entry["id"] == "trinket_catalyst")
        .unwrap()
}

fn filtered(query: &Value) -> usize {
    let output: Value =
        serde_json::from_str(&filter_seeds_impl(&query.to_string(), &[0.0]).unwrap()).unwrap();
    output.as_array().unwrap().len()
}

#[test]
fn selection_defaults_overrides_and_validation() {
    let query = json!({"requirements":[{"item":"mimic_tooth","select_trinket":true}]});
    let mut request = json!({"seed":"AAA-AAA-AAA", "query":query});
    let selected = report(&request);
    assert_eq!(selected["trinkets"]["selected"], "mimic_tooth");
    request["trinket"] = "none".into();
    let none = report(&request);
    assert!(none["trinkets"]["selected"].is_null());
    assert_ne!(none["floors"], selected["floors"]);
    for id in [
        "mimic_tooth",
        "parchment_scrap",
        "dimensional_sundial",
        "thirteen_leaf_clover",
    ] {
        request["trinket"] = id.into();
        let decoded = decode_request(&request.to_string()).unwrap();
        assert_eq!(
            decoded.selected_trinket.map(|id| item(id).stable_id),
            Some(id)
        );
    }
    for id in ["rat_skull", "not_a_trinket", "longsword"] {
        request["trinket"] = id.into();
        assert!(seed_report_impl(&request.to_string()).is_err());
    }
}

#[test]
fn reports_the_run_gems_that_recolor_its_rings() {
    // YKH-LGJ-WDQ draws haste as a diamond in the game. The item keeps its
    // catalog cell — which is what names the class and indexes its glyph —
    // and the gem table is what moves the art onto the diamond.
    let output = report(&json!({"seed":"YKH-LGJ-WDQ"}));
    assert_eq!(
        output["ringGems"],
        json!([7, 8, 3, 5, 4, 6, 2, 11, 10, 1, 0, 9])
    );

    let identities = &output["identities"];
    for category in ["scrolls", "potions", "rings"] {
        assert_eq!(identities[category].as_array().unwrap().len(), 12);
    }
    assert_eq!(identities["rings"][7]["appearance"], "Diamond");
    assert_eq!(identities["rings"][7]["spriteIndex"], RING_SPRITE_BASE + 11);
    assert_eq!(identities["rings"][7]["name"], "Ring of haste");

    let haste = item_by_stable_id("ring_haste").unwrap();
    assert_eq!(haste.sprite_index, RING_SPRITE_BASE + 7);
    assert_eq!(haste.ring_glyph_index(), Some(7));
    let gems = output["ringGems"].as_array().unwrap();
    let glyph = usize::from(haste.ring_glyph_index().unwrap());
    let drawn = RING_SPRITE_BASE + u16::try_from(gems[glyph].as_u64().unwrap()).unwrap();
    assert_eq!(drawn, RING_SPRITE_BASE + 11);

    for entry in items(&output) {
        if let Some(definition) = item_by_stable_id(entry["id"].as_str().unwrap()) {
            assert_eq!(entry["spriteIndex"], definition.sprite_index, "{entry}");
        }
    }
}

#[test]
fn feelings_match_game_fixtures_and_skip_boss_floors() {
    let output = report(&json!({"seed":"AAA-AAA-AAA"}));
    let floors = output["floors"].as_array().unwrap();
    assert_eq!(floors[0]["feeling"], "none");
    for floor in floors {
        let boss = floor["depth"].as_u64().unwrap() % 5 == 0;
        assert_eq!(floor["feeling"].is_null(), boss, "floor {}", floor["depth"]);
    }
    for fixture in [
        include_str!("../../../tooling/oracle-4.0/tests/prison-floors.expected.json"),
        include_str!("../../../tooling/oracle-4.0/tests/caves-floors.expected.json"),
        include_str!("../../../tooling/oracle-4.0/tests/city-floors.expected.json"),
        include_str!("../../../tooling/oracle-4.0/tests/halls-floors.expected.json"),
    ] {
        let fixture: Value = serde_json::from_str(fixture).unwrap();
        for level in fixture["seeds"]["AAA-AAA-AAA"]["levels"]
            .as_array()
            .unwrap()
        {
            let depth = usize::try_from(level["depth"].as_u64().unwrap()).unwrap();
            assert_eq!(
                floors[depth - 1]["feeling"],
                level["feeling"].as_str().unwrap().to_lowercase(),
                "floor {depth}"
            );
        }
    }
}

#[test]
fn trinket_transmutations_filter_and_highlight_the_remaining_deck() {
    // Official v4.0.0 oracle: Censer is first, Salt Cube is thirteenth.
    let query = json!({"max_depth": 3, "requirements": [
        {"item": "chaotic_censer", "trinket_transmutations": 1},
        {"item": "salt_cube", "trinket_transmutations": 13}
    ]});
    let output = report(&json!({"seed": "AAA-AAA-AAA", "query": query}));
    assert_eq!(output["query"]["matchedRequirements"], 2);
    let trinkets = &output["trinkets"];
    assert_eq!(trinkets["transmutationOrder"][0]["matched"], true);
    assert_eq!(trinkets["transmutationOrder"][12]["matched"], true);
    assert_eq!(trinkets["offers"].as_array().unwrap().len(), 4);
    assert_eq!(catalyst(&output)["matched"], false);
    assert_eq!(trinkets["selected"], Value::Null);
    assert_eq!(filtered(&query), 1);
    let mut wrong = query;
    wrong["requirements"][0]["trinket_transmutations"] = 0.into();
    assert_eq!(filtered(&wrong), 0);
}

#[test]
fn trinket_wire_order_catalog_and_or_search_agree() {
    let query = json!({"requirements": [{"any_of": [
        {"item": "rat_skull"}, {"item": "mimic_tooth"}
    ]}], "max_depth": 3});
    let output = report(&json!({"seed": "AAA-AAA-AAA", "query": query}));
    let trinkets = &output["trinkets"];
    let order: Vec<&Value> = trinkets["offers"]
        .as_array()
        .unwrap()
        .iter()
        .chain(trinkets["transmutationOrder"].as_array().unwrap())
        .collect();
    assert_eq!(order.len(), 17);
    assert_eq!(order[0]["id"], "dimensional_sundial");
    assert_eq!(order[1]["id"], "mimic_tooth");
    assert_eq!(order[16]["id"], "salt_cube");
    assert_eq!(output["query"]["matchedRequirements"], 1);
    // The matching Mimic Tooth offer marks the Catalyst that stands for it.
    assert_eq!(catalyst(&output)["matched"], true);
    let catalog: Value = serde_json::from_str(include_str!(
        "../../../android/app/src/main/assets/third_party/shattered-pixel-dungeon/catalog-v4.0.2.json"
    ))
    .unwrap();
    for entry in catalog["entries"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|entry| entry["type"] == "trinket")
    {
        let wire = order.iter().find(|wire| wire["id"] == entry["id"]).unwrap();
        assert_eq!(wire["name"], entry["name"]);
        assert_eq!(wire["spriteIndex"], entry["sprite"]);
    }
    assert_eq!(filtered(&query), 1);
}

#[test]
fn query_marks_a_matching_known_item() {
    let world = generate_main_world(DungeonSeed::MIN, 24).unwrap();
    let known = &world.items[0];
    let definition = item(known.item);
    let output = report(&json!({
        "seed": "AAAAAAAAA",
        "query": {
            "requirements": [{"item": definition.stable_id, "max_depth": known.depth}]
        }
    }));
    assert_eq!(output["query"]["totalRequirements"], 1);
    assert_eq!(output["query"]["matchedRequirements"], 1);
    let matched: Vec<_> = items(&output)
        .filter(|entry| entry["matched"] == true)
        .collect();
    assert_eq!(matched.len(), 1);
    assert_eq!(matched[0]["id"], definition.stable_id);
}

#[test]
fn items_flag_excluded_smith_rewards() {
    let output = |exclude: bool| {
        report(&json!({
            "seed": "AAAAAAAAA",
            "query": {
                "exclude_blacksmith_rewards": exclude,
                "requirements": [{"kind": "weapon"}]
            }
        }))
    };
    let excluded = output(true);
    assert!(
        items(&excluded).any(|entry| entry["source"] == "blacksmith_reward"),
        "the canonical seed has a Blacksmith"
    );
    for entry in items(&excluded) {
        assert_eq!(entry["excluded"], entry["source"] == "blacksmith_reward");
        assert!(entry["excluded"] == false || entry["matched"] == false);
    }
    assert!(items(&output(false)).all(|entry| entry["excluded"] == false));
}
