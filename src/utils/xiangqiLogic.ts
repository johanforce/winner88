import {
  XiangqiPiece,
  XiangqiPieceType,
  XiangqiSide,
} from '../types';

export {
  createInitialXiangqiPieces,
  getPieceAt,
  isInsidePalace,
  isSideInCheck,
  getLegalMoves,
  hasAnyLegalMoves,
  getPieceNameVN,
} from '../../server/xiangqiLogic';

export function getPieceCharacter(type: XiangqiPieceType, color: XiangqiSide): string {
  if (color === 'RED') {
    switch (type) {
      case 'GENERAL': return '帥';
      case 'ADVISOR': return '仕';
      case 'ELEPHANT': return '相';
      case 'HORSE': return '傌';
      case 'CHARIOT': return '俥';
      case 'CANNON': return '炮';
      case 'SOLDIER': return '兵';
    }
  } else {
    switch (type) {
      case 'GENERAL': return '將';
      case 'ADVISOR': return '士';
      case 'ELEPHANT': return '象';
      case 'HORSE': return '馬';
      case 'CHARIOT': return '車';
      case 'CANNON': return '砲';
      case 'SOLDIER': return '卒';
    }
  }
}
