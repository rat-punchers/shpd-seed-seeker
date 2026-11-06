//! Quest entries of a seed report.

use serde::{Deserialize, Serialize};

use crate::feasibility::Quest as QuestKind;
use crate::quests::{
    BlacksmithQuestType, GhostQuestType, ImpQuestType, QuestSummary, WandmakerQuestType,
};

/// Smith favor one Blacksmith reward costs (`Blacksmith.Quest` smith price).
const SMITH_FAVOR: u32 = 2_000;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Quest {
    /// `ghost`, `wandmaker`, `blacksmith` or `imp`.
    pub quest: String,
    pub variant: String,
    pub depth: u8,
    pub spawn_depth_range: DepthRange,
    pub rewards: RewardSelection,
    /// The reward options in option order; the `questRewardSlots` section.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slots: Option<Vec<RewardSlot>>,
    /// Imp: no deck drift in the window moves the floor RNG behind the
    /// range-rule slots' levels and effects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upgrades_pinned: Option<bool>,
    /// Imp: Scroll of Upgrade equivalents across all options.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_upgrade_value: Option<u32>,
}

/// Inclusive floors the quest giver can spawn on.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DepthRange {
    pub min: u8,
    pub max: u8,
}

/// The player keeps `selectedCount` of `optionCount` rewards.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RewardSelection {
    /// The item `source` the reward items carry.
    pub source: String,
    pub option_count: u8,
    pub selected_count: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub favor_requirement: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RewardSlot {
    pub slot: u8,
    /// The seed-drawn item.
    pub item: String,
    pub level: u8,
    /// The level cannot change with run history.
    pub level_pinned: bool,
    /// Ghost, Blacksmith and Imp: `artifact`, `ring`, `weapon`, `missile`,
    /// `armor` or `wand`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level_rule: Option<LevelRule>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect: Option<String>,
    /// Items a deck-index drift can put in this slot; absent for slots drawn
    /// from no seeded deck.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidates: Option<Vec<SlotCandidate>>,
    /// Denominator for candidate weights.
    pub scenario_count: u32,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum LevelRule {
    Range { min: u8, max: u8 },
    TransferUpgrade { transfer: u8 },
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SlotCandidate {
    pub item: String,
    /// Deck-index offsets from the seed draw, nearest first; 0 is the draw.
    pub drifts: Vec<i32>,
    pub weight: u32,
}

/// The quests present in the generated world, in Ghost, Wandmaker,
/// Blacksmith, Imp order.
pub(super) fn quests(summary: QuestSummary) -> Vec<Quest> {
    let mut output = Vec::with_capacity(4);
    if let Some(quest) = summary.ghost {
        let variant = match quest.variant {
            GhostQuestType::FetidRat => "fetid_rat",
            GhostQuestType::GnollTrickster => "gnoll_trickster",
            GhostQuestType::GreatCrab => "great_crab",
        };
        output.push(entry(QuestKind::Ghost, variant, quest.depth));
    }
    if let Some(quest) = summary.wandmaker {
        let variant = match quest.variant {
            WandmakerQuestType::CorpseDust => "corpse_dust",
            WandmakerQuestType::ElementalEmbers => "elemental_embers",
            WandmakerQuestType::Rotberry => "rotberry",
        };
        output.push(entry(QuestKind::Wandmaker, variant, quest.depth));
    }
    if let Some(quest) = summary.blacksmith {
        output.push(entry(
            QuestKind::Blacksmith,
            blacksmith_variant(quest.variant),
            quest.depth,
        ));
    }
    if let Some(quest) = summary.imp {
        let variant = match quest.variant {
            ImpQuestType::Vault => "vault",
        };
        output.push(entry(QuestKind::Imp, variant, quest.depth));
    }
    output
}

pub(super) const fn blacksmith_variant(variant: BlacksmithQuestType) -> &'static str {
    match variant {
        BlacksmithQuestType::Crystal => "crystal",
        BlacksmithQuestType::Gnoll => "gnoll",
    }
}

fn entry(kind: QuestKind, variant: &str, depth: u8) -> Quest {
    let (name, source, option_count, favor_requirement) = match kind {
        QuestKind::Ghost => ("ghost", "ghost_reward", 2, None),
        QuestKind::Wandmaker => ("wandmaker", "wandmaker_reward", 2, None),
        QuestKind::Blacksmith => ("blacksmith", "blacksmith_reward", 4, Some(SMITH_FAVOR)),
        QuestKind::Imp => ("imp", "imp_reward", 6, None),
    };
    let (min, max) = kind.window();
    Quest {
        quest: name.to_owned(),
        variant: variant.to_owned(),
        depth,
        spawn_depth_range: DepthRange { min, max },
        rewards: RewardSelection {
            source: source.to_owned(),
            option_count,
            selected_count: 1,
            favor_requirement,
        },
        slots: None,
        upgrades_pinned: None,
        total_upgrade_value: None,
    }
}
