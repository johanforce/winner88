import React, { useState } from 'react';
import {
  X,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Coins,
  Flame,
  ShieldAlert,
  Award,
  Clock,
} from 'lucide-react';
import { GameRule } from '../types';

type ModalTab = GameRule | 'PENALTY_RATES';

interface RuleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRule?: GameRule;
  initialRule?: GameRule;
}

export const RuleGuideModal: React.FC<RuleGuideModalProps> = ({
  isOpen,
  onClose,
  defaultRule,
  initialRule,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialRule || defaultRule || 'TIEN_LEN_MIEN_NAM');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-white truncate">Luật Chơi & Mức Phạt</h2>
          </div>
          <button
            onClick={onClose}
            id="btn-close-rule-modal"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-3 sm:px-6 pt-2.5 sm:pt-3 gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] touch-pan-x">
          <button
            onClick={() => setActiveTab('TIEN_LEN_MIEN_NAM')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'TIEN_LEN_MIEN_NAM'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>♠ Tiến Lên</span>
          </button>
          <button
            onClick={() => setActiveTab('SAM_LOC')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'SAM_LOC'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔥 Sâm Lốc</span>
          </button>
          <button
            onClick={() => setActiveTab('CO_TUONG')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'CO_TUONG'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🏆 Cờ Tướng</span>
          </button>
          <button
            onClick={() => setActiveTab('CARO')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'CARO'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>❌⭕ Cờ Caro</span>
          </button>
          <button
            onClick={() => setActiveTab('BAN_TAU')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'BAN_TAU'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🚢 Bắn Tàu</span>
          </button>
          <button
            onClick={() => setActiveTab('CO_CA_NGUA')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'CO_CA_NGUA'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎲 Cờ Cá Ngựa</span>
          </button>
          <button
            onClick={() => setActiveTab('CO_VUA')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'CO_VUA'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>♟️ Cờ Vua (AI)</span>
          </button>
          <button
            onClick={() => setActiveTab('PENALTY_RATES')}
            className={`pb-2.5 px-2.5 sm:px-3 font-semibold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer touch-manipulation ${
              activeTab === 'PENALTY_RATES'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>💰 Mức Phạt & Xu</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-300">
          {activeTab === 'TIEN_LEN_MIEN_NAM' ? (
            <>
              {/* Thứ tự quân bài */}
              <div className="bg-emerald-950/40 border border-emerald-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Thứ tự quân bài & Chất
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Độ lớn số:</strong> 3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; <strong>2 (Heo lớn nhất)</strong>.
                  <br />
                  &bull; <strong>Độ lớn chất:</strong> Bích (♠) &lt; Tép (♣) &lt; Rô (♦) &lt; Cơ (♥).
                </p>
              </div>

              {/* Các bộ bài hợp lệ */}
              <div>
                <h3 className="font-bold text-white mb-2">Các bộ bài hợp lệ:</h3>
                <ul className="space-y-1.5 text-xs list-disc pl-5">
                  <li><strong>Lá đơn:</strong> 1 lá bài đơn lẻ (gọi theo số và chất: 7 Rô, 10 Tép, A Cơ, 3 Bích...).</li>
                  <li><strong>Đôi:</strong> 2 lá cùng số (so sánh chất lá lớn nhất).</li>
                  <li><strong>Sám cô:</strong> 3 lá cùng số.</li>
                  <li><strong>Sảnh:</strong> Dãy từ 3 lá trở lên liên tiếp (3 đến A, <strong>Heo không được nằm trong sảnh</strong>).</li>
                  <li><strong>Tứ quý:</strong> 4 lá cùng số.</li>
                  <li><strong>3 đôi thông:</strong> 3 đôi có số liên tiếp nhau (vd: đôi 4, đôi 5, đôi 6).</li>
                  <li><strong>4 đôi thông:</strong> 4 đôi có số liên tiếp nhau.</li>
                </ul>
              </div>

              {/* Quy tắc chặt hàng */}
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Quy tắc Chặt Hàng & Đè Heo:
                </h3>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li>&bull; <strong>1 con Heo (2):</strong> Bị chặt bởi 3 đôi thông, Tứ quý, hoặc 4 đôi thông.</li>
                  <li>&bull; <strong>Đôi Heo:</strong> Bị chặt bởi Tứ quý, 4 đôi thông.</li>
                  <li>&bull; <strong>Tứ quý:</strong> Bị chặt bởi Tứ quý lớn hơn, hoặc 4 đôi thông.</li>
                  <li>&bull; <strong>3 đôi thông:</strong> Bị chặt bởi 3 đôi thông lớn hơn, Tứ quý, 4 đôi thông.</li>
                  <li>&bull; <strong>4 đôi thông:</strong> Chặt được 1 heo, đôi heo, 3 đôi thông, tứ quý, 4 đôi thông nhỏ hơn; có thể chặt bất cứ lúc nào (không cần chờ tới lượt).</li>
                </ul>
              </div>

              {/* QUY TẮC PHẠT & TÍNH ĐIỂM TIẾN LÊN MIỀN NAM */}
              <div className="bg-rose-950/30 border border-rose-800/50 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Quy định Phạt & Tính Tiền Xu:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-300 block mb-0.5">🥇 Về Nhất Ăn Tất:</span>
                    <span className="text-slate-300">
                      Người hết bài đầu tiên về Nhất, ván đấu kết thúc ngay lập tức. Người Nhất nhận trọn vẹn toàn bộ số tiền phạt từ tất cả người thua.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-300 block mb-0.5">🃏 Đếm Lá Phạt:</span>
                    <span className="text-slate-300">
                      Mỗi lá bài còn lại trên tay người thua bị phạt <strong className="text-amber-400">10 xu</strong> (tối thiểu 10 xu).
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-cyan-300 block mb-0.5">❄️ Phạt Cóng (Cháy bài):</span>
                    <span className="text-slate-300">
                      Người chơi chưa đánh ra được lá nào (còn đủ 13 lá) bị xử phạt Cóng: trừ 130 xu đếm lá + phạt thêm <strong className="text-cyan-400">50 xu</strong>.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-emerald-300 block mb-0.5">🐗 Thối Heo:</span>
                    <span className="text-slate-300">
                      &bull; Thối Heo Đen (♠, ♣): Phạt <strong className="text-amber-400">30 xu</strong> / con.<br />
                      &bull; Thối Heo Đỏ (♦, ♥): Phạt <strong className="text-rose-400">60 xu</strong> / con.
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                &bull; <strong>Ván đầu tiên:</strong> Người giữ lá <strong>3 Bích (3♠)</strong> được đánh trước và bắt buộc phải đánh bài có chứa 3♠. Nếu bàn chơi 2–3 người mà lá 3♠ không được chia (nằm trong phần bài thừa), người giữ lá bài nhỏ nhất trên bàn sẽ được quyền đi trước và đánh bài tự do.
                <br />
                &bull; <strong>Ván tiếp theo:</strong> Người về Nhất ván trước được quyền đánh trước.
              </div>
            </>
          ) : activeTab === 'SAM_LOC' ? (
            <>
              {/* Đặc trưng Sâm Lốc */}
              <div className="bg-amber-950/40 border border-amber-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Đặc trưng của Sâm Lốc (10 lá)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; Mỗi người chơi được chia <strong>10 lá bài</strong>.
                  <br />
                  &bull; <strong>Không phân biệt chất:</strong> Chỉ so sánh độ lớn của số (vd: đôi 7 bất kỳ ăn được đôi 6 bất kỳ, sảnh 5-6-7 bất kỳ ăn được sảnh 4-5-6 bất kỳ).
                  <br />
                  &bull; <strong>1 Tứ quý:</strong> Chặt được 1 con Heo (2).
                </p>
              </div>

              {/* Báo Sâm */}
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" /> Giai đoạn Báo Sâm (Xin Sâm):
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Trước khi bắt đầu đánh, mỗi người có 10 giây để chọn <strong>&quot;Báo Sâm&quot;</strong>.
                  Người báo Sâm được ưu tiên đánh trước. Nếu đánh hết 10 lá mà không ai chặn được thì thắng Sâm; nếu bị bất kỳ ai chặn dù chỉ 1 lượt thì bị coi là đền Sâm!
                </p>
              </div>

              {/* QUY TẮC PHẠT & TÍNH TIỀN SÂM LỐC */}
              <div className="bg-rose-950/30 border border-rose-800/50 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Quy định Phạt & Tính Điểm Sâm Lốc:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-300 block mb-0.5">👑 Thắng Báo Sâm:</span>
                    <span className="text-slate-300">
                      Báo Sâm thành công: mỗi người chơi khác trong phòng phải đền <strong className="text-amber-400">200 xu</strong> cho người báo Sâm.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-300 block mb-0.5">💥 Đền Sâm (Báo Thất Bại):</span>
                    <span className="text-slate-300">
                      Nếu người báo Sâm bị người khác chặn bài, phải đền <strong className="text-rose-400">200 xu &times; (số người chơi - 1)</strong> cho cả làng.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-yellow-300 block mb-0.5">🃏 Đếm Lá Về Nhất:</span>
                    <span className="text-slate-300">
                      Khi có người hết bài, ván kết thúc. Người thua bị phạt <strong className="text-amber-400">10 xu</strong> cho mỗi lá còn trên tay. Người Nhất nhận trọn tiền phạt.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-cyan-300 block mb-0.5">❄️ Phạt Cóng (Cháy):</span>
                    <span className="text-slate-300">
                      Còn nguyên 10 lá chưa ra được lá nào: trừ 100 xu đếm lá + phạt thêm <strong className="text-cyan-400">50 xu</strong> cóng.
                    </span>
                  </div>
                </div>
              </div>

              {/* Thối Heo trong Sâm Lốc */}
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-rose-300 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Cấm Đánh Heo Về Chót (Thối Heo):
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Trong Sâm Lốc, quân 2 (Heo) <strong>không được đánh làm lá bài cuối cùng để về Nhất</strong>.
                  Nếu bạn đánh quân 2 cuối cùng hoặc còn giữ Heo khi người khác hết bài, bạn sẽ bị phạt tội <strong>&quot;Thối Heo&quot;</strong> (Heo đen: 30 xu, Heo đỏ: 60 xu).
                </p>
              </div>
            </>
          ) : activeTab === 'CO_TUONG' ? (
            /* TAB CO_TUONG: LUẬT CỜ TƯỚNG TIÊU CHUẨN & CỜ CHỚP */
            <>
              <div className="bg-amber-950/40 border border-amber-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" /> Thể Thức Thi Đấu &amp; Cách Tính Thời Gian Quốc Tế
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>2 Kỳ thủ thi đấu:</strong> Kỳ thủ Đỏ (ghế 1 - đi trước 🔴) và Kỳ thủ Đen (ghế 2 - đi sau ⚫).<br />
                  &bull; <strong>2 Slot theo dõi:</strong> Ghế 3 và Ghế 4 dành cho khán giả vào xem trận đấu và trò chuyện thời gian thực.<br />
                  &bull; <strong>Chủ phòng tùy chọn thể thức:</strong> Chủ phòng có thể thiết lập thể thức thi đấu ngay tại phòng chờ trước khi bắt đầu:<br />
                  &nbsp;&nbsp;+ <strong>🏆 Cờ Tiêu Chuẩn Quốc Tế:</strong> Mỗi bên có <strong>60 phút</strong> chính và được <strong>cộng thêm 30 giây</strong> sau mỗi nước đi hợp lệ (theo chuẩn thi đấu Liên Đoàn Cờ Tướng Thế Giới WXF).<br />
                  &nbsp;&nbsp;+ <strong>⚡ Cờ Chớp (Blitz):</strong> Mỗi bên có <strong>5 phút (300 giây)</strong> và được <strong>cộng thêm 3 giây</strong> sau mỗi nước đi.<br />
                  &bull; <strong>Xử thua hết giờ (Timeout):</strong> Nếu đồng hồ của một bên chạm mốc 00:00:00 mà chưa hoàn tất nước đi, bên đó lập tức bị xử thua!
                </p>
              </div>

              <div className="bg-stone-900 border border-stone-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Quy Tắc Di Chuyển Của 7 Loại Quân
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-red-400">Tướng (帥 / 將):</strong> Di chuyển từng ô một theo chiều ngang/dọc bên trong Cửu Cung (ô 3x3). Hai tướng không được nhìn thấy nhau trên cùng cột (Lộ mặt tướng).
                  </div>
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-amber-400">Sĩ (仕 / 士):</strong> Đi chéo 1 ô mỗi nước, luôn hoạt động bên trong Cửu Cung để hộ vệ tướng.
                  </div>
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-cyan-400">Tượng (相 / 象):</strong> Đi chéo 2 ô (hình chữ điền), không được qua sông. Bị cản nếu có quân nằm ở giữa mắt tượng.
                  </div>
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-emerald-400">Mã (傌 / 馬):</strong> Đi theo hình chữ nhật 1x2 (chữ L). Bị cản chân mã nếu có quân nằm ngay trước hướng xuất phát.
                  </div>
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-yellow-400">Xe (俥 / 車):</strong> Đi ngang hoặc dọc không giới hạn khoảng cách, uy lực cơ động mạnh nhất.
                  </div>
                  <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-purple-400">Pháo (炮 / 砲):</strong> Đi ngang dọc như Xe, nhưng khi ăn quân đối phương thì bắt buộc phải có đúng 1 quân bất kỳ làm ngòi (nhảy qua ngòi).
                  </div>
                </div>
                <div className="bg-stone-950/50 p-2.5 rounded-lg border border-stone-800 text-xs">
                  <strong className="text-rose-400">Binh / Tốt (兵 / 卒):</strong> Chưa qua sông chỉ đi thẳng 1 bước; sau khi qua sông có thể đi thẳng hoặc đi ngang 1 bước. Không bao giờ được đi lùi!
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" /> Thắng Thua, Hòa Cờ & Tiền Thưởng Xu
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Chiếu bí / Hết nước đi:</strong> Kỳ thủ đối phương bị chiếu mà không còn đường đỡ, hoặc không còn nước đi hợp lệ &rarr; Thắng trận (+100 xu).<br />
                  &bull; <strong>Hết giờ (Timeout):</strong> Kim đồng hồ về 0 &rarr; Xử thua ngay lập tức (-100 xu).<br />
                  &bull; <strong>Đầu hàng:</strong> Có thể xin đầu hàng bất kỳ lúc nào nếu cảm thấy thế cờ không thể cứu vãn.<br />
                  &bull; <strong>Xin hòa cờ:</strong> Kỳ thủ có thể bấm &quot;Xin hòa&quot;. Nếu đối phương đồng ý, trận đấu kết thúc với kết quả hòa (không trừ xu).
                </p>
              </div>
            </>
          ) : activeTab === 'CARO' ? (
            /* TAB CARO: LUẬT CỜ CARO (20x20 GIAO ĐIỂM, 5 PHÚT TỔNG, ĂN 5 CHẶN 2 ĐẦU WIN) */
            <>
              <div className="bg-cyan-950/40 border border-cyan-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-cyan-400" /> Bàn Cờ 20x20 &amp; Vị Trí Quân Cờ
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Vị trí đặt quân:</strong> Quân cờ được đặt trực tiếp trên <strong>các giao điểm của các đường thẳng</strong>, các ô tạo bởi các đường kẻ là <strong>hình vuông</strong> chuẩn.<br />
                  &bull; <strong>Kích thước bàn cờ:</strong> Lưới gồm <strong>20x20</strong> giao điểm (tương ứng các cột A - T và các hàng 1 - 20).<br />
                  &bull; <strong>Quy định viền ngoài:</strong> <strong>KHÔNG ĐƯỢC ĐÁNH VÀO VIỀN NGOÀI</strong> bàn cờ (hàng ngoài cùng 1, 20 và cột ngoài cùng A, T là đường biên giới hạn).<br />
                  &bull; <strong>Không có tính năng xin đi lại:</strong> Mỗi nước cờ đã đặt xuống là quyết định cuối cùng, không thể rút lại.
                </p>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Luật Ăn 5 Chặn 2 Đầu Vẫn Thắng
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Điều kiện chiến thắng:</strong> Người chơi tạo thành một chuỗi gồm từ <strong>5 quân cờ liên tiếp</strong> trở lên (theo chiều ngang, dọc hoặc 2 đường chéo) sẽ <strong>GIÀNH CHIẾN THẮNG NGAY LẬP TỨC</strong>.<br />
                  &bull; <strong>Chặn 2 đầu:</strong> Kể cả khi chuỗi 5 quân bị đối phương chặn ở một đầu hay <strong>bị chặn ở CẢ HAI ĐẦU</strong> thì người tạo đủ 5 quân <strong>VẪN ĐƯỢC TÍNH LÀ THẮNG</strong>!
                </p>
              </div>

              <div className="bg-amber-950/40 border border-amber-800/40 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" /> Tổng Thời Gian Thi Đấu: 5 Phút / Người Chơi
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Không giới hạn thời gian từng nước đi:</strong> Bạn có thể suy nghĩ nhanh hay chậm tùy ý trong từng nước cờ.<br />
                  &bull; <strong>Tổng quỹ thời gian 5 phút:</strong> Mỗi người chơi có <strong>tổng thời gian là 5 phút (300 giây)</strong> cho toàn bộ ván đấu. Đồng hồ của bạn chỉ đếm ngược khi đang tới lượt của bạn.<br />
                  &bull; <strong>Quy tắc phân định thắng thua:</strong><br />
                  &nbsp;&nbsp;+ Nếu thắng (ăn 5) trong vòng 5 phút: <strong>Tính THẮNG ngay lập tức</strong>.<br />
                  &nbsp;&nbsp;+ Nếu trong 5 phút mà chưa ai thắng: <strong>Ai hết 5 phút trước sẽ là NGƯỜI THUA</strong>, người còn thời gian sẽ giành chiến thắng (+100 xu).
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Lượt Đi &amp; Các Tính Năng
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li><strong>Quân X (Ghế 1):</strong> Luôn là bên được quyền đánh trước nước đầu tiên.</li>
                  <li><strong>Quân O (Ghế 2):</strong> Đánh sau quân X.</li>
                  <li><strong>Không có xin đi lại:</strong> Đảm bảo tính công bằng và nghiêm túc trong thi đấu.</li>
                  <li><strong>Xin hòa:</strong> Bạn có thể gửi đề nghị hòa cờ bất kỳ lúc nào. Nếu đối phương bấm Đồng ý thì ván cờ hòa.</li>
                  <li><strong>Đầu hàng (Xin thua):</strong> Chủ động nhận thua nếu thấy đối thủ đang nắm thế cờ áp đảo.</li>
                  <li><strong>Hiển thị số nước đi:</strong> Bấm nút <strong>123</strong> trên góc phải để xem số thứ tự từng nước cờ.</li>
                  <li><strong>Khán giả theo dõi:</strong> Bạn bè có thể vào phòng xem trực tiếp và đàm thoại Voice Chat thời gian thực.</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'BAN_TAU' ? (
            <>
              {/* 1. Hạm đội và Lưới Tọa Độ */}
              <div className="bg-blue-950/40 border border-blue-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-blue-300 text-xs flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-4 h-4 text-blue-400" /> 1. Hạm Đội & Lưới Tọa Độ (10x10)
                </h3>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                  <li>Bản đồ hải chiến là một lưới 10&times;10 ô vuông (Cột A–J, Hàng 1–10).</li>
                  <li>Mỗi Thuyền trưởng sở hữu <strong>5 chiến hạm</strong>:
                    <ul className="list-circle pl-5 mt-1 space-y-0.5 font-mono text-[11px] text-cyan-300">
                      <li>Tàu sân bay (Aircraft Carrier): Chiếm 5 ô</li>
                      <li>Thiết giáp hạm (Battleship): Chiếm 4 ô</li>
                      <li>Tàu tuần dương (Cruiser): Chiếm 3 ô</li>
                      <li>Tàu ngầm (Submarine): Chiếm 3 ô</li>
                      <li>Tàu khu trục (Destroyer): Chiếm 2 ô</li>
                    </ul>
                  </li>
                  <li>Phòng chơi hỗ trợ <strong>2 Thuyền trưởng thi đấu</strong> và <strong>tối đa 6 khán giả theo dõi</strong>.</li>
                </ul>
              </div>

              {/* 2. Giai đoạn bố trí tàu */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> 2. Giai Đoạn Bố Trí Tàu (Placement Phase)
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Tàu có thể được bố trí theo chiều <strong>Ngang</strong> hoặc <strong>Dọc</strong>.</li>
                  <li>Các tàu không được xếp đè lên nhau hoặc vượt ra ngoài ranh giới lưới 10&times;10.</li>
                  <li>Bạn có thể bấm <strong>"Bố trí ngẫu nhiên"</strong> để hệ thống tự động dàn trận hạm đội tức thì.</li>
                  <li>Sau khi đã hài lòng với đội hình bí mật, bấm <strong>"Sẵn sàng chiến đấu"</strong>. Khi cả 2 bên cùng sẵn sàng, hải chiến chính thức bắt đầu!</li>
                </ul>
              </div>

              {/* 3. Giai đoạn hải chiến */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" /> 3. Giai Đoạn Khai Hỏa (Battle Phase)
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Hai bên luân phiên nhau chọn 1 ô trên lưới biển của đối phương để khai hỏa.</li>
                  <li><strong>Bắn Trúng (💥 HIT):</strong> Đạn trúng vào thân tàu đối phương. Ô đổi sang màu đỏ rực kèm hiệu ứng nổ. Thuyền trưởng bắn trúng sẽ được bắn tiếp 1 phát nữa!</li>
                  <li><strong>Bắn Trượt (💦 MISS):</strong> Đạn rơi xuống biển nước. Ô đổi sang màu xám/bọt biển, lượt bắn chuyển sang cho đối thủ.</li>
                  <li><strong>Đánh Chìm (SUNK):</strong> Khi toàn bộ các ô của một con tàu bị bắn trúng, tàu đó sẽ chính thức bị đánh chìm xuống đáy đại dương!</li>
                </ul>
              </div>

              {/* 4. Điều kiện chiến thắng */}
              <div className="bg-amber-950/30 border border-amber-800/40 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" /> 4. Điều Kiện Thắng / Thua
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Bên nào <strong>bắn chìm toàn bộ 5 chiến hạm (tổng 17 ô)</strong> của đối phương trước sẽ giành chiến thắng tuyệt đối!</li>
                  <li>Người thắng nhận được 50 xu thưởng, người thua bị trừ 50 xu.</li>
                  <li>Kết thúc trận, toàn bộ vị trí chiến hạm của cả 2 bên sẽ được công khai minh bạch trên bàn đấu.</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'CO_CA_NGUA' ? (
            <>
              {/* 1. Giới thiệu & Số lượng người chơi */}
              <div className="bg-purple-950/40 border border-purple-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-purple-300 text-xs flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-4 h-4 text-purple-400" /> 1. Bàn Cờ & Người Tham Gia
                </h3>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                  <li>Hỗ trợ <strong>từ 2 đến 4 kỳ thủ đua ngựa</strong> tương ứng 4 màu: <strong>Đỏ, Xanh Dương, Vàng, Xanh Lá</strong>.</li>
                  <li>Mỗi người chơi chỉ huy <strong>4 chú ngựa</strong> xuất phát từ chuồng cùng màu.</li>
                  <li>Đường đua chung gồm <strong>56 ô liên hoàn</strong> chạy theo chiều kim đồng hồ quanh bàn cờ.</li>
                  <li>Hỗ trợ thêm <strong>4 vị trí Khán giả</strong> để bạn bè cùng vào theo dõi cổ vũ.</li>
                </ul>
              </div>

              {/* 2. Gieo xúc xắc & Xuất chuồng */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> 2. Đổ Xúc Xắc &amp; Xuất Chuồng
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Mỗi lượt, người chơi bấm nút <strong>Gieo Xúc Xắc (1-6)</strong>.</li>
                  <li><strong>Xuất Chuồng:</strong> Khi gieo được mặt <strong>1</strong> hoặc <strong>6</strong>, bạn có thể đưa một chú ngựa từ trong chuồng ra ô xuất phát (cửa chuồng màu mình).</li>
                  <li><strong>Thưởng thêm lượt:</strong> Gieo được <strong>1</strong> hoặc <strong>6</strong> sẽ nhận ngay thêm <strong>1 lượt gieo tiếp</strong>!</li>
                </ul>
              </div>

              {/* 3. Di chuyển & Đá ngựa */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" /> 3. Di Chuyển &amp; Đá Ngựa Đối Phương
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Ngựa trên đường đua tiến tới đúng số bước bằng số chấm xúc xắc vừa gieo.</li>
                  <li><strong>Đá ngựa (K.O):</strong> Nếu điểm đáp trùng đúng ô mà ngựa của đối phương đang đứng, chú ngựa đó sẽ bị <strong>ĐÁ văng về chuồng</strong>!</li>
                  <li><strong>Thưởng khi đá ngựa:</strong> Khi đá thành công ngựa đối phương, bạn được <strong>thưởng thêm 1 lượt gieo xúc xắc</strong>.</li>
                </ul>
              </div>

              {/* 4. Lên thang chuồng & Về đích */}
              <div className="bg-amber-950/30 border border-amber-800/40 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" /> 4. Lên Thang Chuồng &amp; Chiến Thắng
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Sau khi hoàn thành 1 vòng 56 ô, ngựa sẽ tiến vào <strong>thang chuồng (bậc 1 đến bậc 6)</strong> màu của mình.</li>
                  <li>Ngựa phải tiến lần lượt từng bậc hoặc gieo đúng số bậc cần nhảy. Khi lên tới <strong>bậc 6</strong>, ngựa hoàn thành về đích!</li>
                  <li>Người chơi nào đưa được <strong>toàn bộ 4 chú ngựa về chuồng</strong> trước sẽ giành <strong>chiến thắng ván đấu</strong>!</li>
                </ul>
              </div>
            </>
          ) : activeTab === 'CO_VUA' ? (
            /* TAB: CỜ VUA (CHESS) */
            <>
              {/* 1. Tổng quan & Thời gian */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" /> 1. Quy Mô &amp; Thời Gian Thi Đấu
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li><strong>Quy mô phòng:</strong> Tối đa <strong>6 người</strong> (2 kỳ thủ: Trắng đi trước, Đen đi sau + 4 Khán giả theo dõi).</li>
                  <li><strong>Thời gian:</strong> Mỗi bên có <strong>10 phút</strong> suy nghĩ trong toàn bộ ván cờ. Hết giờ trước sẽ bị xử <strong>thua theo thời gian (Time Out)</strong>.</li>
                  <li>Bàn cờ kích thước tiêu chuẩn 8x8 với 64 ô màu đen trắng xen kẽ.</li>
                </ul>
              </div>

              {/* 2. Nước đi đặc biệt */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> 2. Các Nước Đi Đặc Biệt Chuẩn FIDE
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li><strong>Nhập Thành (Castling):</strong> Di chuyển Vua 2 ô về phía Xe (gần hoặc xa) khi giữa Vua và Xe không có quân cản, cả hai chưa từng di chuyển và các ô Vua đi qua không bị đối phương kiểm soát/chiếu.</li>
                  <li><strong>Bắt Tốt Qua Đường (En Passant):</strong> Khi Tốt đối phương nhảy 2 ô ở nước đi đầu tiên và đáp cạnh Tốt của bạn, bạn có thể ăn chéo về ô sau lưng Tốt đối phương ngay lượt đi tiếp theo.</li>
                  <li><strong>Phong Cấp (Pawn Promotion):</strong> Khi Tốt tiến tới hàng cuối cùng (hàng 8 với Trắng, hàng 1 với Đen), bạn có thể phong cấp ngay thành <strong>Hậu (Queen), Xe (Rook), Tượng (Bishop), hoặc Mã (Knight)</strong>.</li>
                </ul>
              </div>

              {/* 3. Chiếu, Chiếu Bí & Hòa */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" /> 3. Chiếu Vua, Chiếu Bí &amp; Cầu Hòa
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li><strong>Chiếu &amp; Chiếu Bí (Check &amp; Checkmate):</strong> Khi Vua bị tấn công và không còn nước đi hợp lệ nào để thoát chiếu, bên đó bị xử <strong>Chiếu bí (Thua cuộc)</strong>.</li>
                  <li><strong>Hòa Cờ (Draw):</strong> Xảy ra khi: Hết nước đi hợp lệ nhưng Vua không bị chiếu (Stalemate), lặp lại thế cờ 3 lần (Threefold repetition), thiếu quân chiếu bí (Insufficient material), hoặc hai kỳ thủ đồng ý cầu hòa.</li>
                </ul>
              </div>

              {/* 4. Khán Giả & Bình Luận Viên */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <h3 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" /> 4. Chế Độ Khán Giả &amp; Bình Luận Trực Tiếp
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>Khán giả trong phòng có thể theo dõi ván đấu thời gian thực từ mọi góc nhìn (xoay bàn cờ tùy ý).</li>
                  <li>Trong suốt trận đấu, hệ thống phân tích thế cờ theo góc nhìn Grandmaster chuyên nghiệp (khai cuộc, đòn chiến thuật, đánh giá lợi thế, nước cờ then chốt).</li>
                  <li><strong>Lưu ý:</strong> Các bản tin phân tích chuyên môn này chỉ hiển thị riêng trong khung chat cho Khán giả, 2 kỳ thủ đang thi đấu không xem được để đảm bảo tính công bằng và tập trung cao độ.</li>
                </ul>
              </div>
            </>
          ) : (
            /* TAB 3: BẢNG TỔNG HỢP MỨC PHẠT */
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">
                    Bảng Tra Cứu Mức Phạt & Thưởng Xu Chi Tiết
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Áp dụng tự động trong từng ván đấu. Xu được cộng/trừ trực tiếp vào ví người chơi và lưu lại khi chơi tiếp.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/60">
                        <th className="py-2.5 px-3 font-semibold">Tình huống / Hành vi</th>
                        <th className="py-2.5 px-3 font-semibold">Tiến Lên Miền Nam</th>
                        <th className="py-2.5 px-3 font-semibold">Sâm Lốc</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Quy định</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>🃏</span> Đếm lá thua
                        </td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">-10 xu / lá</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">-10 xu / lá</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Tối thiểu 10 xu</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>❄️</span> Phạt Cóng (Cháy bài)
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400 font-bold">Thêm -50 xu</td>
                        <td className="py-2.5 px-3 text-cyan-400 font-bold">Thêm -50 xu</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Chưa ra được lá nào</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>🐗</span> Thối Heo Đen (♠, ♣)
                        </td>
                        <td className="py-2.5 px-3 text-amber-400 font-bold">-30 xu / con</td>
                        <td className="py-2.5 px-3 text-amber-400 font-bold">-30 xu / con</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Còn trên tay khi hết ván</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>🐗</span> Thối Heo Đỏ (♦, ♥)
                        </td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">-60 xu / con</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">-60 xu / con</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Còn trên tay khi hết ván</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>🚫</span> Đánh Heo về chót
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">Được phép</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">Bị Thối Heo</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Cấm về bằng Heo ở Sâm</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>👑</span> Thắng Báo Sâm
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">Không có</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">+200 xu / người</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Ăn từ mỗi người khác</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white flex items-center gap-1.5">
                          <span>💥</span> Đền Sâm (Bị chặn)
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">Không có</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">-200 xu &times; người</td>
                        <td className="py-2.5 px-3 text-slate-400 text-right">Đền cho cả bàn</td>
                      </tr>
                      <tr className="bg-amber-950/20">
                        <td className="py-2.5 px-3 font-bold text-amber-300 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" /> Người về Nhất
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-extrabold" colSpan={2}>
                          Nhận 100% tổng tiền phạt từ tất cả người thua trong bàn
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold text-right">Nhất Ăn Tất</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-800/40 p-3.5 rounded-xl text-xs text-slate-300">
                <span className="font-bold text-emerald-300 block mb-1">💡 Mẹo chơi an toàn:</span>
                &bull; Khi thấy đối thủ gần hết bài (chỉ còn 1 - 2 lá), hãy ưu tiên tẩu tán các lá Heo và hàng để tránh bị dính án phạt <strong>Thối Heo</strong> đắt đỏ.<br />
                &bull; Đừng ngần ngại phá bài để ra được ít nhất 1 lá nhằm tránh bị <strong>Phạt Cóng (+50 xu)</strong>!
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
          <div className="text-xs text-slate-400 hidden sm:block">
            Số xu khởi tạo: <span className="text-amber-400 font-bold">1.000 xu</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition"
          >
            Đã hiểu luật & mức phạt
          </button>
        </div>
      </div>
    </div>
  );
};

