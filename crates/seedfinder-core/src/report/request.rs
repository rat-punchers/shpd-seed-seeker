//! The `seed_report` JSON request. Its run fields follow the same rules as
//! `level_map` ([`crate::scout_request`]).

use serde::Deserialize;
use serde_json::Value;

use crate::catalog::ItemId;
use crate::challenges::Challenges;
use crate::query::SearchQuery;
use crate::scout_request::ScoutRun;
use crate::seed::{DungeonSeed, format_input};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    seed: String,
    #[serde(default)]
    challenges: Vec<String>,
    /// Absent resolves from the query; "none" explicitly selects No Trinket.
    #[serde(default)]
    trinket: Option<String>,
    #[serde(default)]
    query: Option<Value>,
}

/// A validated request; query-based trinket selection is already resolved.
#[derive(Clone, Debug)]
pub struct ReportRequest {
    pub seed: DungeonSeed,
    pub challenges: Challenges,
    pub selected_trinket: Option<ItemId>,
    pub query: Option<SearchQuery>,
}

/// Reads `{seed, challenges?, trinket?, query?}`. The seed is a seed code in
/// any grouping or case, or a daily date.
///
/// # Errors
/// Reports malformed JSON, invalid seeds, unknown challenges, invalid
/// queries, and trinkets outside the seed's four Catalyst offers.
pub fn decode_request(input: &str) -> Result<ReportRequest, String> {
    let request: Request = serde_json::from_str(input)
        .map_err(|error| format!("invalid seed report request JSON: {error}"))?;
    let seed = DungeonSeed::from_scout_input(&format_input(&request.seed))
        .map_err(|error| error.to_string())?;
    let run = ScoutRun::decode(
        seed,
        &request.challenges,
        request.query.as_ref(),
        request.trinket.as_deref(),
    )?;
    Ok(ReportRequest {
        seed,
        challenges: run.challenges,
        selected_trinket: run.selected_trinket,
        query: run.query,
    })
}

impl ReportRequest {
    /// Generates the world through depth 24 and builds its report.
    ///
    /// # Errors
    /// Reports a failed world generation.
    pub fn generate(&self) -> Result<super::SeedReport, String> {
        let observed = super::observe::observe(self.seed, self.challenges, self.selected_trinket)?;
        Ok(super::build(
            &observed,
            self.selected_trinket,
            self.query.as_ref(),
        ))
    }
}

/// Answers a request with the report's JSON text.
///
/// # Errors
/// Reports invalid requests and failed world generation.
pub fn document(input: &str) -> Result<String, String> {
    let report = decode_request(input)?.generate()?;
    serde_json::to_string(&report).map_err(|error| error.to_string())
}
