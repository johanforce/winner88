import { XiangqiPiece, XiangqiPieceType, XiangqiSide } from '../types';

export interface XiangqiPuzzlePreset {
  id: string;
  name: string;
  chineseName?: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Khó' | 'Giang hồ';
  description: string;
  sideToMove: XiangqiSide; // Lượt đi gợi ý ban đầu của thế cờ (người chơi có thể đổi tùy ý)
  hintText: string;
  pieces: { type: XiangqiPieceType; color: XiangqiSide; x: number; y: number }[];
}

export const XIANGQI_PIECE_LIMITS: Record<XiangqiPieceType, number> = {
  GENERAL: 1,
  ADVISOR: 2,
  ELEPHANT: 2,
  HORSE: 2,
  CHARIOT: 2,
  CANNON: 2,
  SOLDIER: 5,
};

/**
 * Kiểm tra xem vị trí đặt quân có hợp lệ theo đúng luật cờ tướng hay không:
 * - Tướng: chỉ nằm trong Cửu Cung
 * - Sĩ: chỉ nằm ở 5 giao điểm chéo trong Cửu Cung
 * - Tượng: không được qua sông, chỉ đứng ở 7 vị trí mắt Tượng cố định
 * - Binh/Tốt: không bao giờ được lùi về sau hàng xuất phát; chưa qua sông chỉ được đứng ở cột xuất phát
 */
export function isLegalPiecePlacement(
  type: XiangqiPieceType,
  color: XiangqiSide,
  x: number,
  y: number
): { valid: boolean; reason?: string } {
  if (x < 0 || x > 8 || y < 0 || y > 9) {
    return { valid: false, reason: 'Nằm ngoài phạm vi bàn cờ (x: 0..8, y: 0..9)' };
  }

  // General (Tướng)
  if (type === 'GENERAL') {
    if (color === 'RED') {
      if (x < 3 || x > 5 || y < 7 || y > 9) {
        return { valid: false, reason: 'Tướng Đỏ phải nằm trong Cửu cung Đỏ (cột 4..6, hàng 8..10)' };
      }
    } else {
      if (x < 3 || x > 5 || y < 0 || y > 2) {
        return { valid: false, reason: 'Tướng Đen phải nằm trong Cửu cung Đen (cột 4..6, hàng 1..3)' };
      }
    }
  }

  // Advisor (Sĩ)
  if (type === 'ADVISOR') {
    if (color === 'RED') {
      const validRedAdvisor = [
        [3, 9], [5, 9], [4, 8], [3, 7], [5, 7]
      ];
      if (!validRedAdvisor.some(([vx, vy]) => vx === x && vy === y)) {
        return { valid: false, reason: 'Sĩ Đỏ chỉ được đứng trên 5 điểm chéo trong Cung Đỏ' };
      }
    } else {
      const validBlackAdvisor = [
        [3, 0], [5, 0], [4, 1], [3, 2], [5, 2]
      ];
      if (!validBlackAdvisor.some(([vx, vy]) => vx === x && vy === y)) {
        return { valid: false, reason: 'Sĩ Đen chỉ được đứng trên 5 điểm chéo trong Cung Đen' };
      }
    }
  }

  // Elephant (Tượng)
  if (type === 'ELEPHANT') {
    if (color === 'RED') {
      const validRedElephant = [
        [2, 9], [6, 9], [0, 7], [4, 7], [8, 7], [2, 5], [6, 5]
      ];
      if (!validRedElephant.some(([vx, vy]) => vx === x && vy === y)) {
        return { valid: false, reason: 'Tượng Đỏ không được qua sông và chỉ đứng đúng 7 mắt Tượng' };
      }
    } else {
      const validBlackElephant = [
        [2, 0], [6, 0], [0, 2], [4, 2], [8, 2], [2, 4], [6, 4]
      ];
      if (!validBlackElephant.some(([vx, vy]) => vx === x && vy === y)) {
        return { valid: false, reason: 'Tượng Đen không được qua sông và chỉ đứng đúng 7 mắt Tượng' };
      }
    }
  }

  // Soldier (Binh / Tốt)
  if (type === 'SOLDIER') {
    if (color === 'RED') {
      // Binh Đỏ xuất phát ở y=6, tiến dần về y=0. Không bao giờ được ở y > 6 (không thể đi lùi)
      if (y > 6) {
        return { valid: false, reason: 'Binh Đỏ không thể lùi về sau hàng xuất phát (hàng 8, 9, 10)' };
      }
      // Chưa qua sông (y = 6 hoặc y = 5): chưa được đi ngang, chỉ ở cột xuất phát {0, 2, 4, 6, 8}
      if (y >= 5) {
        if (![0, 2, 4, 6, 8].includes(x)) {
          return { valid: false, reason: 'Binh Đỏ chưa qua sông chỉ có thể ở các cột xuất phát (1, 3, 5, 7, 9)' };
        }
      }
    } else {
      // Tốt Đen xuất phát ở y=3, tiến dần về y=9. Không bao giờ được ở y < 3 (không thể đi lùi)
      if (y < 3) {
        return { valid: false, reason: 'Tốt Đen không thể lùi về sau hàng xuất phát (hàng 1, 2, 3)' };
      }
      // Chưa qua sông (y = 3 hoặc y = 4): chưa được đi ngang, chỉ ở cột xuất phát {0, 2, 4, 6, 8}
      if (y <= 4) {
        if (![0, 2, 4, 6, 8].includes(x)) {
          return { valid: false, reason: 'Tốt Đen chưa qua sông chỉ có thể ở các cột xuất phát (1, 3, 5, 7, 9)' };
        }
      }
    }
  }

  return { valid: true };
}

export const CLASSIC_XIANGQI_PUZZLES: XiangqiPuzzlePreset[] = [
  // 1
  {
    id: 'ma-dieu-ngu',
    name: 'Mã Điếu Ngư Sát Cuộc',
    chineseName: '釣魚馬殺局',
    difficulty: 'Dễ',
    description: 'Thế cờ sát pháp kinh điển: Mã cắm ở vị trí (2,2) khống chế cung tướng đối phương, Xe thọc thẳng chiếu bí.',
    sideToMove: 'RED',
    hintText: 'Mã đỏ đã khống chế đường thoái của Tướng đen. Dùng Xe đỏ thọc sâu xuống đáy cung dứt điểm!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 1, y: 8 },
      { type: 'HORSE', color: 'RED', x: 2, y: 2 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 8, y: 1 },
      { type: 'SOLDIER', color: 'BLACK', x: 2, y: 4 },
    ],
  },

  // 2
  {
    id: 'trac-dien-ho',
    name: 'Trắc Diện Hổ (Hổ Rình Cánh)',
    chineseName: '側面虎',
    difficulty: 'Trung bình',
    description: 'Đòn đánh hiểm hóc: Mã Đỏ chiếm góc sườn cung, Xe Đỏ phối hợp chiếu ngang hoặc thọc đáy dứt điểm.',
    sideToMove: 'RED',
    hintText: 'Tận dụng Mã ở sườn cung khống chế cửa thoái, Xe đỏ phối hợp đòn sườn ép Tướng vào góc chết.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 3, y: 6 },
      { type: 'HORSE', color: 'RED', x: 2, y: 3 },
      { type: 'SOLDIER', color: 'RED', x: 4, y: 4 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 7, y: 2 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 5 },
    ],
  },

  // 3
  {
    id: 'phao-trung-chieu-bi',
    name: 'Pháo Trùng Chiếu Bí',
    chineseName: '重炮殺局',
    difficulty: 'Dễ',
    description: 'Thế cờ 2 Pháo trên cùng một hàng dọc, pháo trước làm ngòi cho pháo sau chiếu bí không thể cản phá.',
    sideToMove: 'RED',
    hintText: 'Hai Pháo đỏ cùng nhìn thẳng vào mặt Tướng. Pháo sau yểm trợ cho pháo trước thâm nhập sâu vào cung!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CANNON', color: 'RED', x: 4, y: 4 },
      { type: 'CANNON', color: 'RED', x: 4, y: 5 },
      { type: 'CHARIOT', color: 'RED', x: 0, y: 8 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 8, y: 3 },
      { type: 'HORSE', color: 'BLACK', x: 6, y: 2 },
    ],
  },

  // 4
  {
    id: 'khong-minh-muon-gio',
    name: 'Khổng Minh Mượn Gió Đông',
    chineseName: '孔明借東風',
    difficulty: 'Khó',
    description: 'Tận dụng Xe Pháo Binh phối hợp thần tốc, vừa phá thế thủ kiên cố của đối phương vừa giải cứu Tướng nhà.',
    sideToMove: 'RED',
    hintText: 'Đỏ đang bị uy hiếp nặng nề. Phải liên tục chiếu tướng bằng Xe và Pháo để đối thủ không kịp phản công!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 1, y: 4 },
      { type: 'CANNON', color: 'RED', x: 6, y: 7 },
      { type: 'SOLDIER', color: 'RED', x: 3, y: 4 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 1, y: 8 },
      { type: 'CANNON', color: 'BLACK', x: 7, y: 1 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 5 },
    ],
  },

  // 5
  {
    id: 'that-tinh-tu-hoi',
    name: 'Thất Tinh Tụ Hội (七星聚会)',
    chineseName: '七星聚會',
    difficulty: 'Giang hồ',
    description: 'Một trong Tứ Đại Danh Cuộc nổi tiếng bậc nhất lịch sử cờ tướng. Mỗi bên 7 quân giằng co quyết liệt tranh tiên.',
    sideToMove: 'RED',
    hintText: 'Thế cờ giang hồ tinh xảo. Các nước đi phải chuẩn xác từng milimet, dùng Binh và Xe thọc sâu!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 2, y: 8 },
      { type: 'CHARIOT', color: 'RED', x: 6, y: 8 },
      { type: 'ADVISOR', color: 'RED', x: 4, y: 8 },
      { type: 'CANNON', color: 'RED', x: 1, y: 5 },
      { type: 'CANNON', color: 'RED', x: 7, y: 5 },
      { type: 'SOLDIER', color: 'RED', x: 4, y: 3 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 4, y: 6 },
      { type: 'SOLDIER', color: 'BLACK', x: 2, y: 5 },
      { type: 'SOLDIER', color: 'BLACK', x: 6, y: 5 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 5 },
    ],
  },

  // 6
  {
    id: 'da-ma-thao-dien',
    name: 'Dã Mã Thao Điền (野马操田)',
    chineseName: '野馬操田',
    difficulty: 'Giang hồ',
    description: 'Thế cờ giang hồ tuyệt đỉnh về nghệ thuật điều Mã và Binh qua sông phối hợp chiếu hiểm độc.',
    sideToMove: 'RED',
    hintText: 'Mã đỏ tung hoành ngang dọc. Chú ý khóa chặt đường di chuyển của tướng và sĩ đối phương!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 2, y: 5 },
      { type: 'HORSE', color: 'RED', x: 6, y: 4 },
      { type: 'SOLDIER', color: 'RED', x: 4, y: 4 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 0, y: 1 },
      { type: 'CANNON', color: 'BLACK', x: 8, y: 2 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 5 },
    ],
  },

  // 7
  {
    id: 'don-xe-thang-song-si',
    name: 'Đơn Xe Thắng Song Sĩ',
    chineseName: '單車勝雙士',
    difficulty: 'Trung bình',
    description: 'Kỹ năng tàn cuộc cơ bản nhưng cốt lõi: 1 Xe chiếm trung lộ hoặc hông sườn để bắt chết Sĩ và Tướng.',
    sideToMove: 'RED',
    hintText: 'Tướng đỏ phải giữ chặt trung lộ (trung tâm) để làm chỗ dựa cho Xe đỏ vờn và chia cắt 2 Sĩ đen.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 1, y: 5 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
    ],
  },

  // 8
  {
    id: 'song-ma-am-tuyen',
    name: 'Song Mã Ẩm Tuyền (Hai Ngựa Uống Nước)',
    chineseName: '雙馬飲泉',
    difficulty: 'Khó',
    description: 'Đòn phối hợp ngoạn mục của 2 Mã luân phiên chiếu và yểm trợ lẫn nhau để đưa tướng vào góc chết.',
    sideToMove: 'RED',
    hintText: 'Mã trước chiếu, Mã sau khóa góc. Ép tướng đối phương phải di chuyển vào thế bế tắc.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 3, y: 3 },
      { type: 'HORSE', color: 'RED', x: 5, y: 4 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'SOLDIER', color: 'BLACK', x: 2, y: 5 },
      { type: 'CANNON', color: 'BLACK', x: 7, y: 2 },
    ],
  },

  // 9
  {
    id: 'ma-hau-phao',
    name: 'Mã Hậu Pháo Sát Cuộc',
    chineseName: '馬後炮殺法',
    difficulty: 'Dễ',
    description: 'Sát pháp kinh điển: Mã làm ngòi cho Pháo ở phía sau chiếu thẳng vào mặt Tướng không thể cản phá.',
    sideToMove: 'RED',
    hintText: 'Dùng Mã chặn ô rút của Tướng, đồng thời làm ngòi cho Pháo phía sau chiếu dứt điểm.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 4, y: 2 },
      { type: 'CANNON', color: 'RED', x: 4, y: 4 },
      { type: 'CHARIOT', color: 'RED', x: 0, y: 7 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 8, y: 1 },
    ],
  },

  // 10
  {
    id: 'bach-ma-hien-de',
    name: 'Bạch Mã Hiện Đề (Vó Ngựa Trắng)',
    chineseName: '白馬現蹄',
    difficulty: 'Trung bình',
    description: 'Đòn đánh tinh tế: Mã Đỏ thọc sườn hiểm ác kết hợp Xe ép góc khiến bên Đen trở tay không kịp.',
    sideToMove: 'RED',
    hintText: 'Mã đỏ khống chế các lộ then chốt, Xe đỏ dồn ép buộc Tướng đen phải đầu hàng.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 1, y: 2 },
      { type: 'CHARIOT', color: 'RED', x: 7, y: 5 },
      { type: 'SOLDIER', color: 'RED', x: 2, y: 4 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'CANNON', color: 'BLACK', x: 1, y: 1 },
      { type: 'CHARIOT', color: 'BLACK', x: 0, y: 3 },
    ],
  },

  // 11
  {
    id: 'hai-de-trieu-nguyet',
    name: 'Hải Để Triêu Nguyệt (Vớt Trăng Đáy Biển)',
    chineseName: '海底撈月',
    difficulty: 'Khó',
    description: 'Thế cờ tàn đỉnh cao: Xe Pháo khéo léo phối hợp ở đáy bàn cờ để bẻ gãy thế thủ Xe Sĩ của Đen.',
    sideToMove: 'RED',
    hintText: 'Pháo đỏ luồn xuống đáy bàn cờ mượn Tướng làm ngòi, Xe đỏ chọc thủng phòng tuyến.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 4, y: 7 },
      { type: 'CANNON', color: 'RED', x: 3, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 5, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 5, y: 9 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
    ],
  },

  // 12
  {
    id: 'tam-anh-chien-lu-bo',
    name: 'Tam Anh Chiến Lữ Bố (3 Binh Phá Thành)',
    chineseName: '三英戰呂布',
    difficulty: 'Trung bình',
    description: 'Ba Binh Đỏ đã qua sông, xếp hàng vây hãm uy lực tựa ba anh hùng vây chặt Lữ Bố trong tích Tam Quốc.',
    sideToMove: 'RED',
    hintText: 'Ba Binh qua sông uy lực như ba cỗ Xe. Tiến công tuần tự từng bước ép Tướng vào bước đường cùng.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'SOLDIER', color: 'RED', x: 3, y: 1 },
      { type: 'SOLDIER', color: 'RED', x: 4, y: 2 },
      { type: 'SOLDIER', color: 'RED', x: 5, y: 1 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 8, y: 2 },
    ],
  },

  // 13
  {
    id: 'khuu-dan-hang-long',
    name: 'Khưu Dẫn Hàng Long (Giun Đất Hàng Rồng)',
    chineseName: '蚯蚓降龍',
    difficulty: 'Giang hồ',
    description: 'Một trong Tứ Đại Danh Cuộc huyền thoại: Ba Tốt Đen kiên cường áp đảo Song Xe Đỏ đầy kịch tính.',
    sideToMove: 'BLACK', // Luật cứng: ĐEN ĐI TRƯỚC
    hintText: 'Đen cầm ba Tốt thọc sâu vào cung Đỏ. Từng bước Tốt lấn lướt làm tê liệt hoàn toàn Song Xe!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 0, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 8, y: 9 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'SOLDIER', color: 'BLACK', x: 3, y: 7 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 7 },
      { type: 'SOLDIER', color: 'BLACK', x: 5, y: 7 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
    ],
  },

  // 14
  {
    id: 'nhi-quy-phach-mon',
    name: 'Nhị Quỷ Phách Môn (Hai Quỷ Gõ Cửa)',
    chineseName: '二鬼拍門',
    difficulty: 'Trung bình',
    description: 'Song Binh Đỏ chiếm hai hông cung (lộ 4 và 6), bóp nghẹt mọi đường cựa quậy của Tướng và Sĩ đối phương.',
    sideToMove: 'RED',
    hintText: 'Hai Binh áp sát cửa cung, Xe đỏ làm mũi dùi kết liễu nhanh gọn.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'SOLDIER', color: 'RED', x: 3, y: 1 },
      { type: 'SOLDIER', color: 'RED', x: 5, y: 1 },
      { type: 'CHARIOT', color: 'RED', x: 2, y: 7 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'CHARIOT', color: 'BLACK', x: 7, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
    ],
  },

  // 15
  {
    id: 'don-xe-thang-khuyet-tuong',
    name: 'Đơn Xe Thắng Khuyết Tượng',
    chineseName: '單車勝殘象',
    difficulty: 'Trung bình',
    description: 'Kỹ năng tàn cuộc căn bản: Xe Đỏ khai thác cánh Tượng bị gãy để tạo sát pháp dứt khoát.',
    sideToMove: 'RED',
    hintText: 'Tấn công vào cánh không có Tượng bảo vệ, cắt đứt đường liên lạc giữa Tướng và Sĩ.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 2, y: 4 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
    ],
  },

  // 16
  {
    id: 'phao-dau-ma-doi',
    name: 'Pháo Đầu Mã Đội Chiếu Bí',
    chineseName: '當頭炮夾馬',
    difficulty: 'Khó',
    description: 'Pháo cắm trung lộ gá Mã đội thọc thẳng tâm cung tạo áp lực cực lớn khiến đối phương vỡ trận.',
    sideToMove: 'RED',
    hintText: 'Mã đội vừa làm ngòi cho Pháo, vừa trực tiếp lao vào cung đoạt soái!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CANNON', color: 'RED', x: 4, y: 6 },
      { type: 'HORSE', color: 'RED', x: 4, y: 4 },
      { type: 'HORSE', color: 'RED', x: 5, y: 3 },
      { type: 'SOLDIER', color: 'RED', x: 4, y: 3 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 1, y: 1 },
      { type: 'CANNON', color: 'BLACK', x: 7, y: 2 },
    ],
  },

  // 17
  {
    id: 'bat-son-cai-the',
    name: 'Bạt Sơn Cái Thế (Khai Sơn Phá Thạch)',
    chineseName: '拔山蓋世',
    difficulty: 'Khó',
    description: 'Thế cờ giang hồ Xe Pháo Mã đồng loạt công phá trung quân, khí thế bạt núi lấp biển.',
    sideToMove: 'RED',
    hintText: 'Phối hợp nhịp nhàng giữa nước chiếu Xe và đòn nhảy Mã hiểm.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 3, y: 5 },
      { type: 'CANNON', color: 'RED', x: 4, y: 5 },
      { type: 'HORSE', color: 'RED', x: 6, y: 3 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'CANNON', color: 'BLACK', x: 1, y: 2 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 6 },
    ],
  },

  // 18
  {
    id: 'tien-bo-thiem-thu',
    name: 'Tiễn Bộ Thiềm Thừ (Cóc Nhảy Chiếu Tướng)',
    chineseName: '剪步蟾蜍',
    difficulty: 'Trung bình',
    description: 'Mã Đỏ nhảy bước cóc luân chuyển ngoạn mục ép Tướng Đen vào thế cùng không lối thoát.',
    sideToMove: 'RED',
    hintText: 'Mã nhảy liên hoàn, kết hợp Pháo yểm hộ từ xa dứt điểm đối thủ.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 3, y: 2 },
      { type: 'HORSE', color: 'RED', x: 5, y: 3 },
      { type: 'CANNON', color: 'RED', x: 4, y: 7 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 0, y: 2 },
    ],
  },

  // 19
  {
    id: 'thien-ma-hanh-khong',
    name: 'Thiên Mã Hành Không (Ngựa Trời Bay Lượn)',
    chineseName: '天馬行空',
    difficulty: 'Khó',
    description: 'Song Mã Đỏ tung vó vượt sông, kết hợp Binh đáy cung tạo nên thế trận biến hóa khôn lường.',
    sideToMove: 'RED',
    hintText: 'Mã bay khắp bàn cờ, phối hợp với Binh chọc sâu vào sườn cung.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'HORSE', color: 'RED', x: 2, y: 4 },
      { type: 'HORSE', color: 'RED', x: 6, y: 3 },
      { type: 'SOLDIER', color: 'RED', x: 3, y: 1 },
      { type: 'ADVISOR', color: 'RED', x: 5, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 8, y: 0 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 6 },
    ],
  },

  // 20
  {
    id: 'song-phao-tac-gia',
    name: 'Song Pháo Tác Giá (Xe Pháo Trùng Điệp)',
    chineseName: '雙炮作架',
    difficulty: 'Dễ',
    description: 'Hai Pháo Đỏ xếp hàng ngang hoặc hàng dọc khóa chặt toàn bộ mặt tiền cung Tướng.',
    sideToMove: 'RED',
    hintText: 'Dùng một Pháo làm ngòi cho Pháo kia chiếu, Xe đón lõng đường tẩu thoát.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CANNON', color: 'RED', x: 3, y: 4 },
      { type: 'CANNON', color: 'RED', x: 5, y: 4 },
      { type: 'CHARIOT', color: 'RED', x: 1, y: 6 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'HORSE', color: 'BLACK', x: 7, y: 2 },
    ],
  },

  // 21
  {
    id: 'doi-tu-chieu-bi',
    name: 'Đới Tử Chiếu Bí (Mượn Quân Sát Tướng)',
    chineseName: '帶子入局',
    difficulty: 'Trung bình',
    description: 'Lấy chính quân của đối phương làm ngòi hoặc chốt chặn để hạ sát Tướng một cách ngoạn mục.',
    sideToMove: 'RED',
    hintText: 'Biến quân của đối thủ thành điểm tựa cho đòn đánh của mình!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CANNON', color: 'RED', x: 4, y: 7 },
      { type: 'HORSE', color: 'RED', x: 3, y: 2 },
      { type: 'CHARIOT', color: 'RED', x: 8, y: 3 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'CANNON', color: 'BLACK', x: 4, y: 3 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
    ],
  },

  // 22
  {
    id: 'uyen-uong-phao',
    name: 'Uyên Ương Pháo Sát Cuộc',
    chineseName: '鴛鴦炮',
    difficulty: 'Trung bình',
    description: 'Pháo nọ bảo vệ và làm ngòi cho Pháo kia, đan xen tấn công cánh trái cánh phải vô cùng ảo diệu.',
    sideToMove: 'RED',
    hintText: 'Hai Pháo dính liền nhau vừa thủ vừa công, tạo thành thế gọng kìm bất khả xâm phạm.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CANNON', color: 'RED', x: 1, y: 3 },
      { type: 'CANNON', color: 'RED', x: 2, y: 3 },
      { type: 'CHARIOT', color: 'RED', x: 6, y: 6 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 4, y: 1 },
      { type: 'CHARIOT', color: 'BLACK', x: 0, y: 1 },
      { type: 'ELEPHANT', color: 'BLACK', x: 2, y: 0 },
    ],
  },

  // 23
  {
    id: 'don-binh-thang-don-tuong',
    name: 'Đơn Binh Thắng Đơn Tướng',
    chineseName: '單兵勝孤將',
    difficulty: 'Dễ',
    description: 'Tàn cuộc mẫu mực: Tướng Đỏ chiếm giữ trung lộ, một Binh Đỏ ép Tướng Đen vào góc chết.',
    sideToMove: 'RED',
    hintText: 'Tướng đỏ chiếm trục giữa, Binh đỏ áp sát từng bước dồn Tướng đen vào góc không còn nước đi.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'SOLDIER', color: 'RED', x: 3, y: 1 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
    ],
  },

  // 24
  {
    id: 'ngoa-long-xuat-son',
    name: 'Ngọa Long Xuất Sơn (Rồng Rời Hang Đố)',
    chineseName: '臥龍出山',
    difficulty: 'Khó',
    description: 'Xe Đỏ ém sâu bất thần xuất kích, phối hợp cùng Mã Pháo hạ sát đối phương trong nháy mắt.',
    sideToMove: 'RED',
    hintText: 'Đòn công chớp nhoáng của Xe từ đáy bàn cờ kết hợp Mã nhảy góc.',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 8, y: 7 },
      { type: 'CANNON', color: 'RED', x: 4, y: 6 },
      { type: 'HORSE', color: 'RED', x: 5, y: 2 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 4, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 3, y: 0 },
      { type: 'ADVISOR', color: 'BLACK', x: 5, y: 0 },
      { type: 'ELEPHANT', color: 'BLACK', x: 6, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 2, y: 2 },
    ],
  },

  // 25
  {
    id: 'thuan-thu-khien-duong',
    name: 'Thuận Thủ Khiên Dương (Dắt Dê Thuận Tay)',
    chineseName: '順手牽羊',
    difficulty: 'Trung bình',
    description: 'Bên Đen phản công dũng mãnh, tận dụng sơ hở của Đỏ để Xe Mã luồn sâu đoạt Tướng.',
    sideToMove: 'BLACK', // Luật cứng: ĐEN ĐI TRƯỚC
    hintText: 'Xe Đen thọc sâu xuống đáy, Mã Đen chiếm điểm hiểm hạ gục Tướng Đỏ!',
    pieces: [
      { type: 'GENERAL', color: 'RED', x: 4, y: 9 },
      { type: 'CHARIOT', color: 'RED', x: 1, y: 7 },
      { type: 'ADVISOR', color: 'RED', x: 3, y: 9 },
      { type: 'ELEPHANT', color: 'RED', x: 2, y: 9 },

      { type: 'GENERAL', color: 'BLACK', x: 3, y: 0 },
      { type: 'CHARIOT', color: 'BLACK', x: 1, y: 1 },
      { type: 'HORSE', color: 'BLACK', x: 3, y: 7 },
      { type: 'SOLDIER', color: 'BLACK', x: 4, y: 5 },
    ],
  },
];

// Helper: Convert Pieces array to Xiangqi FEN string
export function exportPiecesToFen(pieces: XiangqiPiece[], sideToMove: XiangqiSide): string {
  const ranks: string[] = [];
  const pieceCharMap: Record<XiangqiPieceType, { RED: string; BLACK: string }> = {
    GENERAL: { RED: 'K', BLACK: 'k' },
    ADVISOR: { RED: 'A', BLACK: 'a' },
    ELEPHANT: { RED: 'B', BLACK: 'b' },
    HORSE: { RED: 'N', BLACK: 'n' },
    CHARIOT: { RED: 'R', BLACK: 'r' },
    CANNON: { RED: 'C', BLACK: 'c' },
    SOLDIER: { RED: 'P', BLACK: 'p' },
  };

  for (let y = 0; y < 10; y++) {
    let rankStr = '';
    let emptyCount = 0;
    for (let x = 0; x < 9; x++) {
      const p = pieces.find((piece) => piece.x === x && piece.y === y);
      if (!p) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rankStr += emptyCount.toString();
          emptyCount = 0;
        }
        rankStr += pieceCharMap[p.type][p.color];
      }
    }
    if (emptyCount > 0) {
      rankStr += emptyCount.toString();
    }
    ranks.push(rankStr);
  }

  const turnChar = sideToMove === 'RED' ? 'w' : 'b';
  return `${ranks.join('/')} ${turnChar} - - 0 1`;
}

// Helper: Parse Xiangqi FEN string to Pieces array and active side
export function parseFenToPieces(fen: string): { pieces: XiangqiPiece[]; sideToMove: XiangqiSide } | null {
  try {
    const parts = fen.trim().split(/\s+/);
    if (!parts || parts.length < 1) return null;

    const boardPart = parts[0];
    const sidePart = parts[1] || 'w';
    const sideToMove: XiangqiSide = sidePart.toLowerCase() === 'b' ? 'BLACK' : 'RED';

    const rankStrings = boardPart.split('/');
    if (rankStrings.length !== 10) return null;

    const charPieceMap: Record<string, { type: XiangqiPieceType; color: XiangqiSide }> = {
      K: { type: 'GENERAL', color: 'RED' },
      A: { type: 'ADVISOR', color: 'RED' },
      B: { type: 'ELEPHANT', color: 'RED' },
      N: { type: 'HORSE', color: 'RED' },
      R: { type: 'CHARIOT', color: 'RED' },
      C: { type: 'CANNON', color: 'RED' },
      P: { type: 'SOLDIER', color: 'RED' },

      k: { type: 'GENERAL', color: 'BLACK' },
      a: { type: 'ADVISOR', color: 'BLACK' },
      b: { type: 'ELEPHANT', color: 'BLACK' },
      n: { type: 'HORSE', color: 'BLACK' },
      r: { type: 'CHARIOT', color: 'BLACK' },
      c: { type: 'CANNON', color: 'BLACK' },
      p: { type: 'SOLDIER', color: 'BLACK' },
    };

    const pieces: XiangqiPiece[] = [];
    let idCounter = 1;

    for (let y = 0; y < 10; y++) {
      const rank = rankStrings[y];
      let x = 0;
      for (const char of rank) {
        if (/\d/.test(char)) {
          x += parseInt(char, 10);
        } else if (charPieceMap[char]) {
          const info = charPieceMap[char];
          pieces.push({
            id: `piece_${info.color[0]}_${info.type}_${idCounter++}`,
            type: info.type,
            color: info.color,
            x,
            y,
          });
          x++;
        } else {
          return null;
        }
      }
      if (x !== 9) return null;
    }

    return { pieces, sideToMove };
  } catch {
    return null;
  }
}
