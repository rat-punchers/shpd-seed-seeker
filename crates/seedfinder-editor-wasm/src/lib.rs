//! The requirement editor for the browser, on its own.
//!
//! The web app renders its query builder before the engine module
//! (`crates/seedfinder-wasm`, several megabytes of world generation and
//! probability tables) has arrived, and keeps working if it never does. The
//! requirement board and sheet now take their rules from the shared core,
//! so the builder needs the core at first render — but only its editor.
//! This module exports just the editor's envelopes; the linker drops
//! everything they never reach, which keeps the module small enough to load
//! eagerly.
//!
//! Every export takes and returns JSON text and never throws: a request the
//! editor cannot read answers `{"error": ...}` (`docs/requirement-editor.md`).

use shpd_seedfinder_core::editor;
use wasm_bindgen::prelude::*;

/// Answers a requirement-board request: the board's rows after the
/// request's edits, with everything the board draws.
#[wasm_bindgen]
#[must_use]
pub fn requirement_board(request_json: &str) -> String {
    editor::requirement_board(request_json)
}

/// Answers a requirement-sheet request: `open`, `change` or `save`.
#[wasm_bindgen]
#[must_use]
pub fn requirement_editor(request_json: &str) -> String {
    editor::requirement_editor(request_json)
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::{requirement_board, requirement_editor};

    #[test]
    fn the_exports_answer_the_shared_envelopes() {
        let board: Value = serde_json::from_str(&requirement_board(
            r#"{"rows":[{"key":1,"kind":"wand","upgrade":3}],
                "edits":[{"type":"set_count","key":1,"count":2}]}"#,
        ))
        .unwrap();
        assert_eq!(
            board["rows"],
            json!([
                {"key": 1, "kind": "wand", "upgrade": 3, "identity_group": 1},
                {"key": 2, "kind": "wand", "identity_group": 1},
            ])
        );
        assert_eq!(
            board["items"][0]["chips"][0]["badges"]["count"]["text"],
            json!("×2")
        );

        let sheet: Value =
            serde_json::from_str(&requirement_editor(r#"{"op":"open","rows":[]}"#)).unwrap();
        assert!(sheet["draft"].is_string());
        assert_eq!(sheet["form"]["item"]["value"], Value::Null);

        // Bad requests are answered, never thrown.
        for answer in [requirement_board("nope"), requirement_editor("{}")] {
            let answer: Value = serde_json::from_str(&answer).unwrap();
            assert!(answer["error"].is_string(), "{answer}");
        }
    }
}
