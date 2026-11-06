//! One scout-profile replay that keeps every floor's generated objects: the
//! searchable world plus each heap, container and carried item.

use super::floor::Appearance;
use crate::builder::BuilderKind;
use crate::catalog::ItemId;
use crate::challenges::Challenges;
use crate::level::Level;
use crate::level_map::contents::MapItem;
use crate::main_world::{
    FloorObservation, FloorObserver, ObservedProfile, generate_main_world_observed,
};
use crate::model::{GeneratedWorld, WorldItem};
use crate::quests::{QuestState, QuestSummary};
use crate::room::{Room, RoomKind};
use crate::run::ItemAppearanceState;
use crate::search::FloorGate;
use crate::seed::DungeonSeed;
use crate::shop::ShopInventory;
use crate::trinkets::TrinketEffects;

/// The searchable world and the objects of every floor that has them.
pub(super) struct Observed {
    pub world: GeneratedWorld,
    /// Depth order; floors without generated objects are absent.
    pub floors: Vec<ObservedFloor>,
    /// Quest state after the last floor, with each reward's deck draw.
    pub quests: QuestState,
}

pub(super) struct ObservedFloor {
    pub depth: u8,
    /// The selected trinket was active while this floor generated.
    pub trinket_active: bool,
    /// See `FloorObservation::choice_group_offset`; zero on boss floors.
    pub choice_group_offset: u16,
    /// The level builder; absent on floors without a room graph.
    pub builder: Option<BuilderKind>,
    /// Alchemy pots in cell order.
    pub appearances: Vec<Appearance>,
    /// Heap items top first in heap order, then carried items in mob order.
    pub items: Vec<PlacedItem>,
}

/// A generated object and where it lies.
pub(super) struct PlacedItem {
    pub item: MapItem,
    /// The scout `source` of its heap, container or carrier.
    pub source: &'static str,
    /// Inside a secret room.
    pub secret: bool,
}

struct Gate(Option<ItemId>);

impl FloorGate for Gate {
    fn selected_trinket(&self, _: DungeonSeed) -> Option<ItemId> {
        self.0
    }
    fn continue_after_floor(&self, _: u8, _: &[WorldItem], _: &QuestSummary) -> bool {
        true
    }
}

struct Collector {
    appearance: ItemAppearanceState,
    floors: Vec<ObservedFloor>,
    quests: QuestState,
}

impl FloorObserver for Collector {
    fn floor(&mut self, floor: FloorObservation<'_>) {
        let contents = floor.contents.collect(&self.appearance, false);
        let depth = u8::try_from(floor.level.depth).expect("main-path depths fit u8");
        self.floors.push(ObservedFloor {
            depth,
            trinket_active: floor.trinket.selected.is_some(),
            choice_group_offset: floor.choice_group_offset,
            builder: Some(super::timing::builder(&floor.contents)),
            appearances: super::timing::alchemy_pots(floor.level, floor.rooms),
            items: placed(floor.level, floor.rooms, &contents),
        });
    }

    fn boss_shop(&mut self, inventory: &ShopInventory, trinket: &TrinketEffects) {
        self.floors.push(ObservedFloor {
            depth: inventory.depth,
            trinket_active: trinket.selected.is_some(),
            choice_group_offset: 0,
            builder: None,
            appearances: Vec::new(),
            items: crate::level_map::contents::boss_shop_items(inventory, &self.appearance)
                .into_iter()
                .map(|item| PlacedItem {
                    item,
                    source: "shop",
                    secret: false,
                })
                .collect(),
        });
    }

    fn quests(&mut self, quests: &QuestState) {
        self.quests = quests.clone();
    }
}

/// Replays the world through depth 24 exactly as `scout` generates it.
pub(super) fn observe(
    seed: DungeonSeed,
    challenges: Challenges,
    selected: Option<ItemId>,
) -> Result<Observed, String> {
    let dungeon_seed = i64::try_from(seed.value()).expect("seed fits i64");
    let mut collector = Collector {
        appearance: crate::run::RunState::new(dungeon_seed).appearances,
        floors: Vec::new(),
        quests: QuestState::new(),
    };
    let world = generate_main_world_observed(
        seed,
        24,
        challenges,
        &Gate(selected),
        ObservedProfile::Scout,
        &mut collector,
    )
    .map_err(|error| format!("world generation failed: {error}"))?
    .ok_or("world generation stopped early")?;
    // Boss floors 5 and 15 generate from their own seed and change no run state.
    for depth in [5, 15] {
        let (level, rooms) = crate::boss_floor::generate(dungeon_seed, depth, challenges);
        let contents =
            crate::level_map::contents::MapContents::from_level(&level, &collector.appearance);
        collector.floors.push(ObservedFloor {
            depth,
            trinket_active: false,
            choice_group_offset: 0,
            // `SewerBossLevel.builder()` is always a `FigureEightBuilder`;
            // the other boss levels build no room graph.
            builder: (depth == 5).then_some(BuilderKind::FigureEight),
            appearances: super::timing::alchemy_pots(&level, &rooms),
            items: placed(&level, &rooms, &contents),
        });
    }
    // `PrisonBossLevel.createItems` always drops one iron key on floor 10,
    // whose terrain this engine does not generate.
    collector.floors.push(ObservedFloor {
        depth: 10,
        trinket_active: false,
        choice_group_offset: 0,
        builder: None,
        appearances: Vec::new(),
        items: vec![PlacedItem {
            item: MapItem::new("IronKey", 55, 1),
            source: "heap",
            secret: false,
        }],
    });
    collector.floors.sort_by_key(|floor| floor.depth);
    Ok(Observed {
        world,
        floors: collector.floors,
        quests: collector.quests,
    })
}

fn placed(
    level: &Level,
    rooms: &[Room],
    contents: &crate::level_map::contents::MapContents,
) -> Vec<PlacedItem> {
    let secret = |cell: usize| {
        let point = level.map.cell_to_point(cell);
        rooms
            .iter()
            .any(|room| matches!(room.kind, RoomKind::Secret(_)) && room.inside(point))
    };
    let heaps = contents.heaps.iter().flat_map(|heap| {
        let source = heap_source(&heap.kind);
        heap.items.iter().map(move |item| (heap.cell, source, item))
    });
    let mobs = contents.mobs.iter().flat_map(|mob| {
        let source = mob_source(&mob.kind);
        mob.items.iter().map(move |item| (mob.cell, source, item))
    });
    heaps
        .chain(mobs)
        .map(|(cell, source, item)| PlacedItem {
            item: item.clone(),
            source,
            secret: secret(cell),
        })
        .collect()
}

/// Heap types as `scout` names their sources.
fn heap_source(kind: &str) -> &'static str {
    match kind {
        "Chest" => "chest",
        "LockedChest" => "locked_chest",
        "CrystalChest" => "crystal_chest",
        "Tomb" => "tomb",
        "Skeleton" => "skeleton",
        "ForSale" => "shop",
        _ => "heap",
    }
}

/// Carriers as `scout` names their sources.
fn mob_source(kind: &str) -> &'static str {
    match kind {
        "GoldenMimic" => "golden_mimic",
        "CrystalMimic" => "crystal_mimic",
        "Statue" => "statue",
        "ArmoredStatue" => "armored_statue",
        _ => "mimic",
    }
}
