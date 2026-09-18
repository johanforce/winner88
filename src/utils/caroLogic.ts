import { CaroPiece } from '../types';

export const BOARD_SIZE = 20;

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * Kiểm tra xem ô có thuộc viền ngoài cùng của bàn cờ không (x=0, x=19, y=0, y=19)
 */
export function isBorderCell(x: number, y: number): boolean {
  return x === 0 || x === BOARD_SIZE - 1 || y === 0 || y === BOARD_SIZE - 1;
}

/**
 * Kiểm tra xem ô có được phép đánh cờ không:
 * Bàn cờ 20x20 nhưng KHÔNG ĐƯỢC ĐÁNH VÀO ĐƯỜNG VIỀN NGOÀI
 */
export function isPlayableCell(x: number, y: number): boolean {
  return x > 0 && x < BOARD_SIZE - 1 && y > 0 && y < BOARD_SIZE - 1;
}

/**
 * Âm thanh đánh cờ Caro bằng Web Audio API
 */
class CaroSoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playPiecePlace(isX: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isX ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isX ? 520 : 440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Audio playback fails gracefully
    }
  }

  public playWin() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    } catch {
      // Audio failure graceful
    }
  }

  public playTimeout() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
    } catch {
      // Silent catch
    }
  }
}

export const caroSound = new CaroSoundEffects();
