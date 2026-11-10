//! One JSON request/response contract shared by C, JNI, wasm and Rust callers.

use super::{
    LevelMap, MapError, SCHEMA_VERSION, assets, generate_level_map_in_branch, validate_location,
};
use crate::catalog::item;
use crate::challenges::Challenges;
use crate::json_query::CHALLENGE_NAMES;
use crate::scout_request::ScoutRun;
use crate::seed::DungeonSeed;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    seed: String,
    depth: u8,
    #[serde(default)]
    branch: u8,
    #[serde(default)]
    challenges: Vec<String>,
    #[serde(default)]
    query: Option<Value>,
    /// Absent/null resolves from the query; "none" explicitly deselects.
    #[serde(default)]
    trinket: Option<String>,
}

/// A validated request; query-based selection has already been resolved.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LevelMapRequest {
    pub seed: DungeonSeed,
    pub depth: u8,
    pub branch: u8,
    pub challenges: Challenges,
    pub selected_trinket: Option<crate::catalog::ItemId>,
}

/// Parses a complete seed code, a supported regular depth, challenge names,
/// and optional scout query/initial-offer override. Partial seeds are rejected.
///
/// # Errors
/// Reports malformed JSON, unsupported depths, unknown challenges, invalid
/// queries, and selections outside the seed's four initial offers.
pub fn decode_request(input: &str) -> Result<LevelMapRequest, String> {
    let request: Request = serde_json::from_str(input)
        .map_err(|error| format!("invalid level map request: {error}"))?;
    let seed = DungeonSeed::from_scout_input(&request.seed).map_err(|error| error.to_string())?;
    validate_location(request.depth, request.branch).map_err(|error| error.to_string())?;
    let run = ScoutRun::decode(
        seed,
        &request.challenges,
        request.query.as_ref(),
        request.trinket.as_deref(),
    )?;
    Ok(LevelMapRequest {
        seed,
        depth: request.depth,
        branch: request.branch,
        challenges: run.challenges,
        selected_trinket: run.selected_trinket,
    })
}

impl LevelMapRequest {
    /// Generates and serializes the map. Native bridges contain generation
    /// panics in the session layer, like the other scout entry points.
    ///
    /// # Errors
    /// Reports a failed map generation.
    pub fn generate_document(&self) -> Result<String, MapError> {
        let map = generate_level_map_in_branch(
            self.seed,
            self.depth,
            self.branch,
            self.challenges,
            self.selected_trinket,
        )?;
        Ok(document(&map).to_string())
    }
}

/// Serializes a map without regenerating it or reading any runtime state.
#[must_use]
pub fn document(map: &LevelMap) -> Value {
    json!({
        "format": "seed-seeker-level-map",
        "schemaVersion": SCHEMA_VERSION,
        "shpdVersion": crate::SHPD_VERSION,
        "shpdCommit": crate::SHPD_COMMIT,
        "profile": "canonical-scout-raised-v3",
        "pickupAssumptions": {"earlierHourglass": "take_identify_uncurse", "shopSand": "buy"},
        "seed": map.seed.to_code(),
        "depth": map.depth,
        "branch": map.kind.branch(),
        "kind": map.kind,
        "branches": map.branches,
        "challenges": CHALLENGE_NAMES.iter().filter(|(_, flag)| map.challenges.contains(*flag)).map(|(name, _)| name).collect::<Vec<_>>(),
        "selectedTrinket": map.selected_trinket.map(|id| item(id).stable_id),
        "feeling": map.feeling.name(),
        "width": map.width,
        "height": map.height,
        "terrain": map.terrain,
        "entrance": map.entrance,
        "exit": map.exit,
        "secretRooms": map.secret_rooms,
        "secretDoors": map.terrain.iter().enumerate().filter_map(|(cell, &tile)| (tile == crate::geometry::terrain::SECRET_DOOR).then_some(cell)).collect::<Vec<_>>(),
        "secretTraps": map.terrain.iter().enumerate().filter_map(|(cell, &tile)| (tile == crate::geometry::terrain::SECRET_TRAP).then_some(cell)).collect::<Vec<_>>(),
        "traps": map.traps,
        "assetRevision": assets::SOURCE_REVISION,
        "assets": assets::ASSETS.iter().filter(|asset| map.scene.sprites.iter().flat_map(|sprite| &sprite.frames).flatten().chain(map.scene.emitters.iter().chain(&map.scene.concealed_emitters).map(|e| &e.image)).any(|draw| matches!(draw, super::MapDraw::Blit {asset: id,..} if *id == asset.id))).collect::<Vec<_>>(),
        "scene": map.scene,
        "contents": map.contents,
        "itemTooltips": map.item_tooltips(),
        "mobDetails": mob_details(map),
        "plantDetails": plant_details(map),
    })
}

/// Each generated plant kind's examine text and map tile, keyed by kind.
fn plant_details(map: &LevelMap) -> serde_json::Map<String, Value> {
    let columns = assets::get("terrain_features.png")
        .expect("embedded atlas")
        .width
        / 16;
    map.contents
        .plants
        .iter()
        .filter_map(|plant| {
            let key = match plant.kind.as_str() {
                "Blandfruit" | "BlandfruitBush" => "blandfruitbush".to_owned(),
                "Seedpod" => "wandofregrowth$seedpod".to_owned(),
                "Dewcatcher" => "wandofregrowth$dewcatcher".to_owned(),
                kind => kind.to_ascii_lowercase(),
            };
            let text = super::item_text::ITEM_TEXT;
            let (_, name, description) = text[text
                .binary_search_by_key(&key.as_str(), |entry| entry.0)
                .ok()?];
            let tile = 112 + plant.image;
            Some((
                plant.kind.clone(),
                json!({
                    "name": name,
                    "description": description,
                    "asset": "terrain_features.png",
                    "frameDurationMs": 1000,
                    "frames": [[tile % columns * 16, tile / columns * 16, 16, 16]],
                }),
            ))
        })
        .collect()
}

/// Each generated mob kind's examine text and idle film, keyed by kind.
fn mob_details(map: &LevelMap) -> serde_json::Map<String, Value> {
    map.contents
        .mobs
        .iter()
        .filter_map(|mob| {
            let (asset, duration, frames) = super::visuals::mob_film(&mob.kind)?;
            let (_, name, description) = super::mob_text::MOB_TEXT
                .iter()
                .find(|(kind, _, _)| *kind == mob.kind)?;
            Some((
                mob.kind.clone(),
                json!({
                    "name": name,
                    "description": description,
                    "asset": asset,
                    "frameDurationMs": duration,
                    "frames": frames,
                }),
            ))
        })
        .collect()
}
