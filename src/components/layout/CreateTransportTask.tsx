import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import { DROPOFF_STATIONS, PICKUP_STATIONS, isPassable } from '../../engine/warehouse';
import { useSimStore } from '../../store/useSimStore';

type RobotId = 'R1' | 'R2' | 'R3';

const ROBOT_IDS: RobotId[] = ['R1', 'R2', 'R3'];
const AISLES = [
  { label: 'Aisle 1', position: PICKUP_STATIONS[0] },
  { label: 'Aisle 2', position: PICKUP_STATIONS[1] },
  { label: 'Aisle 3', position: PICKUP_STATIONS[2] },
  { label: 'Aisle 4', position: DROPOFF_STATIONS[0] },
  { label: 'Aisle 5', position: DROPOFF_STATIONS[1] },
  { label: 'Aisle 6', position: DROPOFF_STATIONS[2] },
] as const;

export function CreateTransportTask() {
  const blockedCells = useSimStore((state) => state.blockedCells);
  const createTransportTask = useSimStore((state) => state.createTransportTask);
  const [robotId, setRobotId] = useState<RobotId>('R1');
  const [pickupAisle, setPickupAisle] = useState('');
  const [dropoffAisle, setDropoffAisle] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string }>();

  const pickup = AISLES.find((aisle) => aisle.label === pickupAisle)?.position;
  const dropoff = AISLES.find((aisle) => aisle.label === dropoffAisle)?.position;
  const sameAisle = pickupAisle !== '' && pickupAisle === dropoffAisle;
  const isValid =
    pickup !== undefined &&
    dropoff !== undefined &&
    !sameAisle &&
    isPassable(pickup.x, pickup.y, blockedCells) &&
    isPassable(dropoff.x, dropoff.y, blockedCells);

  const handleAssign = () => {
    if (!pickup || !dropoff || !isValid) return;
    const result = createTransportTask(robotId, pickup, dropoff);
    setMessage(
      result.success
        ? { type: 'success', text: `${robotId} transport task assigned.` }
        : { type: 'error', text: result.error ?? 'Unable to assign transport task.' },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Create transport task">
      <div className="flex items-center gap-1 text-[#68777d]">
        <MapPinned size={12} aria-hidden="true" />
        <span className="font-sans text-[9px] font-bold tracking-[0.08em] uppercase">Transport</span>
      </div>
      <select
        aria-label="Transport robot"
        value={robotId}
        onChange={(event) => setRobotId(event.target.value as RobotId)}
        className="h-8 border border-[#d8dce0] bg-white px-2 font-sans text-[10px] text-[#1f3442] outline-none focus:border-[#2f80c3]"
      >
        {ROBOT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
      <select
        aria-label="Pickup aisle"
        value={pickupAisle}
        onChange={(event) => { setPickupAisle(event.target.value); setMessage(undefined); }}
        className="h-8 max-w-[7rem] border border-[#d8dce0] bg-white px-2 font-sans text-[10px] text-[#1f3442] outline-none focus:border-[#2f80c3]"
      >
        <option value="">Pickup aisle</option>
        {AISLES.map((aisle) => <option key={aisle.label} value={aisle.label}>{aisle.label}</option>)}
      </select>
      <select
        aria-label="Drop-off aisle"
        value={dropoffAisle}
        onChange={(event) => { setDropoffAisle(event.target.value); setMessage(undefined); }}
        className="h-8 max-w-[7rem] border border-[#d8dce0] bg-white px-2 font-sans text-[10px] text-[#1f3442] outline-none focus:border-[#2f80c3]"
      >
        <option value="">Drop-off aisle</option>
        {AISLES.map((aisle) => <option key={aisle.label} value={aisle.label}>{aisle.label}</option>)}
      </select>
      <button
        type="button"
        onClick={handleAssign}
        disabled={!isValid}
        className="h-8 border border-[#1f5f9c] bg-[#1f5f9c] px-2.5 font-sans text-[9px] font-bold tracking-[0.06em] text-white uppercase transition-colors hover:bg-[#174c7d] disabled:cursor-not-allowed disabled:border-[#d8dce0] disabled:bg-[#e8e5df] disabled:text-[#9da5a9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f80c3]"
      >
        Assign Task
      </button>
      {(sameAisle || (pickup && !isPassable(pickup.x, pickup.y, blockedCells)) || (dropoff && !isPassable(dropoff.x, dropoff.y, blockedCells))) && !message && (
        <span className="basis-full font-sans text-[9px] text-[#c34d55]" role="alert">
          {sameAisle ? 'Pickup and drop-off aisles must differ.' : 'Selected aisle is currently blocked.'}
        </span>
      )}
      {message && (
        <span className={`basis-full font-sans text-[9px] ${message.type === 'success' ? 'text-[#1eaa73]' : 'text-[#c34d55]'}`} role="status">
          {message.text}
        </span>
      )}
    </div>
  );
}
