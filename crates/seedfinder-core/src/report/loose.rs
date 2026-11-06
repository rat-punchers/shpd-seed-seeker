//! Report entries for generated objects other than searchable equipment:
//! potions, scrolls, stones, seeds, food, gold, keys and the rest.

use std::collections::{BTreeMap, BTreeSet};

use super::item::{Accessibility, Item};
use super::observe::{ObservedFloor, PlacedItem};
use crate::level_map::contents::{MapItem, MapItemAccess};
use crate::model::{self, WorldItem};

/// Searchable equipment; `scout` already lists it.
pub(super) fn is_equipment(item: &MapItem) -> bool {
    crate::catalog::item_by_stable_id(&item.kind).is_some()
}

/// The catalyst itself is listed as its four trinket offers, like `scout`.
pub(super) fn is_listed(item: &MapItem) -> bool {
    !is_equipment(item) && item.kind != "TrinketCatalyst"
}

/// Gives painter choice groups world-wide numbers. A floor-local group that
/// the floor's equipment shares keeps the equipment's world number; any other
/// group gets a new number above every world group, so groups never collide.
pub(super) struct Groups {
    world: BTreeSet<(u8, u16)>,
    fresh: BTreeMap<(u8, Option<u16>), u16>,
    next: u16,
}

impl Groups {
    pub(super) fn new(items: &[WorldItem]) -> Self {
        let world: BTreeSet<(u8, u16)> = items
            .iter()
            .filter_map(|item| match item.accessibility {
                model::Accessibility::Independent => None,
                model::Accessibility::Choice { group, .. }
                | model::Accessibility::Scenarios { group, .. } => Some((item.depth, group)),
            })
            .collect();
        let next = world.iter().map(|&(_, group)| group + 1).max().unwrap_or(0);
        Self {
            world,
            fresh: BTreeMap::new(),
            next,
        }
    }

    fn group(&mut self, floor: &ObservedFloor, local: Option<u16>) -> u16 {
        if let Some(group) = local.map(|local| local + floor.choice_group_offset)
            && self.world.contains(&(floor.depth, group))
        {
            return group;
        }
        *self.fresh.entry((floor.depth, local)).or_insert_with(|| {
            self.next += 1;
            self.next - 1
        })
    }

    fn accessibility(
        &mut self,
        floor: &ObservedFloor,
        access: Option<MapItemAccess>,
    ) -> Accessibility {
        match access {
            None | Some(MapItemAccess::Reward(model::Accessibility::Independent)) => {
                Accessibility::Independent
            }
            Some(MapItemAccess::Reward(model::Accessibility::Choice { group, option })) => {
                Accessibility::Choice {
                    group: self.group(floor, Some(group)),
                    option,
                }
            }
            Some(MapItemAccess::Reward(model::Accessibility::Scenarios { group, mask })) => {
                Accessibility::Scenarios {
                    group: self.group(floor, Some(group)),
                    mask: format!("0x{mask:x}"),
                }
            }
            Some(MapItemAccess::CrystalPath(slot)) => Accessibility::Scenarios {
                group: self.group(floor, None),
                mask: format!(
                    "0x{:x}",
                    crate::special_consumable::crystal_path_scenario_mask(slot)
                ),
            },
        }
    }
}

pub(super) fn item(placed: &PlacedItem, floor: &ObservedFloor, groups: &mut Groups) -> Item {
    let kind = placed.item.kind.as_str();
    let (id, name) = match kind {
        "RuntimeLaboratoryPotion" => ("random_potion".to_owned(), "Random potion".to_owned()),
        "RuntimeLibraryScroll" => ("random_scroll".to_owned(), "Random scroll".to_owned()),
        _ => (
            snake_case(kind),
            crate::level_map::MapTooltipItem::from_item(&placed.item).name,
        ),
    };
    Item {
        id,
        name,
        category: category(kind).to_owned(),
        sprite_index: placed.item.image,
        upgrade: 0,
        effect: None,
        cursed: false,
        secret: placed.secret,
        depth: floor.depth,
        source: placed.source.to_owned(),
        accessibility: groups.accessibility(floor, placed.item.access),
        matched: false,
        resin_donor: false,
        excluded: false,
        prediction: None,
        conditions: None,
        ranges: None,
    }
}

/// `PotionOfHealing` → `potion_of_healing`; `RegionLorePage$Halls` →
/// `region_lore_page_halls`.
fn snake_case(kind: &str) -> String {
    let mut output = String::with_capacity(kind.len() + 4);
    for character in kind.chars() {
        if character == '$' {
            output.push('_');
        } else if character.is_ascii_uppercase() {
            if !output.is_empty() && !output.ends_with('_') {
                output.push('_');
            }
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
    }
    output
}

fn category(kind: &str) -> &'static str {
    match kind {
        _ if kind.contains("PotionOf") || kind == "RuntimeLaboratoryPotion" => "potion",
        _ if kind.contains("ScrollOf") || kind == "RuntimeLibraryScroll" => "scroll",
        _ if kind.starts_with("StoneOf") => "stone",
        _ if kind.ends_with("Seed") => "seed",
        "Ration" | "Pasty" | "MysteryMeat" | "SmallRation" | "ChargrilledMeat" | "Berry"
        | "Blandfruit" | "FrozenCarpaccio" | "StewedMeat" | "SupplyRation" => "food",
        "Gold" | "DarkGold" => "gold",
        "IronKey" | "GoldenKey" | "CrystalKey" => "key",
        "Dart" => "missile",
        _ => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::{category, snake_case};

    #[test]
    fn ids_and_categories_follow_the_class_names() {
        for (kind, id, category_name) in [
            ("PotionOfHealing", "potion_of_healing", "potion"),
            (
                "ExoticScrollOfUpgrade",
                "exotic_scroll_of_upgrade",
                "scroll",
            ),
            ("StoneOfBlink", "stone_of_blink", "stone"),
            ("SungrassSeed", "sungrass_seed", "seed"),
            ("SmallRation", "small_ration", "food"),
            ("Gold", "gold", "gold"),
            ("CrystalKey", "crystal_key", "key"),
            ("Dart", "dart", "missile"),
            ("RegionLorePage$Halls", "region_lore_page_halls", "other"),
            ("DoubleBomb", "double_bomb", "other"),
        ] {
            assert_eq!(snake_case(kind), id);
            assert_eq!(category(kind), category_name, "{kind}");
        }
    }
}
