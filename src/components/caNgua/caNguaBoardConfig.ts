import { CaNguaColor } from '../../types';

// 56 tọa độ [row, col] của đường đua 15x15 không trùng lặp, tạo thành 1 vòng tròn khép kín
export const TRACK_COORDINATES: [number, number][] = [
  // 1. Nhánh Đỏ (Trái lên Trên) - 14 ô (0..13)
  [6, 1],  // 0: Xuất phát Đỏ
  [6, 2],  // 1
  [6, 3],  // 2
  [6, 4],  // 3
  [6, 5],  // 4
  [6, 6],  // 5: Góc trong trên-trái
  [5, 6],  // 6
  [4, 6],  // 7
  [3, 6],  // 8
  [2, 6],  // 9
  [1, 6],  // 10
  [0, 6],  // 11
  [0, 7],  // 12: Đỉnh trên
  [0, 8],  // 13: Cửa vào chuồng Xanh Dương

  // 2. Nhánh Xanh Dương (Trên sang Phải) - 14 ô (14..27)
  [1, 8],  // 14: Xuất phát Xanh Dương
  [2, 8],  // 15
  [3, 8],  // 16
  [4, 8],  // 17
  [5, 8],  // 18
  [6, 8],  // 19: Góc trong trên-phải
  [6, 9],  // 20
  [6, 10], // 21
  [6, 11], // 22
  [6, 12], // 23
  [6, 13], // 24
  [6, 14], // 25
  [7, 14], // 26: Đỉnh phải
  [8, 14], // 27: Cửa vào chuồng Vàng

  // 3. Nhánh Vàng (Phải xuống Dưới) - 14 ô (28..41)
  [8, 13], // 28: Xuất phát Vàng
  [8, 12], // 29
  [8, 11], // 30
  [8, 10], // 31
  [8, 9],  // 32
  [8, 8],  // 33: Góc trong dưới-phải
  [9, 8],  // 34
  [10, 8], // 35
  [11, 8], // 36
  [12, 8], // 37
  [13, 8], // 38
  [14, 8], // 39
  [14, 7], // 40: Đỉnh dưới
  [14, 6], // 41: Cửa vào chuồng Xanh Lá

  // 4. Nhánh Xanh Lá (Dưới sang Trái) - 14 ô (42..55)
  [13, 6], // 42: Xuất phát Xanh Lá
  [12, 6], // 43
  [11, 6], // 44
  [10, 6], // 45
  [9, 6],  // 46
  [8, 6],  // 47: Góc trong dưới-trái
  [8, 5],  // 48
  [8, 4],  // 49
  [8, 3],  // 50
  [8, 2],  // 51
  [8, 1],  // 52
  [8, 0],  // 53
  [7, 0],  // 54: Đỉnh trái
  [6, 0],  // 55: Cửa vào chuồng Đỏ
];

// Thang vào chuồng (6 bước) hướng về tâm [7, 7]
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
    bg: string;
    border: string;
    text: string;
    glow: string;
    badge: string;
    stableClass: string;
    horseGradient: string;
    hex: string;
    accentHex: string;
  }
> = {
  RED: {
    name: 'Đỏ Ruby',
    bg: 'bg-rose-600',
    border: 'border-rose-500',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/50',
    badge: 'bg-rose-950/80 text-rose-300 border-rose-700',
    stableClass: 'from-rose-950/70 to-red-950/40 border-rose-700/60 shadow-rose-950/40',
    horseGradient: 'from-rose-500 via-red-600 to-rose-700',
    hex: '#ef4444',
    accentHex: '#f43f5e',
  },
  BLUE: {
    name: 'Xanh Biển',
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/50',
    badge: 'bg-blue-950/80 text-blue-300 border-blue-700',
    stableClass: 'from-blue-950/70 to-indigo-950/40 border-blue-700/60 shadow-blue-950/40',
    horseGradient: 'from-blue-500 via-indigo-600 to-blue-700',
    hex: '#3b82f6',
    accentHex: '#60a5fa',
  },
  YELLOW: {
    name: 'Vàng Hoàng Gia',
    bg: 'bg-amber-500',
    border: 'border-amber-500',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/50',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-700',
    stableClass: 'from-amber-950/70 to-yellow-950/40 border-amber-700/60 shadow-amber-950/40',
    horseGradient: 'from-amber-400 via-yellow-500 to-amber-600',
    hex: '#f59e0b',
    accentHex: '#fbbf24',
  },
  GREEN: {
    name: 'Xanh Lục Bảo',
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/50',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700',
    stableClass: 'from-emerald-950/70 to-teal-950/40 border-emerald-700/60 shadow-emerald-950/40',
    horseGradient: 'from-emerald-500 via-green-600 to-emerald-700',
    hex: '#10b981',
    accentHex: '#34d399',
  },
};
