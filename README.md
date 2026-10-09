# Virtual Drum Pro 🥁
> **Hệ thống Chơi Trống Ảo Tương Tác Cử Chỉ Bàn Tay (Webcam AI) & Phòng Jam Nhạc Trực Tuyến Đa Người Dùng**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks--Vision-0097A7?logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Synthesizer-FF5722)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Voice%2FVideo-333333?logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

---

## 📖 Giới thiệu Dự Án

**Virtual Drum Pro** là ứng dụng âm nhạc tương tác thế hệ mới hoạt động trực tiếp trên nền tảng web, cho phép người dùng chơi trống tự nhiên trong không gian thông qua **Webcam nhận diện cử chỉ ngón tay AI (Air Drumming)** mà không cần dùi trống hay thiết bị ngoại vi đắt tiền.

Ngoài tính năng chơi trống cá nhân, ứng dụng tích hợp một **Phòng Jam Nhạc Trực Tuyến (Live Room Studio)** cho phép nhiều người chơi cùng kết nối đàm thoại giọng nói (Voice Chat), truyền hình ảnh Video, chia sẻ màn hình và gõ trống đồng bộ thời gian thực thông qua công nghệ **WebRTC Mesh & Server SSE Relay**.

---

## 🌟 Tính Năng Nổi Bật

### 1. 🤖 Nhận Diện Cử Chỉ Bàn Tay AI Thời Gian Thực (MediaPipe Hand Tracking)
- Tích hợp mô hình thị giác máy tính `@mediapipe/tasks-vision` chạy WebAssembly trực tiếp trên GPU/RAM máy khách.
- Theo dõi độc lập đầu ngón trỏ (Landmark #8) của cả 2 tay (Trái & Phải) với tần số lấy mẫu lên đến **60 FPS**.
- **Tính toán lực đánh Velocity (%):** Phân tích gia tốc chuyển động ngón tay theo trục Y để điều tiết âm lượng to/nhỏ chân thực như trống cơ thật.
- **Khử rung & chống nổ tiếng (Debouncing):** Tự động phát hiện quỹ đạo đảo chiều để mỗi cú gõ chỉ tạo ra duy nhất một nốt chuẩn xác.

### 2. 🎛️ Bộ Tổng Hợp Âm Thanh Độc Lập (Web Audio API Synthesizer)
- Tự động tổng hợp âm thanh bằng toán học và bộ lọc tần số, **không phụ thuộc file âm thanh mp3/wav mẫu bên ngoài**, độ trễ dưới 10ms:
  - 🥁 **Acoustic Studio Kit:** Âm thanh trống gỗ tự nhiên, tiếng cymbal kim loại ngân vang.
  - 🎛️ **808 Electronic Hip-hop:** Tiếng Kick Sub-bass sâu chắc, Snare đanh và Hi-Hat ngắt tiếng sắc bén.
  - ⚡ **Hard Rock Kit:** Âm hưởng uy lực, nén dynamic compression bùng nổ.

### 3. 🎯 Chế Độ Chơi Tự Do & Bàn Thu Vòng Lặp (Free Play & Live Looper)
- **Kéo thả tùy biến bố cục mặt trống:** Dễ dàng kéo di chuyển vị trí và co giãn kích thước từng mặt trống phù hợp với góc đặt camera và sải tay.
- **Máy thu vòng lặp đa tầng (Multi-layer Looper):** Hỗ trợ Record, Overdub (thu đè nhiều lớp nhạc cụ), Loop Mode phát lặp vô tận và Trim tự động cắt khoảng lặng thừa.
- **Đếm Combo & Tốc độ phát:** Theo dõi chuỗi gõ đúng nhịp, tùy chỉnh tốc độ phát lại `0.75x`, `1x`, `1.25x`.

### 4. 🎮 Chế Độ Thử Thách Nhịp Điệu (Rhythm Challenge Game)
- Băng chuyền nốt nhạc ngang (Rhythm Conveyor) và đại lộ nốt rơi dọc (Beat Highway) chạy theo nhịp bài hát.
- Chấm điểm chính xác từng mili-giây: **PERFECT** (<60ms), **GOOD** (<130ms), **MISS**.
- Đánh giá sao, xếp hạng Rank (`S`, `A`, `B`, `C`, `D`), pháo hoa chúc mừng và nhận xét chuyên môn.

### 5. 🏆 Bảng Xếp Hạng Trực Tuyến Toàn Cầu (Global Leaderboard)
- Lọc thành tích Top người chơi theo từng bài hát cụ thể.
- Khối hiển thị kỷ lục cá nhân (Personal Best) nổi bật.
- **Quy tắc bảo vệ bảng xếp hạng:** Khách vãng lai (Guest) có thể tự do trải nghiệm mọi chế độ nhưng **chỉ tài khoản đăng ký chính thức mới được lưu điểm và xếp hạng**, đảm bảo tính minh bạch và chống spam dữ liệu.

### 6. 🌐 Phòng Jam Nhạc Trực Tuyến Đa Người Dùng (Live Rooms Jam Studio)
- Kết nối phòng nhạc thời gian thực thông qua máy chủ Server-Sent Events (SSE) và WebRTC P2P Mesh.
- **Voice Chat & Micro:** Tích hợp bộ lọc khử ồn (Noise Suppression), khử tiếng vọng (Echo Cancellation) và chỉ báo đang nói.
- **Camera & Chia sẻ màn hình (Screen Share):** Truyền hình ảnh webcam và chia sẻ màn hình trực tiếp cho cả phòng.
- **Đồng bộ tiếng trống (Drum Sync):** Khi một thành viên gõ trống, tín hiệu truyền tức thì tới tất cả thành viên khác với hiệu ứng mặt trống phát sáng đồng bộ.
- **Quản trị phòng:** Chủ phòng (Host) có quyền khóa phòng, kick thành viên; Admin có quyền dọn sạch phòng (`Clear All`). Tự động xóa phòng khi không còn ai, không có bot tự sinh phòng rác.

### 7. 💾 Thư Viện Bản Thu & Xuất File WAV 16-Bit PCM Chuẩn Studio
- Thuật toán `renderHitsToWav` dùng `OfflineAudioContext` vẽ lại bài trống thành file `.wav` 16-bit 44.1kHz chất lượng cao để tải về máy và đưa vào các phần mềm hòa âm (DAW) như FL Studio, Ableton, v.v.
- Chia sẻ nhanh bản thu cho bạn bè thông qua đường dẫn nén URL an toàn.

### 8. 👤 Hệ Thống Tài Khoản & Cấp Độ (Auth & Level Progression)
- Đăng nhập/Đăng ký bảo mật qua **Supabase Auth** (kèm cơ chế dự phòng LocalStorage khi offline).
- Tích lũy EXP qua từng ván chơi để thăng cấp người chơi: $\text{Level} = \lfloor\sqrt{\text{TotalScore} / 500}\rfloor + 1$.
- Tự động sinh Avatar Dicebear nghệ thuật theo tên tài khoản.

---

## 🎮 Hướng Dẫn Điều Khiển

Người chơi có thể linh hoạt sử dụng 3 hình thức điều khiển cùng lúc:

| Mặt trống | Phím tắt | Thao tác Cử chỉ Webcam (Air Drumming) | Thao tác Chuột / Cảm ứng |
| :--- | :---: | :--- | :--- |
| **Hi-Hat** | `H` | Đưa đầu ngón trỏ vào vùng trống Hi-Hat (bên trái) | Nhấp chuột hoặc chạm tay vào pad Hi-Hat |
| **Tom** | `U` hoặc `T` | Đưa đầu ngón trỏ vào vùng trống Tom (ở giữa) | Nhấp chuột hoặc chạm tay vào pad Tom |
| **Crash Cymbal** | `C` | Đưa đầu ngón trỏ vào lá Crash Cymbal (phía trên) | Nhấp chuột hoặc chạm tay vào pad Crash |
| **Snare** | `J` hoặc `S` | Đưa đầu ngón trỏ vào mặt Snare (bên phải) | Nhấp chuột hoặc chạm tay vào pad Snare |
| **Kick (Bass)** | `Space` hoặc `K` | Đưa đầu ngón trỏ vào mặt trống Kick (phía dưới) | Nhấp chuột hoặc chạm tay vào pad Kick |

> [!TIP]
> **Mẹo chơi bằng Webcam:** Đặt camera ngang tầm ngực, giữ khoảng cách 0.6m - 1.2m trong môi trường đủ sáng. Đưa ngón tay bổ dứt khoát xuống mặt trống để tạo lực đánh (Velocity) mạnh nhất.

---

## 🛠️ Công Nghệ & Thư Viện Sử Dụng

| Tầng Công Nghệ | Công Nghệ / Thư Viện | Mục Đích Sử Dụng |
| :--- | :--- | :--- |
| **Core Frontend** | React 19, TypeScript | Xây dựng giao diện Single Page Application hiện đại, chặt chẽ về mặt kiểu dữ liệu |
| **Build & Tooling** | Vite 8, Rollup, PostCSS | Đóng gói mã nguồn siêu tốc, hỗ trợ Hot Module Replacement (HMR) |
| **Styling & UI** | Tailwind CSS v4, Base UI, Lucide Icons | Thiết kế giao diện Dark Mode cao cấp, kính mờ Glassmorphism, animations mượt mà |
| **Computer Vision AI** | `@mediapipe/tasks-vision` | Nhận diện tọa độ 21 điểm khớp bàn tay từ video camera trên luồng WebAssembly |
| **Audio Engine** | Web Audio API (`AudioContext`, `OscillatorNode`) | Bộ tổng hợp âm thanh trống analog, acoustic và 808 độ trễ <10ms |
| **Offline Audio Export**| `OfflineAudioContext`, DataView WAV Encoder | Render và đóng gói luồng âm thanh thành tệp nhị phân WAV 16-bit PCM tải về máy |
| **Realtime & Multiplayer** | WebRTC (`RTCPeerConnection`, `RTCDataChannel`), Server SSE | Đàm thoại Voice, truyền Video, Screen Share và đồng bộ cú gõ trống P2P |
| **Backend & Database** | Supabase (PostgreSQL, Supabase Auth, Row Level Security) | Quản lý tài khoản, lưu trữ hồ sơ, cấp độ và bảng xếp hạng đám mây |
| **Hiệu Ứng Game** | Canvas Confetti | Bắn pháo hoa rực rỡ khi người chơi đạt thứ hạng cao (Rank S/A) |

---

## 📋 Yêu Cầu Hệ Thống

- **Node.js**: Phiên bản `18.x`, `20.x` hoặc `22.x`.
- **Trình duyệt**: Hỗ trợ WebAssembly, Web Audio và WebRTC (Google Chrome, Microsoft Edge, Brave, Firefox, Safari).
- **Phần cứng**: Webcam (độ phân giải 720p trở lên được khuyến nghị), Microphone.

---

## 🚀 Cài Đặt Và Khởi Chạy Local

### 1. Clone Repository & Cài Đặt Dependencies
```bash
git clone https://github.com/Hungdo2005/virtual-drum.git
cd virtual-drum
npm install
```

### 2. Cấu Hình Biến Môi Trường (Tùy chọn)
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```
Nội dung file `.env`:
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```
*(Nếu không điền Supabase, hệ thống sẽ tự động hoạt động ở chế độ LocalStorage hoàn chỉnh).*

### 3. Khởi Chạy Server Phát Triển
```bash
npm run dev
```
Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)**

---

## 📜 Các Lệnh Scripts Dự Án

| Lệnh | Chức Năng |
| :--- | :--- |
| `npm run dev` | Khởi chạy Vite Dev Server tại cổng `3000` (kèm Live Rooms relay plugin) |
| `npm run build` | Biên dịch mã nguồn và đóng gói bản tối ưu hóa cho Production |
| `npm run preview` | Khởi chạy máy chủ xem trước bản Production Build |
| `npm run lint` | Kiểm tra toàn diện lỗi cú pháp và kiểu dữ liệu TypeScript (`tsc --noEmit`) |
| `npm run clean` | Dọn dẹp thư mục bản build tạm thời (`dist/`) |

---

## 🗄️ Cấu Hình Cơ Sở Dữ Liệu Supabase

Để kích hoạt tính năng lưu tài khoản người chơi và bảng xếp hạng trực tuyến trên đám mây:

1. Đăng nhập tại [supabase.com](https://supabase.com) và tạo một Project mới.
2. Mở mục **SQL Editor** trong thanh menu bên trái, nhấn **New Query**.
3. Dán toàn bộ nội dung trong tệp [`supabase_schema.sql`](supabase_schema.sql) và nhấn **Run**.
4. Vào **Project Settings** → **API** để lấy `Project URL` và `anon/public key` điền vào file `.env`.
5. Vào **Authentication** → **Providers** → **Email** → tắt mục **Confirm email** để người chơi đăng ký là có thể đăng nhập chơi được ngay.

---

## 📁 Cấu Trúc Thư Mục Chi Tiết

```text
virtual-drum/
├── index.html                        # Tệp HTML đơn trang gốc
├── package.json                      # Cấu hình thư viện và scripts
├── tsconfig.json                     # Cấu hình biên dịch TypeScript
├── vite.config.ts                    # Cấu hình Vite & plugin
├── supabase_schema.sql               # Toàn bộ mã nguồn SQL schema CSDL Supabase
├── PROJECT_FEATURES.md               # Tài liệu thuyết minh chi tiết từng chức năng
├── PROJECT_FILES_ANALYSIS.md         # Tài liệu phân tích chuyên sâu từng file mã nguồn
├── plugins/
│   └── liveRoomsPlugin.ts            # Server SSE & WebRTC Relay chạy cùng Vite
└── src/
    ├── main.tsx                      # Điểm vào chính của ứng dụng React
    ├── App.tsx                       # Bộ điều hướng màn hình & Root State
    ├── types.ts                      # Toàn bộ định nghĩa kiểu dữ liệu Interface/Types
    ├── index.css                     # Bảng màu, tokens và hiệu ứng Tailwind CSS v4
    ├── context/
    │   └── AuthContext.tsx           # Context quản lý phiên đăng nhập và profile
    ├── data/
    │   ├── drums.ts                  # Thông số 5 mặt trống: phím tắt, màu sắc, tọa độ
    │   └── challenges.ts             # Danh sách bài hát thử thách & chuỗi nốt rơi
    ├── services/
    │   ├── audio.ts                  # Bộ tổng hợp âm thanh trống Web Audio API
    │   ├── cameraTracker.ts          # Bộ xử lý AI nhận diện cử chỉ MediaPipe
    │   ├── drumLayout.ts             # Quản lý kéo thả & lưu vị trí mặt trống
    │   ├── mediaManager.ts           # Quản lý luồng Mic, Cam & phân tích âm lượng nói
    │   ├── webrtcManager.ts          # Quản lý kết nối P2P WebRTC Voice/Video/Screen
    │   ├── roomService.ts            # Quản trị trạng thái và đồng bộ phòng trực tuyến
    │   ├── storage.ts                # Bộ điều hợp LocalStorage & tính Level
    │   ├── supabase.ts               # Khởi tạo kết nối client Supabase
    │   ├── supabaseAuth.ts           # Xác thực tài khoản qua Supabase Auth
    │   ├── supabaseStorage.ts        # Lưu trữ điểm & bảng xếp hạng Supabase
    │   ├── recordingsStorage.ts      # Quản lý kho lưu trữ bản thu của người dùng
    │   ├── wavExporter.ts            # Thuật toán mã hóa xuất file WAV 16-bit PCM
    │   └── authUtils.ts              # Hàm tính cấp bậc Level & sinh Avatar Dicebear
    ├── screens/
    │   ├── HomeScreen.tsx            # Trang chủ giới thiệu & gõ thử trống
    │   ├── FreePlayScreen.tsx        # Chế độ chơi tự do kết hợp Camera AI & Looper
    │   ├── ChallengeSelectScreen.tsx # Màn hình chọn bài hát & nghe thử nốt
    │   ├── RhythmGameScreen.tsx      # Trò chơi gõ trống theo đại lộ nốt rơi
    │   ├── ResultScreen.tsx          # Báo cáo kết quả, xếp hạng Rank & bắn pháo hoa
    │   ├── LeaderboardScreen.tsx     # Bảng xếp hạng thành tích trực tuyến
    │   ├── RecordingsScreen.tsx      # Thư viện bản thu, nghe lại & tải file WAV
    │   ├── RoomsLobbyScreen.tsx      # Sảnh danh sách phòng jam trực tuyến
    │   └── LiveRoomScreen.tsx        # Phòng chơi nhạc trực tiếp (Voice/Cam/Trống)
    └── components/
        ├── Navbar.tsx                # Thanh điều hướng trên cùng & chỉnh âm lượng
        ├── AuthModal.tsx             # Hộp thoại đăng nhập & đăng ký
        ├── SettingsModal.tsx         # Hộp thoại cài đặt Audio & Camera
        ├── CameraView.tsx            # Khung hiển thị Camera & vẽ mặt trống ảo
        ├── DrumPad.tsx               # Mặt trống tương tác với hiệu ứng phát sóng
        ├── BeatTimeline.tsx          # Băng chuyền nốt chạy ngang (Rhythm Conveyor)
        ├── FallingNoteLane.tsx       # Đại lộ nốt rơi dọc (Beat Highway)
        ├── LooperControl.tsx         # Bảng điều khiển thu âm vòng lặp trống
        ├── ErrorBoundary.tsx         # Rào chắn xử lý lỗi ngoại lệ an toàn
        └── ui/                       # Bộ thành phần giao diện nền tảng Shadcn/UI
```

---

## 🔒 Quyền Riêng Tư & Bảo Mật

- **Camera & Video:** Toàn bộ luồng video webcam chỉ được xử lý cục bộ ngay trong bộ nhớ RAM trình duyệt để nhận dạng tọa độ khớp xương ngón tay. Ứng dụng **không ghi hình, không lưu trữ video và không gửi dữ liệu hình ảnh về bất kỳ máy chủ nào**.
- **Âm thanh & Voice:** Đàm thoại trong phòng trực tuyến được mã hóa trực tiếp giữa các người dùng qua giao thức chuẩn **WebRTC P2P (DTLS/SRTP)**.
- **Dữ liệu tài khoản:** Mật khẩu được mã hóa an toàn qua Supabase Auth, bảo vệ truy xuất thông qua chính sách phân quyền cấp độ hàng (Row Level Security - RLS).

---

## 📄 Bản Quyền & Tài Liệu Tham Khảo

- Dự án phục vụ mục đích học tập, nghiên cứu và trình diễn công nghệ Web Audio + Computer Vision.
- Xem chi tiết danh mục chức năng tại: [PROJECT_FEATURES.md](PROJECT_FEATURES.md)
- Xem phân tích chi tiết từng file tại: [PROJECT_FILES_ANALYSIS.md](PROJECT_FILES_ANALYSIS.md)