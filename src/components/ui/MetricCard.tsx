interface MetricCardProps {
  label: string;
  cloudValue: string;
  meshValue: string;
  detail: string;
}

/** Paired readout that keeps the cloud and P2P outcomes directly comparable. */
export function MetricCard({ label, cloudValue, meshValue, detail }: MetricCardProps) {
  return (
    <article className="min-w-0 border border-[#4b3218] bg-[#120c05] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="font-mono text-[9px] font-bold tracking-[0.16em] text-[#b98243] uppercase">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0 border-l-2 border-[#ef4444] pl-2">
          <p className="font-mono text-[8px] tracking-[0.12em] text-[#9d5a3e] uppercase">Cloud</p>
          <p className="truncate font-mono text-base font-bold tabular-nums text-[#fecaca]">{cloudValue}</p>
        </div>
        <div className="min-w-0 border-l-2 border-[#22c55e] pl-2">
          <p className="font-mono text-[8px] tracking-[0.12em] text-[#4ade80] uppercase">P2P mesh</p>
          <p className="truncate font-mono text-base font-bold tabular-nums text-[#bbf7d0]">{meshValue}</p>
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[8px] tracking-[0.05em] text-[#80603c] uppercase">{detail}</p>
    </article>
  );
}
