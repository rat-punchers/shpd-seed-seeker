//! `prediction`, `conditions` and `ranges` for floor items (the `allItems`
//! section). An item is `exact` when the seed alone makes it spawn as listed,
//! `constrained` when its identity is fixed but its spawn depends on the
//! listed conditions, and `variable` when play or unseeded runtime state
//! picks its identity.

use std::collections::BTreeMap;

use super::item::{Accessibility, Condition, Item, Prediction, Range, Ranges, TrinketEvent};
use super::quest::Quest;
use crate::catalog::{ItemId, ItemKind, item_by_stable_id};
use crate::model::{self, WorldItem};

/// Trinkets this engine models in floor generation. Any other trinket leaves
/// the generated floors unchanged here.
pub(super) const GENERATION_TRINKETS: [ItemId; 7] = [
    ItemId::ParchmentScrap,
    ItemId::MimicTooth,
    ItemId::RatSkull,
    ItemId::CrackedSpyglass,
    ItemId::ExoticCrystals,
    ItemId::TrapMechanism,
    ItemId::MossyClump,
];

/// Run facts every item's prediction draws on.
pub(super) struct Context<'a> {
    pub quests: &'a [Quest],
    /// The selected trinket, when it can change floor generation.
    pub trinket: Option<ItemId>,
    /// Floors generated with that trinket active.
    pub trinket_depths: Vec<u8>,
    /// Options per choice group, from the largest option number.
    pub group_options: BTreeMap<u16, u8>,
}

/// Options per choice group: one more than its largest option number.
pub(super) fn group_options(items: &[WorldItem]) -> BTreeMap<u16, u8> {
    let mut options = BTreeMap::new();
    for item in items {
        if let model::Accessibility::Choice { group, option } = item.accessibility {
            let count = options.entry(group).or_insert(0_u8);
            *count = (*count).max(option.saturating_add(1));
        }
    }
    options
}

/// Fills the `allItems` fields. `deterministic` is false when play or
/// unseeded runtime state picks the identity; `quantity` is the stack size
/// when known.
pub(super) fn annotate(
    item: &mut Item,
    deterministic: bool,
    quantity: Option<u32>,
    context: &Context<'_>,
) {
    let mut conditions = Vec::new();
    if let Some(trinket) = context.trinket
        && context.trinket_depths.contains(&item.depth)
    {
        conditions.push(Condition::Trinket {
            events: vec![TrinketEvent {
                before_depth: item.depth,
                kind: "acquired".to_owned(),
                trinket: Some(crate::catalog::item(trinket).stable_id.to_owned()),
                min_upgrades: Some(3),
            }],
        });
    }
    quest_conditions(item, context, &mut conditions);
    if let Some(state) = runtime_state(item, deterministic) {
        conditions.push(Condition::Runtime {
            state: state.to_owned(),
        });
    }
    item.prediction = Some(if !deterministic {
        Prediction::Variable
    } else if conditions.is_empty() {
        Prediction::Exact
    } else {
        Prediction::Constrained
    });
    item.conditions = Some(conditions);
    item.ranges = Some(ranges(item, quantity));
}

/// Quest rewards spawn when the quest is completed, and the player keeps
/// `selectedCount` of the options. The Imp's vault treasure shares the Imp's
/// choice (one item leaves the vault), and the depth-20 shop opens when the
/// Imp quest is done.
fn quest_conditions(item: &Item, context: &Context<'_>, conditions: &mut Vec<Condition>) {
    let quest = match item.source.as_str() {
        "ghost_reward" => "ghost",
        "wandmaker_reward" => "wandmaker",
        "blacksmith_reward" => "blacksmith",
        "imp_reward" | "vault_treasure" => "imp",
        "shop" if item.depth == 20 => "imp",
        _ => return,
    };
    let entry = context.quests.iter().find(|entry| entry.quest == quest);
    conditions.push(Condition::Quest {
        quest: quest.to_owned(),
        depth: entry.map(|entry| entry.depth),
    });
    let Some(entry) = entry.filter(|_| item.source != "shop") else {
        return;
    };
    let option_count = match item.accessibility {
        Accessibility::Choice { group, .. } => context.group_options.get(&group).copied(),
        _ => None,
    };
    conditions.push(Condition::Choice {
        group: entry.rewards.source.clone(),
        option_count: option_count.unwrap_or(entry.rewards.option_count),
        selected_count: entry.rewards.selected_count,
        favor_requirement: entry.rewards.favor_requirement,
    });
}

fn runtime_state(item: &Item, deterministic: bool) -> Option<&'static str> {
    if item.source == "sacrificial_fire" {
        // The prize is generated with the floor and appears once the fire is fed.
        return Some("sacrificial_fire");
    }
    if deterministic {
        return None;
    }
    Some(if item.source == "shop" {
        "shop_bag"
    } else {
        "unseeded_selection"
    })
}

fn ranges(item: &Item, quantity: Option<u32>) -> Ranges {
    let definition = item_by_stable_id(&item.id);
    let exact = |value: u32| Range {
        min: value,
        max: value,
    };
    Ranges {
        quantity: quantity.map(exact),
        tier: definition.and_then(|definition| definition.tier.map(u32::from).map(exact)),
        level: definition
            .filter(|definition| definition.kind != ItemKind::Trinket)
            .map(|definition| {
                exact(u32::from(crate::model::displayed_upgrade(
                    definition.id,
                    item.upgrade,
                )))
            }),
    }
}
