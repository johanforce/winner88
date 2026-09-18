import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, ChevronDown } from 'lucide-react';
import { ChatMessage } from '../types';
import { socket } from '../socket';

interface KhungChatProps {
  roomCode: string;
  playerId?: string;
  myPlayerId?: string;
  messages?: ChatMessage[];
  chatMessages?: ChatMessage[];
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  onReadAll?: () => void;
}

const QUICK_CHATS = [
  'Đánh nhanh lên bạn ơi! ⏱️',
  'Bài đẹp quá nè! 🤩',
  'Chặt đè này! 🔥',
  'Cứ bình tĩnh tính toán 🤔',
  'May mắn thôi hehe 😄',
  'Xin đừng chặt em nha 🙏',
];

export const KhungChat: React.FC<KhungChatProps> = ({
  roomCode,
  playerId,
  myPlayerId,
  messages,
  chatMessages,
  isOpen = true,
  onClose,
  isFloating = false,
  onReadAll,
}) => {
  const effectiveMessages = messages ?? chatMessages ?? [];
  const effectivePlayerId = playerId ?? myPlayerId ?? '';

  const [inputText, setInputText] = useState('');
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Notify parent component that messages have been read whenever chat is visible
  useEffect(() => {
    if (isOpen) {
      onReadAll?.();
    }
  }, [isOpen, effectiveMessages.length, onReadAll]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    const nearBottom = distanceToBottom < 75;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      if (hasUnreadBelow) {
        setHasUnreadBelow(false);
      }
      onReadAll?.();
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setHasUnreadBelow(false);
    isNearBottomRef.current = true;
    onReadAll?.();
  };

  useEffect(() => {
    if (isNearBottomRef.current) {
      // Small timeout allows DOM reflow so scrollHeight accounts for newly added message element
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setHasUnreadBelow(true);
    }
  }, [effectiveMessages.length]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

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
    : 'w-full h-full bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden relative';

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
        {/* Header */}
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

      {/* Message List */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-3 overflow-y-auto scroll-smooth overscroll-contain touch-pan-y space-y-2.5 text-xs select-text"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {effectiveMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic select-none">
            Chưa có tin nhắn nào. Hãy gửi lời chào!
          </div>
        ) : (
          effectiveMessages.map((msg) => {
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

      {/* Floating Unread / Scroll to bottom pill */}
      {hasUnreadBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-22 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-full shadow-lg border border-emerald-400/40 flex items-center gap-1 transition-all animate-bounce cursor-pointer"
        >
          <span>Tin nhắn mới</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Quick chat shortcuts */}
      <div className="px-2.5 py-2 bg-slate-950/70 border-t border-slate-800/80 flex gap-2 overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] shrink-0 touch-pan-x">
        {QUICK_CHATS.map((qc, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(qc)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-emerald-700 active:scale-95 text-xs text-slate-300 hover:text-white transition shrink-0 cursor-pointer touch-manipulation"
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
        className="p-2.5 bg-slate-950/95 border-t border-slate-800 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={120}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl transition cursor-pointer touch-manipulation"
          title="Gửi tin nhắn"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
    </>
  );
};
