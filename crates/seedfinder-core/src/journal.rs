//! Journal assumptions for one observed replay. Search uses the canonical profile.

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) enum JournalProfile {
    #[default]
    Canonical,
    Fresh,
}

impl JournalProfile {
    pub(crate) const fn from_lore_pages(lore_pages: bool) -> Self {
        if lore_pages {
            Self::Fresh
        } else {
            Self::Canonical
        }
    }

    pub(crate) const fn is_fresh(self) -> bool {
        matches!(self, Self::Fresh)
    }
}

/// Internal marker for the entrance page, whose cell is chosen outside the seeded stream.
pub(crate) const EARLY_GUIDE_PAGE: &str = "Guidebook$GuidePage";

#[cfg(feature = "json-query")]
pub(crate) const FRESH_JOURNAL_NOTE: &str = "Fresh journal assumes no pages are picked up. The floor 2 entrance page uses an example location when it appears. Its location and affected loot can vary.";

/// Choose one of the game's eligible cells without consuming any seeded draws.
pub(crate) fn place_entrance_page(level: &mut crate::level::Level, room: crate::geometry::Rect) {
    use crate::geometry::{Point, terrain};
    use crate::level::{DirectPaintItem, HeapKind, PaintItem};

    let entrance = level.entrance();
    let cell = (room.top + 1..=room.bottom - 2)
        .flat_map(|y| (room.left + 1..room.right).map(move |x| Point::new(x, y)))
        .map(|point| level.point_to_cell(point))
        .find(|&cell| Some(cell) != entrance && level.map.cells[cell] != terrain::REGION_DECO);
    if let Some(cell) = cell {
        level.drop_item(
            PaintItem::Direct(DirectPaintItem::Other(EARLY_GUIDE_PAGE)),
            cell,
            HeapKind::Heap,
        );
    }
}
