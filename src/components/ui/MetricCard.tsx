interface MetricCardProps {
  label: string;
  cloudValue: string;
  meshValue: string;
  detail: string;
}

/** Paired readout that keeps the cloud and P2P outcomes directly comparable. */
export function MetricCard({ label, cloudValue, meshValue, detail }: MetricCardProps) {
  return (
    <article className="min-w-0 border border-[#244446] bg-[#0c2021] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="font-mono text-[9px] font-bold tracking-[0.16em] text-[#86aaa4] uppercase">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0 border-l-2 border-[#f15b5b] pl-2">
          <p className="font-mono text-[8px] tracking-[0.12em] text-[#f59a9a] uppercase">Cloud</p>
          <p className="truncate font-mono text-base font-bold tabular-nums text-[#ffd2d2]">{cloudValue}</p>
        </div>
        <div className="min-w-0 border-l-2 border-[#51d38d] pl-2">
          <p className="font-mono text-[8px] tracking-[0.12em] text-[#51d38d] uppercase">P2P mesh</p>
          <p className="truncate font-mono text-base font-bold tabular-nums text-[#bff5d7]">{meshValue}</p>
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[8px] tracking-[0.05em] text-[#60817d] uppercase">{detail}</p>
    </article>
  );
}
