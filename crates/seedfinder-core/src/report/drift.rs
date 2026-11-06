//! Deck-drift windows for quest reward slots.
//!
//! A seeded deck's class at each draw index is fixed by the seed
//! ([`deck_sequence`]). Run history, such as items generated during play,
//! only moves which index a reward draw lands on. A slot's candidates are the
//! classes at the seed draw's index and up to [`DRIFT`] indices either side.

use super::quest::SlotCandidate;
use crate::catalog::{ItemId, item};
use crate::generator::deck_sequence;
use crate::quests::DeckDraw;
use crate::run::GeneratorState;

/// Deck indices either side of the seed draw.
pub(super) const DRIFT: i32 = 3;
/// Cards replayed past the window so duplicate rejects can resolve.
const SLACK: usize = 64;
/// The longest replay a duplicate-reject walk may need.
const MAX_REPLAY: usize = 1_024;

/// The class one window offset puts in a slot.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct Draw {
    pub offset: i32,
    pub item: ItemId,
    /// Duplicate cards skipped before this one (pair draws only).
    pub rejects: u32,
}

/// Window offsets nearest first (0, -1, 1, -2, …), without indices before
/// the deck's first draw.
pub(super) fn offsets(index: i32) -> Vec<i32> {
    let mut offsets: Vec<i32> = (-DRIFT..=DRIFT)
        .filter(|offset| index + offset >= 0)
        .collect();
    offsets.sort_by_key(|offset| (offset.abs(), *offset));
    offsets
}

fn replay(initial: &GeneratorState, draw: DeckDraw, extra: usize) -> Vec<Option<ItemId>> {
    let count = usize::try_from(draw.index + DRIFT + 1).unwrap_or(0) + extra;
    deck_sequence(initial, draw.category, count).unwrap_or_default()
}

fn at(classes: &[Option<ItemId>], index: i32) -> Option<ItemId> {
    usize::try_from(index)
        .ok()
        .and_then(|index| classes.get(index).copied().flatten())
}

/// The class at each window offset of a single draw. Offsets where the deck
/// holds no catalog class (an exhausted artifact deck) are left out.
pub(super) fn single(initial: &GeneratorState, draw: DeckDraw) -> Vec<Draw> {
    let classes = replay(initial, draw, 0);
    offsets(draw.index)
        .into_iter()
        .filter_map(|offset| {
            at(&classes, draw.index + offset).map(|item| Draw {
                offset,
                item,
                rejects: 0,
            })
        })
        .collect()
}

/// A first draw and the next card of a different class, as the Wandmaker's
/// two wands and the Imp's two rings are drawn. Returns the first and second
/// draws per offset; an offset whose pair does not resolve is left out of both.
pub(super) fn pairs(initial: &GeneratorState, draw: DeckDraw) -> (Vec<Draw>, Vec<Draw>) {
    let offsets = offsets(draw.index);
    let mut extra = SLACK;
    loop {
        let classes = replay(initial, draw, extra);
        let resolved: Vec<Option<(Draw, Draw)>> = offsets
            .iter()
            .map(|&offset| pair(&classes, draw.index + offset, offset))
            .collect();
        if resolved.iter().all(Option::is_some) || extra >= MAX_REPLAY {
            return resolved.into_iter().flatten().unzip();
        }
        extra *= 2;
    }
}

fn pair(classes: &[Option<ItemId>], index: i32, offset: i32) -> Option<(Draw, Draw)> {
    let first = at(classes, index)?;
    let start = usize::try_from(index).ok()? + 1;
    let (rejects, second) = classes
        .get(start..)?
        .iter()
        .enumerate()
        .find_map(|(rejects, class)| class.filter(|&class| class != first).map(|c| (rejects, c)))?;
    let rejects = u32::try_from(rejects).ok()?;
    Some((
        Draw {
            offset,
            item: first,
            rejects: 0,
        },
        Draw {
            offset,
            item: second,
            rejects,
        },
    ))
}

/// The duplicate rejects are the same at every offset, so the floor RNG the
/// draws after the pair see does not move.
pub(super) fn rejects_pinned(draws: &[Draw]) -> bool {
    draws
        .first()
        .is_none_or(|first| draws.iter().all(|draw| draw.rejects == first.rejects))
}

/// Collapses a window into weighted classes with the denominator. The seed
/// draw leads; the rest follow by weight, then nearest offset.
pub(super) fn candidates(draws: &[Draw]) -> (Vec<SlotCandidate>, u32) {
    let mut collapsed: Vec<(ItemId, SlotCandidate)> = Vec::new();
    for draw in draws {
        if let Some((_, candidate)) = collapsed.iter_mut().find(|(item, _)| *item == draw.item) {
            candidate.drifts.push(draw.offset);
            candidate.weight += 1;
        } else {
            collapsed.push((
                draw.item,
                SlotCandidate {
                    item: item(draw.item).stable_id.to_owned(),
                    drifts: vec![draw.offset],
                    weight: 1,
                },
            ));
        }
    }
    let mut collapsed: Vec<SlotCandidate> = collapsed
        .into_iter()
        .map(|(_, candidate)| candidate)
        .collect();
    collapsed.sort_by_key(|candidate| {
        (
            !candidate.drifts.contains(&0),
            std::cmp::Reverse(candidate.weight),
            candidate
                .drifts
                .first()
                .map_or(i32::MAX, |drift| drift.abs()),
        )
    });
    let scenarios = u32::try_from(draws.len()).unwrap_or(u32::MAX);
    (collapsed, scenarios)
}
