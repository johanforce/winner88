import React, { useState } from 'react';
import { X, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import { GameRule } from '../types';

interface RuleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRule?: GameRule;
}

export const RuleGuideModal: React.FC<RuleGuideModalProps> = ({
  isOpen,
  onClose,
  defaultRule = 'TIEN_LEN_MIEN_NAM',
}) => {
  const [activeTab, setActiveTab] = useState<GameRule>(defaultRule);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Hướng dẫn luật chơi bài</h2>
          </div>
          <button
            onClick={onClose}
            id="btn-close-rule-modal"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('TIEN_LEN_MIEN_NAM')}
            className={`pb-2.5 px-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'TIEN_LEN_MIEN_NAM'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>♠ Tiến Lên Miền Nam</span>
          </button>
          <button
            onClick={() => setActiveTab('SAM_LOC')}
            className={`pb-2.5 px-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'SAM_LOC'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔥 Sâm Lốc (Xâm)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-300">
          {activeTab === 'TIEN_LEN_MIEN_NAM' ? (
            <>
              <div className="bg-emerald-950/40 border border-emerald-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Thứ tự quân bài & Chất
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; <strong>Độ lớn số:</strong> 3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; <strong>2 (Heo lớn nhất)</strong>.
                  <br />
                  &bull; <strong>Độ lớn chất:</strong> Bích (♠) &lt; Chuồn (♣) &lt; Rô (♦) &lt; Cơ (♥).
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-2">Các bộ bài hợp lệ:</h3>
                <ul className="space-y-1.5 text-xs list-disc pl-5">
                  <li><strong>Rác (Đơn):</strong> 1 lá bài bất kỳ.</li>
                  <li><strong>Đôi:</strong> 2 lá cùng số (so sánh chất lá lớn nhất).</li>
                  <li><strong>Sám cô:</strong> 3 lá cùng số.</li>
                  <li><strong>Sảnh:</strong> Dãy từ 3 lá trở lên liên tiếp (3 đến A, <strong>Heo không được nằm trong sảnh</strong>).</li>
                  <li><strong>Tứ quý:</strong> 4 lá cùng số.</li>
                  <li><strong>3 đôi thông:</strong> 3 đôi có số liên tiếp nhau (vd: đôi 4, đôi 5, đôi 6).</li>
                  <li><strong>4 đôi thông:</strong> 4 đôi có số liên tiếp nhau.</li>
                </ul>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Quy tắc Chặt Hàng & Đè Heo:
                </h3>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li>&bull; <strong>1 con Heo (2)</strong> bị chặt bởi: 3 đôi thông, Tứ quý, hoặc 4 đôi thông.</li>
                  <li>&bull; <strong>Đôi Heo</strong> bị chặt bởi: Tứ quý, 4 đôi thông.</li>
                  <li>&bull; <strong>Tứ quý</strong> bị chặt bởi: Tứ quý lớn hơn, hoặc 4 đôi thông.</li>
                  <li>&bull; <strong>3 đôi thông</strong> bị chặt bởi: 3 đôi thông lớn hơn, Tứ quý, 4 đôi thông.</li>
                  <li>&bull; <strong>4 đôi thông</strong> chặt được mọi thứ và có thể chặt bất cứ lúc nào (không cần chờ tới lượt).</li>
                </ul>
              </div>

              <div className="text-xs text-slate-400">
                &bull; <strong>Ván đầu tiên:</strong> Người giữ lá <strong>3 Bích (3♠)</strong> được đánh trước và bắt buộc phải đánh bài có chứa 3♠.
                <br />
                &bull; <strong>Ván tiếp theo:</strong> Người về Nhất ván trước được quyền đánh trước.
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-950/40 border border-amber-800/40 p-3.5 rounded-xl">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Đặc trưng của Sâm Lốc (10 lá)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  &bull; Mỗi người chơi được chia <strong>10 lá bài</strong>.
                  <br />
                  &bull; <strong>Không phân biệt chất:</strong> Chỉ so sánh độ lớn của số (vd: đôi 7 bất kỳ ăn được đôi 6 bất kỳ, không cần quan tâm cơ/rô/chuồn/bích).
                  <br />
                  &bull; <strong>1 Tứ quý:</strong> Chặt được 1 con Heo (2).
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-2">Giai đoạn Báo Sâm (Xin Sâm):</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Trước khi bắt đầu đánh, mọi người có 10 giây để chọn <strong>&quot;Báo Sâm&quot;</strong>.
                  Nếu báo Sâm thành công và đánh hết bài mà không ai chặn được, bạn nhận thưởng cực lớn! Nhưng nếu bị chặn dù chỉ 1 lượt, bạn phải <strong>Đền Sâm (Đền cả làng)</strong>.
                </p>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                <h3 className="font-bold text-rose-300 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Quy tắc Thối Heo trong Sâm Lốc:
                </h3>
                <p className="text-xs text-slate-300">
                  Quân 2 (Heo) không được đánh về cuối cùng. Nếu bạn đánh quân 2 làm lá cuối cùng để về, bạn sẽ bị phạt tội <strong>&quot;Thối Heo&quot;</strong> và mất điểm!
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition"
          >
            Đã hiểu luật
          </button>
        </div>
      </div>
    </div>
  );
};
