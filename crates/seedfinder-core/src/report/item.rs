//! One floor item in a seed report, plus the optional prediction fields.

use serde::{Deserialize, Serialize};

use crate::catalog::{Effect, item, kind_name};
use crate::model::{self, WorldItem, source_name};

/// A floor item. The base fields equal one `scout` item; the optional fields
/// stay absent until the `allItems` section is computed.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[allow(clippy::struct_excessive_bools)] // Independent flags in the report document.
pub struct Item {
    pub id: String,
    pub name: String,
    pub category: String,
    pub sprite_index: u16,
    pub upgrade: u8,
    pub effect: Option<ItemEffect>,
    pub cursed: bool,
    pub secret: bool,
    pub depth: u8,
    pub source: String,
    pub accessibility: Accessibility,
    pub matched: bool,
    pub resin_donor: bool,
    pub excluded: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prediction: Option<Prediction>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<Condition>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ranges: Option<Ranges>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ItemEffect {
    pub name: String,
    /// `enchantment` (weapon enchantments and armor glyphs) or `curse`.
    pub kind: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Accessibility {
    Independent,
    Choice {
        group: u16,
        option: u8,
    },
    /// `mask` is the scenario bit set as lowercase hex, `0x…`.
    Scenarios {
        group: u16,
        mask: String,
    },
}

/// How firmly the seed alone fixes the item.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Prediction {
    Exact,
    Constrained,
    Variable,
}

/// One condition the item depends on.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Condition {
    Challenge {
        challenge: String,
        enabled: bool,
    },
    Trinket {
        events: Vec<TrinketEvent>,
    },
    Artifact {
        events: Vec<ArtifactEvent>,
    },
    Quest {
        quest: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        depth: Option<u8>,
    },
    Choice {
        group: String,
        option_count: u8,
        selected_count: u8,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        favor_requirement: Option<u32>,
    },
    Inventory {
        requirement: String,
    },
    Runtime {
        state: String,
    },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrinketEvent {
    pub before_depth: u8,
    /// `acquired`, `upgraded` or `transmuted`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trinket: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_upgrades: Option<u8>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArtifactEvent {
    pub before_depth: u8,
    /// `obtained` or `transmuted`.
    pub kind: String,
    pub artifact: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Ranges {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quantity: Option<Range>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tier: Option<Range>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<Range>,
}

/// Inclusive bounds.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Range {
    pub min: u32,
    pub max: u32,
}

/// Query marks for one item: matched, resin donor, excluded.
#[derive(Clone, Copy, Debug, Default)]
pub(super) struct Marks {
    pub matched: bool,
    pub resin_donor: bool,
    pub excluded: bool,
}

impl Item {
    pub(super) fn from_world(world_item: &WorldItem, marks: Marks) -> Self {
        let definition = item(world_item.item);
        Self {
            id: definition.stable_id.to_owned(),
            name: definition.name.to_owned(),
            category: kind_name(definition.kind).to_owned(),
            sprite_index: definition.sprite_index,
            upgrade: world_item.upgrade,
            effect: world_item.effect.map(effect),
            cursed: world_item.cursed,
            secret: world_item.secret,
            depth: world_item.depth,
            source: source_name(world_item.source).to_owned(),
            accessibility: accessibility(world_item.accessibility),
            matched: marks.matched,
            resin_donor: marks.resin_donor,
            excluded: marks.excluded,
            prediction: None,
            conditions: None,
            ranges: None,
        }
    }
}

fn effect(effect: Effect) -> ItemEffect {
    ItemEffect {
        name: effect.wire_name().to_owned(),
        kind: if effect.is_curse() {
            "curse"
        } else {
            "enchantment"
        }
        .to_owned(),
    }
}

fn accessibility(accessibility: model::Accessibility) -> Accessibility {
    match accessibility {
        model::Accessibility::Independent => Accessibility::Independent,
        model::Accessibility::Choice { group, option } => Accessibility::Choice { group, option },
        model::Accessibility::Scenarios { group, mask } => Accessibility::Scenarios {
            group,
            mask: format!("0x{mask:x}"),
        },
    }
}
