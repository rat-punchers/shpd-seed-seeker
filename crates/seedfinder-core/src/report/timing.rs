//! Trinket timing, alchemy pots and level builders of a seed report.

use super::floor::{Appearance, Floor};
use super::observe::ObservedFloor;
use super::trinket::TrinketTiming;
use crate::builder::BuilderKind;
use crate::catalog::ItemId;
use crate::floor_filters::RoomType;
use crate::geometry::terrain;
use crate::level::Level;
use crate::level_map::contents::FloorSource;
use crate::model::GeneratedWorld;
use crate::room::{Room, RoomKind};

/// The builder class a regular floor's room graph was laid out with.
pub(super) const fn builder(source: &FloorSource<'_>) -> BuilderKind {
    match source {
        FloorSource::Sewer(floor) => floor.painted.builder,
        FloorSource::Prison(floor) => floor.painted.builder,
        FloorSource::Caves(floor) => floor.painted.builder,
        FloorSource::City(floor) => floor.painted.builder,
        FloorSource::Halls(floor) => floor.painted.builder,
    }
}

/// One alchemy pot per `ALCHEMY` cell, in cell order, with the room that
/// holds it.
pub(super) fn alchemy_pots(level: &Level, rooms: &[Room]) -> Vec<Appearance> {
    level
        .map
        .cells
        .iter()
        .enumerate()
        .filter(|&(_, &tile)| tile == terrain::ALCHEMY)
        .map(|(cell, _)| {
            let point = level.map.cell_to_point(cell);
            let room = rooms.iter().find(|room| room.inside(point));
            Appearance {
                kind: "alchemy_pot".to_owned(),
                room: room.map(|room| RoomType::from_kind(room.kind).stable_id().to_owned()),
                secret: room.is_some_and(|room| matches!(room.kind, RoomKind::Secret(_))),
            }
        })
        .collect()
}

/// Sets every floor's `builder` and `appearances` from the replay.
pub(super) fn fill_floors(floors: &mut [Floor], observed: &[ObservedFloor]) {
    for floor in floors.iter_mut() {
        let generated = observed.iter().filter(|entry| entry.depth == floor.depth);
        floor.builder = generated
            .clone()
            .find_map(|entry| entry.builder)
            .map(|kind| kind.stable_id().to_owned());
        floor.appearances = Some(
            generated
                .flat_map(|entry| entry.appearances.iter().cloned())
                .collect(),
        );
    }
}

/// When the trinket can be chosen and first change generation, as the replay
/// applies it: the Catalyst and an alchemy pot must both have generated, and
/// the trinket is held from the next floor on. `None` when either never
/// generates through depth 24.
pub(super) fn timing(world: &GeneratedWorld, observed: &[ObservedFloor]) -> Option<TrinketTiming> {
    let offers = &crate::trinkets::trinket_order(world.seed)[..4];
    // The Catalyst is listed as its four offers on the floor it lies on.
    let catalyst_depth = world
        .items
        .iter()
        .filter(|item| offers.contains(&item.item))
        .map(|item| item.depth)
        .min()?;
    let pot_floor = observed
        .iter()
        .filter(|floor| !floor.appearances.is_empty())
        .min_by_key(|floor| floor.depth)?;
    let selection_depth = catalyst_depth.max(pot_floor.depth);
    Some(TrinketTiming {
        catalyst_depth,
        first_alchemy_pot_depth: pot_floor.depth,
        first_alchemy_pot_secret: pot_floor.appearances.iter().all(|pot| pot.secret),
        selection_depth,
        first_effective_depth: selection_depth + 1,
        option_effects: offers
            .iter()
            .map(|&id| option_effect(id).to_owned())
            .collect(),
    })
}

/// `modeled` for trinkets whose floor-generation change this engine applies;
/// `none` for trinkets that only change play.
fn option_effect(id: ItemId) -> &'static str {
    if super::predict::GENERATION_TRINKETS.contains(&id) {
        "modeled"
    } else {
        "none"
    }
}
