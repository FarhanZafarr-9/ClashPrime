/**
 * Column sizing for the level/stat tables, shared by the Buildings and Army
 * sheets so the two tables stay identical in how they behave.
 *
 * The problem this solves: a table whose cells are `flex: 1` with a fixed
 * `minWidth` lets any row whose cell content runs past that minimum stretch only
 * that column. The header, which holds a short label, does not stretch, and
 * neither do the other rows - so the grid visibly pulls out of line. It shows up
 * wherever a cell can hold a much longer value than its column name, e.g. a
 * Blacksmith level unlocking "Healer Puppet, Noble Iron" or a Hero Hall level
 * listing an unlock.
 */

// Typography.caption is 11px with 0.5 letter-spacing, so ~6.5px per glyph. Uppercase
// letter-spaced headers read a little wider per glyph than body text.
const CHAR_WIDTH = 6.6;
const HEADER_GLYPH_FACTOR = 1.15;
const CELL_PADDING = 8;
// High enough for the longest real value in these tables so they fit rather than
// ellipsize; beyond that the table scrolls horizontally.
const MAX_COL_WIDTH = 190;
const DEFAULT_COL_WIDTH = 56;

export interface TableColumn<T> {
  /** Stable id for the column, used as the key in the returned widths map. */
  key: string;
  /** Header label, measured alongside the values. */
  header: string;
  /** Minimum width, normally the column's hand-tuned default. */
  floor: number;
  /** The cell's rendered text for a row, or null/undefined when the cell is empty. */
  value: (row: T) => string | number | null | undefined;
  /** Extra width for non-text chrome in the cell, e.g. a leading resource icon. */
  extra?: number;
}

/**
 * Per-column widths, each taken from the widest string in that column across every
 * row plus the header, clamped to [floor, MAX_COL_WIDTH].
 *
 * Measured over all rows the caller supplies, not the ones currently rendered, so
 * expanding or collapsing a table never changes its layout and the grid does not
 * shift under the reader.
 */
export function measureTableCols<T>(rows: T[], columns: TableColumn<T>[]): Record<string, number> {
  const widths: Record<string, number> = {};
  for (const col of columns) {
    let longest = col.header.length * HEADER_GLYPH_FACTOR;
    for (const row of rows) {
      const raw = col.value(row);
      if (raw == null || raw === '') continue;
      const text = String(raw);
      if (text.length > longest) longest = text.length;
    }
    const measured = Math.ceil(longest * CHAR_WIDTH) + CELL_PADDING + (col.extra ?? 0);
    widths[col.key] = Math.min(Math.max(col.floor || DEFAULT_COL_WIDTH, measured), MAX_COL_WIDTH);
  }
  return widths;
}

/**
 * Final per-column pixel widths, plus the table's total width.
 *
 * Returns fixed numbers rather than flex, on purpose. With flex in play, a cell
 * can still be widened past its share - by its own min-content width, by the row
 * being a different kind of container, or by a grow factor resolving differently -
 * and any one of those makes a single row disagree with the header. Fixed widths
 * make every row pixel-identical by construction.
 *
 * When the table has to stretch to fill a wider viewport, the slack is folded
 * into the measured widths here, proportionally, so the columns still keep the
 * ratio they were measured at and still fill the space exactly.
 */
export function resolveColWidths<T>(
  rows: T[],
  columns: TableColumn<T>[],
  viewportW = 0,
): { widths: number[]; total: number } {
  const measured = measureTableCols(rows, columns);
  const base = columns.map((c) => measured[c.key] ?? DEFAULT_COL_WIDTH);
  const sum = base.reduce((a, b) => a + b, 0);
  const target = Math.max(viewportW, sum);
  if (target > sum && sum > 0) {
    const slack = target - sum;
    const widths = base.map((w) => w + Math.round((slack * w) / sum));
    return { widths, total: widths.reduce((a, b) => a + b, 0) };
  }
  return { widths: base, total: sum };
}

export { DEFAULT_COL_WIDTH, MAX_COL_WIDTH };