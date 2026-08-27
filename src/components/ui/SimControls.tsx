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
      <div className="flex overflow-hidden border border-[#31585a] bg-[#0c2021]">
        <button
          type="button"
          onClick={isPlaying ? pause : play}
          className="inline-flex h-8 items-center gap-1.5 border-r border-[#31585a] px-2.5 font-mono text-[10px] font-bold tracking-[0.12em] uppercase text-[#e5f3ee] transition-colors hover:bg-[#123031] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c14e]"
          aria-label={isPlaying ? 'Pause simulation' : 'Resume simulation'}
        >
          {isPlaying ? <Pause size={13} strokeWidth={2.4} /> : <Play size={13} strokeWidth={2.4} />}
          {isPlaying ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex h-8 items-center justify-center px-2 text-[#86aaa4] transition-colors hover:bg-[#123031] hover:text-[#e5f3ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c14e]"
          aria-label="Restart simulation"
          title="Restart simulation"
        >
          <RotateCcw size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center border border-[#31585a] bg-[#0c2021]" aria-label="Simulation speed">
        <span className="px-2 font-mono text-[9px] tracking-[0.14em] text-[#86aaa4] uppercase">Rate</span>
        {SPEEDS.map((value) => {
          const selected = speed === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={selected}
              className="h-8 min-w-8 border-l border-[#31585a] px-1.5 font-mono text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f2c14e]"
              style={{
                background: selected ? '#f2c14e' : 'transparent',
                color: selected ? '#071617' : '#86aaa4',
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
