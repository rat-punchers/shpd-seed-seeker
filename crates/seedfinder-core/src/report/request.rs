//! The `seed_report` JSON request, read with the same rules as `scout`.

use serde::Deserialize;
use serde_json::Value;

use crate::catalog::ItemId;
use crate::challenges::Challenges;
use crate::json_query::{self, CHALLENGE_NAMES};
use crate::main_world::generate_main_world_with_trinket;
use crate::query::SearchQuery;
use crate::seed::{DungeonSeed, format_input};
use crate::trinkets::{parse_offered, selected_for_query};

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

/// Reads `{seed, challenges?, trinket?, query?}`. The seed accepts what
/// `scout` accepts: a seed code in any grouping or case, or a daily date.
///
/// # Errors
/// Reports malformed JSON, invalid seeds, unknown challenges, invalid
/// queries, and trinkets outside the seed's four Catalyst offers.
pub fn decode_request(input: &str) -> Result<ReportRequest, String> {
    let request: Request = serde_json::from_str(input)
        .map_err(|error| format!("invalid seed report request JSON: {error}"))?;
    let seed = DungeonSeed::from_scout_input(&format_input(&request.seed))
        .map_err(|error| error.to_string())?;
    let mut challenges = Challenges::NONE;
    for name in request.challenges {
        challenges |= CHALLENGE_NAMES
            .iter()
            .find(|(known, _)| *known == name)
            .ok_or_else(|| format!("unknown challenge: {name}"))?
            .1;
    }
    let query = request
        .query
        .map(|value| json_query::decode(&value.to_string()))
        .transpose()?;
    let selected_trinket = match request.trinket.as_deref() {
        None => query.as_ref().and_then(|q| selected_for_query(seed, q)),
        Some("none") => None,
        Some(id) => Some(parse_offered(seed, id)?),
    };
    Ok(ReportRequest {
        seed,
        challenges,
        selected_trinket,
        query,
    })
}

impl ReportRequest {
    /// Generates the world through depth 24 and builds its report.
    ///
    /// # Errors
    /// Reports a failed world generation.
    pub fn generate(&self) -> Result<super::SeedReport, String> {
        let world =
            generate_main_world_with_trinket(self.seed, 24, self.challenges, self.selected_trinket)
                .map_err(|error| format!("world generation failed: {error}"))?;
        Ok(super::build(
            &world,
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
