/**
 * Tarif mashinalari (yon ko'rinish, SVG): har sinfning o'z shakli va rangi —
 * Ekonom (oq sedan), Komfort (po'lat-ko'k sedan), Biznes (qora uzun sedan), Miniven (kumush, baland).
 */
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Kind = 'ekonom' | 'komfort' | 'biznes' | 'miniven';

const PAINT: Record<Kind, { top: string; base: string; line: string }> = {
  ekonom: { top: '#ffffff', base: '#dcdad3', line: '#b9b6ad' },
  komfort: { top: '#9fb3cc', base: '#5f7896', line: '#4a6280' },
  biznes: { top: '#4a4a4a', base: '#111111', line: '#000000' },
  miniven: { top: '#d9dde2', base: '#9ea5ae', line: '#7f8791' },
};

/** Tarif kodidan (yoki o'rinlar/darajadan) mashina turi */
export function carKind(t: { code?: string | null; name?: string; seats?: number; level?: number }): Kind {
  const c = (t.code || t.name || '').toLowerCase();
  if (c.includes('mini') || (t.seats ?? 4) >= 6) return 'miniven';
  if (c.includes('biz') || (t.level ?? 1) >= 3) return 'biznes';
  if (c.includes('kom') || (t.level ?? 1) === 2) return 'komfort';
  return 'ekonom';
}

const SEDAN = 'M4 22.2C4 19.6 5.8 17.7 8.6 17.2L17 15.6L23.2 9.6C24.4 8.4 26 7.7 27.7 7.7H40C42 7.7 43.8 8.6 45 10.1L50.2 15.9L56 17.1C58.4 17.6 60 19.3 60 21.6V23C60 24.1 59.1 25 58 25H6C4.9 25 4 24.1 4 23Z';
const LIMO = 'M2 22.2C2 19.8 3.7 18 6.4 17.5L15.5 16L22.8 10.2C24 9.2 25.6 8.6 27.2 8.6H42.5C44.4 8.6 46.2 9.4 47.4 10.8L52.6 16.2L58.4 17.3C60.6 17.8 62 19.4 62 21.6V23C62 24.1 61.1 25 60 25H4C2.9 25 2 24.1 2 23Z';
const VAN = 'M4 22V17.6C4 16.4 4.6 15.4 5.6 14.8L11.8 8.4C13 7.2 14.6 6.5 16.3 6.5H46.2C48.4 6.5 50.4 7.7 51.4 9.6L54.8 16L57.6 16.8C59 17.2 60 18.5 60 20V23C60 24.1 59.1 25 58 25H6C4.9 25 4 24.1 4 23Z';

export function TariffCar({ kind, size = 58 }: { kind: Kind; size?: number }) {
  const p = PAINT[kind];
  const id = `g-${kind}`;
  const glass = kind === 'biznes' ? '#2a3440' : '#3d4a5c';
  const wheels = kind === 'biznes' ? [17, 48] : kind === 'miniven' ? [16, 47] : [16, 47];
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 64 32">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.top} />
          <Stop offset="1" stopColor={p.base} />
        </LinearGradient>
        <LinearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8fa3bb" />
          <Stop offset="1" stopColor={glass} />
        </LinearGradient>
      </Defs>
      {/* yerdagi soya */}
      <Ellipse cx="32" cy="29" rx="27" ry="1.8" fill="#000" opacity={0.14} />

      <Path d={kind === 'miniven' ? VAN : kind === 'biznes' ? LIMO : SEDAN} fill={`url(#${id})`} stroke={p.line} strokeWidth={0.6} />

      {/* oynalar */}
      {kind === 'miniven' ? (
        <>
          <Path d="M13.6 9.4C14.2 8.8 15 8.5 15.8 8.5H22.5V15H8.4Z" fill={`url(#${id}-glass)`} />
          <Rect x="24.2" y="8.5" width="10.6" height="6.5" rx="1" fill={`url(#${id}-glass)`} />
          <Rect x="36.5" y="8.5" width="9.6" height="6.5" rx="1" fill={`url(#${id}-glass)`} />
          <Path d="M47.8 8.5C48.6 8.5 49.3 9 49.7 9.7L52.5 15H47.8Z" fill={`url(#${id}-glass)`} />
        </>
      ) : kind === 'biznes' ? (
        <>
          <Path d="M24.4 11.4C25.2 10.7 26.2 10.3 27.3 10.3H34.4V15.8H19Z" fill={`url(#${id}-glass)`} />
          <Path d="M36.2 10.3H42.4C43.7 10.3 44.9 10.8 45.8 11.8L49.6 15.8H36.2Z" fill={`url(#${id}-glass)`} />
          {/* xrom chiziq */}
          <Path d="M7 19.6H58" stroke="#c9ccd1" strokeWidth={0.7} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path d="M24.8 10.7C25.6 9.9 26.6 9.5 27.7 9.5H33.2V15.7H19.8Z" fill={`url(#${id}-glass)`} />
          <Path d="M35 9.5H40C41.3 9.5 42.5 10.1 43.4 11.1L47.5 15.7H35Z" fill={`url(#${id}-glass)`} />
        </>
      )}
      {/* eshik chizig'i, fara va stop-chiroq */}
      <Path d={kind === 'miniven' ? 'M35.6 16.5V23.5' : 'M34.1 16.8V23.5'} stroke={p.line} strokeWidth={0.6} opacity={0.7} />
      <Rect x={kind === 'biznes' ? 59 : 57.4} y="18.6" width="2.4" height="1.6" rx="0.8" fill="#ffe7a3" />
      <Rect x={kind === 'biznes' ? 2.4 : 4.2} y="18.8" width="2" height="1.6" rx="0.8" fill="#e0453a" />

      {/* g'ildiraklar: shina, disk, markaz */}
      {wheels.map((cx) => (
        <Circle key={`t${cx}`} cx={cx} cy="25" r="5.2" fill="#1b1b1b" />
      ))}
      {wheels.map((cx) => (
        <Circle key={`r${cx}`} cx={cx} cy="25" r="2.9" fill={kind === 'biznes' ? '#d7dade' : '#b9bdc3'} stroke="#8d9299" strokeWidth={0.5} />
      ))}
      {wheels.map((cx) => (
        <Circle key={`h${cx}`} cx={cx} cy="25" r="0.9" fill="#6b7078" />
      ))}
    </Svg>
  );
}
