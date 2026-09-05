interface MetricCardProps {
  label: string;
  cloudValue: string;
  meshValue: string;
  detail: string;
}

/** Paired readout that keeps the cloud and P2P outcomes directly comparable. */
export function MetricCard({ label, cloudValue, meshValue, detail }: MetricCardProps) {
  return (
    <article className="min-w-0 border border-[#e1ded8] bg-white px-3 py-2.5 shadow-[inset_0_1px_0_rgba(31,52,66,0.04)]">
      <p className="font-sans text-[9px] font-bold tracking-[0.12em] text-[#68777d] uppercase">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0 border-l-2 border-[#df3f49] pl-2">
          <p className="font-sans text-[8px] tracking-[0.12em] text-[#c34d55] uppercase">Cloud</p>
          <p className="truncate font-sans text-base font-bold tabular-nums text-[#1f3442]">{cloudValue}</p>
        </div>
        <div className="min-w-0 border-l-2 border-[#1eaa73] pl-2">
          <p className="font-sans text-[8px] tracking-[0.12em] text-[#1e8d63] uppercase">P2P mesh</p>
          <p className="truncate font-sans text-base font-bold tabular-nums text-[#1f3442]">{meshValue}</p>
        </div>
      </div>
      <p className="mt-1.5 font-sans text-[8px] tracking-[0.05em] text-[#879197] uppercase">{detail}</p>
    </article>
  );
}
