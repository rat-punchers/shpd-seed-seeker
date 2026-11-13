//! Floor encounters: the mobs a floor generates with, and the items they
//! carry from generation. Death loot is rolled during play and is not listed.

use std::collections::BTreeMap;

use super::floor::{Encounter, EncounterReward, Floor};
use super::observe::ObservedFloor;
use crate::level_map::contents::{MapItem, MapMob};

/// Classes of `actors.mobs.npcs`: quest givers, shopkeepers, the Rat King,
/// sheep, images and vault guards. They are not encounters.
const NPCS: [&str; 16] = [
    "Blacksmith",
    "DirectableAlly",
    "Ghost",
    "Imp",
    "ImpShopkeeper",
    "MirrorImage",
    "NPC",
    "PrismaticImage",
    "RatKing",
    "Sheep",
    "Shopkeeper",
    "VaultLaser",
    "VaultMirror",
    "VaultSentry",
    "VaultTokenDoor",
    "Wandmaker",
];

/// Sets every floor's `encounters` from the replay. Floors 10 and 20 have
/// none: `PrisonBossLevel.createMobs` only keeps Tengu aside and
/// `CityBossLevel.createMobs` is empty.
pub(super) fn fill_floors(floors: &mut [Floor], observed: &[ObservedFloor]) {
    for floor in floors.iter_mut() {
        let mobs: Vec<MapMob> = observed
            .iter()
            .filter(|entry| entry.depth == floor.depth)
            .flat_map(|entry| entry.mobs.iter().cloned())
            .collect();
        floor.encounters = Some(encounters(&mobs));
    }
}

/// Groups generated mobs by class in mob id order. Runtime-created Ghoul
/// partners (`approximate`) and NPCs are left out; rewards keep mob order.
pub(super) fn encounters(mobs: &[MapMob]) -> Vec<Encounter> {
    let mut groups: BTreeMap<String, Encounter> = BTreeMap::new();
    for mob in mobs
        .iter()
        .filter(|mob| !mob.approximate && !NPCS.contains(&mob.kind.as_str()))
    {
        let id = mob_id(&mob.kind);
        let encounter = groups.entry(id.clone()).or_insert_with(|| Encounter {
            mob: id,
            quantity: 0,
            rewards: None,
        });
        encounter.quantity += 1;
        if !mob.items.is_empty() {
            encounter
                .rewards
                .get_or_insert_with(Vec::new)
                .extend(mob.items.iter().map(reward));
        }
    }
    groups.into_values().collect()
}

/// `CrystalMimic` → `crystal_mimic`; `DM100` → `dm100`.
pub(super) fn mob_id(kind: &str) -> String {
    let mut output = String::with_capacity(kind.len() + 4);
    let mut previous: Option<char> = None;
    for character in kind.chars() {
        if character.is_ascii_uppercase() {
            if previous.is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit()) {
                output.push('_');
            }
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
        previous = Some(character);
    }
    output
}

fn reward(item: &MapItem) -> EncounterReward {
    let (id, category, roll) = match crate::catalog::item_by_stable_id(&item.kind) {
        Some(definition) => (
            Some(definition.stable_id.to_owned()),
            crate::catalog::kind_name(definition.kind),
            item.roll,
        ),
        None => (
            item.deterministic
                .then(|| super::loose::snake_case(&item.kind)),
            super::loose::category(&item.kind),
            None,
        ),
    };
    EncounterReward {
        item: id,
        category: category.to_owned(),
        level: roll.map(|roll| roll.upgrade).filter(|&level| level > 0),
        cursed: roll.map(|roll| roll.cursed),
        effect: roll
            .and_then(|roll| roll.effect)
            .map(|effect| effect.wire_name().to_owned()),
        prediction: "generated_with_floor".to_owned(),
        chance: None,
    }
}

#[cfg(test)]
mod tests {
    use super::mob_id;

    #[test]
    fn mob_ids_follow_the_class_names() {
        for (kind, id) in [
            ("Rat", "rat"),
            ("CrystalMimic", "crystal_mimic"),
            ("DM100", "dm100"),
            ("DM201", "dm201"),
            ("FireElemental", "fire_elemental"),
        ] {
            assert_eq!(mob_id(kind), id);
        }
    }
}
