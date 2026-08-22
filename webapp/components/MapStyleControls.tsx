export type MapStyleMode = 'standard' | 'satellite';

interface Props {
  mapStyleMode: MapStyleMode;
  onChangeStyle: (mode: MapStyleMode) => void;
  is3D: boolean;
  onToggle3D: () => void;
}

/** Satellite/standard + 2D/3D toggle — same two controls as the mobile map builder. */
export default function MapStyleControls({ mapStyleMode, onChangeStyle, is3D, onToggle3D }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 8,
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', borderRadius: 'var(--radius-pill)', background: 'var(--surface)', boxShadow: 'var(--elevation-card)', overflow: 'hidden' }}>
        <button onClick={() => onChangeStyle('standard')} style={toggleBtnStyle(mapStyleMode === 'standard')}>
          Map
        </button>
        <button onClick={() => onChangeStyle('satellite')} style={toggleBtnStyle(mapStyleMode === 'satellite')}>
          Satellite
        </button>
      </div>
      <button onClick={onToggle3D} style={{ ...toggleBtnStyle(is3D), borderRadius: 'var(--radius-pill)', boxShadow: 'var(--elevation-card)' }}>
        3D
      </button>
    </div>
  );
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    border: 'none',
    background: active ? 'var(--coral)' : 'var(--surface)',
    color: active ? 'var(--white)' : 'var(--ink)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  };
}
