import { Text, type StyleProp, type TextStyle } from 'react-native';

const STAFF_NAME_COLORS: Record<string, string> = {
  anna: '#1aa7a1',
  anne: '#8b5cf6',
  agnes: '#fa8072',
  drew: '#ff4fa8',
  jacob: '#8f5ab8',
  jake: '#ff8c00',
  jason: '#1f4ea8',
  jayden: '#e14b2d',
  jazz: '#b0e0e6',
  kevin: '#8e1d4a',
  lindsay: '#ffd54f',
  lucky: '#9acd32',
  megan: '#b57edc',
  shy: '#1e6bff',
  sienna: '#228b22',
  sisi: '#a66a3a',
  summer: '#3eb489',
  tomma: '#c72c67',
};

function normalizeStaffName(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[’']s$/i, '')
    .trim()
    .toLowerCase();
}

export function staffNameColor(name: string): string | undefined {
  return STAFF_NAME_COLORS[normalizeStaffName(name)];
}

type ColoredStaffNamesTextProps = {
  prefix: string;
  names: string[];
  style?: StyleProp<TextStyle>;
};

export function ColoredStaffNamesText({ prefix, names, style }: ColoredStaffNamesTextProps) {
  if (!names.length) return null;

  return (
    <Text style={style}>
      {prefix}:{' '}
      {names.map((name, index) => (
        <Text
          key={`${normalizeStaffName(name)}-${index}`}
          style={{ color: staffNameColor(name) ?? '#e9f0f5' }}>
          {name}
          {index < names.length - 1 ? ', ' : ''}
        </Text>
      ))}
    </Text>
  );
}
