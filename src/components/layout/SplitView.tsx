import { WarehouseCanvas } from '../simulation/WarehouseCanvas';

// ─── SplitView ────────────────────────────────────────────────────────────────

/**
 * Side-by-side layout: Traditional (left) | Proposed (right).
 *
 * Design notes (from frontend-design skill):
 * - No border-radius on the chrome divider — industrial hard corners.
 * - The 1px vertical divider is a structural element, not decoration:
 *   it encodes the "versus" relationship between the two sides.
 * - Each canvas takes exactly 50% of the available width.
 */
export function SplitView() {
  return (
    <div
      className="flex h-full w-full"
      style={{ background: '#1a1209' }} // very dark brown — warehouse floor in shadow
    >
      {/* ── Left: Traditional / Centralized ── */}
      <div className="relative flex-1 overflow-hidden">
        <WarehouseCanvas side="traditional" />
      </div>

      {/* ── Divider — hard 2px line, slightly tinted amber to match palette ── */}
      <div
        className="relative z-10 flex-shrink-0"
        style={{ width: '2px', background: '#78350f' }}
      >
        {/* VS pill centred on the divider */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            background: '#2d1f0e',
            border: '1px solid #78350f',
            padding: '4px 6px',
            lineHeight: 1,
          }}
        >
          <span
            className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase"
            style={{ color: '#78350f' }}
          >
            vs
          </span>
        </div>
      </div>

      {/* ── Right: Proposed / Decentralized ── */}
      <div className="relative flex-1 overflow-hidden">
        <WarehouseCanvas side="proposed" />
      </div>
    </div>
  );
}
