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

pub(crate) fn seed_report_impl(request_json: &str) -> Result<String, String> {
    shpd_seedfinder_core::report::document(request_json)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::seed_report_impl;

    /// Real reports kept beside the doc; see "Fixtures" there.
    const FIXTURES: [(&str, &str); 1] = [("AAA-AAA-AAA", "aaa-aaa-aaa.json")];

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
                // A Windows checkout may turn the fixtures' LF into CRLF.
                let committed = std::fs::read_to_string(&path)
                    .unwrap_or_default()
                    .replace("\r\n", "\n");
                assert!(
                    committed == text,
                    "{} is stale; run UPDATE_SEED_REPORT_FIXTURES=1 cargo test -p shpd-seedfinder-wasm seed_report",
                    path.display()
                );
            }
        }
    }
}
