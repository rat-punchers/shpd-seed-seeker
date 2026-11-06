//! Per-floor entries of a seed report.

use serde::{Deserialize, Serialize};

use super::item::Item;
use crate::floor_filters::RoomType;
use crate::level_prelude::Feeling;
use crate::model::GeneratedWorld;
use crate::quests::QuestSummary;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Floor {
    pub depth: u8,
    /// Absent on boss floors, which roll no feeling.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feeling: Option<String>,
    /// Room types present; empty on floors without room tracking.
    pub rooms: Vec<RoomType>,
    /// Level builder class; the `builders` section.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub builder: Option<String>,
    /// Guaranteed fixtures such as alchemy pots; the `alchemyPots` section.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub appearances: Option<Vec<Appearance>>,
    pub items: Vec<Item>,
    /// Mobs generated with the floor; the `encounters` section.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encounters: Option<Vec<Encounter>>,
    /// Quest sub-levels reached from this floor.
    pub branches: Vec<Branch>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Appearance {
    /// `alchemy_pot`.
    pub kind: String,
    /// Room type holding it, when known.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    /// Hidden behind a secret door.
    pub secret: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Encounter {
    pub mob: String,
    pub quantity: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rewards: Option<Vec<EncounterReward>>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EncounterReward {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item: Option<String>,
    pub category: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect: Option<String>,
    /// `guaranteed`, `runtime_chance` or `generated_with_floor`.
    pub prediction: String,
    /// Drop chance for `runtime_chance` rewards.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chance: Option<Chance>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Chance {
    pub numerator: u32,
    pub denominator: u32,
}

/// A quest sub-level. Request its map with `level_map` at the parent depth
/// and this `branch`.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Branch {
    pub branch: u8,
    /// `blacksmith_crystal`, `blacksmith_gnoll` or `imp_vault`, as in `level_map`.
    pub kind: String,
    /// The quest variant the sub-level hosts.
    pub objective: String,
    pub access: BranchAccess,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BranchAccess {
    pub quest: String,
    /// The quest must be accepted before the entrance opens.
    pub requires_acceptance: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_item: Option<String>,
}

/// Floors 1–24 in depth order. Items keep their given order: equipment in
/// world order, then the other categories.
pub(super) fn floors(world: &GeneratedWorld, items: Vec<Item>) -> Vec<Floor> {
    let mut floors: Vec<Floor> = (1..=24)
        .map(|depth| Floor {
            depth,
            feeling: world
                .feelings
                .iter()
                .find(|entry| entry.depth == depth)
                .map(|entry| feeling_name(entry.feeling).to_owned()),
            rooms: world
                .floor_rooms
                .iter()
                .find(|floor| floor.depth == depth)
                .map(|floor| floor.rooms.iter().collect())
                .unwrap_or_default(),
            builder: None,
            appearances: None,
            items: Vec::new(),
            encounters: None,
            branches: branches(world.quests, depth),
        })
        .collect();
    for item in items {
        if let Some(floor) = floors.get_mut(usize::from(item.depth).wrapping_sub(1)) {
            floor.items.push(item);
        }
    }
    floors
}

fn branches(quests: QuestSummary, depth: u8) -> Vec<Branch> {
    let mut output = Vec::new();
    if let Some(quest) = quests.blacksmith.filter(|quest| quest.depth == depth) {
        let objective = super::quest::blacksmith_variant(quest.variant);
        output.push(Branch {
            branch: 1,
            kind: format!("blacksmith_{objective}"),
            objective: objective.to_owned(),
            access: BranchAccess {
                quest: "blacksmith".to_owned(),
                requires_acceptance: true,
                required_item: None,
            },
        });
    }
    if quests.imp.is_some_and(|quest| quest.depth == depth) {
        output.push(Branch {
            branch: 1,
            kind: "imp_vault".to_owned(),
            objective: "vault".to_owned(),
            access: BranchAccess {
                quest: "imp".to_owned(),
                requires_acceptance: true,
                required_item: None,
            },
        });
    }
    output
}

pub(super) const fn feeling_name(feeling: Feeling) -> &'static str {
    match feeling {
        Feeling::None => "none",
        Feeling::Chasm => "chasm",
        Feeling::Water => "water",
        Feeling::Grass => "grass",
        Feeling::Dark => "dark",
        Feeling::Large => "large",
        Feeling::Traps => "traps",
        Feeling::Secrets => "secrets",
    }
}
