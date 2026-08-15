const STAFF_NAME_COLORS: Record<string, string> = {
  anna: '#1aa7a1', anne: '#8b5cf6', agnes: '#fa8072', drew: '#ff4fa8',
  jacob: '#8f5ab8', jake: '#ff8c00', jason: '#4778d4', jayden: '#e14b2d',
  jazz: '#b0e0e6', kevin: '#b9346d', lindsay: '#ffd54f', lucky: '#9acd32',
  megan: '#b57edc', shy: '#4d83ff', sienna: '#35a852', sisi: '#c9874e',
  summer: '#3eb489', tomma: '#e24c87', bree: '#ff9f70', breanne: '#ff9f70',
};

export function normalizeStaffName(value: string) {
  return value.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim().toLowerCase();
}

export function staffNameColor(name: string) {
  return STAFF_NAME_COLORS[normalizeStaffName(name)] || '#e9f0f5';
}

export function ColoredStaffNames({ prefix, names }: { prefix: string; names: string[] }) {
  return <div className="event-meta staff-line"><span>{prefix}:</span>{names.length ? names.map((name, index) =>
    <span className="staff-name" style={{ color: staffNameColor(name) }} key={`${normalizeStaffName(name)}-${index}`}>{name}{index < names.length - 1 ? ',' : ''}</span>
  ) : <span>Open</span>}</div>;
}
