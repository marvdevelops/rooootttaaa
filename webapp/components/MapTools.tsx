import { MapStyleMode } from './MapStyleControls';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  is3D: boolean;
  onToggle3D: () => void;
  mapStyleMode: MapStyleMode;
  onChangeStyle: (mode: MapStyleMode) => void;
}

/** Vertical map tool stack — zoom in/out, recenter, 3D, satellite. 40px white squares, per the design brief. */
export default function MapTools({ onZoomIn, onZoomOut, onRecenter, is3D, onToggle3D, mapStyleMode, onChangeStyle }: Props) {
  return (
    <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
      <ToolButton onClick={onZoomIn} label="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolButton>
      <ToolButton onClick={onZoomOut} label="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolButton>
      <ToolButton onClick={onRecenter} label="Recenter">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </ToolButton>
      <div style={{ height: 4 }} />
      <ToolButton active={is3D} onClick={onToggle3D} label="3D">
        <span style={{ fontSize: 11, fontWeight: 800 }}>3D</span>
      </ToolButton>
      <ToolButton active={mapStyleMode === 'satellite'} onClick={() => onChangeStyle(mapStyleMode === 'satellite' ? 'standard' : 'satellite')} label="Satellite">
        <span style={{ fontSize: 10, fontWeight: 800 }}>SAT</span>
      </ToolButton>
    </div>
  );
}

function ToolButton({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="soft-btn"
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: active ? 'var(--coral)' : 'var(--surface)',
        color: active ? 'var(--white)' : 'var(--ink)',
        boxShadow: 'var(--shadow-floating)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
