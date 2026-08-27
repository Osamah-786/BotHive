import { PhaserWarehouse } from './PhaserWarehouse';

// ─── WarehouseCanvas ──────────────────────────────────────────────────────────

interface WarehouseCanvasProps {
  /** 'traditional' or 'proposed' — determines which slice of the store to read */
  side: 'traditional' | 'proposed';
}

export function WarehouseCanvas({ side }: WarehouseCanvasProps) {
  return (
    <div className="h-full w-full overflow-hidden" style={{ background: '#071617' }}>
      <PhaserWarehouse side={side} />
    </div>
  );
}
