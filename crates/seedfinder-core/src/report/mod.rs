//! The `seed_report` document for one seed's Analyze screen, specified in
//! `docs/seed-report-format.md`. Fields not yet computed stay absent, and
//! `sections` lists the sections the report fills.

mod floor;
mod item;
mod quest;
mod request;
#[cfg(test)]
mod tests;
mod trinket;

use serde::{Deserialize, Serialize};

pub use floor::{Appearance, Branch, BranchAccess, Chance, Encounter, EncounterReward, Floor};
pub use item::{
    Accessibility, ArtifactEvent, Condition, Item, ItemEffect, Prediction, Range, Ranges,
    TrinketEvent,
};
pub use quest::{DepthRange, LevelRule, Quest, RewardSelection, RewardSlot, SlotCandidate};
pub use request::{ReportRequest, decode_request, document};
pub use trinket::{ArtifactDeck, ItemRef, TrinketTiming, Trinkets};

use crate::catalog::ItemId;
use crate::model::GeneratedWorld;
use crate::query::{ScoutMatches, SearchQuery, scout_matches};

pub const FORMAT: &str = "seed-seeker-seed-report";
pub const SCHEMA_VERSION: u32 = 1;

/// A part of the report the engine fills. The UI renders a part only when
/// the report lists it.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Section {
    Identities,
    RingGems,
    TrinketOffers,
    ArtifactDecks,
    Feelings,
    Rooms,
    /// Weapons, armor, wands, rings, trinkets and artifacts on each floor.
    Equipment,
    Quests,
    Branches,
    /// Every item category, with `prediction`, `conditions` and `ranges`.
    AllItems,
    TrinketTiming,
    AlchemyPots,
    Builders,
    QuestRewardSlots,
    Encounters,
}

/// The sections this engine fills.
pub const SECTIONS: [Section; 9] = [
    Section::Identities,
    Section::RingGems,
    Section::TrinketOffers,
    Section::ArtifactDecks,
    Section::Feelings,
    Section::Rooms,
    Section::Equipment,
    Section::Quests,
    Section::Branches,
];

const NOTES: [&str; 2] = [
    "Floor items list equipment only: weapons, armor, wands, rings, trinkets and artifacts.",
    "Trinket timing, alchemy pots, builders, quest reward slots and floor encounters are not computed.",
];

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// Some sections are not computed yet.
    Partial,
    Complete,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SeedReport {
    pub format: String,
    pub schema_version: u32,
    pub shpd_version: String,
    pub shpd_commit: String,
    pub status: Status,
    pub notes: Vec<String>,
    pub sections: Vec<Section>,
    pub seed: SeedInfo,
    /// Present when the request carried a query.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub query: Option<QueryMatch>,
    pub identities: Identities,
    /// The gem index each ring class is drawn with, in catalog ring order.
    pub ring_gems: Vec<u8>,
    pub trinkets: Trinkets,
    pub floors: Vec<Floor>,
    pub quests: Vec<Quest>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SeedInfo {
    /// `XXX-XXX-XXX`, or `YYYY-MM-DD` for a daily run.
    pub code: String,
    pub value: u64,
    pub daily: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QueryMatch {
    pub matched_requirements: usize,
    pub total_requirements: usize,
}

/// Unidentified appearances, in the game's class order.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Identities {
    pub scrolls: Vec<Identity>,
    pub potions: Vec<Identity>,
    pub rings: Vec<Identity>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Identity {
    pub name: String,
    pub appearance: String,
    pub sprite_index: u16,
}

/// Builds the report for a generated world. `selected` is the trinket the
/// world was generated with; `query` marks matched items like `scout`.
#[must_use]
pub fn build(
    world: &GeneratedWorld,
    selected: Option<ItemId>,
    query: Option<&SearchQuery>,
) -> SeedReport {
    let marks = query.map(|query| scout_matches(world, query));
    let items = world
        .items
        .iter()
        .enumerate()
        .map(|(index, world_item)| {
            item::Item::from_world(world_item, item_marks(marks.as_ref(), index))
        })
        .collect();
    SeedReport {
        format: FORMAT.to_owned(),
        schema_version: SCHEMA_VERSION,
        shpd_version: crate::SHPD_VERSION.to_owned(),
        shpd_commit: crate::SHPD_COMMIT.to_owned(),
        status: Status::Partial,
        notes: NOTES.iter().map(|&note| note.to_owned()).collect(),
        sections: SECTIONS.to_vec(),
        seed: SeedInfo {
            code: world.seed.to_code(),
            value: world.seed.value(),
            daily: world.seed.is_daily(),
        },
        query: marks.as_ref().map(|marks| QueryMatch {
            matched_requirements: marks.matched_requirements,
            total_requirements: marks.total_requirements,
        }),
        identities: identities(world),
        ring_gems: world.ring_gems.ordinals().to_vec(),
        trinkets: trinket::trinkets(world, selected, marks.as_ref()),
        floors: floor::floors(world, items),
        quests: quest::quests(world.quests),
    }
}

fn item_marks(marks: Option<&ScoutMatches>, index: usize) -> item::Marks {
    let flag = |flags: &[bool]| flags.get(index).copied().unwrap_or(false);
    marks.map_or_else(item::Marks::default, |marks| item::Marks {
        matched: flag(&marks.matched),
        resin_donor: flag(&marks.resin_donors),
        excluded: flag(&marks.excluded),
    })
}

fn identities(world: &GeneratedWorld) -> Identities {
    let mappings = crate::item_mappings::item_mappings(world.seed);
    let list = |entries: &[crate::item_mappings::ItemMapping]| {
        entries
            .iter()
            .map(|entry| Identity {
                name: entry.name.to_owned(),
                appearance: entry.appearance.to_owned(),
                sprite_index: entry.sprite_index,
            })
            .collect()
    };
    Identities {
        scrolls: list(&mappings.scrolls),
        potions: list(&mappings.potions),
        rings: list(&mappings.rings),
    }
}
