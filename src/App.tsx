import { useEffect, type ReactNode } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { Header } from './components/layout/Header';
import { LoginPage } from './components/layout/LoginPage';
import { MetricsPanel } from './components/layout/MetricsPanel';
import { SplitView } from './components/layout/SplitView';
import { proposedTick } from './engine/proposed';
import { BASE_TICK_MS } from './engine/simulation';
import { traditionalTick } from './engine/traditional';
import { useSimStore } from './store/useSimStore';
import { useAuthStore } from './store/useAuthStore';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

export default function App() {
  useSimulationLoop();

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: '#f8f7f4', fontFamily: "'Geist Variable', sans-serif" }}
    >
      <Header />

      <Switch>
        <Route path="/login">
          <LoginPage initialMode="login" />
        </Route>
        <Route path="/signup">
          <LoginPage initialMode="signup" />
        </Route>
        <Route path="/">
          <ProtectedRoute>
            {/* ── Main split-screen simulation view ── */}
            <main className="min-h-0 flex-1">
              <SplitView />
            </main>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute>
            <main className="min-h-0 flex-1 flex flex-col p-4">
              <MetricsPanel fullPage />
            </main>
          </ProtectedRoute>
        </Route>
        {/* Fallback route */}
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    </div>
  );
}

/**
 * A single requestAnimationFrame loop keeps the engine independent of React's
 * render cadence. Logical steps stay fixed at 200 ms / speed multiplier.
 */
function useSimulationLoop() {
  useEffect(() => {
    let animationFrame = 0;
    let lastFrame = performance.now();
    let accumulator = 0;

    const frame = (now: number) => {
      const elapsed = Math.min(now - lastFrame, 1_000);
      lastFrame = now;
      const state = useSimStore.getState();

      if (state.isPlaying) {
        accumulator += elapsed;
        const tickDuration = BASE_TICK_MS / state.speed;

        while (accumulator >= tickDuration) {
          accumulator -= tickDuration;
          const current = useSimStore.getState();
          const nextTick = current.tick + 1;
          const traditional = traditionalTick(current.traditional, {
            tick: nextTick,
            blockedCells: current.blockedCells,
            cloudKilled: current.cloudKilled,
            killedRobots: current.killedRobots,
            powerOutage: !current.warehousePower,
            // Fixed logical ticks model the cloud round-trip without timers.
            plannerInterval: Math.max(1, Math.ceil(current.latencyMs / BASE_TICK_MS)),
          });
          const proposed = proposedTick(current.proposed, {
            tick: nextTick,
            blockedCells: current.blockedCells,
            killedRobots: current.killedRobots,
            unresponsiveRobots: current.unresponsiveRobots,
            powerOutage: !current.warehousePower,
          });

          current.setTraditionalState(
            traditional.robots,
            traditional.metrics,
            traditional.remainingBoxes,
            traditional.stackBoxes,
          );
          current.setProposedState(
            proposed.robots,
            proposed.metrics,
            proposed.remainingBoxes,
            proposed.stackBoxes,
            proposed.p2pLinks,
          );
          current.setTick(nextTick);
        }
      } else {
        // Pausing never carries a partial interval into the resumed simulation.
        accumulator = 0;
      }

      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, []);
}
