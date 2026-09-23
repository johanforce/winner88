import { Chess, Square, PieceSymbol } from 'chess.js';
import { ChessMoveRecord } from './types';

// Danh mục các khai cuộc cờ vua kinh điển quốc tế
interface OpeningDef {
  name: string;
  vietnameseName: string;
  moves: string[]; // chuỗi SAN, vd: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
  summary: string;
}

const OPENINGS_DB: OpeningDef[] = [
  {
    name: 'Ruy Lopez (Spanish Game)',
    vietnameseName: 'Khai cuộc Tây Ban Nha (Ruy Lopez)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    summary: 'Trắng gây sức ép sớm lên quân Mã c6 bảo vệ tốt trung tâm e5, mở ra thế trận chiến lược sâu sắc.',
  },
  {
    name: 'Italian Game (Giuoco Piano)',
    vietnameseName: 'Khai cuộc Ý (Giuoco Piano)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    summary: 'Tượng c4 nhắm thẳng vào điểm yếu f7 của Đen, khai cuộc mở đầy tính cơ động và tấn công trung tâm.',
  },
  {
    name: 'Scotch Game',
    vietnameseName: 'Khai cuộc Scotch',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    summary: 'Trắng lập tức đột phá d4 để giành quyền kiểm soát trung tâm ngay từ nước thứ 3.',
  },
  {
    name: 'Petrov Defense',
    vietnameseName: 'Phòng thủ Petrov (Nga)',
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    summary: 'Đen phản công trực diện tốt e4 của Trắng thay vì phòng thủ thụ động, thế trận đối xứng kiên cố.',
  },
  {
    name: "King's Gambit",
    vietnameseName: 'Gambit Vua (King\'s Gambit)',
    moves: ['e4', 'e5', 'f4'],
    summary: 'Trắng dũng cảm phế tốt f4 nhằm kéo tốt Đen ra khỏi trung tâm và mở cột f tấn công sắc bén.',
  },
  {
    name: 'Vienna Game',
    vietnameseName: 'Khai cuộc Vienna',
    moves: ['e4', 'e5', 'Nc3'],
    summary: 'Trắng phát triển Mã c3 chắc chắn, chuẩn bị f4 tấn công cánh Vua linh hoạt.',
  },
  {
    name: 'Sicilian Defense - Najdorf',
    vietnameseName: 'Phòng thủ Sicilian (Biến thể Najdorf)',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    summary: 'Vũ khí phản công huyền thoại của Fischer và Kasparov, tạo thế trận bất đối xứng phức tạp và sắc lẹm.',
  },
  {
    name: 'Sicilian Defense',
    vietnameseName: 'Phòng thủ Sicilian',
    moves: ['e4', 'c5'],
    summary: 'Đen chiến đấu giành quyền kiểm soát ô trung tâm d4 bằng tốt biên c5, mở ra ván cờ đôi công quyết liệt.',
  },
  {
    name: 'French Defense',
    vietnameseName: 'Phòng thủ Pháp (French Defense)',
    moves: ['e4', 'e6'],
    summary: 'Đen thiết lập chuỗi tốt vững chãi, chuẩn bị phản công d5 đánh vào trung tâm của Trắng.',
  },
  {
    name: 'Caro-Kann Defense',
    vietnameseName: 'Phòng thủ Caro-Kann',
    moves: ['e4', 'c6'],
    summary: 'Lối chơi phòng thủ cực kỳ kiên cố và khoa học, Đen sẵn sàng hóa giải sức ép của Trắng.',
  },
  {
    name: 'Scandinavian Defense',
    vietnameseName: 'Phòng thủ Scandinavian',
    moves: ['e4', 'd5'],
    summary: 'Đen lập tức thách thức trung tâm bằng d5, tạo thế cờ mở thoáng cho cả hai bên.',
  },
  {
    name: "Queen's Gambit Accepted",
    vietnameseName: 'Gambit Hậu Chấp Nhận (QGA)',
    moves: ['d4', 'd5', 'c4', 'dxc4'],
    summary: 'Đen tạm thời ăn tốt c4, Trắng sẽ nhanh chóng giành lại tốt và chiếm ưu thế trung tâm.',
  },
  {
    name: "Queen's Gambit Declined",
    vietnameseName: 'Gambit Hậu Từ Chối (QGD)',
    moves: ['d4', 'd5', 'c4', 'e6'],
    summary: 'Khai cuộc kinh điển của các trận Chung kết Thế giới, Đen giữ vững chốt d5 bằng chuỗi phòng ngự thép.',
  },
  {
    name: "Queen's Gambit - Slav Defense",
    vietnameseName: 'Phòng thủ Slav (Slav Defense)',
    moves: ['d4', 'd5', 'c4', 'c6'],
    summary: 'Đen dùng c6 củng cố d5 mà không chặn đường phát triển của Tượng ô trắng c8.',
  },
  {
    name: "Queen's Gambit",
    vietnameseName: 'Gambit Hậu (Queen\'s Gambit)',
    moves: ['d4', 'd5', 'c4'],
    summary: 'Trắng thí tốt cánh Hậu c4 để đổi lấy ưu thế khống chế tuyệt đối 2 ô trung tâm d4 và e4.',
  },
  {
    name: 'London System',
    vietnameseName: 'Hệ thống London (London System)',
    moves: ['d4', 'd5', 'Bf4'],
    summary: 'Hệ thống phát triển Tượng ra f4 trước khi đóng e3, tạo cấu trúc phòng thủ vững như bàn thạch.',
  },
  {
    name: "King's Indian Defense",
    vietnameseName: 'Phòng thủ Ấn Độ của Vua (KID)',
    moves: ['d4', 'Nf6', 'c4', 'g6'],
    summary: 'Đen nhường trung tâm ban đầu, nhập thành nhanh và chuẩn bị đòn phản công bão táp e5 ở trung cuộc.',
  },
  {
    name: 'Nimzo-Indian Defense',
    vietnameseName: 'Phòng thủ Nimzo-Indian',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    summary: 'Tượng b4 ghim Mã c3, Đen kiểm soát gián tiếp ô trọng yếu e4 mà không cần đẩy tốt d5 sớm.',
  },
  {
    name: 'English Opening',
    vietnameseName: 'Khai cuộc Anh (English Opening)',
    moves: ['c4'],
    summary: 'Trắng khởi đầu bằng cánh c4, kiểm soát ô d5 từ xa theo trường phái hiện đại (Hypermodern).',
  },
  {
    name: 'Reti Opening',
    vietnameseName: 'Khai cuộc Reti',
    moves: ['Nf3'],
    summary: 'Khai cuộc linh hoạt và cơ động cao, kiểm soát trung tâm từ xa trước khi bộc lộ cấu trúc tốt.',
  },
];

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3.15,
  r: 5,
  q: 9,
  k: 0,
};

export interface PositionEvaluation {
  openingName: string | null;
  openingSummary: string | null;
  whiteMaterial: number;
  blackMaterial: number;
  materialDiff: number; // >0 white leads, <0 black leads
  advantageDescription: string;
  blunderAlert?: string;
  brilliantAlert?: string;
  tacticalNote?: string;
  fullGrandmasterCommentary: string;
}

/**
 * Nhận diện khai cuộc dựa trên chuỗi nước đi SAN
 */
export function detectOpening(moveSans: string[]): { name: string; summary: string } | null {
  if (moveSans.length === 0) return null;

  // Tìm khai cuộc khớp dài nhất trước
  let bestMatch: OpeningDef | null = null;
  let maxMatchLength = 0;

  for (const op of OPENINGS_DB) {
    if (op.moves.length <= moveSans.length) {
      let match = true;
      for (let i = 0; i < op.moves.length; i++) {
        if (moveSans[i] !== op.moves[i]) {
          match = false;
          break;
        }
      }
      if (match && op.moves.length > maxMatchLength) {
        bestMatch = op;
        maxMatchLength = op.moves.length;
      }
    }
  }

  if (bestMatch) {
    return {
      name: bestMatch.vietnameseName,
      summary: bestMatch.summary,
    };
  }

  return null;
}

/**
 * Tính điểm lực lượng và kiểm soát từ FEN
 */
export function evaluateBoard(fen: string): {
  whiteMaterial: number;
  blackMaterial: number;
  whiteCenterControl: number;
  blackCenterControl: number;
} {
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whiteCenterControl = 0;
  let blackCenterControl = 0;

  try {
    const chess = new Chess(fen);
    const board = chess.board();

    // Center squares: e4, d4, e5, d5 (index: r=3,4; c=3,4)
    // Extended center: c4, c5, f4, f5
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const val = PIECE_VALUES[piece.type] || 0;
        const isCenter = (r === 3 || r === 4) && (c === 3 || c === 4);
        const isExtendedCenter = (r >= 2 && r <= 5) && (c >= 2 && c <= 5);

        if (piece.color === 'w') {
          whiteMaterial += val;
          if (isCenter) whiteCenterControl += 2;
          else if (isExtendedCenter) whiteCenterControl += 1;
        } else {
          blackMaterial += val;
          if (isCenter) blackCenterControl += 2;
          else if (isExtendedCenter) blackCenterControl += 1;
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi đánh giá FEN:', err);
  }

  return {
    whiteMaterial: Math.round(whiteMaterial * 10) / 10,
    blackMaterial: Math.round(blackMaterial * 10) / 10,
    whiteCenterControl,
    blackCenterControl,
  };
}

/**
 * Phân tích chuyên môn cờ vua Grandmaster cho khán giả
 */
export function generateLocalGrandmasterAnalysis(
  moveHistory: ChessMoveRecord[],
  fen: string,
  whitePlayerName: string = 'Trắng',
  blackPlayerName: string = 'Đen'
): PositionEvaluation {
  const moveSans = moveHistory.map((m) => m.san);
  const moveCount = moveHistory.length;
  const fullMoveNum = Math.ceil(moveCount / 2);
  const lastMove = moveHistory[moveHistory.length - 1];

  const opening = detectOpening(moveSans);
  const { whiteMaterial, blackMaterial, whiteCenterControl, blackCenterControl } = evaluateBoard(fen);
  const materialDiff = Math.round((whiteMaterial - blackMaterial) * 10) / 10;

  let advantageDescription = '';
  if (materialDiff >= 4) {
    advantageDescription = `Trắng (+${materialDiff}) đang nắm giữ ưu thế áp đảo hoàn toàn về lực lượng và thế trận.`;
  } else if (materialDiff >= 1.5) {
    advantageDescription = `Trắng (+${materialDiff}) đang dẫn trước lực lượng và nắm thế chủ động tấn công.`;
  } else if (materialDiff > 0.5) {
    advantageDescription = `Trắng (+${materialDiff}) đang nhỉnh hơn đôi chút nhờ cấu trúc quân cơ động hơn.`;
  } else if (materialDiff <= -4) {
    advantageDescription = `Đen (+${Math.abs(materialDiff)}) đang áp đảo hoàn toàn với lợi thế quân số vượt trội.`;
  } else if (materialDiff <= -1.5) {
    advantageDescription = `Đen (+${Math.abs(materialDiff)}) đang chiếm thế thượng phong với ưu thế lực lượng rõ nét.`;
  } else if (materialDiff < -0.5) {
    advantageDescription = `Đen (+${Math.abs(materialDiff)}) đang nắm chút ưu thế chiến lược và tạo áp lực tốt hơn.`;
  } else {
    if (whiteCenterControl > blackCenterControl + 2) {
      advantageDescription = 'Cân bằng về quân số, nhưng Trắng đang chiếm lĩnh các ô trung tâm tốt hơn.';
    } else if (blackCenterControl > whiteCenterControl + 2) {
      advantageDescription = 'Quân số ngang ngửa, nhưng Đen đang kiểm soát trung tâm và gây sức ép khó chịu.';
    } else {
      advantageDescription = 'Cục diện cân bằng giằng co quyết liệt, cả hai bên đều đang thận trọng giăng bẫy chiến thuật.';
    }
  }

  // Phân tích sai lầm hoặc nước đi thiên tài gần nhất
  let blunderAlert: string | undefined;
  let brilliantAlert: string | undefined;
  let tacticalNote: string | undefined;

  if (lastMove) {
    const moverName = lastMove.turn === 'WHITE' ? whitePlayerName : blackPlayerName;
    const opponentName = lastMove.turn === 'WHITE' ? blackPlayerName : whitePlayerName;
    const moverSide = lastMove.turn === 'WHITE' ? 'Trắng' : 'Đen';
    const oppSide = lastMove.turn === 'WHITE' ? 'Đen' : 'Trắng';

    if (lastMove.isCheckmate) {
      brilliantAlert = `🏆 NƯỚC ĐI KẾT LIỄU: ${moverName} (${moverSide}) tung đòn chiếu bí sát ván (${lastMove.san}), chấm dứt hoàn toàn hy vọng của ${oppSide}!`;
    } else if (lastMove.isCheck) {
      tacticalNote = `⚡ ${moverName} (${moverSide}) vừa tung nước chiếu hiểm hóc (${lastMove.san}), buộc Vua ${oppSide} phải phản ứng khẩn cấp!`;
    } else if (lastMove.captured) {
      const capVal = PIECE_VALUES[lastMove.captured] || 1;
      const pieceVal = PIECE_VALUES[lastMove.piece] || 1;

      if (lastMove.captured === 'q') {
        brilliantAlert = `💥 ĐÒN ĐỘT PHÁ SẤM SÉT: ${moverName} (${moverSide}) vừa bắt gọn Hậu đối phương với nước ${lastMove.san}!`;
      } else if (pieceVal < capVal) {
        brilliantAlert = `💎 NƯỚC CỜ THIÊN TÀI: ${moverName} (${moverSide}) vừa có pha ăn quân lời lớn (${lastMove.san}), chiếm ưu thế vật chất ngoạn mục!`;
      } else if (pieceVal > capVal && capVal === 1) {
        // Có thể là phế quân tấn công
        tacticalNote = `🔥 ${moverName} (${moverSide}) vừa thực hiện nước đi táo bạo (${lastMove.san}), có thể là một pha phế quân chiến thuật nhắm vào thành lũy của ${oppSide}!`;
      }
    } else if (lastMove.san === 'O-O' || lastMove.san === 'O-O-O') {
      tacticalNote = `🛡️ ${moverName} (${moverSide}) vừa nhập thành an toàn (${lastMove.san}), củng cố vị trí Vua và kết nối hai Xe sẵn sàng giao chiến!`;
    }
  }

  // Tổng hợp nhận định chuyên nghiệp như Grandmaster
  let commentaryLines: string[] = [];

  // 1. Khai cuộc
  if (fullMoveNum <= 8 && opening) {
    commentaryLines.push(`📖 Khai cuộc: ${opening.name}. ${opening.summary}`);
  }

  // 2. Nhận định nước cờ đặc biệt
  if (brilliantAlert) {
    commentaryLines.push(brilliantAlert);
  } else if (blunderAlert) {
    commentaryLines.push(blunderAlert);
  } else if (tacticalNote) {
    commentaryLines.push(tacticalNote);
  }

  // 3. Đánh giá thế cờ
  commentaryLines.push(`⚖️ Đánh giá thế trận (Nước ${fullMoveNum}): ${advantageDescription}`);

  const fullGrandmasterCommentary = commentaryLines.join('\n');

  return {
    openingName: opening?.name || null,
    openingSummary: opening?.summary || null,
    whiteMaterial,
    blackMaterial,
    materialDiff,
    advantageDescription,
    blunderAlert,
    brilliantAlert,
    tacticalNote,
    fullGrandmasterCommentary,
  };
}
