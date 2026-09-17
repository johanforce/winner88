import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X } from 'lucide-react';
import { ChatMessage } from '../types';
import { socket } from '../socket';

interface KhungChatProps {
  roomCode: string;
  playerId: string;
  messages: ChatMessage[];
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
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
  messages,
  isOpen = true,
  onClose,
  isFloating = false,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    socket.emit('CHAT_MESSAGE', {
      roomCode,
      playerId,
      text,
    });

    if (!textToSend) {
      setInputText('');
    }
  };

  if (!isOpen) return null;

  const containerClasses = isFloating
    ? 'fixed bottom-4 right-4 z-40 w-80 sm:w-96 h-[460px] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col backdrop-blur-md overflow-hidden animate-slideUp'
    : 'w-full h-full bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-sm text-white">Trò chuyện trong phòng</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Chưa có tin nhắn nào. Hãy gửi lời chào!
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-slate-800/70 border border-slate-700/50 text-[11px] text-amber-300 font-medium">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.senderId === playerId;

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <span className="text-base bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
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
                  <p className="text-xs break-words">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick chat shortcuts */}
      <div className="px-2 py-1.5 bg-slate-950/50 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_CHATS.map((qc, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(qc)}
            className="whitespace-nowrap px-2 py-1 rounded-full bg-slate-800/90 hover:bg-emerald-700 text-[11px] text-slate-300 hover:text-white transition shrink-0"
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
        className="p-2 bg-slate-950/90 border-t border-slate-800 flex gap-1.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={120}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
