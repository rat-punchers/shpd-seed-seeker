//! Shop stock that is generated but not placed on the floor.

use super::{MapItem, items};
use crate::run::ItemAppearanceState;

/// The depth-20 Imp shop stock other than searchable equipment, in stock order.
pub(crate) fn boss_shop_items(
    inventory: &crate::shop::ShopInventory,
    appearance: &ItemAppearanceState,
) -> Vec<MapItem> {
    inventory
        .items
        .iter()
        .filter(|stock| !matches!(stock, crate::shop::ShopStockItem::Searchable(_)))
        .map(|stock| {
            items::forced(
                &crate::special_forced::ForcedItem::Shop(stock.clone()),
                appearance,
                u32::from(inventory.depth),
            )
        })
        .collect()
}
