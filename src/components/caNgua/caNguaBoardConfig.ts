import { CaNguaColor } from '../../types';

export const TRACK_COORDINATES: [number, number][] = [
  // 0..12: Từ ngang đỏ hướng lên đỉnh xanh
  [6, 1],  // 0
  [6, 2],  // 1
  [6, 3],  // 2
  [6, 4],  // 3
  [6, 5],  // 4
  [6, 6],  // 5
  [5, 6],  // 6
  [4, 6],  // 7
  [3, 6],  // 8
  [2, 6],  // 9
  [1, 6],  // 10
  [0, 6],  // 11
  [0, 7],  // 12 (Cửa Chuồng Xanh Dương / Blue Gate)

  // 13..26: Từ XP Xanh Dương đi xuống sang phải tới cửa chuồng Vàng
  [0, 8],  // 13 (Xuất Phát Xanh Dương / Blue Start)
  [1, 8],  // 14
  [2, 8],  // 15
  [3, 8],  // 16
  [4, 8],  // 17
  [5, 8],  // 18
  [6, 8],  // 19
  [6, 9],  // 20
  [6, 10], // 21
  [6, 11], // 22
  [6, 12], // 23
  [6, 13], // 24
  [6, 14], // 25
  [7, 14], // 26 (Cửa Chuồng Vàng / Yellow Gate)

  // 27..40: Từ XP Vàng đi sang trái xuống đáy tới cửa chuồng Lá
  [8, 14], // 27 (Xuất Phát Vàng / Yellow Start)
  [8, 13], // 28
  [8, 12], // 29
  [8, 11], // 30
  [8, 10], // 31
  [8, 9],  // 32
  [8, 8],  // 33
  [9, 8],  // 34
  [10, 8], // 35
  [11, 8], // 36
  [12, 8], // 37
  [13, 8], // 38
  [14, 8], // 39
  [14, 7], // 40 (Cửa Chuồng Lá / Green Gate)

  // 41..54: Từ XP Lá đi lên rẽ trái tới cửa chuồng Đỏ
  [14, 6], // 41 (Xuất Phát Lá / Green Start)
  [13, 6], // 42
  [12, 6], // 43
  [11, 6], // 44
  [10, 6], // 45
  [9, 6],  // 46
  [8, 6],  // 47
  [8, 5],  // 48
  [8, 4],  // 49
  [8, 3],  // 50
  [8, 2],  // 51
  [8, 1],  // 52
  [8, 0],  // 53
  [7, 0],  // 54 (Cửa Chuồng Đỏ / Red Gate)

  // 55: Ô Xuất Phát Đỏ (quay vòng về ô 0)
  [6, 0],  // 55 (Xuất Phát Đỏ / Red Start)
];

export const BARN_COORDINATES: Record<CaNguaColor, [number, number][]> = {
  RED: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  BLUE: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ],
  YELLOW: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
  GREEN: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7],
  ],
};

export const COLOR_CONFIG: Record<
  CaNguaColor,
  {
    name: string;
    hex: string;
    bg: string;
    border: string;
    text: string;
    lightBg: string;
    stableClass: string;
    badge: string;
    gatePos: number;
    startPos: number;
  }
> = {
  RED: {
    name: 'Đỏ',
    hex: '#ef4444',
    bg: 'bg-rose-600',
    border: 'border-rose-500',
    text: 'text-rose-400',
    lightBg: 'bg-rose-950/40',
    stableClass: 'from-rose-950/70 via-red-900/50 to-[#220d0d] border-rose-500/60',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    gatePos: 54,
    startPos: 55,
  },
  BLUE: {
    name: 'Xanh Dương',
    hex: '#3b82f6',
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-400',
    lightBg: 'bg-blue-950/40',
    stableClass: 'from-blue-950/70 via-indigo-900/50 to-[#0d1422] border-blue-500/60',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    gatePos: 12,
    startPos: 13,
  },
  YELLOW: {
    name: 'Vàng',
    hex: '#eab308',
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-400',
    lightBg: 'bg-amber-950/40',
    stableClass: 'from-amber-950/70 via-yellow-900/50 to-[#22180d] border-amber-500/60',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    gatePos: 26,
    startPos: 27,
  },
  GREEN: {
    name: 'Xanh Lá',
    hex: '#10b981',
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    lightBg: 'bg-emerald-950/40',
    stableClass: 'from-emerald-950/70 via-green-900/50 to-[#0d2214] border-emerald-500/60',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    gatePos: 40,
    startPos: 41,
  },
};
