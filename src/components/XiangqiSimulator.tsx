import React, { useState, useMemo, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  RotateCcw,
  Sparkles,
  Play,
  RotateCw,
  Trophy,
  AlertTriangle,
  Lightbulb,
  Eraser,
  Grid,
  Trash2,
  BookOpen,
  Copy,
  Check,
  Download,
  Share2,
  Bot,
  User,
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
} from 'lucide-react';
import { XiangqiPiece, XiangqiPieceType, XiangqiSide, XiangqiMove } from '../types';
import {
  getPieceAt,
  getLegalMoves,
  getPieceCharacter,
  getPieceNameVN,
  isSideInCheck,
  hasAnyLegalMoves,
  generateMoveNotation,
  createInitialXiangqiPieces,
  isInsidePalace,
  getBoardPositionKey,
  checkRepetitiveMovesDraw,
} from '../utils/xiangqiLogic';
import { findBestXiangqiMove, XiangqiAiHint } from '../utils/xiangqiAi';
import {
  CLASSIC_XIANGQI_PUZZLES,
  XiangqiPuzzlePreset,
  XIANGQI_PIECE_LIMITS,
  isLegalPiecePlacement,
  exportPiecesToFen,
  parseFenToPieces,
} from '../utils/xiangqiPuzzles';
import { chessSound } from '../utils/chessSound';

interface XiangqiSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

type SimulatorMode = 'SETUP' | 'SOLVING';
type SolvingOpponent = 'SOLO' | 'AI_DEFENDER';

export const XiangqiSimulator: React.FC<XiangqiSimulatorProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Simulator mode: 'SETUP' (Xếp cờ) vs 'SOLVING' (Giải cờ thế)
  const [mode, setMode] = useState<SimulatorMode>('SETUP');

  // Board pieces
  const [pieces, setPieces] = useState<XiangqiPiece[]>(() => {
    // Default to the first classic puzzle "Mã Điếu Ngư Sát Cuộc"
    const defaultPuzzle = CLASSIC_XIANGQI_PUZZLES[0];
    return defaultPuzzle.pieces.map((p, idx) => ({
      ...p,
      id: `piece_${p.color[0]}_${p.type}_${idx + 1}`,
    }));
  });

  // Snapshot of pieces when entering SOLVING mode (so user can reset puzzle anytime)
  const [initialSnapshotPieces, setInitialSnapshotPieces] = useState<XiangqiPiece[]>([]);
  const [initialSideToMove, setInitialSideToMove] = useState<XiangqiSide>('RED');

  // Side to move in setup and solving
  const [turnSide, setTurnSide] = useState<XiangqiSide>('RED');

  // Current active preset puzzle (if any)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('ma-dieu-ngu');

  // Setup Palette selection
  // selectedTrayPiece: { type, color } or 'ERASER' or null
  const [selectedTrayItem, setSelectedTrayItem] = useState<{
    type: XiangqiPieceType;
    color: XiangqiSide;
  } | 'ERASER' | null>(null);

  // Perspective flip
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Solving state
  const [solvingOpponent, setSolvingOpponent] = useState<SolvingOpponent>('SOLO');
  const [humanSide, setHumanSide] = useState<XiangqiSide>('RED');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<XiangqiMove | null>(null);
  const [moveHistory, setMoveHistory] = useState<XiangqiMove[]>([]);
  const [redoStack, setRedoStack] = useState<{
    pieces: XiangqiPiece[];
    turnSide: XiangqiSide;
    move: XiangqiMove;
  }[]>([]);

  // AI Hint & Assistance
  const [aiHint, setAiHint] = useState<XiangqiAiHint | null>(null);
  const [isCalculatingAi, setIsCalculatingAi] = useState<boolean>(false);

  // Status & notifications
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const [isSolvedWon, setIsSolvedWon] = useState<boolean>(false);
  const [isStalemate, setIsStalemate] = useState<boolean>(false);
  const [isRepetitionDraw, setIsRepetitionDraw] = useState<boolean>(false);
  const [positionHistory, setPositionHistory] = useState<string[]>([]);

  // Modals & Popups inside simulator
  const [isPresetModalOpen, setIsPresetModalOpen] = useState<boolean>(false);
  const [presetFilter, setPresetFilter] = useState<'ALL' | 'Dễ' | 'Trung bình' | 'Khó' | 'Giang hồ'>('ALL');
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [isFenModalOpen, setIsFenModalOpen] = useState<boolean>(false);
  const [fenInputText, setFenInputText] = useState<string>('');
  const [fenCopyFeedback, setFenCopyFeedback] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Compute piece counts per type and color on current board
  const currentPieceCounts = useMemo(() => {
    const counts: {
      RED: Record<XiangqiPieceType, number>;
      BLACK: Record<XiangqiPieceType, number>;
    } = {
      RED: { GENERAL: 0, ADVISOR: 0, ELEPHANT: 0, HORSE: 0, CHARIOT: 0, CANNON: 0, SOLDIER: 0 },
      BLACK: { GENERAL: 0, ADVISOR: 0, ELEPHANT: 0, HORSE: 0, CHARIOT: 0, CANNON: 0, SOLDIER: 0 },
    };
    for (const p of pieces) {
      if (counts[p.color] && counts[p.color][p.type] !== undefined) {
        counts[p.color][p.type]++;
      }
    }
    return counts;
  }, [pieces]);

  // Check state & legal moves computation
  const activeSelectedPiece = useMemo(() => {
    if (!selectedPieceId) return null;
    return pieces.find((p) => p.id === selectedPieceId) || null;
  }, [selectedPieceId, pieces]);

  const legalMoves = useMemo(() => {
    if (mode !== 'SOLVING') return [];
    if (!activeSelectedPiece || activeSelectedPiece.color !== turnSide) return [];
    return getLegalMoves(activeSelectedPiece, pieces);
  }, [mode, activeSelectedPiece, turnSide, pieces]);

  // Validate board setup
  const boardValidation = useMemo(() => {
    const redGen = pieces.find((p) => p.type === 'GENERAL' && p.color === 'RED');
    const blackGen = pieces.find((p) => p.type === 'GENERAL' && p.color === 'BLACK');

    if (!redGen && !blackGen) {
      return { valid: false, message: 'Thiếu Tướng Đỏ và Tướng Đen trên bàn cờ.' };
    }
    if (!redGen) {
      return { valid: false, message: 'Cần đặt Tướng Đỏ (帥) trên bàn cờ.' };
    }
    if (!blackGen) {
      return { valid: false, message: 'Cần đặt Tướng Đen (將) trên bàn cờ.' };
    }

    if (!isInsidePalace(redGen.x, redGen.y, 'RED')) {
      return { valid: false, message: 'Tướng Đỏ phải nằm trong Cửu cung (x: 3..5, y: 7..9).' };
    }
    if (!isInsidePalace(blackGen.x, blackGen.y, 'BLACK')) {
      return { valid: false, message: 'Tướng Đen phải nằm trong Cửu cung (x: 3..5, y: 0..2).' };
    }

    // Check if generals face each other directly (Lộ mặt tướng)
    if (redGen.x === blackGen.x) {
      let blocked = false;
      const minY = Math.min(redGen.y, blackGen.y);
      const maxY = Math.max(redGen.y, blackGen.y);
      for (let y = minY + 1; y < maxY; y++) {
        if (getPieceAt(pieces, redGen.x, y)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        return { valid: false, message: 'Hai Tướng không được đối mặt trực tiếp (Lộ mặt Tướng).' };
      }
    }

    return { valid: true, message: 'Thế cờ hợp lệ! Sẵn sàng giải.' };
  }, [pieces]);

  // Load a preset puzzle (bên đi trước được thiết lập theo gợi ý của thế cờ, người dùng có thể đổi tự do)
  const handleLoadPreset = (preset: XiangqiPuzzlePreset) => {
    const newPieces: XiangqiPiece[] = preset.pieces.map((p, idx) => ({
      ...p,
      id: `piece_${p.color[0]}_${p.type}_${idx + 1}`,
    }));
    setPieces(newPieces);
    setTurnSide(preset.sideToMove); // Gợi ý mặc định ban đầu
    setInitialSideToMove(preset.sideToMove);
    setHumanSide(preset.sideToMove);
    setSelectedPresetId(preset.id);
    setIsPresetModalOpen(false);
    setSelectedPieceId(null);
    setSelectedTrayItem(null);
    setAiHint(null);
    setStatusMessage(
      `Đã nạp thế cờ: "${preset.name}" (Gợi ý: ${
        preset.sideToMove === 'RED' ? '🔴 Đỏ đi trước' : '⚫ Đen đi trước'
      } - bạn có thể đổi tùy ý)`
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Clear board
  const handleClearBoard = () => {
    setPieces([]);
    setSelectedPieceId(null);
    setSelectedPresetId(null);
    setSelectedTrayItem(null);
    setAiHint(null);
    setStatusMessage('Đã làm trống bàn cờ. Chế độ tùy chỉnh tự do: Bạn có thể chọn bên đi trước.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Reset to standard 32-piece initial board
  const handleResetStandard = () => {
    const std = createInitialXiangqiPieces();
    setPieces(std);
    setTurnSide('RED');
    setInitialSideToMove('RED');
    setHumanSide('RED');
    setSelectedPieceId(null);
    setSelectedPresetId(null);
    setSelectedTrayItem(null);
    setAiHint(null);
    setStatusMessage('Đã xếp bàn cờ chuẩn 32 quân (Đỏ đi trước).');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Start Solving mode
  const handleStartSolving = () => {
    if (!boardValidation.valid) {
      setValidationError(boardValidation.message);
      setTimeout(() => setValidationError(null), 4000);
      return;
    }

    // Save snapshot of current pieces and turn
    setInitialSnapshotPieces(JSON.parse(JSON.stringify(pieces)));
    setInitialSideToMove(turnSide);

    setMode('SOLVING');
    setSelectedPieceId(null);
    setMoveHistory([]);
    setRedoStack([]);
    setLastMove(null);
    setIsSolvedWon(false);
    setIsStalemate(false);
    setIsRepetitionDraw(false);
    setAiHint(null);

    const initialPosKey = getBoardPositionKey(pieces, turnSide);
    setPositionHistory([initialPosKey]);

    // Initial check verification
    const inCheck = isSideInCheck(turnSide, pieces);
    setIsCheck(inCheck);
    if (inCheck) {
      chessSound.playCheck();
    }

    // If vs AI and AI goes first
    if (solvingOpponent === 'AI_DEFENDER' && turnSide !== humanSide) {
      setIsCalculatingAi(true);
      setTimeout(() => {
        const aiMove = findBestXiangqiMove(pieces, turnSide, 2);
        setIsCalculatingAi(false);
        if (aiMove) {
          const aiTargetPiece = pieces.find((p) => p.x === aiMove.to.x && p.y === aiMove.to.y);
          executeAiCounterMove(aiMove.piece, aiMove.to, pieces, turnSide, aiTargetPiece);
        }
      }, 500);
    }
  };

  // Return to Setup mode
  const handleReturnToSetup = () => {
    setMode('SETUP');
    setSelectedPieceId(null);
    setAiHint(null);
    setIsSolvedWon(false);
    setIsStalemate(false);
    setIsRepetitionDraw(false);
  };

  // Reset to beginning of current puzzle
  const handleResetCurrentPuzzle = () => {
    if (initialSnapshotPieces.length > 0) {
      setPieces(JSON.parse(JSON.stringify(initialSnapshotPieces)));
      setTurnSide(initialSideToMove);
      const initialPosKey = getBoardPositionKey(initialSnapshotPieces, initialSideToMove);
      setPositionHistory([initialPosKey]);
    } else {
      const initialPosKey = getBoardPositionKey(pieces, turnSide);
      setPositionHistory([initialPosKey]);
    }
    setSelectedPieceId(null);
    setMoveHistory([]);
    setRedoStack([]);
    setLastMove(null);
    setIsSolvedWon(false);
    setIsStalemate(false);
    setIsRepetitionDraw(false);
    setAiHint(null);
    setStatusMessage('Đã khôi phục thế cờ ban đầu.');
    setTimeout(() => setStatusMessage(null), 2000);

    // If vs AI and AI goes first
    if (solvingOpponent === 'AI_DEFENDER' && initialSideToMove !== humanSide && initialSnapshotPieces.length > 0) {
      setIsCalculatingAi(true);
      setTimeout(() => {
        const aiMove = findBestXiangqiMove(initialSnapshotPieces, initialSideToMove, 2);
        setIsCalculatingAi(false);
        if (aiMove) {
          const aiTargetPiece = initialSnapshotPieces.find((p) => p.x === aiMove.to.x && p.y === aiMove.to.y);
          executeAiCounterMove(aiMove.piece, aiMove.to, initialSnapshotPieces, initialSideToMove, aiTargetPiece);
        }
      }, 500);
    }
  };

  // Perform a move in Solving mode
  const executeSolvingMove = (
    fromPiece: XiangqiPiece,
    to: { x: number; y: number },
    targetPiece?: XiangqiPiece
  ) => {
    const notation = generateMoveNotation(fromPiece, to, targetPiece);

    // Save for undo
    const oldPieces = JSON.parse(JSON.stringify(pieces)) as XiangqiPiece[];
    const currentTurn = turnSide;

    // Apply move
    const newPieces = pieces
      .filter((p) => !(p.x === to.x && p.y === to.y))
      .map((p) => {
        if (p.id === fromPiece.id) {
          return { ...p, x: to.x, y: to.y };
        }
        return p;
      });

    const nextTurn: XiangqiSide = currentTurn === 'RED' ? 'BLACK' : 'RED';
    const nextSideInCheck = isSideInCheck(nextTurn, newPieces);
    const nextSideHasMoves = hasAnyLegalMoves(nextTurn, newPieces);

    const moveRecord: XiangqiMove = {
      from: { x: fromPiece.x, y: fromPiece.y },
      to,
      piece: fromPiece,
      capturedPiece: targetPiece,
      notation,
      isCheck: nextSideInCheck,
      timestamp: Date.now(),
    };

    if (targetPiece) {
      chessSound.playCapture();
    } else {
      chessSound.playMove();
    }

    if (nextSideInCheck) {
      chessSound.playCheck();
    }

    const nextPosKey = getBoardPositionKey(newPieces, nextTurn);
    const updatedPositions = [...positionHistory, nextPosKey];
    setPositionHistory(updatedPositions);

    const updatedMoves = [...moveHistory, moveRecord];
    setPieces(newPieces);
    setTurnSide(nextTurn);
    setLastMove(moveRecord);
    setMoveHistory(updatedMoves);
    setRedoStack([]);
    setSelectedPieceId(null);
    setAiHint(null);
    setIsCheck(nextSideInCheck);

    // Kiểm tra luật: 2 bên đi lại nước đi quá 3 lần liên tục là hòa
    const repCheck = checkRepetitiveMovesDraw(updatedMoves, updatedPositions);
    if (repCheck.isDraw) {
      setIsRepetitionDraw(true);
      chessSound.playMove();
      setStatusMessage('🤝 HÒA CỜ: Hai bên đi lại nước đi quá 3 lần liên tục (Luật lặp thế cờ)!');
      return;
    }

    // Check for checkmate or stalemate
    if (!nextSideHasMoves) {
      if (nextSideInCheck) {
        // Checkmate! Current mover wins!
        setIsSolvedWon(true);
        chessSound.playWin();
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
      } else {
        // Stalemate
        setIsStalemate(true);
      }
      return;
    }

    // If AI opponent is active and it's AI's turn
    if (solvingOpponent === 'AI_DEFENDER' && nextTurn !== humanSide) {
      setIsCalculatingAi(true);
      setTimeout(() => {
        const aiMove = findBestXiangqiMove(newPieces, nextTurn, 2);
        setIsCalculatingAi(false);
        if (aiMove) {
          const aiTargetPiece = newPieces.find((p) => p.x === aiMove.to.x && p.y === aiMove.to.y);
          executeAiCounterMove(aiMove.piece, aiMove.to, newPieces, nextTurn, aiTargetPiece);
        } else {
          // AI has no moves
          setIsSolvedWon(true);
          chessSound.playWin();
        }
      }, 450);
    }
  };

  // AI executes its response
  const executeAiCounterMove = (
    aiPiece: XiangqiPiece,
    to: { x: number; y: number },
    currentPieces: XiangqiPiece[],
    currentTurn: XiangqiSide,
    targetPiece?: XiangqiPiece
  ) => {
    const notation = generateMoveNotation(aiPiece, to, targetPiece);
    const updatedPieces = currentPieces
      .filter((p) => !(p.x === to.x && p.y === to.y))
      .map((p) => {
        if (p.id === aiPiece.id) {
          return { ...p, x: to.x, y: to.y };
        }
        return p;
      });

    const nextTurn: XiangqiSide = currentTurn === 'RED' ? 'BLACK' : 'RED';
    const nextSideInCheck = isSideInCheck(nextTurn, updatedPieces);
    const nextSideHasMoves = hasAnyLegalMoves(nextTurn, updatedPieces);

    const moveRecord: XiangqiMove = {
      from: { x: aiPiece.x, y: aiPiece.y },
      to,
      piece: aiPiece,
      capturedPiece: targetPiece,
      notation,
      isCheck: nextSideInCheck,
      timestamp: Date.now(),
    };

    if (targetPiece) {
      chessSound.playCapture();
    } else {
      chessSound.playMove();
    }

    if (nextSideInCheck) {
      chessSound.playCheck();
    }

    const nextPosKey = getBoardPositionKey(updatedPieces, nextTurn);
    const updatedPositions = [...positionHistory, nextPosKey];
    setPositionHistory(updatedPositions);

    const updatedMoves = [...moveHistory, moveRecord];
    setPieces(updatedPieces);
    setTurnSide(nextTurn);
    setLastMove(moveRecord);
    setMoveHistory(updatedMoves);
    setIsCheck(nextSideInCheck);

    // Kiểm tra luật: 2 bên đi lại nước đi quá 3 lần liên tục là hòa
    const repCheck = checkRepetitiveMovesDraw(updatedMoves, updatedPositions);
    if (repCheck.isDraw) {
      setIsRepetitionDraw(true);
      chessSound.playMove();
      setStatusMessage('🤝 HÒA CỜ: Hai bên đi lại nước đi quá 3 lần liên tục (Luật lặp thế cờ)!');
      return;
    }

    if (!nextSideHasMoves) {
      if (nextSideInCheck) {
        // Player got checkmated
        setStatusMessage('Thất bại: Máy đã chiếu bí bạn! Hãy thử lại biến cờ khác.');
      } else {
        setIsStalemate(true);
      }
    }
  };

  // Request AI Hint
  const handleRequestHint = () => {
    if (mode !== 'SOLVING') return;
    setIsCalculatingAi(true);
    setTimeout(() => {
      const best = findBestXiangqiMove(pieces, turnSide, 3);
      setAiHint(best);
      setIsCalculatingAi(false);
      if (!best) {
        setStatusMessage('Không tìm thấy nước đi hợp lệ nào.');
        setTimeout(() => setStatusMessage(null), 2500);
      }
    }, 150);
  };

  // Undo move
  const handleUndo = () => {
    if (moveHistory.length === 0) return;

    // In AI mode, undo 2 moves (player + AI) if available
    const stepsToUndo = solvingOpponent === 'AI_DEFENDER' && moveHistory.length >= 2 ? 2 : 1;

    // Reconstruct pieces from initial snapshot + remaining history
    const targetMoveCount = moveHistory.length - stepsToUndo;
    let reconstructedPieces = JSON.parse(JSON.stringify(initialSnapshotPieces)) as XiangqiPiece[];
    let currentSide = initialSideToMove;

    for (let i = 0; i < targetMoveCount; i++) {
      const histMove = moveHistory[i];
      reconstructedPieces = reconstructedPieces
        .filter((p) => !(p.x === histMove.to.x && p.y === histMove.to.y))
        .map((p) => {
          if (p.x === histMove.from.x && p.y === histMove.from.y) {
            return { ...p, x: histMove.to.x, y: histMove.to.y };
          }
          return p;
        });
      currentSide = currentSide === 'RED' ? 'BLACK' : 'RED';
    }

    const newHistory = moveHistory.slice(0, targetMoveCount);
    const newLastMove = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;

    setPieces(reconstructedPieces);
    setTurnSide(currentSide);
    setMoveHistory(newHistory);
    setLastMove(newLastMove);
    setSelectedPieceId(null);
    setAiHint(null);
    setIsSolvedWon(false);
    setIsStalemate(false);
    setIsRepetitionDraw(false);
    setPositionHistory((prev) => prev.slice(0, Math.max(1, prev.length - stepsToUndo)));
    setIsCheck(isSideInCheck(currentSide, reconstructedPieces));
  };

  // Click on board intersection
  const handleCellClick = (x: number, y: number) => {
    if (mode === 'SETUP') {
      handleSetupCellClick(x, y);
    } else {
      handleSolvingCellClick(x, y);
    }
  };

  // Handle cell click in SETUP mode
  const handleSetupCellClick = (x: number, y: number) => {
    const existingPiece = getPieceAt(pieces, x, y);

    // If eraser tool is selected
    if (selectedTrayItem === 'ERASER') {
      if (existingPiece) {
        setPieces((prev) => prev.filter((p) => p.id !== existingPiece.id));
        chessSound.playCapture();
        setSelectedPresetId(null);
      }
      return;
    }

    // If a piece from tray is selected -> place or replace it
    if (selectedTrayItem && typeof selectedTrayItem === 'object') {
      // 1. Kiểm tra vị trí hợp lệ theo luật cờ tướng (vị trí Tướng, Sĩ, Tượng, Tốt)
      const placementCheck = isLegalPiecePlacement(selectedTrayItem.type, selectedTrayItem.color, x, y);
      if (!placementCheck.valid) {
        setValidationError(`⚠️ Vị trí không hợp lệ: ${placementCheck.reason}`);
        setTimeout(() => setValidationError(null), 3500);
        return;
      }

      // 2. Kiểm tra giới hạn số lượng quân theo chuẩn cờ tướng (bằng hoặc ít hơn quân cùng loại)
      const isReplacingSameType =
        existingPiece &&
        existingPiece.type === selectedTrayItem.type &&
        existingPiece.color === selectedTrayItem.color;
      const countOnBoard = currentPieceCounts[selectedTrayItem.color][selectedTrayItem.type];
      const maxLimit = XIANGQI_PIECE_LIMITS[selectedTrayItem.type];

      if (!isReplacingSameType && countOnBoard >= maxLimit) {
        setValidationError(
          `⚠️ Đã đạt giới hạn tối đa ${maxLimit} quân ${getPieceNameVN(
            selectedTrayItem.type,
            selectedTrayItem.color
          )} theo luật cờ tiêu chuẩn!`
        );
        setTimeout(() => setValidationError(null), 3500);
        return;
      }

      const newPiece: XiangqiPiece = {
        id: `piece_${selectedTrayItem.color[0]}_${selectedTrayItem.type}_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 6)}`,
        type: selectedTrayItem.type,
        color: selectedTrayItem.color,
        x,
        y,
      };

      setPieces((prev) => {
        // If placing a GENERAL, ensure only one GENERAL of that color exists
        let filtered = prev.filter((p) => !(p.x === x && p.y === y));
        if (selectedTrayItem.type === 'GENERAL') {
          filtered = filtered.filter(
            (p) => !(p.type === 'GENERAL' && p.color === selectedTrayItem.color)
          );
        }
        return [...filtered, newPiece];
      });

      chessSound.playMove();
      setSelectedPieceId(null);
      setSelectedPresetId(null); // Người dùng đã chỉnh sửa cờ thế
      return;
    }

    // If no tray piece selected:
    // If clicking an existing piece on board -> select it or remove it if clicked again
    if (existingPiece) {
      if (selectedPieceId === existingPiece.id) {
        // Double click / re-click removes the piece
        setPieces((prev) => prev.filter((p) => p.id !== existingPiece.id));
        setSelectedPieceId(null);
        setSelectedPresetId(null);
        chessSound.playCapture();
      } else {
        setSelectedPieceId(existingPiece.id);
      }
    } else if (selectedPieceId) {
      // Move selected board piece to empty square with placement validation
      const pieceToMove = pieces.find((p) => p.id === selectedPieceId);
      if (pieceToMove) {
        const placementCheck = isLegalPiecePlacement(pieceToMove.type, pieceToMove.color, x, y);
        if (!placementCheck.valid) {
          setValidationError(`⚠️ Vị trí không hợp lệ: ${placementCheck.reason}`);
          setTimeout(() => setValidationError(null), 3500);
          return;
        }

        setPieces((prev) =>
          prev.map((p) => (p.id === selectedPieceId ? { ...p, x, y } : p))
        );
        chessSound.playMove();
        setSelectedPieceId(null);
        setSelectedPresetId(null);
      }
    }
  };

  // Handle cell click in SOLVING mode
  const handleSolvingCellClick = (x: number, y: number) => {
    if (isSolvedWon || isRepetitionDraw) return;

    // Check if it's user's turn
    if (solvingOpponent === 'AI_DEFENDER' && turnSide !== humanSide) {
      return; // Waiting for AI
    }

    const clickedPiece = getPieceAt(pieces, x, y);

    // If a piece is already selected and target is a legal move
    if (activeSelectedPiece && activeSelectedPiece.color === turnSide) {
      const isTarget = legalMoves.some((m) => m.x === x && m.y === y);
      if (isTarget) {
        executeSolvingMove(activeSelectedPiece, { x, y }, clickedPiece);
        return;
      }
    }

    // Select friendly piece
    if (clickedPiece && clickedPiece.color === turnSide) {
      setSelectedPieceId(clickedPiece.id);
    } else {
      setSelectedPieceId(null);
    }
  };

  // FEN Export
  const handleExportFen = () => {
    const fen = exportPiecesToFen(pieces, turnSide);
    navigator.clipboard.writeText(fen);
    setFenCopyFeedback(true);
    setTimeout(() => setFenCopyFeedback(false), 2500);
  };

  // FEN Import
  const handleImportFen = () => {
    const result = parseFenToPieces(fenInputText);
    if (!result) {
      setValidationError('Chuỗi FEN không hợp lệ. Vui lòng kiểm tra lại định dạng FEN Cờ Tướng.');
      setTimeout(() => setValidationError(null), 4000);
      return;
    }
    setPieces(result.pieces);
    setTurnSide(result.sideToMove);
    setInitialSideToMove(result.sideToMove);
    setSelectedPresetId(null);
    setSelectedPieceId(null);
    setAiHint(null);
    setIsFenModalOpen(false);
    setFenInputText('');
    setStatusMessage('Đã tải thế cờ thành công từ chuỗi FEN!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Piece tray definitions
  const trayPiecesRed: { type: XiangqiPieceType; name: string }[] = [
    { type: 'GENERAL', name: 'Tướng' },
    { type: 'ADVISOR', name: 'Sĩ' },
    { type: 'ELEPHANT', name: 'Tượng' },
    { type: 'CHARIOT', name: 'Xe' },
    { type: 'CANNON', name: 'Pháo' },
    { type: 'HORSE', name: 'Mã' },
    { type: 'SOLDIER', name: 'Binh' },
  ];

  const trayPiecesBlack: { type: XiangqiPieceType; name: string }[] = [
    { type: 'GENERAL', name: 'Tướng' },
    { type: 'ADVISOR', name: 'Sĩ' },
    { type: 'ELEPHANT', name: 'Tượng' },
    { type: 'CHARIOT', name: 'Xe' },
    { type: 'CANNON', name: 'Pháo' },
    { type: 'HORSE', name: 'Mã' },
    { type: 'SOLDIER', name: 'Tốt' },
  ];

  // Active preset object
  const activePreset = useMemo(() => {
    return CLASSIC_XIANGQI_PUZZLES.find((p) => p.id === selectedPresetId) || null;
  }, [selectedPresetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-stone-950 border border-amber-600/40 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] my-auto">
        {/* HEADER BAR */}
        <div className="bg-gradient-to-r from-stone-900 via-neutral-900 to-stone-900 border-b border-stone-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-black text-xl shadow-lg border border-amber-400/40">
              🧩
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  Cờ Thế & Simulator
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {mode === 'SETUP' ? 'Chế độ Tự Xếp Cờ' : 'Chế độ Đang Giải'}
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-stone-400 font-medium hidden sm:block">
                Tự do dàn xếp quân cờ thế, nghiên cứu biến hóa, giải đố giang hồ & luyện tập với AI.
              </p>
            </div>
          </div>

          {/* Mode Switcher & Close */}
          <div className="flex items-center gap-2">
            {mode === 'SETUP' ? (
              <button
                type="button"
                onClick={handleStartSolving}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer ${
                  boardValidation.valid
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/40'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-400 border border-stone-700'
                }`}
                title={boardValidation.valid ? 'Bắt đầu giải thế cờ' : boardValidation.message}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Bắt Đầu Giải</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReturnToSetup}
                className="px-3 sm:px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-stone-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                title="Quay lại xếp cờ"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Sửa Thế Cờ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 transition cursor-pointer"
              title="Đóng Simulator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION & FEEDBACK BANNER */}
        {validationError && (
          <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-1.5 text-xs text-center font-bold flex items-center justify-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {statusMessage && (
          <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-1.5 text-xs text-center font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {isSolvedWon && (
          <div className="bg-gradient-to-r from-amber-600 via-emerald-600 to-teal-600 text-white font-black text-sm py-2 px-4 text-center tracking-wide shadow-xl flex items-center justify-center gap-2 animate-bounce">
            <Trophy className="w-5 h-5 text-amber-300" />
            <span>🎉 PHÁ THẾ THÀNH CÔNG! Chiếu bí Tướng đối phương! Tuyệt đỉnh kỳ nghệ!</span>
          </div>
        )}

        {isRepetitionDraw && (
          <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-purple-950 text-cyan-200 border-b border-cyan-500/50 font-black text-sm py-2.5 px-4 text-center tracking-wide shadow-xl flex items-center justify-center gap-2 animate-fadeIn">
            <span className="text-lg">🤝</span>
            <span>HÒA CỜ: Hai bên đi lại nước đi quá 3 lần liên tục (Luật lặp thế cờ)! Bấm &quot;Hoàn tác&quot; để thử biến khác hoặc &quot;Giải lại&quot;.</span>
          </div>
        )}

        {isStalemate && (
          <div className="bg-amber-900 border-b border-amber-700 text-amber-100 font-bold text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Bên đến lượt hết nước đi hợp lệ (Hòa hoặc Thua theo luật thi đấu).</span>
          </div>
        )}

        {/* MAIN BODY: 2-COLUMN LAYOUT */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-5">
          {/* LEFT: BOARD CONTAINER */}
          <div className="w-full max-w-[480px] sm:max-w-[510px] flex flex-col items-center">
            {/* ACTIVE TURN & STATUS BAR */}
            <div className="w-full mb-2.5 px-3 py-2 bg-stone-900/90 border border-stone-800 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-medium">Lượt đi:</span>
                <span
                  className={`px-2 py-0.5 rounded-lg font-black flex items-center gap-1.5 ${
                    turnSide === 'RED'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-stone-950 text-stone-200 border border-stone-700'
                  }`}
                >
                  {turnSide === 'RED' ? '🔴 ĐỎ đi' : '⚫ ĐEN đi'}
                </span>
                {isCheck && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 font-black animate-pulse">
                    ⚡ Chiếu Tướng!
                  </span>
                )}
              </div>

              {/* Lật bàn chỉ hiển thị trước khi giải (chế độ Setup), bỏ trong khi giải */}
              {mode === 'SETUP' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-xl border border-stone-700 flex items-center gap-1 transition cursor-pointer"
                    title="Đổi chiều nhìn bàn cờ"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Lật bàn</span>
                  </button>
                </div>
              )}
            </div>

            {/* THE XIANGQI BOARD (AUTHENTIC 9:10 GRID) */}
            <div
              id="simulator-board-wrapper"
              className="w-full aspect-[9/10] relative rounded-2xl bg-[#c8924b] shadow-2xl border-4 border-[#653911] select-none overflow-hidden touch-manipulation"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse at center, #dfaa68 0%, #be8744 70%, #9c672b 100%)',
                boxShadow:
                  '0 20px 35px -10px rgba(0,0,0,0.8), inset 0 2px 8px rgba(255,255,255,0.2)',
              }}
            >
              <div className="relative w-full h-full">
                {/* SVG Grid Lines, River, Palaces */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 900 1000"
                  preserveAspectRatio="none"
                >
                  <rect
                    x="16"
                    y="16"
                    width="868"
                    height="968"
                    rx="10"
                    fill="none"
                    stroke="#543015"
                    strokeWidth="4"
                  />
                  <rect
                    x="50"
                    y="50"
                    width="800"
                    height="900"
                    fill="none"
                    stroke="#4a2a10"
                    strokeWidth="2.5"
                  />

                  {/* Horizontal lines */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                    <line
                      key={`h-${row}`}
                      x1="50"
                      y1={50 + row * 100}
                      x2="850"
                      y2={50 + row * 100}
                      stroke="#4a2a10"
                      strokeWidth="2"
                    />
                  ))}

                  {/* Vertical lines */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((col) => {
                    const x = 50 + col * 100;
                    if (col === 0 || col === 8) {
                      return (
                        <line
                          key={`v-${col}`}
                          x1={x}
                          y1="50"
                          x2={x}
                          y2="950"
                          stroke="#4a2a10"
                          strokeWidth="2.5"
                        />
                      );
                    }
                    return (
                      <React.Fragment key={`v-${col}`}>
                        <line x1={x} y1="50" x2={x} y2="450" stroke="#4a2a10" strokeWidth="2" />
                        <line x1={x} y1="550" x2={x} y2="950" stroke="#4a2a10" strokeWidth="2" />
                      </React.Fragment>
                    );
                  })}

                  {/* Black Palace */}
                  <line x1="350" y1="50" x2="550" y2="250" stroke="#4a2a10" strokeWidth="2" />
                  <line x1="550" y1="50" x2="350" y2="250" stroke="#4a2a10" strokeWidth="2" />

                  {/* Red Palace */}
                  <line x1="350" y1="750" x2="550" y2="950" stroke="#4a2a10" strokeWidth="2" />
                  <line x1="550" y1="750" x2="350" y2="950" stroke="#4a2a10" strokeWidth="2" />

                  {/* River Water Tint & Text */}
                  <rect x="51" y="451" width="798" height="98" fill="#a47239" opacity="0.12" />
                  <text
                    x="250"
                    y="500"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#543015"
                    fontSize="36"
                    fontWeight="bold"
                    fontFamily="serif"
                    letterSpacing="8"
                  >
                    楚 河
                  </text>
                  <text
                    x="650"
                    y="500"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#543015"
                    fontSize="36"
                    fontWeight="bold"
                    fontFamily="serif"
                    letterSpacing="8"
                  >
                    漢 界
                  </text>
                </svg>

                {/* INTERACTIVE 9x10 GRID */}
                <div className="absolute inset-0 w-full h-full grid grid-cols-9 grid-rows-10 z-10">
                  {Array.from({ length: 10 }).map((_, vy) =>
                    Array.from({ length: 9 }).map((__, vx) => {
                      const x = isFlipped ? 8 - vx : vx;
                      const y = isFlipped ? 9 - vy : vy;

                      const piece = getPieceAt(pieces, x, y);
                      const isSelected = activeSelectedPiece?.x === x && activeSelectedPiece?.y === y;
                      const isLegalTarget = legalMoves.some((m) => m.x === x && m.y === y);
                      const isLastMoveFrom = lastMove && lastMove.from.x === x && lastMove.from.y === y;
                      const isLastMoveTo = lastMove && lastMove.to.x === x && lastMove.to.y === y;

                      // Check if General is checked
                      const isGeneralChecked =
                        piece?.type === 'GENERAL' && isCheck && piece.color === turnSide;

                      // AI Hint Indicators
                      const isAiHintFrom = aiHint && aiHint.from.x === x && aiHint.from.y === y;
                      const isAiHintTo = aiHint && aiHint.to.x === x && aiHint.to.y === y;

                      return (
                        <div
                          key={`cell-${vx}-${vy}`}
                          onClick={() => handleCellClick(x, y)}
                          className="relative flex items-center justify-center cursor-pointer group"
                        >
                          {/* Last move indicator */}
                          {(isLastMoveFrom || isLastMoveTo) && (
                            <div className="absolute w-[86%] h-[86%] max-w-[48px] max-h-[48px] rounded-full bg-amber-400/35 ring-2 ring-amber-400/70 pointer-events-none animate-pulse" />
                          )}

                          {/* AI Hint Halos */}
                          {isAiHintFrom && (
                            <div className="absolute w-[92%] h-[92%] max-w-[50px] max-h-[50px] rounded-full border-2 border-dashed border-violet-400 bg-violet-600/35 ring-4 ring-violet-500/50 pointer-events-none z-30 flex items-center justify-center shadow-lg animate-pulse">
                              <span className="text-[8px] font-black bg-violet-600 text-white px-1 py-0.2 rounded shadow">
                                GỢI Ý
                              </span>
                            </div>
                          )}

                          {isAiHintTo && (
                            <div className="absolute w-[92%] h-[92%] max-w-[50px] max-h-[50px] rounded-full border-2 border-emerald-400 bg-emerald-500/35 ring-4 ring-emerald-400/60 pointer-events-none z-30 flex items-center justify-center shadow-lg animate-pulse">
                              <span className="text-[8px] font-black bg-emerald-500 text-slate-950 px-1 py-0.2 rounded shadow">
                                ĐẾN
                              </span>
                            </div>
                          )}

                          {/* Legal Target Indicator in Solving Mode */}
                          {isLegalTarget && (
                            <>
                              {piece ? (
                                <div className="absolute w-[92%] h-[92%] max-w-[50px] max-h-[50px] rounded-full border-2 border-emerald-400 bg-emerald-500/30 ring-4 ring-emerald-400/40 pointer-events-none animate-ping" />
                              ) : (
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-700/85 border-2 border-emerald-300 shadow-md group-hover:scale-125 transition" />
                              )}
                            </>
                          )}

                          {/* PIECE RENDERING */}
                          {piece && (
                            <div
                              className={`relative w-[84%] h-[84%] max-w-[48px] max-h-[48px] aspect-square rounded-full flex flex-col items-center justify-center shadow-lg transition-transform ${
                                isSelected
                                  ? 'scale-110 z-20 ring-4 ring-amber-400 shadow-amber-950/60'
                                  : 'group-hover:scale-105'
                              } ${isGeneralChecked ? 'ring-4 ring-rose-500 animate-bounce' : ''} ${
                                piece.color === 'RED'
                                  ? 'bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 border-2 border-red-700 text-red-700'
                                  : 'bg-gradient-to-br from-stone-800 via-stone-900 to-neutral-950 border-2 border-stone-600 text-amber-200'
                              }`}
                              style={{
                                boxShadow:
                                  piece.color === 'RED'
                                    ? '0 4px 6px -1px rgba(185, 28, 28, 0.45), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.3)'
                                    : '0 4px 6px -1px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.8)',
                              }}
                            >
                              <div
                                className={`w-[86%] h-[86%] rounded-full border-2 flex items-center justify-center ${
                                  piece.color === 'RED'
                                    ? 'border-red-600/70 bg-amber-50/50'
                                    : 'border-stone-500/70 bg-stone-900/50'
                                }`}
                              >
                                <span className="text-base sm:text-xl font-black leading-none select-none font-serif tracking-tight">
                                  {getPieceCharacter(piece.type, piece.color)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Quick helper tip below board */}
            <p className="text-[11px] text-stone-400 mt-2 text-center">
              {mode === 'SETUP'
                ? selectedTrayItem === 'ERASER'
                  ? '🖱️ Chế độ tẩy: Nhấp vào quân cờ bất kỳ trên bàn để xóa.'
                  : selectedTrayItem
                  ? `🖱️ Đang chọn quân ${
                      selectedTrayItem.color === 'RED' ? 'Đỏ' : 'Đen'
                    }: Nhấp vào ô trống trên bàn cờ để đặt.`
                  : '🖱️ Nhấp chọn quân từ khay bên phải để đặt lên bàn, hoặc nhấp quân trên bàn để đổi chỗ/xóa.'
                : '🎯 Nhấp vào quân cờ của bạn để xem và đi các nước cờ hợp lệ.'}
            </p>
          </div>

          {/* RIGHT: CONTROLS & PALETTE PANEL */}
          <div className="w-full lg:w-96 flex flex-col gap-4">
            {/* MODE: SETUP CONTROLS */}
            {mode === 'SETUP' ? (
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                {/* Preset banner */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      Thế Cờ Hiện Tại
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {activePreset ? activePreset.name : 'Thế cờ tự do do bạn xếp'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPresetModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Chọn Mẫu</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activePreset && (
                  <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 text-[11px] text-stone-300 leading-relaxed">
                    <p className="text-amber-300/90 font-medium">{activePreset.description}</p>
                    <p className="text-[10px] text-stone-400 mt-1 italic">
                      💡 Mẹo: {activePreset.hintText}
                    </p>
                  </div>
                )}

                {/* PIECE TRAY: RED PIECES */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                      🔴 Quân Đỏ (Tối đa chuẩn)
                    </span>
                    <span className="text-[10px] text-stone-500">Nhấp chọn để đặt lên bàn</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {trayPiecesRed.map((item) => {
                      const countOnBoard = currentPieceCounts.RED[item.type];
                      const maxLimit = XIANGQI_PIECE_LIMITS[item.type];
                      const isMaxedOut = countOnBoard >= maxLimit;
                      const isSelected =
                        selectedTrayItem &&
                        typeof selectedTrayItem === 'object' &&
                        selectedTrayItem.type === item.type &&
                        selectedTrayItem.color === 'RED';
                      return (
                        <button
                          key={`tray-red-${item.type}`}
                          type="button"
                          disabled={isMaxedOut}
                          onClick={() => {
                            if (isMaxedOut) return;
                            setSelectedTrayItem(
                              isSelected ? null : { type: item.type, color: 'RED' }
                            );
                          }}
                          className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition relative ${
                            isMaxedOut
                              ? 'opacity-30 bg-stone-950 border-stone-800 cursor-not-allowed'
                              : isSelected
                              ? 'bg-red-950 border-red-500 ring-2 ring-red-400 scale-105 shadow-md shadow-red-950 cursor-pointer'
                              : 'bg-stone-950 hover:bg-stone-800 border-stone-800 hover:border-red-500/50 cursor-pointer'
                          }`}
                          title={
                            isMaxedOut
                              ? `Đã đủ tối đa ${maxLimit} quân ${item.name} trên bàn cờ`
                              : `Quân Đỏ: ${item.name} (${countOnBoard}/${maxLimit})`
                          }
                        >
                          <span className="text-base sm:text-lg font-black font-serif text-red-500 leading-none">
                            {getPieceCharacter(item.type, 'RED')}
                          </span>
                          <span className="text-[9px] text-stone-400 mt-0.5">{item.name}</span>
                          <span
                            className={`text-[8px] font-bold px-1 rounded-full absolute -top-1.5 -right-1.5 border shadow ${
                              isMaxedOut
                                ? 'bg-stone-800 text-stone-500 border-stone-700'
                                : 'bg-red-950 text-red-300 border-red-700'
                            }`}
                          >
                            {countOnBoard}/{maxLimit}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PIECE TRAY: BLACK PIECES */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-stone-300 flex items-center gap-1">
                      ⚫ Quân Đen (Tối đa chuẩn)
                    </span>
                    <span className="text-[10px] text-stone-500">Nhấp chọn để đặt lên bàn</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {trayPiecesBlack.map((item) => {
                      const countOnBoard = currentPieceCounts.BLACK[item.type];
                      const maxLimit = XIANGQI_PIECE_LIMITS[item.type];
                      const isMaxedOut = countOnBoard >= maxLimit;
                      const isSelected =
                        selectedTrayItem &&
                        typeof selectedTrayItem === 'object' &&
                        selectedTrayItem.type === item.type &&
                        selectedTrayItem.color === 'BLACK';
                      return (
                        <button
                          key={`tray-black-${item.type}`}
                          type="button"
                          disabled={isMaxedOut}
                          onClick={() => {
                            if (isMaxedOut) return;
                            setSelectedTrayItem(
                              isSelected ? null : { type: item.type, color: 'BLACK' }
                            );
                          }}
                          className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition relative ${
                            isMaxedOut
                              ? 'opacity-30 bg-stone-950 border-stone-800 cursor-not-allowed'
                              : isSelected
                              ? 'bg-neutral-800 border-amber-400 ring-2 ring-amber-400 scale-105 shadow-md cursor-pointer'
                              : 'bg-stone-950 hover:bg-stone-800 border-stone-800 hover:border-stone-600 cursor-pointer'
                          }`}
                          title={
                            isMaxedOut
                              ? `Đã đủ tối đa ${maxLimit} quân ${item.name} trên bàn cờ`
                              : `Quân Đen: ${item.name} (${countOnBoard}/${maxLimit})`
                          }
                        >
                          <span className="text-base sm:text-lg font-black font-serif text-stone-200 leading-none">
                            {getPieceCharacter(item.type, 'BLACK')}
                          </span>
                          <span className="text-[9px] text-stone-400 mt-0.5">{item.name}</span>
                          <span
                            className={`text-[8px] font-bold px-1 rounded-full absolute -top-1.5 -right-1.5 border shadow ${
                              isMaxedOut
                                ? 'bg-stone-800 text-stone-500 border-stone-700'
                                : 'bg-stone-800 text-amber-300 border-stone-600'
                            }`}
                          >
                            {countOnBoard}/{maxLimit}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CẤU HÌNH TRẬN GIẢI (CHỌN TRƯỚC KHI GIẢI) */}
                <div className="pt-2.5 border-t border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      ⚙️ Cấu Hình Trước Khi Giải
                    </span>
                    <span className="text-[10px] text-stone-500">Khóa cố định khi vào giải</span>
                  </div>

                  {/* 1. Chọn chế độ: Tự giải 2 bên vs Đấu với máy AI */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 mb-1.5">
                      1. Chế độ giải:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSolvingOpponent('SOLO')}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                          solvingOpponent === 'SOLO'
                            ? 'bg-emerald-950/70 border-emerald-500 text-white ring-2 ring-emerald-500/40'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        <User className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-xs">Tự Giải 2 Bên</div>
                          <div className="text-[9px] text-stone-400">Nghiên cứu biến cờ</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSolvingOpponent('AI_DEFENDER')}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                          solvingOpponent === 'AI_DEFENDER'
                            ? 'bg-violet-950/70 border-violet-500 text-white ring-2 ring-violet-500/40'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                        }`}
                      >
                        <Bot className="w-4 h-4 text-violet-400 shrink-0" />
                        <div>
                          <div className="font-bold text-xs">Đấu Với Máy AI</div>
                          <div className="text-[9px] text-stone-400">Máy tự động đỡ nước</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 2. Chọn bên bạn cầm (khi đấu với máy AI) */}
                  {solvingOpponent === 'AI_DEFENDER' && (
                    <div className="bg-stone-950/80 border border-stone-800 p-2.5 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-300">2. Phe bạn cầm:</span>
                        <span className="text-[10px] text-violet-400 font-medium">
                          {humanSide === 'RED' ? 'Máy cầm Đen' : 'Máy cầm Đỏ'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setHumanSide('RED')}
                          className={`py-1.5 px-3 rounded-lg font-bold text-xs transition cursor-pointer ${
                            humanSide === 'RED'
                              ? 'bg-red-700 text-white shadow ring-2 ring-red-500/40'
                              : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          🔴 Bạn cầm Đỏ
                        </button>
                        <button
                          type="button"
                          onClick={() => setHumanSide('BLACK')}
                          className={`py-1.5 px-3 rounded-lg font-bold text-xs transition cursor-pointer ${
                            humanSide === 'BLACK'
                              ? 'bg-stone-700 text-white shadow ring-2 ring-stone-500/40'
                              : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          ⚫ Bạn cầm Đen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. Lượt đi trước (hoàn toàn tự do chọn) */}
                  <div className="flex items-center justify-between text-xs bg-stone-950/60 p-2 rounded-xl border border-stone-800">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-300">3. Đi trước:</span>
                      {activePreset && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-medium">
                          Gợi ý: {activePreset.sideToMove === 'RED' ? 'Đỏ' : 'Đen'}
                        </span>
                      )}
                    </div>
                    <div className="flex rounded-lg bg-stone-900 p-0.5 border border-stone-800">
                      <button
                        type="button"
                        onClick={() => {
                          setTurnSide('RED');
                          setInitialSideToMove('RED');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          turnSide === 'RED'
                            ? 'bg-red-700 text-white shadow'
                            : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        🔴 Đỏ trước
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTurnSide('BLACK');
                          setInitialSideToMove('BLACK');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          turnSide === 'BLACK'
                            ? 'bg-stone-700 text-white shadow'
                            : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        ⚫ Đen trước
                      </button>
                    </div>
                  </div>

                  {/* 4. Hướng nhìn bàn cờ (Lật bàn trước khi giải) */}
                  <div className="flex items-center justify-between text-xs bg-stone-950/60 p-2 rounded-xl border border-stone-800">
                    <span className="font-bold text-stone-300">4. Lật bàn:</span>
                    <div className="flex rounded-lg bg-stone-900 p-0.5 border border-stone-800">
                      <button
                        type="button"
                        onClick={() => setIsFlipped(false)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          !isFlipped
                            ? 'bg-amber-600 text-stone-950 shadow'
                            : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        🔴 Đỏ ở dưới
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          isFlipped
                            ? 'bg-amber-600 text-stone-950 shadow'
                            : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        ⚫ Đen ở dưới
                      </button>
                    </div>
                  </div>

                  {/* 5. Utility buttons row */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTrayItem(selectedTrayItem === 'ERASER' ? null : 'ERASER')
                      }
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition cursor-pointer ${
                        selectedTrayItem === 'ERASER'
                          ? 'bg-rose-950 border-rose-500 text-rose-300 ring-2 ring-rose-400'
                          : 'bg-stone-950 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                      title="Chọn công cụ tẩy để xóa quân"
                    >
                      <Eraser className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-[11px]">Tẩy</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearBoard}
                      className="px-2 py-1.5 rounded-xl text-xs font-bold bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Xóa sạch toàn bộ bàn cờ"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px]">Trống</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetStandard}
                      className="px-2 py-1.5 rounded-xl text-xs font-bold bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Khôi phục bàn cờ chuẩn 32 quân"
                    >
                      <Grid className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px]">Chuẩn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFenModalOpen(true)}
                      className="px-2 py-1.5 rounded-xl text-xs font-bold bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Xuất hoặc nhập mã FEN thế cờ"
                    >
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px]">FEN</span>
                    </button>
                  </div>
                </div>

                {/* Validation Status Indicator */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                    boardValidation.valid
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  }`}
                >
                  {boardValidation.valid ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span>{boardValidation.message}</span>
                </div>
              </div>
            ) : (
              /* MODE: SOLVING CONTROLS (ĐÃ BỎ CHỌN BÊN, ĐẤU MÁY, LẬT BÀN TRONG KHI GIẢI) */
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                {/* Active Match Info Card */}
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                      {solvingOpponent === 'AI_DEFENDER' ? (
                        <>
                          <Bot className="w-4 h-4 text-violet-400" />
                          <span>Đấu Với Máy AI</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-emerald-400" />
                          <span>Tự Giải 2 Bên</span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleReturnToSetup}
                      className="text-[11px] text-amber-400/90 hover:text-amber-300 underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Sửa thế / Đổi bên</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-stone-800/80">
                    <div>
                      <span className="text-stone-500 block text-[10px]">Phe bạn cầm:</span>
                      <span className="font-bold text-stone-200">
                        {solvingOpponent === 'AI_DEFENDER'
                          ? humanSide === 'RED'
                            ? '🔴 Đỏ (Máy cầm Đen)'
                            : '⚫ Đen (Máy cầm Đỏ)'
                          : 'Tự điều khiển 2 bên'}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[10px]">Góc nhìn bàn cờ:</span>
                      <span className="font-bold text-stone-200">
                        {isFlipped ? '⚫ Đen ở dưới (Đã lật)' : '🔴 Đỏ ở dưới (Chuẩn)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Solving Actions Row: Undo, Hint, Reset */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Undo Button */}
                  <button
                    type="button"
                    disabled={moveHistory.length === 0}
                    onClick={handleUndo}
                    className="p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed border border-stone-800 text-xs font-bold text-stone-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                    title="Đi lại nước trước"
                  >
                    <ChevronLeft className="w-4 h-4 text-amber-400" />
                    <span>Hoàn tác</span>
                  </button>

                  {/* AI Hint Button */}
                  <button
                    type="button"
                    onClick={handleRequestHint}
                    disabled={isCalculatingAi || isSolvedWon || isRepetitionDraw}
                    className="p-2.5 rounded-xl bg-violet-950/50 hover:bg-violet-900/60 disabled:opacity-40 border border-violet-700/60 text-xs font-bold text-violet-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-md"
                    title="Xem gợi ý nước đi tối ưu"
                  >
                    <Lightbulb className={`w-4 h-4 text-violet-400 ${isCalculatingAi ? 'animate-spin' : ''}`} />
                    <span>{isCalculatingAi ? 'Đang tính...' : 'Gợi ý AI'}</span>
                  </button>

                  {/* Reset Puzzle Button */}
                  <button
                    type="button"
                    onClick={handleResetCurrentPuzzle}
                    className="p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs font-bold text-stone-200 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                    title="Giải lại từ đầu thế cờ"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>Giải lại</span>
                  </button>
                </div>

                {/* AI Hint Details Box */}
                {aiHint && (
                  <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-700/50 text-xs text-violet-200 space-y-1 animate-fadeIn">
                    <div className="font-black text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gợi ý: {aiHint.notation}
                    </div>
                    <p className="text-[11px] text-stone-300">
                      Từ vị trí ({aiHint.from.x + 1}, {aiHint.from.y + 1}) đến ({aiHint.to.x + 1},{' '}
                      {aiHint.to.y + 1}). Điểm đánh giá thế trận: +{aiHint.score}.
                    </p>
                  </div>
                )}

                {/* MOVE HISTORY LOG */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-400 mb-1.5">
                    <span>Lịch sử nước giải ({moveHistory.length})</span>
                    {activePreset && <span className="text-amber-400">{activePreset.name}</span>}
                  </div>
                  <div className="h-40 max-h-40 bg-stone-950 rounded-xl border border-stone-800 p-2 overflow-y-auto space-y-1 text-xs font-mono">
                    {moveHistory.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-stone-600 text-[11px] italic">
                        Chưa có nước đi nào. Hãy bắt đầu giải!
                      </div>
                    ) : (
                      moveHistory.map((mv, idx) => (
                        <div
                          key={`hist-${idx}`}
                          className="flex items-center justify-between px-2 py-1 rounded bg-stone-900/60 border border-stone-800/80 text-[11px]"
                        >
                          <span className="text-stone-500 font-bold w-6">#{idx + 1}</span>
                          <span
                            className={`font-semibold flex-1 ${
                              mv.piece.color === 'RED' ? 'text-red-400' : 'text-stone-300'
                            }`}
                          >
                            {mv.piece.color === 'RED' ? '🔴' : '⚫'} {mv.notation}
                          </span>
                          {mv.isCheck && (
                            <span className="text-[10px] text-rose-400 font-bold">⚡ Chiếu</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: CHOOSE PRESET PUZZLES */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-amber-600/40 w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Kho 25 Thế Cờ Kinh Điển &amp; Giang Hồ
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Tự do chọn thế cờ và có thể tùy ý chọn bên Đỏ hoặc Đen đi trước để luyện tập giải thế.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs overflow-x-auto">
                {(['ALL', 'Dễ', 'Trung bình', 'Khó', 'Giang hồ'] as const).map((diff) => {
                  const count =
                    diff === 'ALL'
                      ? CLASSIC_XIANGQI_PUZZLES.length
                      : CLASSIC_XIANGQI_PUZZLES.filter((p) => p.difficulty === diff).length;
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setPresetFilter(diff)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                        presetFilter === diff
                          ? 'bg-amber-600 text-stone-950 shadow'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {diff === 'ALL' ? `Tất cả (${count})` : `${diff} (${count})`}
                    </button>
                  );
                })}
              </div>

              {/* Search box */}
              <input
                type="text"
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder="Tìm tên thế cờ (vd: Thất Tinh, Dã Mã, Khổng Minh...)"
                className="px-3.5 py-1.5 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-stone-500 outline-none w-full sm:w-64 transition"
              />
            </div>

            {/* Preset Cards Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {CLASSIC_XIANGQI_PUZZLES.filter((puzzle) => {
                if (presetFilter !== 'ALL' && puzzle.difficulty !== presetFilter) return false;
                if (presetSearch.trim()) {
                  const q = presetSearch.toLowerCase();
                  return (
                    puzzle.name.toLowerCase().includes(q) ||
                    puzzle.description.toLowerCase().includes(q) ||
                    (puzzle.chineseName && puzzle.chineseName.includes(q))
                  );
                }
                return true;
              }).map((puzzle) => (
                <div
                  key={puzzle.id}
                  onClick={() => handleLoadPreset(puzzle)}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between ${
                    selectedPresetId === puzzle.id
                      ? 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/40'
                      : 'bg-stone-950/80 hover:bg-stone-800/80 border-stone-800 hover:border-amber-600/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-black text-sm text-white">{puzzle.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          puzzle.difficulty === 'Dễ'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : puzzle.difficulty === 'Trung bình'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : puzzle.difficulty === 'Khó'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {puzzle.difficulty}
                      </span>
                    </div>

                    {puzzle.chineseName && (
                      <span className="text-[11px] text-amber-400 font-serif block mb-1">
                        {puzzle.chineseName}
                      </span>
                    )}

                    <p className="text-[11px] text-stone-300 line-clamp-2 leading-relaxed">
                      {puzzle.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-300 font-medium flex items-center gap-1">
                      <span>Lượt gợi ý:</span>
                      <span className="font-bold text-amber-300">
                        {puzzle.sideToMove === 'RED' ? '🔴 Đỏ đi trước' : '⚫ Đen đi trước'}
                      </span>
                    </span>
                    <span className="text-amber-400 font-extrabold flex items-center gap-1">
                      <span>Nạp thế cờ</span>
                      <span>&rarr;</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXPORT / IMPORT FEN */}
      {isFenModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-cyan-500/40 w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                Chia Sẻ & Nhập Chuỗi FEN
              </h3>
              <button
                type="button"
                onClick={() => setIsFenModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Export Section */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300 block">
                Chuỗi FEN của thế cờ hiện tại:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={exportPiecesToFen(pieces, turnSide)}
                  className="flex-1 px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-mono text-cyan-300 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleExportFen}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  {fenCopyFeedback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{fenCopyFeedback ? 'Đã sao chép' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Import Section */}
            <div className="space-y-1.5 pt-2 border-t border-stone-800">
              <label className="text-xs font-bold text-stone-300 block">
                Nhập chuỗi FEN để tải thế cờ:
              </label>
              <textarea
                rows={3}
                value={fenInputText}
                onChange={(e) => setFenInputText(e.target.value)}
                placeholder="Dán chuỗi FEN cờ tướng vào đây (ví dụ: 3k1a3/4a4/9/4p4/9/9/9/9/4K4/9 w - - 0 1)"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 focus:border-cyan-400 rounded-xl text-xs font-mono text-stone-200 outline-none resize-none transition"
              />
              <button
                type="button"
                onClick={handleImportFen}
                disabled={!fenInputText.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-stone-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Nạp Thế Cờ Từ FEN</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
