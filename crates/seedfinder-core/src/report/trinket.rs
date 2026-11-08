//! Trinket offers, transmutations and artifact decks of a seed report.

use std::borrow::Cow;

use serde::{Deserialize, Serialize};

use super::item::{Item, Marks};
use crate::catalog::{ItemId, ItemKind, item};
use crate::model::{GeneratedWorld, WorldItem};
use crate::query::ScoutMatches;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Trinkets {
    /// The four Trinket Catalyst offers.
    pub offers: Vec<ItemRef>,
    /// The selected offer's id, or null for No Trinket.
    pub selected: Option<String>,
    /// Transmutation results 1–13, in order.
    pub transmutation_order: Vec<ItemRef>,
    /// Remaining artifact deck before floor 1 (`depth` 0) and after each floor.
    pub artifact_decks: Vec<ArtifactDeck>,
    /// When the trinket takes effect; the `trinketTiming` section.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timing: Option<TrinketTiming>,
}

/// A catalog item reference. `matched` marks a query match.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ItemRef {
    pub id: String,
    pub name: String,
    /// The game's examine text; absent where the game has none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub sprite_index: u16,
    pub matched: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactDeck {
    pub depth: u8,
    pub order: Vec<ItemRef>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrinketTiming {
    pub catalyst_depth: u8,
    pub first_alchemy_pot_depth: u8,
    pub first_alchemy_pot_secret: bool,
    /// First floor the player can choose the trinket on.
    pub selection_depth: u8,
    /// First floor whose generation the trinket can change.
    pub first_effective_depth: u8,
    /// Index-aligned with `offers`: `modeled`, `unmodeled` or `none`.
    pub option_effects: Vec<String>,
}

/// Floors list the Magical Catalyst itself; its four offers are in
/// `trinkets.offers`. The world carries the offers in the Catalyst's place,
/// so the first offer becomes the Catalyst and later offers return `None`
/// after adding their query marks to it.
pub(super) fn listed_world_item<'a>(
    world_item: &'a WorldItem,
    marks: Marks,
    items: &mut [Item],
) -> Option<Cow<'a, WorldItem>> {
    if item(world_item.item).kind != ItemKind::Trinket {
        return Some(Cow::Borrowed(world_item));
    }
    let catalyst_id = item(ItemId::TrinketCatalyst).stable_id;
    if let Some(catalyst) = items.iter_mut().find(|entry| entry.id == catalyst_id) {
        catalyst.matched |= marks.matched;
        catalyst.resin_donor |= marks.resin_donor;
        catalyst.excluded |= marks.excluded;
        return None;
    }
    Some(Cow::Owned(WorldItem {
        item: ItemId::TrinketCatalyst,
        ..world_item.clone()
    }))
}

fn item_ref(id: ItemId, matched: bool) -> ItemRef {
    let entry = item(id);
    ItemRef {
        id: entry.stable_id.to_owned(),
        name: entry.name.to_owned(),
        description: super::item::description(entry.stable_id),
        sprite_index: entry.sprite_index,
        matched,
    }
}

/// Offers and transmutations follow `trinkets::trinket_order`; the decks and
/// match marks follow the `scout` rules.
pub(super) fn trinkets(
    world: &GeneratedWorld,
    selected: Option<ItemId>,
    marks: Option<&ScoutMatches>,
) -> Trinkets {
    let order = crate::trinkets::trinket_order(world.seed);
    let transmuted = |step: usize| marks.is_some_and(|marks| marks.transmuted_trinkets[step]);
    Trinkets {
        offers: order[..4].iter().map(|&id| item_ref(id, false)).collect(),
        selected: selected.map(|id| item(id).stable_id.to_owned()),
        transmutation_order: order[4..]
            .iter()
            .enumerate()
            .map(|(step, &id)| item_ref(id, transmuted(step)))
            .collect(),
        artifact_decks: artifact_decks(world, marks),
        timing: None,
    }
}

fn artifact_decks(world: &GeneratedWorld, marks: Option<&ScoutMatches>) -> Vec<ArtifactDeck> {
    use crate::artifacts::deck_at;
    (0..=24)
        .map(|depth| ArtifactDeck {
            depth,
            order: deck_at(world, depth)
                .iter()
                .enumerate()
                .map(|(index, &id)| {
                    let matched = marks.is_some_and(|marks| {
                        if depth == 0 {
                            marks.transmuted_artifacts.iter().any(|&(floor, position)| {
                                deck_at(world, floor).get(position) == Some(&id)
                            })
                        } else {
                            marks.transmuted_artifacts.contains(&(depth, index))
                        }
                    });
                    item_ref(id, matched)
                })
                .collect(),
        })
        .collect()
}
