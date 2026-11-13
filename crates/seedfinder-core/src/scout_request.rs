//! The run fields the JSON scout requests share (`seed_report` and
//! `level_map`): challenge names, an optional query and the selected trinket.

use serde_json::Value;

use crate::catalog::ItemId;
use crate::challenges::Challenges;
use crate::json_query::{self, CHALLENGE_NAMES};
use crate::query::SearchQuery;
use crate::seed::DungeonSeed;
use crate::trinkets::{parse_offered, selected_for_query};

/// A request's run options, validated, with query-based trinket selection
/// already resolved.
#[derive(Clone, Debug)]
pub(crate) struct ScoutRun {
    pub challenges: Challenges,
    pub query: Option<SearchQuery>,
    pub selected_trinket: Option<ItemId>,
}

impl ScoutRun {
    /// Reads a request's `challenges` names, `query` document and `trinket`
    /// for `seed`. An absent trinket resolves from the query; `"none"`
    /// explicitly selects No Trinket; any other value must be one of the
    /// seed's four Catalyst offers.
    ///
    /// # Errors
    /// Reports unknown challenges, invalid queries, and unknown trinkets or
    /// trinkets outside the offers.
    pub(crate) fn decode(
        seed: DungeonSeed,
        challenges: &[String],
        query: Option<&Value>,
        trinket: Option<&str>,
    ) -> Result<Self, String> {
        let mut mask = Challenges::NONE;
        for name in challenges {
            mask |= CHALLENGE_NAMES
                .iter()
                .find(|(known, _)| *known == name.as_str())
                .ok_or_else(|| format!("unknown challenge: {name}"))?
                .1;
        }
        let query = query
            .map(|value| json_query::decode(&value.to_string()))
            .transpose()?;
        let selected_trinket = match trinket {
            None => query.as_ref().and_then(|q| selected_for_query(seed, q)),
            Some("none") => None,
            Some(id) => Some(parse_offered(seed, id)?),
        };
        Ok(Self {
            challenges: mask,
            query,
            selected_trinket,
        })
    }
}
