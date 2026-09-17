# Web Game Đánh Bài Online (Tiến Lên Miền Nam & Sâm Lốc)

Ứng dụng web chơi bài online nhiều người chơi (multiplayer realtime) qua WebSocket (Socket.io) với Node.js + Express backend và React (Vite) + Tailwind CSS frontend.

---

## 1. Cấu trúc thư mục dự án

```
├── server/                       # Backend Logic & Realtime Game Engine
│   ├── types.ts                  # Khai báo kiểu dữ liệu (Card, Player, Hand, Room, v.v.)
│   ├── cardUtils.ts              # Xử lý bài (bộ 52 lá, xáo bài Fisher-Yates, so chất/số)
│   ├── rules/
│   │   ├── tienlen.ts            # Engine luật Tiến Lên Miền Nam (bộ bài, chặt heo, 3 bích)
│   │   ├── samloc.ts             # Engine luật Sâm Lốc (10 lá, so số không so chất, Báo Sâm)
│   │   └── index.ts              # Dispatcher luật chơi theo cấu hình phòng
│   ├── gameRoom.ts               # State Machine phòng chơi, timer đếm ngược, chia bài, xử lý lượt
│   ├── roomManager.ts            # Quản lý danh sách phòng, sinh mã phòng 6 ký tự, cleanup phòng rác
│   └── socketHandler.ts          # Bộ lắng nghe sự kiện WebSocket thời gian thực (Socket.io)
├── src/                          # Frontend React UI
│   ├── types.ts                  # Client types
│   ├── socket.ts                 # Socket.io client singleton, lưu session & reconnect token
│   ├── components/
│   │   ├── TrangDatTen.tsx       # Màn hình 1: Nhập tên & chọn avatar đại diện
│   │   ├── Lobby.tsx             # Màn hình 2: Sảnh chọn phòng, tạo phòng, nhập mã phòng
│   │   ├── PhongChoi.tsx         # Màn hình 3: Phòng chờ (4 ghế, đổi chủ phòng, bắt đầu)
│   │   ├── BanChoi.tsx           # Màn hình 4: Bàn chơi (bài trên tay, vòng đánh, đếm giờ, chat)
│   │   ├── CardView.tsx          # Giao diện lá bài với chất, số, hiệu ứng chọn lá nhô lên
│   │   ├── KhungChat.tsx         # Khung trò chuyện realtime với quick-chat câu nói vui
│   │   ├── KetQuaVan.tsx         # Màn hình 5: Bảng kết quả ván đấu, thứ hạng, phạt cóng/thối heo
│   │   └── RuleGuideModal.tsx    # Modal hướng dẫn luật chơi chi tiết cho người mới
│   ├── App.tsx                   # Điều phối màn hình và kết nối socket
│   ├── main.tsx
│   └── index.css                 # Tailwind CSS theme & font Be Vietnam Pro
├── server.ts                     # Entry point server Express + Socket.io + Vite middleware
├── package.json
└── tsconfig.json
```

---

## 2. Hướng dẫn cài đặt & Chạy thử local

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Chạy môi trường phát triển (Dev)
```bash
npm run dev
```
Server và client cùng chạy tại địa chỉ: `http://localhost:3000` (Socket.io chạy cùng port qua HTTP upgrade).

### Bước 3: Build & Chạy Production
```bash
npm run build
npm start
```

---

## 3. Các tính năng nổi bật
- **Không cần đăng ký:** Nhập tên và chọn avatar là vào chơi ngay.
- **2 luật chơi tùy chọn:** Tiến Lên Miền Nam (13 lá, so chất Cơ > Rô > Chuồn > Bích, chặt heo) và Sâm Lốc (10 lá, so số không so chất, giai đoạn Xin Sâm/Báo Sâm).
- **Phòng tối đa 4 người:** Bắt đầu ván khi đủ từ 2 người trở lên.
- **Chuyển quyền chủ phòng:** Host có thể chủ động chuyển host hoặc hệ thống tự chuyển nếu host rời phòng.
- **Cơ chế Reconnect 60s:** Khi bị rớt mạng hoặc refresh trình duyệt, hệ thống tự động nhận diện `playerId` và `reconnectToken` để phục hồi đúng ghế và bài trên tay.
- **Server-Authoritative:** Toàn bộ việc kiểm tra nước đi, chặt bài, đếm giờ (25s) và tính điểm đều chạy trên server, chống gian lận client.
