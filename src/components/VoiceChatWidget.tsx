import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Radio,
  Sliders,
  ShieldCheck,
  Headphones,
  Volume1,
} from 'lucide-react';
import { useVoiceChat } from '../context/VoiceChatContext';
import { RoomPublicState } from '../types';

interface VoiceChatWidgetProps {
  roomState: RoomPublicState;
  myPlayerId: string;
  className?: string;
}

export const VoiceChatWidget: React.FC<VoiceChatWidgetProps> = ({
  roomState,
  myPlayerId,
  className = '',
}) => {
  const {
    isVoiceJoined,
    isConnecting,
    hasMic,
    isMuted,
    isDeafened,
    isSpeaking,
    needsAudioUnlock,
    permissionState,
    errorMessage,
    participants,
    speakingMap,
    volumeLevel,
    peerVolumes,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    setPeerVolume,
    unlockAudio,
    clearError,
  } = useVoiceChat();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showVolumeControls, setShowVolumeControls] = useState(false);

  const me = roomState.players.find((p) => p.id === myPlayerId);
  const voiceUserCount = participants.length;

  return (
    <>
      {/* Autoplay Unlock Notice Banner (if browser blocked sound) */}
      {needsAudioUnlock && (
        <div
          onClick={unlockAudio}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 shadow-2xl shadow-amber-500/30 font-bold text-xs cursor-pointer hover:bg-amber-400 transition animate-bounce"
          title="Nhấn vào đây để cho phép phát âm thanh"
        >
          <Volume1 className="w-4 h-4 animate-pulse" />
          <span>Trình duyệt tạm chặn âm thanh. Nhấn vào đây để bật loa nghe phòng! 🔊</span>
        </div>
      )}

      {/* Error / Permission Modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <button
                onClick={clearError}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white mb-1">
                {permissionState === 'denied'
                  ? 'Quyền Micro bị từ chối'
                  : 'Thông báo Voice Chat'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
              <Headphones className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Bạn vẫn nghe mọi người nói bình thường!</strong> Chế độ Chỉ nghe (Listen-only) đang hoạt động tự động.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={clearError}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Voice Chat Widget Container */}
      <div className={`transition-all duration-200 ${className}`}>
        {!isVoiceJoined ? (
          /* Disconnected state - Button to reconnect */
          <button
            onClick={() => joinVoice()}
            disabled={isConnecting}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/50 shadow-lg shadow-black/40 text-xs font-medium text-slate-200 hover:text-white transition group disabled:opacity-50"
            title="Kết nối lại kênh Voice phòng"
          >
            <div className="relative">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                <Headphones className="w-4 h-4" />
              </div>
              {isConnecting && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div className="text-left">
              <div className="font-bold flex items-center gap-1.5">
                <span>{isConnecting ? 'Đang kết nối âm thanh...' : 'Vào Kênh Nghe Voice'}</span>
                {voiceUserCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {voiceUserCount} trong voice
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Nghe mọi người nói chuyện
              </div>
            </div>
          </button>
        ) : (
          /* Active Voice Chat - Docked Floating Control Bar */
          <div className="flex flex-col items-end">
            {/* Expanded Detailed Panel */}
            {isExpanded && (
              <div className="mb-2 w-72 sm:w-84 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Headphones className="w-4 h-4 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Âm Thanh Phòng {roomState.code}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                          WebRTC
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {participants.length} người đang cùng nghe & trò chuyện
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Local Mic State & Equalizer */}
                <div className="my-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="text-lg">{me?.avatar || '🤠'}</span>
                      {isSpeaking && (
                        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-ping"></span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                        <span>{me?.name || 'Bạn'}</span>
                        <span className="text-[10px] text-slate-500">(Tôi)</span>
                        {!hasMic && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                            Chế độ nghe 🎧
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {hasMic && !isMuted ? (
                          <>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-75 ${
                                  isSpeaking ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                style={{ width: `${Math.max(8, volumeLevel)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-emerald-400 font-medium">
                              {isSpeaking ? 'Đang nói...' : 'Mic đang bật'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] text-slate-400">
                            {hasMic ? 'Mic đã tắt' : 'Đang nghe phòng (Chưa bật mic)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={toggleMute}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      !hasMic || isMuted
                        ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                    }`}
                    title={!hasMic || isMuted ? 'Nhấn để bật micro' : 'Nhấn để tắt micro'}
                  >
                    {!hasMic || isMuted ? (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Bật Mic</span>
                      </>
                    ) : (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Tắt Mic</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Voice Participants List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                    <span>THÀNH VIÊN ({participants.length})</span>
                    <button
                      onClick={() => setShowVolumeControls(!showVolumeControls)}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{showVolumeControls ? 'Đóng âm lượng' : 'Chỉnh âm lượng'}</span>
                    </button>
                  </div>

                  {participants.map((p) => {
                    const isRemoteSpeaking = speakingMap[p.playerId] || p.isSpeaking;
                    const isMe = p.playerId === myPlayerId;
                    const peerVol = peerVolumes[p.socketId] ?? 1;

                    return (
                      <div
                        key={p.socketId}
                        className={`flex items-center justify-between p-2 rounded-xl transition ${
                          isRemoteSpeaking
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-slate-950/40 border border-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <span className="text-base">{p.playerAvatar}</span>
                            {isRemoteSpeaking && (
                              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
                              <span>{p.playerName}</span>
                              {isMe && (
                                <span className="text-[9px] text-slate-500 font-normal">(Tôi)</span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 flex items-center gap-1">
                              {p.hasMic === false ? (
                                <span className="text-sky-400 flex items-center gap-0.5">
                                  <Headphones className="w-2.5 h-2.5" /> Đang nghe
                                </span>
                              ) : p.isMuted ? (
                                <span className="text-slate-400 flex items-center gap-0.5">
                                  <MicOff className="w-2.5 h-2.5 text-rose-400" /> Tắt mic
                                </span>
                              ) : isRemoteSpeaking ? (
                                <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Đang nói
                                </span>
                              ) : (
                                <span className="text-emerald-400/80 flex items-center gap-0.5">
                                  <Mic className="w-2.5 h-2.5" /> Sẵn sàng nói
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side status / Volume slider */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {showVolumeControls && !isMe ? (
                            <div className="flex items-center gap-1.5 w-24">
                              <Volume2 className="w-3 h-3 text-slate-500" />
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={peerVol}
                                onChange={(e) =>
                                  setPeerVolume(p.socketId, parseFloat(e.target.value))
                                }
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                          ) : (
                            <div
                              className={`p-1.5 rounded-lg ${
                                p.hasMic === false
                                  ? 'bg-sky-500/10 text-sky-400'
                                  : p.isMuted
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : isRemoteSpeaking
                                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                              title={
                                p.hasMic === false
                                  ? 'Người chơi đang nghe'
                                  : p.isMuted
                                  ? 'Đã tắt mic'
                                  : isRemoteSpeaking
                                  ? 'Đang nói'
                                  : 'Bật mic'
                              }
                            >
                              {p.hasMic === false ? (
                                <Headphones className="w-3.5 h-3.5" />
                              ) : p.isMuted ? (
                                <MicOff className="w-3.5 h-3.5" />
                              ) : (
                                <Mic className="w-3.5 h-3.5" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Tự động kết nối WebRTC P2P</span>
                  </div>

                  <button
                    onClick={leaveVoice}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-semibold transition"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Tạm ngắt</span>
                  </button>
                </div>
              </div>
            )}

            {/* Compact Control Bar */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl shadow-black/50">
              {/* Listen Mode Indicator */}
              <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-900/80 transition"
                title="Kênh âm thanh phòng đang hoạt động. Nhấn để mở danh sách."
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Đang nghe</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[10px]">
                  {participants.length}
                </span>
              </div>

              {/* Mic Mute / Speak Button */}
              <button
                onClick={toggleMute}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                  !hasMic || isMuted
                    ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                    : isSpeaking
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-emerald-500/40 animate-pulse'
                    : 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                }`}
                title={
                  !hasMic || isMuted
                    ? 'Nhấn để bật micro nói chuyện'
                    : 'Nhấn để tắt micro'
                }
              >
                {!hasMic || isMuted ? (
                  <>
                    <MicOff className="w-4 h-4 text-rose-400" />
                    <span className="hidden sm:inline">Bật Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">
                      {isSpeaking ? 'Đang nói...' : 'Mic: Bật'}
                    </span>
                  </>
                )}
              </button>

              {/* Deafen (Tắt / Bật tiếng loa nghe phòng) */}
              <button
                onClick={toggleDeafen}
                className={`p-2 rounded-xl text-xs transition ${
                  isDeafened
                    ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
                }`}
                title={isDeafened ? 'Mở lại âm thanh phòng' : 'Tắt tiếng phòng (Deafen)'}
              >
                {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Participant Count & Expand Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition"
                title="Xem thành viên & chỉnh âm lượng"
              >
                <Users className="w-4 h-4 text-slate-400" />
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
