/**
 * Z-order for Radix portaled layers. Several primitives (Select, Popover, DropdownMenu)
 * copy the inner element’s computed z-index onto a Popper wrapper — pair Tailwind `z-*`
 * with an inline `zIndex` so production builds never leave the wrapper at `auto`.
 *
 * Stacked sheets (`hideOverlay`) must stay **below** floating pickers so menus opened
 * from inside a nested sheet still paint above that sheet’s panel.
 */
/** Sheet/Dialog with dimming overlay — above map UIs (e.g. Leaflet panes/controls ~400–1000). */
export const Z_MODAL = 1200
export const Z_SHEET_STACKED = 1400
export const Z_FLOATING = 1600
