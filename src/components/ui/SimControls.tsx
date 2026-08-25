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
      <div className="flex overflow-hidden border border-[#5c3d1a] bg-[#120c05]">
        <button
          type="button"
          onClick={isPlaying ? pause : play}
          className="inline-flex h-8 items-center gap-1.5 border-r border-[#5c3d1a] px-2.5 font-mono text-[10px] font-bold tracking-[0.12em] uppercase text-[#fef3c7] transition-colors hover:bg-[#2d1d0b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
          aria-label={isPlaying ? 'Pause simulation' : 'Resume simulation'}
        >
          {isPlaying ? <Pause size={13} strokeWidth={2.4} /> : <Play size={13} strokeWidth={2.4} />}
          {isPlaying ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex h-8 items-center justify-center px-2 text-[#d6a55b] transition-colors hover:bg-[#2d1d0b] hover:text-[#fef3c7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
          aria-label="Restart simulation"
          title="Restart simulation"
        >
          <RotateCcw size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center border border-[#5c3d1a] bg-[#120c05]" aria-label="Simulation speed">
        <span className="px-2 font-mono text-[9px] tracking-[0.14em] text-[#a6783c] uppercase">Rate</span>
        {SPEEDS.map((value) => {
          const selected = speed === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={selected}
              className="h-8 min-w-8 border-l border-[#5c3d1a] px-1.5 font-mono text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f59e0b]"
              style={{
                background: selected ? '#f59e0b' : 'transparent',
                color: selected ? '#1a1209' : '#d6a55b',
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
