import React from 'react';

interface ChessPieceSvgProps {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  className?: string;
}

export const ChessPieceSvg: React.FC<ChessPieceSvgProps> = ({
  type,
  color,
  className = 'w-full h-full',
}) => {
  const isWhite = color === 'w';

  // Gradient IDs based on color
  const gradId = isWhite ? 'whitePieceGrad' : 'blackPieceGrad';
  const shadowFilter = 'pieceDropShadow';

  const baseFill = `url(#${gradId})`;
  const baseStroke = isWhite ? '#1e293b' : '#f8fafc';
  const strokeWidth = 1.6;

  return (
    <svg viewBox="0 0 45 45" className={className}>
      <defs>
        {/* Soft realistic drop shadow */}
        <filter id={shadowFilter} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>

        {/* Ivory gradient for White */}
        <linearGradient id="whitePieceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f8f6f0" />
          <stop offset="100%" stopColor="#e8e2d5" />
        </linearGradient>

        {/* Obsidian slate gradient for Black */}
        <linearGradient id="blackPieceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="60%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Piece Vector */}
      {renderPiece(type, isWhite, baseFill, baseStroke, strokeWidth, shadowFilter)}
    </svg>
  );
};

function renderPiece(
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k',
  isWhite: boolean,
  fill: string,
  stroke: string,
  strokeWidth: number,
  filterId: string
) {
  switch (type) {
    case 'p': // PAWN
      return (
        <g filter={`url(#${filterId})`}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Subtle specular contour */}
          <path
            d="M 21 11 C 21 10.5 22.5 10.2 23.5 10.5"
            stroke={isWhite ? '#ffffff' : '#64748b'}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </g>
      );

    case 'n': // KNIGHT
      return (
        <g
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
          <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.07,8.06 17.07,8.06 C 17.07,8.06 20.89,6.5 22,10 z" />
          <circle cx="15" cy="14.5" r="1.5" fill={isWhite ? '#1e293b' : '#f8fafc'} />
          <path
            d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
            fill={isWhite ? '#1e293b' : '#f8fafc'}
          />
        </g>
      );

    case 'b': // BISHOP
      return (
        <g
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
          <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
          <path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z" />
          <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" />
        </g>
      );

    case 'r': // ROOK
      return (
        <g
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
          <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
          <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
          <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
          <path d="M 14,17 L 14,29.5 L 31,29.5 L 31,17" />
          <path d="M 14,29.5 L 11,32 L 34,32 L 31,29.5" />
        </g>
      );

    case 'q': // QUEEN
      return (
        <g
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          <path d="M 9 13 A 2 2 0 1 1 5,13 A 2 2 0 1 1 9 13 z" />
          <path d="M 24 9 A 2 2 0 1 1 20,9 A 2 2 0 1 1 24 9 z" />
          <path d="M 39 13 A 2 2 0 1 1 35,13 A 2 2 0 1 1 39 13 z" />
          <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38,14 L 31,25 L 22.5,10 L 14,25 L 7,14 L 9,26 z" />
          <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10,38.5 L 35,38.5 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z" />
          <path d="M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5" />
        </g>
      );

    case 'k': // KING
      return (
        <g
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          <path d="M 22.5,11.63 L 22.5,6" />
          <path d="M 20,8 L 25,8" />
          <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z" />
          <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 36.5,30 36.5,28.5 36.5,24 C 36.5,19.5 30.5,16.5 22.5,16.5 C 14.5,16.5 8.5,19.5 8.5,24 C 8.5,28.5 8.5,30 11.5,37 z" />
          <path d="M 11.5,30 C 17,27 28,27 33.5,30" />
          <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" />
          <path d="M 11.5,37 C 17,34 28,34 33.5,37" />
        </g>
      );
  }
}
