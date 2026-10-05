import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  X,
  MessageSquare,
  ChevronDown,
  ArrowDown,
} from 'lucide-react';
import { socket } from '../socket';
import { ChatMessage } from '../types';

interface KhungChatProps {
  roomCode: string;
  playerId?: string;
  myPlayerId?: string;
  chatMessages?: ChatMessage[];
  messages?: ChatMessage[];
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  onReadAll?: () => void;
  onInterceptMessage?: (text: string) => boolean;
  isSpectator?: boolean;
  hideHeader?: boolean;
}

const QUICK_CHATS = [
  'Chào mọi người! 👋',
  'Đánh hay lắm! 👏',
  'Nước đi đỉnh thật! 🎯',
  'Xin hòa được không? 🤝',
  'Nhanh lên bạn ơi! ⏳',
  'GG! Ván đấu tuyệt vời! 🏆',
];

export const KhungChat: React.FC<KhungChatProps> = ({
  roomCode,
  playerId,
  myPlayerId,
  chatMessages,
  messages,
  isOpen = true,
  onClose,
  isFloating = false,
  onReadAll,
  onInterceptMessage,
  isSpectator = false,
  hideHeader = false,
}) => {
  const rawMessages = messages ?? chatMessages ?? [];
  // Lọc: người chơi trong trận KHÔNG nhìn thấy tin nhắn bình luận chuyên môn của Grandmaster
  const effectiveMessages = rawMessages.filter((m) => !m.isSpectatorOnly || isSpectator);
  const effectivePlayerId = playerId ?? myPlayerId ?? '';

  const [inputText, setInputText] = useState('');
  const [hasScrolledUp, setHasScrolledUp] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const onReadAllRef = useRef(onReadAll);
  useEffect(() => {
    onReadAllRef.current = onReadAll;
  });

  // Notify parent component that messages have been read whenever chat is visible
  useEffect(() => {
    if (isOpen) {
      onReadAllRef.current?.();
    }
  }, [isOpen, effectiveMessages.length]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    // User is considered at the bottom if within 80px
    const nearBottom = distanceToBottom < 80;
    isNearBottomRef.current = nearBottom;
    setHasScrolledUp(!nearBottom);
    if (nearBottom) {
      onReadAllRef.current?.();
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setHasScrolledUp(false);
    isNearBottomRef.current = true;
    onReadAllRef.current?.();
  };

  // Scroll to bottom initially or when near bottom and new message arrives
  useEffect(() => {
    if (isNearBottomRef.current) {
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [effectiveMessages.length]);

  // Initial scroll to bottom when chat opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (onInterceptMessage && onInterceptMessage(text)) {
      if (!textToSend) {
        setInputText('');
      }
      return;
    }

    socket.emit('CHAT_MESSAGE', {
      roomCode,
      playerId: effectivePlayerId,
      text,
    });

    if (!textToSend) {
      setInputText('');
    }

    // Always scroll to bottom when current player sends a message
    setTimeout(() => {
      scrollToBottom(true);
    }, 60);
  };

  if (!isOpen) return null;

  const containerClasses = isFloating
    ? 'fixed inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-4 sm:right-4 z-50 w-auto sm:w-96 h-[68vh] sm:h-[480px] max-h-[520px] bg-slate-900/98 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col backdrop-blur-lg overflow-hidden animate-slideUp'
    : 'w-full h-full min-h-0 bg-slate-950/70 border-0 flex flex-col overflow-hidden relative';

  return (
    <>
      {/* Mobile backdrop for floating chat */}
      {isFloating && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden animate-fadeIn"
        />
      )}

      <div className={containerClasses}>
        {/* Header - shown only if not hideHeader */}
        {!hideHeader && (
          <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm text-white">Trò chuyện trong phòng</span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 sm:p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition touch-manipulation cursor-pointer"
                title="Đóng chat"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        )}

        {/* Message List - with full scroll support up and down */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain space-y-2.5 text-xs select-text scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/40"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {effectiveMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic select-none">
              Chưa có tin nhắn nào. Hãy gửi lời chào!
            </div>
          ) : (
            effectiveMessages.map((msg) => {
              // Tin nhắn bình luận chuyên môn Grandmaster chỉ dành cho Khán giả
              if (msg.senderId === 'BOT_GEMINI' || msg.isSpectatorOnly) {
                return (
                  <div
                    key={msg.id}
                    className="my-2.5 p-3 rounded-2xl bg-gradient-to-br from-amber-950/80 via-slate-900 to-amber-950/60 border border-amber-600/60 shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-amber-800/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">♟️</span>
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-400">
                          Bình Luận Grandmaster
                        </span>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                        DÀNH CHO KHÁN GIẢ
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                      {msg.text}
                    </p>
                  </div>
                );
              }

              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="text-center my-1.5">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-slate-800/70 border border-slate-700/50 text-[11px] text-amber-300 font-medium">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.senderId === effectivePlayerId;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <span className="text-base bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center shrink-0 select-none">
                      {msg.senderAvatar}
                    </span>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-1.5 shadow-sm ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-slate-800 text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {!isMe && (
                      <div className="text-[10px] font-semibold text-emerald-300 mb-0.5">
                        {msg.senderName}
                      </div>
                    )}
                    <p className="text-xs break-words leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Scroll to bottom button when user scrolled up */}
        {hasScrolledUp && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-slate-800/95 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold rounded-full shadow-2xl border border-slate-600 hover:border-emerald-400 flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-sm"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Cuộn xuống cuối</span>
          </button>
        )}

        {/* Quick chat shortcuts */}
        <div className="px-2.5 py-2 bg-slate-950/80 border-t border-slate-800 flex gap-2 overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] shrink-0 touch-pan-x">
          {QUICK_CHATS.map((qc, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(qc)}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-slate-800/90 hover:bg-emerald-700 active:scale-95 text-xs text-slate-300 hover:text-white transition shrink-0 cursor-pointer touch-manipulation border border-slate-700"
            >
              {qc}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-2.5 bg-slate-950 border-t border-slate-800 flex gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập tin nhắn..."
            maxLength={120}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl transition cursor-pointer touch-manipulation shrink-0"
            title="Gửi tin nhắn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
};
