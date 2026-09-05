import { Pause, Play, RotateCcw } from 'lucide-react';
import { useSimStore } from '../../store/useSimStore';

const SPEEDS = [0.5, 1, 2, 4] as const;

/** Primary transport controls for the simulation clock. */
export function SimControls() {
  const isPlaying = useSimStore((state) => state.isPlaying);
  const speed = useSimStore((state) => state.speed);
  const play = useSimStore((state) => state.play);
  const pause = useSimStore((state) => state.pause);
  const restart = useSimStore((state) => state.restart);
  const setSpeed = useSimStore((state) => state.setSpeed);

  return (
    <section className="flex items-center gap-2" aria-label="Simulation controls">
      <div className="flex overflow-hidden rounded-sm border border-[#d8dce0] bg-white shadow-sm">
        <button
          type="button"
          onClick={isPlaying ? pause : play}
          className="inline-flex h-8 items-center gap-1.5 border-r border-[#d8dce0] px-2.5 font-sans text-[10px] font-bold tracking-[0.08em] uppercase text-[#334854] transition-colors hover:bg-[#f3f6f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
          aria-label={isPlaying ? 'Pause simulation' : 'Resume simulation'}
        >
          {isPlaying ? <Pause size={13} strokeWidth={2.4} /> : <Play size={13} strokeWidth={2.4} />}
          {isPlaying ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex h-8 items-center justify-center px-2 text-[#77858c] transition-colors hover:bg-[#f3f6f7] hover:text-[#334854] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
          aria-label="Restart simulation"
          title="Restart simulation"
        >
          <RotateCcw size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center rounded-sm border border-[#d8dce0] bg-white shadow-sm" aria-label="Simulation speed">
        <span className="px-2 font-sans text-[9px] tracking-[0.1em] text-[#77858c] uppercase">Rate</span>
        {SPEEDS.map((value) => {
          const selected = speed === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={selected}
              className="h-8 min-w-8 border-l border-[#d8dce0] px-1.5 font-sans text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2f80c3]"
              style={{
                background: selected ? '#f2b544' : 'transparent',
                color: selected ? '#263640' : '#77858c',
              }}
            >
              {value}×
            </button>
          );
        })}
      </div>
    </section>
  );
}
