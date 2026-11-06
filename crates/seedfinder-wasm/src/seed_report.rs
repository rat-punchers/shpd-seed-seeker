//! The Analyze screen's `seed_report` export (`docs/seed-report-format.md`).

use wasm_bindgen::prelude::*;

/// Generates one seed's report as JSON.
///
/// # Errors
///
/// Returns a JavaScript error for malformed requests, invalid seeds, queries
/// or trinkets, and world-generation failures.
#[wasm_bindgen]
pub fn seed_report(request_json: &str) -> Result<String, JsError> {
    seed_report_impl(request_json).map_err(|error| JsError::new(&error))
}

fn seed_report_impl(request_json: &str) -> Result<String, String> {
    shpd_seedfinder_core::report::document(request_json)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use serde_json::Value;

    use super::seed_report_impl;
    use crate::scout_impl;

    /// Real reports kept beside the doc; see "Fixtures" there.
    const FIXTURES: [(&str, &str); 3] = [
        ("AAA-AAA-AAA", "aaa-aaa-aaa.json"),
        ("RZN-LKU-EFS", "rzn-lku-efs.json"),
        ("2026-01-01", "daily-2026-01-01.json"),
    ];

    #[test]
    fn report_items_match_scout() {
        let requests = [
            r#"{"seed":"AAA-AAA-AAA"}"#,
            r#"{"seed":"RZN-LKU-EFS","challenges":["faith_is_my_armor"],"trinket":"none"}"#,
            r#"{"seed":"2026-01-01"}"#,
            r#"{"seed":"EYY-RUL-LQG","query":{"auto_apply_trinket":true,"max_depth":19,"requirements":[{"item":"runic_blade","upgrade":1,"effect":"Grim"}]}}"#,
            r#"{"seed":"AAA-AAA-AAA","query":{"requirements":[{"item":"mimic_tooth","select_trinket":true},{"item":"hand_axe","source":"golden_mimic","max_depth":6}]}}"#,
        ];
        for request in requests {
            let scout: Value = serde_json::from_str(&scout_impl(request).unwrap()).unwrap();
            let report: Value = serde_json::from_str(&seed_report_impl(request).unwrap()).unwrap();
            assert_eq!(report["seed"]["code"], scout["seed"]["code"], "{request}");
            assert_eq!(report["seed"]["value"], scout["seed"]["value"], "{request}");
            assert_eq!(report["trinkets"]["selected"], scout["selectedTrinket"]);
            assert_eq!(report["ringGems"], scout["ringGems"], "{request}");
            let floors = report["floors"].as_array().unwrap();
            let scout_items = scout["items"].as_array().unwrap();
            for floor in floors {
                let expected: Vec<&Value> = scout_items
                    .iter()
                    .filter(|item| item["depth"] == floor["depth"])
                    .collect();
                // Equipment comes first in scout order; the other categories follow.
                let listed = floor["items"].as_array().unwrap();
                let (equipment, others) = listed.split_at(expected.len().min(listed.len()));
                let base: Vec<Value> = equipment
                    .iter()
                    .map(|item| {
                        let mut item = item.clone();
                        for field in ["prediction", "conditions", "ranges"] {
                            item.as_object_mut().unwrap().remove(field);
                        }
                        item
                    })
                    .collect();
                let base: Vec<&Value> = base.iter().collect();
                assert_eq!(base, expected, "{request} depth {}", floor["depth"]);
                for item in others {
                    let category = item["category"].as_str().unwrap();
                    assert!(
                        !["weapon", "armor", "wand", "ring", "trinket", "artifact"]
                            .contains(&category),
                        "{request} depth {} {item}",
                        floor["depth"]
                    );
                }
            }
            let offers: Vec<_> = report["trinkets"]["offers"]
                .as_array()
                .unwrap()
                .iter()
                .chain(report["trinkets"]["transmutationOrder"].as_array().unwrap())
                .collect();
            let order: Vec<_> = scout["trinketOrder"].as_array().unwrap().iter().collect();
            assert_eq!(offers, order, "{request}");
            assert_eq!(report["trinkets"]["artifactDecks"], scout["artifactDecks"]);
            for (index, quest) in scout["quests"].as_array().unwrap().iter().enumerate() {
                for field in ["quest", "variant", "depth"] {
                    assert_eq!(report["quests"][index][field], quest[field], "{request}");
                }
            }
            for entry in scout["feelings"].as_array().unwrap() {
                let depth = usize::try_from(entry["depth"].as_u64().unwrap()).unwrap();
                assert_eq!(floors[depth - 1]["feeling"], entry["feeling"], "{request}");
            }
            for entry in scout["floorRooms"].as_array().unwrap() {
                let depth = usize::try_from(entry["depth"].as_u64().unwrap()).unwrap();
                assert_eq!(floors[depth - 1]["rooms"], entry["rooms"], "{request}");
            }
            if let Some(total) = scout
                .get("totalRequirements")
                .filter(|_| request.contains("query"))
            {
                assert_eq!(&report["query"]["totalRequirements"], total);
                assert_eq!(
                    report["query"]["matchedRequirements"],
                    scout["matchedRequirements"]
                );
            }
            let mappings = &scout["itemMappings"];
            assert_eq!(report["identities"], *mappings, "{request}");
        }
    }

    /// Compares the committed fixtures with fresh reports, or rewrites them
    /// with `UPDATE_SEED_REPORT_FIXTURES=1`.
    #[test]
    fn seed_report_fixtures_are_current() {
        let directory =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/seed-report");
        let update = std::env::var_os("UPDATE_SEED_REPORT_FIXTURES").is_some();
        for (seed, file) in FIXTURES {
            let report: shpd_seedfinder_core::report::SeedReport = serde_json::from_str(
                &seed_report_impl(&format!(r#"{{"seed":"{seed}"}}"#)).unwrap(),
            )
            .unwrap();
            let text = format!("{}\n", serde_json::to_string_pretty(&report).unwrap());
            let path = directory.join(file);
            if update {
                std::fs::create_dir_all(&directory).unwrap();
                std::fs::write(&path, text).unwrap();
            } else {
                let committed = std::fs::read_to_string(&path).unwrap_or_default();
                assert!(
                    committed == text,
                    "{} is stale; run UPDATE_SEED_REPORT_FIXTURES=1 cargo test -p shpd-seedfinder-wasm seed_report",
                    path.display()
                );
            }
        }
    }
}
