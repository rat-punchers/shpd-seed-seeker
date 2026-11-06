//! The `seed_report` document for one seed's Analyze screen, specified in
//! `docs/seed-report-format.md`. Fields not yet computed stay absent, and
//! `sections` lists the sections the report fills.

mod floor;
mod item;
#[cfg(test)]
mod item_tests;
mod loose;
mod observe;
mod predict;
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

use std::collections::BTreeMap;

use crate::catalog::ItemId;
use crate::model::{self, GeneratedWorld, WorldItem};
use crate::query::{ScoutMatches, SearchQuery, scout_matches};
use observe::{Observed, PlacedItem};

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
pub const SECTIONS: [Section; 10] = [
    Section::Identities,
    Section::RingGems,
    Section::TrinketOffers,
    Section::ArtifactDecks,
    Section::Feelings,
    Section::Rooms,
    Section::Equipment,
    Section::Quests,
    Section::Branches,
    Section::AllItems,
];

const NOTES: [&str; 2] = [
    "Floor items leave out the Blacksmith mines and the Imp's vault, apart from the vault's treasure equipment.",
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

/// Builds the report from a scout-profile replay. `selected` is the trinket
/// the world was generated with; `query` marks matched items like `scout`.
fn build(observed: &Observed, selected: Option<ItemId>, query: Option<&SearchQuery>) -> SeedReport {
    let world = &observed.world;
    let marks = query.map(|query| scout_matches(world, query));
    let quests = quest::quests(world.quests);
    let context = predict::Context {
        quests: &quests,
        trinket: selected.filter(|id| predict::GENERATION_TRINKETS.contains(id)),
        trinket_depths: observed
            .floors
            .iter()
            .filter(|floor| floor.trinket_active)
            .map(|floor| floor.depth)
            .collect(),
        group_options: group_options(&world.items),
    };
    let mut stacks: BTreeMap<u8, Vec<&PlacedItem>> = BTreeMap::new();
    for floor in &observed.floors {
        stacks.entry(floor.depth).or_default().extend(
            floor
                .items
                .iter()
                .filter(|placed| loose::is_equipment(&placed.item)),
        );
    }
    let mut items = Vec::new();
    for (index, world_item) in world.items.iter().enumerate() {
        let mut item = item::Item::from_world(world_item, item_marks(marks.as_ref(), index));
        let quantity = stack_size(&mut stacks, world_item);
        predict::annotate(&mut item, true, quantity, &context);
        items.push(item);
    }
    let mut groups = loose::Groups::new(&world.items);
    for floor in &observed.floors {
        for placed in floor
            .items
            .iter()
            .filter(|placed| loose::is_listed(&placed.item))
        {
            let mut item = loose::item(placed, floor, &mut groups);
            let quantity = u32::try_from(placed.item.quantity).ok();
            predict::annotate(&mut item, placed.item.deterministic, quantity, &context);
            items.push(item);
        }
    }
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
        quests,
    }
}

/// Options per choice group: one more than its largest option number.
fn group_options(items: &[WorldItem]) -> BTreeMap<u16, u8> {
    let mut options = BTreeMap::new();
    for item in items {
        if let model::Accessibility::Choice { group, option } = item.accessibility {
            let count = options.entry(group).or_insert(0_u8);
            *count = (*count).max(option.saturating_add(1));
        }
    }
    options
}

/// The stack size of a world item's heap or carried copy on its floor. Items
/// that lie in no heap (quest rewards, sacrificial prizes, trinket offers,
/// vault treasure, the depth-20 shop) count one, except thrown weapons,
/// whose stack size is then unknown.
fn stack_size(stacks: &mut BTreeMap<u8, Vec<&PlacedItem>>, world_item: &WorldItem) -> Option<u32> {
    let definition = crate::catalog::item(world_item.item);
    let roll = crate::equipment::EquipmentRoll {
        upgrade: world_item.upgrade,
        effect: world_item.effect,
        cursed: world_item.cursed,
    };
    let floor = stacks.entry(world_item.depth).or_default();
    if let Some(index) = floor.iter().position(|placed| {
        placed.item.kind == definition.stable_id && placed.item.roll == Some(roll)
    }) {
        return u32::try_from(floor.remove(index).item.quantity).ok();
    }
    (definition.weapon_category() != Some(crate::catalog::WeaponCategory::Thrown)).then_some(1)
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
