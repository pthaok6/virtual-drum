# 📂 PHÂN TÍCH CHI TIẾT TOÀN BỘ CẤU TRÚC TỪNG FILE DỰ ÁN VIRTUAL DRUM PRO

> **Mục đích tài liệu:** Bóc tách chuyên sâu từng tập tin mã nguồn trong toàn bộ dự án Virtual Drum Pro, làm rõ nhiệm vụ, vai trò kiến trúc và cách thức các tập tin phối hợp hoạt động với nhau.

---

## 🗺️ TỔNG QUAN CÂY THƯ MỤC DỰ ÁN

```text
Project/
├── .env                              # Cấu hình biến môi trường Supabase
├── .env.example                      # Mẫu biến môi trường
├── index.html                        # File HTML gốc của Single Page Application
├── package.json                      # Quản lý thư viện phụ thuộc và scripts
├── tsconfig.json                     # Cấu hình biên dịch TypeScript
├── vite.config.ts                    # Cấu hình build Vite & nạp plugin máy chủ
├── components.json                   # Cấu hình tích hợp Shadcn UI
├── supabase_schema.sql               # Toàn bộ mã nguồn SQL schema CSDL Supabase
├── plugins/
│   └── liveRoomsPlugin.ts            # Server SSE & WebRTC Relay chạy cùng Vite
└── src/
    ├── main.tsx                      # Điểm vào chính của ứng dụng React
    ├── App.tsx                       # Bộ điều hướng màn hình trung tâm (Router & Root State)
    ├── types.ts                      # Toàn bộ định nghĩa kiểu dữ liệu TypeScript (Interface/Types)
    ├── index.css                     # Bảng màu, tokens và phong cách Tailwind CSS v4
    ├── context/
    │   └── AuthContext.tsx           # Context quản lý phiên đăng nhập và hồ sơ người dùng
    ├── data/
    │   ├── drums.ts                  # Thông số 5 mặt trống: màu sắc, phím tắt, tọa độ chuẩn
    │   └── challenges.ts             # Danh sách bài nhạc mẫu, BPM, nốt nhạc rơi
    ├── services/
    │   ├── audio.ts                  # Bộ tổng hợp âm thanh trống Web Audio API (Synthesizer)
    │   ├── cameraTracker.ts          # Bộ xử lý AI nhận diện cử chỉ ngón tay MediaPipe
    │   ├── drumLayout.ts             # Dịch vụ quản lý tọa độ, kéo thả & lưu vị trí trống
    │   ├── mediaManager.ts           # Quản lý luồng Micro, Camera và phân tích âm lượng nói
    │   ├── webrtcManager.ts          # Quản lý kết nối P2P WebRTC truyền Voice/Video/Screen
    │   ├── roomService.ts            # Quản lý trạng thái phòng chơi trực tuyến đa người dùng
    │   ├── storage.ts                # Bộ điều hợp lưu trữ LocalStorage & tính Level
    │   ├── supabase.ts               # Kết nối client và kiểm tra trạng thái Supabase
    │   ├── supabaseAuth.ts           # Xử lý xác thực người dùng qua Supabase Auth
    │   ├── supabaseStorage.ts        # Lưu trữ điểm số và bảng xếp hạng trên Supabase
    │   ├── recordingsStorage.ts      # Lưu trữ và nạp các bản thu trống của người dùng
    │   ├── wavExporter.ts            # Thuật toán mã hóa nốt nhạc ra file âm thanh WAV 16-bit
    │   └── authUtils.ts              # Hàm tính Level theo điểm số và sinh Avatar Dicebear
    ├── screens/
    │   ├── HomeScreen.tsx            # Màn hình Trang Chủ giới thiệu và xem thử trống
    │   ├── FreePlayScreen.tsx        # Màn hình Chơi Tự Do kết hợp Camera AI & Looper
    │   ├── ChallengeSelectScreen.tsx # Màn hình Chọn Bài Nhạc và nghe thử nốt trước khi chơi
    │   ├── RhythmGameScreen.tsx      # Màn hình Trò Chơi Nhịp Điệu (Băng chuyền nốt rơi)
    │   ├── ResultScreen.tsx          # Màn hình Báo Cáo Kết Quả, xếp hạng Rank & bắn pháo hoa
    │   ├── LeaderboardScreen.tsx     # Màn hình Bảng Xếp Hạng thành tích toàn cầu
    │   ├── RecordingsScreen.tsx      # Màn hình Thư Viện Bản Thu, nghe lại và tải file WAV
    │   ├── RoomsLobbyScreen.tsx      # Màn hình Sảnh Danh Sách Phòng Trực Tuyến
    │   └── LiveRoomScreen.tsx        # Màn hình Phòng Chơi Nhạc Trực Tiếp (Voice/Cam/Trống)
    └── components/
        ├── Navbar.tsx                # Thanh điều hướng trên cùng, chỉnh volume nhanh & profile
        ├── AuthModal.tsx             # Cửa sổ Đăng ký / Đăng nhập tài khoản
        ├── SettingsModal.tsx         # Cửa sổ Cài đặt Audio, Camera & Nhận diện cử chỉ
        ├── CameraView.tsx            # Khung hiển thị Camera, vẽ ngón tay và các mặt trống ảo
        ├── DrumPad.tsx               # Thành phần mặt trống tương tác với hiệu ứng sóng phát quang
        ├── BeatTimeline.tsx          # Băng chuyền nốt nhạc nằm ngang (Rhythm Conveyor)
        ├── FallingNoteLane.tsx       # Đại lộ nốt nhạc rơi từ trên xuống (Beat Highway)
        ├── LooperControl.tsx         # Bảng điều khiển thu âm, lặp nhịp trống (Looper Panel)
        ├── ErrorBoundary.tsx         # Vỏ bọc chặn lỗi ứng dụng ngăn chặn màn hình bị crash
        └── ui/                       # Bộ thành phần giao diện nền tảng (Design System)
            ├── button.tsx, card.tsx, badge.tsx, dialog.tsx, input.tsx, label.tsx,
            ├── progress.tsx, select.tsx, separator.tsx, slider.tsx, switch.tsx, alert.tsx
```

---

## 🔍 CHI TIẾT PHÂN TÍCH TỪNG TẬP TIN TRONG DỰ ÁN

---

### 1. CÁC FILE CẤU HÌNH GỐC & CƠ SỞ DỮ LIỆU

#### 📄 `index.html`
- **Chức năng:** Tệp HTML gốc duy nhất làm khung nạp toàn bộ ứng dụng web (SPA).
- **Chi tiết nội dung:** Chứa thẻ `<div id="root"></div>`, nạp phông chữ Geist hiện đại, cấu hình chế độ nền tối `class="dark"` mặc định, thiết lập các thẻ meta chuẩn SEO và nạp tập tin khởi chạy `/src/main.tsx`.

#### 📄 `package.json`
- **Chức năng:** Khai báo thông tin dự án, cấu hình scripts và toàn bộ thư viện npm phụ thuộc.
- **Chi tiết nội dung:**
  - `dependencies`: React 19, `@mediapipe/tasks-vision` (AI cử chỉ), `@supabase/supabase-js` (CSDL & Realtime), `lucide-react` (icon), `canvas-confetti` (pháo hoa), `@tailwindcss/vite` (CSS styling).
  - `devDependencies`: TypeScript, Vite 8, types định kiểu.
  - `scripts`: `npm run dev` (chạy dev server port 3000), `npm run build` (đóng gói production), `npm run lint` (`tsc --noEmit` kiểm tra lỗi cú pháp).

#### 📄 `vite.config.ts`
- **Chức năng:** Cấu hình trình đóng gói và máy chủ phát triển Vite.
- **Chi tiết nội dung:** Tích hợp plugin `@vitejs/plugin-react`, `@tailwindcss/vite`, thiết lập alias đường dẫn `@/` trỏ về `./src` và đặc biệt là nạp `liveRoomsPlugin()` để chạy máy chủ trung gian đồng bộ phòng nhạc thời gian thực.

#### 📄 `tsconfig.json`
- **Chức năng:** Cấu hình trình biên dịch TypeScript Compiler.
- **Chi tiết nội dung:** Bật chế độ `strict` type-checking, hỗ trợ cú pháp JSX của React 19, thiết lập path mapping `@/*` giúp việc import các thành phần trong `src/` ngắn gọn, không bị lỗi đường dẫn tương đối.

#### 📄 `components.json`
- **Chức năng:** Cấu hình công cụ dòng lệnh Shadcn UI.
- **Chi tiết nội dung:** Định nghĩa phong cách thiết kế (style: default), đường dẫn chứa các thành phần UI cơ sở (`src/components/ui`) và tệp CSS chủ đạo.

#### 📄 `.env` & `.env.example`
- **Chức năng:** Lưu trữ các khóa API kết nối dịch vụ Backend Supabase.
- **Chi tiết nội dung:** 
  - `VITE_SUPABASE_URL`: Đường dẫn URL dự án Supabase.
  - `VITE_SUPABASE_ANON_KEY`: Khóa công khai ẩn danh an toàn (Anon Public Key) dùng cho giao tiếp từ trình duyệt đến CSDL.

#### 📄 `supabase_schema.sql`
- **Chức năng:** Toàn bộ kịch bản SQL định nghĩa cơ sở dữ liệu trên Supabase.
- **Chi tiết nội dung:** 
  - Bảng `public.profiles`: Lưu id, email, username, avatar_url, level, total_score.
  - Bảng `public.play_records`: Lưu kết quả từng ván chơi rhythm game.
  - Bảng `public.user_recordings`: Lưu các bản thu trống của từng người dùng.
  - Trigger `handle_new_user`: Tự động khởi tạo profile ngay khi đăng ký tài khoản mới.
  - Chính sách bảo mật RLS (Row Level Security): Chỉ cho phép tài khoản hợp lệ ghi điểm lên bảng xếp hạng, cấm khách vãng lai ghi dữ liệu rác.

#### 📄 `plugins/liveRoomsPlugin.ts`
- **Chức năng:** Máy chủ backend mini chạy trực tiếp bên trong tiến trình Vite.
- **Chi tiết nội dung:** Cung cấp các API REST và đường truyền Server-Sent Events (SSE) `/api/live-rooms`: tạo phòng, danh sách phòng, tham gia, rời phòng, đổi chủ phòng, kick thành viên, gửi tín hiệu WebRTC signaling (SDP Offer/Answer/ICE candidate). Tự động dọn dẹp các phòng trống thành viên và đảm bảo danh sách phòng khởi tạo luôn sạch (`rooms = []`).

---

### 2. MÃ NGUỒN CỐT LÕI (CORE APPLICATION)

#### 📄 `src/main.tsx`
- **Chức năng:** Điểm kích hoạt mã nguồn JavaScript đầu tiên.
- **Chi tiết nội dung:** Nhận phần tử DOM `#root` và gọi `ReactDOM.createRoot()`, nạp tệp CSS toàn cục `index.css` và render thành phần gốc `<App />`.

#### 📄 `src/App.tsx`
- **Chức năng:** Bộ điều hướng màn hình trung tâm (Root Controller & Screen Router).
- **Chi tiết nội dung:**
  - Quản lý trạng thái màn hình hiện tại `currentScreen` ('home', 'free-play', 'challenge-select', 'rhythm-game', 'result', 'leaderboard', 'recordings', 'rooms').
  - Quản lý cài đặt ứng dụng `settings` (âm lượng, preset trống, độ nhạy velocity, trạng thái camera).
  - Đồng bộ âm thanh toàn cục thông qua `audioEngine` và luồng camera qua `cameraTracker`.
  - Bao bọc toàn ứng dụng trong `<AuthProvider>` và `<ErrorBoundary>`.

#### 📄 `src/types.ts`
- **Chức năng:** "Trái tim" định kiểu của toàn bộ dự án TypeScript.
- **Chi tiết nội dung:** Định nghĩa tất cả các interface và type chuẩn:
  - Loại trống: `DrumType` ('kick' | 'snare' | 'hihat' | 'tom' | 'crash').
  - Preset trống: `DrumKitPreset` ('acoustic' | 'electronic' | 'rock').
  - Cấu trúc phòng trực tuyến: `LiveRoom`, `RoomMember`, `RoomChatMessage`, `DrumHitBroadcast`.
  - Cấu trúc game: `RhythmChallenge`, `BeatNote`, `HitRating`, `GameResult`.
  - Hồ sơ & Thứ hạng: `UserProfile`, `PlayRecord`, `PersonalBest`, `LeaderboardEntry`.

#### 📄 `src/index.css`
- **Chức năng:** Thiết lập hệ màu sắc và hiệu ứng chuyển động toàn diện của ứng dụng.
- **Chi tiết nội dung:** Sử dụng Tailwind CSS v4, khai báo biến theme CSS (`--background`, `--foreground`, `--primary`, `--rose-500`, `--amber-400`), tạo lớp kính mờ (glassmorphism), thanh cuộn tối màu (custom scrollbar) và các keyframe animations (`@keyframes pulse`, `ripple`, `fade-in`).

---

### 3. TẦNG QUẢN LÝ DỊCH VỤ & THUẬT TOÁN (SERVICES LAYER)

#### 📄 `src/services/audio.ts`
- **Chức năng:** Bộ tổng hợp âm thanh trống thời gian thực (Software Drum Synthesizer).
- **Chi tiết nội dung:** Không dùng file mp3 có sẵn mà tổng hợp trực tiếp từ sóng âm:
  - `playDrum()`: Kích hoạt tiếng trống với lực đánh `velocity` và preset tương ứng.
  - `playAcousticKit()`: Bộ trống gỗ mộc tự nhiên với tiếng Kick trầm ấm, Snare đanh có dải Pink Noise mô phỏng dây tem (snare wires).
  - `playElectronicKit()`: Mô phỏng mạch analog Roland TR-808 với sub-bass kick sâu đặc trưng.
  - `playRockKit()`: Bộ trống uy lực, nén âm bùng nổ.

#### 📄 `src/services/cameraTracker.ts`
- **Chức năng:** Bộ điều phối thị giác AI theo dõi cử chỉ ngón tay từ webcam.
- **Chi tiết nội dung:**
  - Tải và khởi tạo mô hình `@mediapipe/tasks-vision` chạy trên WebAssembly.
  - Vòng lặp `requestAnimationFrame` đọc từng khung hình video từ camera, trích xuất tọa độ điểm Landmark số 8 (đầu ngón trỏ) của tay trái và tay phải.
  - Ánh xạ tọa độ ngón tay vào vùng không gian tương ứng của từng mặt trống ảo trên màn hình.
  - Tính toán đạo hàm vận tốc di chuyển trục Y để xác định lực đánh (`velocity`) và khử rung kích hoạt trùng lặp (debounce).

#### 📄 `src/services/drumLayout.ts`
- **Chức năng:** Dịch vụ quản lý vị trí, kích thước và bố cục của các mặt trống trên khung camera.
- **Chi tiết nội dung:** 
  - Lưu trữ tọa độ chuẩn hóa tỉ lệ phần trăm `%` của 5 mặt trống (`DEFAULT_DRUM_LAYOUT`).
  - Hỗ trợ lưu trữ và nạp các preset bố cục: Studio Standard, Compact Ergonomic, Wide Spread.
  - Đồng bộ tự động vị trí người dùng đã kéo thả vào `localStorage`.

#### 📄 `src/services/mediaManager.ts`
- **Chức năng:** Quản lý phần cứng media cục bộ (Microphone, Camera và Màn hình).
- **Chi tiết nội dung:**
  - Khởi tạo luồng âm thanh micro với các bộ lọc `echoCancellation`, `noiseSuppression`.
  - Phân tích phổ tần số âm thanh bằng `AnalyserNode` với chu kỳ 100ms để phát hiện trạng thái người dùng đang nói chuyện (`isSpeaking`) và đo biên độ âm lượng.
  - Quản lý đóng/ngắt các media track an toàn khi rời phòng để tránh rò rỉ bộ nhớ và tài nguyên phần cứng.

#### 📄 `src/services/webrtcManager.ts`
- **Chức năng:** Quản lý kết nối mạng ngang hàng đa người dùng (WebRTC Peer-to-Peer Mesh).
- **Chi tiết nội dung:**
  - Tạo và duy trì các kết nối `RTCPeerConnection` giữa các thành viên trong phòng.
  - Tự động cấu hình `addTransceiver('audio')` và `addTransceiver('video')` để nhận dữ liệu từ xa ngay cả trước khi bật cam/mic của chính mình.
  - Quản lý kênh truyền dữ liệu siêu tốc `RTCDataChannel` để trao đổi tín hiệu gõ trống không độ trễ.

#### 📄 `src/services/roomService.ts`
- **Chức năng:** Dịch vụ quản trị logic phòng jam trực tuyến (State Management & Multi-channel Sync).
- **Chi tiết nội dung:**
  - Cơ chế đa kênh đồng bộ: Kết hợp Server SSE (`/api/live-rooms/events`), Local `BroadcastChannel` và `Supabase Realtime`.
  - Các hàm nghiệp vụ: `createRoom`, `joinRoom`, `leaveRoom`, `deleteRoom`, `kickMember`, `sendDrumHit`, `sendChatMessage`.
  - Đảm bảo khi tất cả thành viên rời phòng, phòng sẽ được dọn dẹp sạch sẽ. Nâng cấp key xóa cache trình duyệt để dọn sạch phòng cũ.

#### 📄 `src/services/storage.ts`
- **Chức năng:** Bộ điều hợp lưu trữ LocalStorage & tính toán điểm số cục bộ.
- **Chi tiết nội dung:**
  - Triển khai `LocalStorageAuthAdapter` và `LocalStorageService` dùng làm giải pháp dự phòng hoàn hảo khi không có mạng hoặc chưa cấu hình Supabase.
  - Cung cấp hàm `isUserAdmin(user)` nhận diện tài khoản quản trị viên.
  - Quản lý lưu trữ điểm cá nhân, lịch sử chơi và bảng xếp hạng offline.

#### 📄 `src/services/supabase.ts`
- **Chức năng:** Khởi tạo và kiểm tra kết nối với Supabase Cloud.
- **Chi tiết nội dung:** Đọc URL và Anon Key từ `.env` (hoặc cấu hình tùy chỉnh lưu trong trình duyệt), khởi tạo singleton `SupabaseClient`, cung cấp hàm `testSupabaseConnection()` kiểm tra trạng thái bảng CSDL.

#### 📄 `src/services/supabaseAuth.ts`
- **Chức năng:** Dịch vụ xác thực tài khoản qua Supabase Authentication.
- **Chi tiết nội dung:** Thực hiện các tác vụ đăng nhập `supabase.auth.signInWithPassword`, đăng ký `signUp`, đăng xuất `signOut`, đồng bộ dữ liệu vào bảng `profiles` và cập nhật điểm số tích lũy của tài khoản.

#### 📄 `src/services/supabaseStorage.ts`
- **Chức năng:** Dịch vụ truy vấn và lưu trữ điểm số trên bảng `play_records` Supabase.
- **Chi tiết nội dung:**
  - `savePlayRecord()`: Chỉ cho phép tài khoản đã đăng nhập lưu điểm lên đám mây, chặn hoàn toàn tài khoản khách.
  - `getLeaderboard()`: Truy vấn danh sách điểm có điều kiện `.not('user_id', 'is', null)`, nhóm theo từng tài khoản để chỉ hiển thị điểm kỷ lục cao nhất của mỗi người.

#### 📄 `src/services/recordingsStorage.ts`
- **Chức năng:** Quản lý kho bản thu trống của người chơi.
- **Chi tiết nội dung:** Lưu các bản thu (gồm danh sách các cú gõ, thời gian mili-giây, lực gõ, preset trống) vào bộ nhớ riêng của từng tài khoản, cung cấp các bài thu mẫu demo để người chơi nghe thử.

#### 📄 `src/services/wavExporter.ts`
- **Chức năng:** Bộ xử lý xuất file âm thanh WAV chuẩn phòng thu & mã hóa liên kết chia sẻ.
- **Chi tiết nội dung:**
  - `renderHitsToWav()`: Dùng `OfflineAudioContext` vẽ lại toàn bộ bài trống thành AudioBuffer mà không cần phát ra loa, sau đó đóng gói thành dữ liệu nhị phân WAV 16-bit PCM.
  - `generateSharePayload()` & `parseSharedRecordingFromUrl()`: Nén cấu trúc bản thu thành chuỗi tham số URL để chia sẻ qua liên kết web.

#### 📄 `src/services/authUtils.ts`
- **Chức năng:** Tiện ích tính toán cấp bậc và tạo ảnh đại diện.
- **Chi tiết nội dung:** Chứa hàm `calculateUserLevel(totalScore)` (công thức nâng cấp độ dựa trên tổng điểm) và hàm `generateDefaultAvatar(seed)` tạo avatar robot Dicebear tự động dựa trên tên người dùng.

---

### 4. TẦNG QUẢN LÝ PHIÊN & TRẠNG THÁI (CONTEXT LAYER)

#### 📄 `src/context/AuthContext.tsx`
- **Chức năng:** Quản lý trạng thái xác thực và hồ sơ người dùng trên toàn ứng dụng.
- **Chi tiết nội dung:**
  - Cung cấp hook `useAuth()` cho mọi thành phần trong ứng dụng.
  - Lưu giữ thông tin người dùng đang đăng nhập `user` (hoặc `null` nếu là khách).
  - Điều khiển đóng/mở cửa sổ đăng nhập `openAuthModal()` / `closeAuthModal()`.
  - Tự động chuyển đổi mượt mà giữa adapter Supabase và adapter LocalStorage.

---

### 5. TẦNG DỮ LIỆU CỐ ĐỊNH (DATA LAYER)

#### 📄 `src/data/drums.ts`
- **Chức năng:** Khai báo thông số kỹ thuật cố định của 5 mặt trống tiêu chuẩn.
- **Chi tiết nội dung:** Định nghĩa mã ID (`kick`, `snare`, `hihat`, `tom`, `crash`), tên hiển thị, phím gõ tắt trên bàn phím (Space, J, K, U, H), mã màu nhận diện HSL, màu phát quang Glow và vùng tọa độ chuẩn trên màn hình.

#### 📄 `src/data/challenges.ts`
- **Chức năng:** Kho bài tập và thử thách trò chơi nhịp điệu.
- **Chi tiết nội dung:** Định nghĩa các bài nhạc mẫu (Beginner Beat, Basic Rock, Lo-Fi Chill Hop, Pop Pulse, Metal Storm) kèm theo tên nghệ sĩ, độ khó (Easy, Medium, Hard, Expert), tốc độ BPM, thời lượng và chuỗi mảng các nốt rơi theo mili-giây (`BeatNote[]`).

---

### 6. TẦNG GIAO DIỆN MÀN HÌNH CHÍNH (SCREENS LAYER)

#### 📄 `src/screens/HomeScreen.tsx`
- **Chức năng:** Màn hình trang chủ của ứng dụng.
- **Chi tiết nội dung:** Hiển thị Hero banner giới thiệu công nghệ điều khiển bằng cử chỉ không cần dùi trống, cung cấp các nút CTA dẫn nhanh tới các chế độ, kèm khung gõ thử tương tác trực tiếp 5 mặt trống mộc.

#### 📄 `src/screens/FreePlayScreen.tsx`
- **Chức năng:** Màn hình chơi trống tự do đỉnh cao kết hợp Webcam AI.
- **Chi tiết nội dung:**
  - Tích hợp khung Camera nhận diện tay [CameraView.tsx](file:///c:/Users/ASUS%20TUF/Downloads/Documents/FER/Project/src/components/CameraView.tsx).
  - Tích hợp bộ đo lực đánh Velocity %, đếm combo liên hoàn và tốc độ phát lại (0.75x, 1x, 1.25x).
  - Tích hợp bàn điều khiển vòng lặp Looper [LooperControl.tsx](file:///c:/Users/ASUS%20TUF/Downloads/Documents/FER/Project/src/components/LooperControl.tsx).

#### 📄 `src/screens/ChallengeSelectScreen.tsx`
- **Chức năng:** Màn hình lựa chọn bài nhạc thử thách nhịp điệu.
- **Chi tiết nội dung:** Hiển thị thẻ thông tin từng bài hát, bộ lọc theo độ khó, thanh tìm kiếm và nút bấm nghe thử trước một đoạn nhạc mẫu ngắn của bài đó.

#### 📄 `src/screens/RhythmGameScreen.tsx`
- **Chức năng:** Màn hình chơi game đánh trống theo nốt nhạc rơi.
- **Chi tiết nội dung:** Đếm ngược 3 giây chuẩn bị, đồng bộ thời gian bài hát theo từng mili-giây, hiển thị đại lộ nốt rơi, chấm điểm độ chính xác (Perfect/Good/Miss), đếm combo và chuyển sang màn hình kết quả khi hết bài. Chỉ lưu điểm nếu người chơi đã đăng nhập.

#### 📄 `src/screens/ResultScreen.tsx`
- **Chức năng:** Màn hình tổng kết và chấm điểm sau khi hoàn thành ván chơi.
- **Chi tiết nội dung:** Hiển thị Huy hiệu Rank (S, A, B, C, D), số điểm, độ chính xác %, số sao, hiệu ứng pháo hoa, nhận xét chuyên môn và nút hướng dẫn đăng nhập nếu đang chơi dưới danh nghĩa khách vãng lai.

#### 📄 `src/screens/LeaderboardScreen.tsx`
- **Chức năng:** Màn hình Bảng xếp hạng thành tích trực tuyến.
- **Chi tiết nội dung:** Bộ lọc bài hát, hiển thị thành tích kỷ lục cá nhân (Personal Best), bảng vinh danh Top người chơi có điểm cao nhất của bài hát đó (đã lọc sạch khách, chỉ hiển thị tài khoản chính thức).

#### 📄 `src/screens/RecordingsScreen.tsx`
- **Chức năng:** Màn hình thư viện quản lý các bản thu của người dùng.
- **Chi tiết nội dung:** Danh sách các bản beat đã thu, hỗ trợ bấm nghe lại, xuất file âm thanh `.wav` chất lượng cao về máy tính, đổi tên bản thu, xuất file `.json` hoặc sao chép link chia sẻ lên mạng xã hội.

#### 📄 `src/screens/RoomsLobbyScreen.tsx`
- **Chức năng:** Màn hình sảnh danh sách phòng jam trực tuyến.
- **Chi tiết nội dung:** Tìm kiếm phòng, lọc theo thể loại nhạc, hiển thị số thành viên hiện tại (ví dụ: 1/8), nút tạo phòng mới, nút làm mới danh sách phòng và quyền xóa phòng (chủ phòng xóa phòng của mình, Admin có nút Clear All toàn bộ phòng).

#### 📄 `src/screens/LiveRoomScreen.tsx`
- **Chức năng:** Màn hình phòng chơi nhạc trực tiếp nhiều người.
- **Chi tiết nội dung:**
  - Hàng video/avatar của các thành viên trong phòng kèm trạng thái mic, cam, chỉ báo đang nói chuyện.
  - Khung chia sẻ màn hình lớn khi có thành viên kích hoạt Screen Share.
  - Bàn trống trực tuyến: Khi ai gõ trống, cả phòng cùng nghe thấy và thấy trống sáng lên.
  - Cửa sổ chat nhắn tin và thả cảm xúc (reactions: Thumbs up, Heart, Flame, Zap) thời gian thực.
  - Thanh công cụ điều khiển bên dưới: Bật/Tắt Mic, Cam, Chia sẻ màn hình, Thoát phòng.

---

### 7. TẦNG CÁC THÀNH PHẦN TÁI SỬ DỤNG (COMPONENTS LAYER)

#### 📄 `src/components/Navbar.tsx`
- **Chức năng:** Thanh điều hướng trên cùng xuất hiện xuyên suốt ứng dụng.
- **Chi tiết nội dung:** Chứa logo, các liên kết chuyển màn hình (Home, Free Play, Challenge, Leaderboard, Recordings, Live Rooms), thanh trượt chỉnh nhanh âm lượng Master Volume, chỉ báo camera và nút hiển thị Profile/Đăng nhập.

#### 📄 `src/components/AuthModal.tsx`
- **Chức năng:** Hộp thoại đăng nhập và đăng ký tài khoản.
- **Chi tiết nội dung:** Form nhập Email, Tên hiển thị và Mật khẩu. Hỗ trợ chuyển đổi nhanh giữa tab Đăng nhập và Đăng ký, hiển thị thông báo lỗi hoặc thành công rõ ràng.

#### 📄 `src/components/SettingsModal.tsx`
- **Chức năng:** Hộp thoại cài đặt toàn diện hệ thống âm thanh & camera.
- **Chi tiết nội dung:** Chứa các công tắc bật/tắt nhận diện tay MediaPipe, chọn thiết bị webcam vật lý, chọn bộ trống (Acoustic, 808, Rock), chỉnh thanh trượt âm lượng, độ nhạy lực đánh ngón tay, bật/tắt hiệu ứng âm thanh và hình ảnh, lật gương camera.

#### 📄 `src/components/CameraView.tsx`
- **Chức năng:** Thành phần hiển thị luồng video webcam và các mặt trống tương tác.
- **Chi tiết nội dung:** Vẽ các điểm chấm hiển thị vị trí ngón tay trỏ ảo, các vùng mặt trống bán trong suốt, hỗ trợ chế độ kéo thả và co giãn kích thước mặt trống trực tiếp bằng chuột hoặc cử chỉ.

#### 📄 `src/components/DrumPad.tsx`
- **Chức năng:** Thành phần giao diện một mặt trống đơn lẻ.
- **Chi tiết nội dung:** Hiển thị tên trống, phím tắt, màu sắc nhận diện, hiệu ứng rung nảy và phát sóng ánh sáng (shockwave ripple) khi được gõ trúng.

#### 📄 `src/components/BeatTimeline.tsx`
- **Chức năng:** Băng chuyền hiển thị nốt nhạc chạy ngang (Rhythm Conveyor).
- **Chi tiết nội dung:** Thể hiện các nốt nhạc di chuyển từ phải qua trái tương ứng với nhịp BPM, vạch đích đánh dấu thời điểm gõ chuẩn xác.

#### 📄 `src/components/FallingNoteLane.tsx`
- **Chức năng:** Đại lộ hiển thị nốt nhạc rơi dọc (Beat Highway).
- **Chi tiết nội dung:** Phân chia thành 5 làn tương ứng với 5 mặt trống (Kick, Snare, Hi-Hat, Tom, Crash), các nốt rơi từ trên xuống dưới vạch đón nốt.

#### 📄 `src/components/LooperControl.tsx`
- **Chức năng:** Bàn điều khiển bộ thu âm vòng lặp trống.
- **Chi tiết nội dung:** Các nút bấm: Record (Thu), Overdub (Thu đè), Play/Pause (Phát/Dừng), Clear (Xóa), Loop Mode (Bật lặp), Trim (Cắt gọt khoảng lặng thừa), Lưu vào thư viện và Tải file WAV.

#### 📄 `src/components/ErrorBoundary.tsx`
- **Chức năng:** Thành phần rào chắn xử lý lỗi React ngoại lệ.
- **Chi tiết nội dung:** Bắt các lỗi render bất ngờ của giao diện (ví dụ mất kết nối camera hoặc lỗi WebRTC), hiển thị màn hình thông báo thân thiện và nút "Reset & Return to Home" thay vì làm trắng màn hình ứng dụng.

---

### 8. BỘ THÀNH PHẦN GIAO DIỆN CƠ SỞ (UI DESIGN SYSTEM - `src/components/ui/`)

Tất cả các thành phần trong thư mục này được xây dựng trên nền tảng Accessible Primitive (@base-ui/react / Radix) kết hợp Tailwind CSS chuẩn xác:
- **`button.tsx`**: Nút bấm hỗ trợ đa kích cỡ (sm, md, lg, icon) và biến thể (default, ghost, outline, secondary).
- **`card.tsx`**: Khung chứa nội dung có viền tối, đổ bóng và bo góc hiện đại.
- **`badge.tsx`**: Huy hiệu hiển thị trạng thái (PRO, Level, BPM, Thể loại nhạc).
- **`dialog.tsx`**: Khung cửa sổ modal bật lên (Cài đặt, Đăng nhập, Tạo phòng).
- **`input.tsx` & `label.tsx`**: Ô nhập liệu văn bản và nhãn tiêu đề form chuẩn trợ năng.
- **`select.tsx`**: Menu thả tùy biến danh sách lựa chọn (Bài hát, Camera, Bộ trống).
- **`slider.tsx`**: Thanh trượt điều chỉnh tỉ lệ liên tục (Volume, Sensitivity).
- **`switch.tsx`**: Công tắc bật/tắt hai trạng thái (On/Off toggle).
- **`progress.tsx`**: Thanh tiến trình hiển thị thời lượng bài hát.
- **`alert.tsx`**: Khối cảnh báo thông tin quan trọng.
- **`separator.tsx`**: Đường kẻ phân chia các khối giao diện.

---

## 💡 TỔNG KẾT KIẾN TRÚC TỔNG THỂ

Hệ thống tập tin của **Virtual Drum Pro** được phân tách chặt chẽ theo mô hình kiến trúc phân lớp (Clean Layered Architecture):
1. **Presentation Layer (Screens & Components):** Phụ trách trải nghiệm người dùng, đồ họa sống động và tương tác.
2. **Domain & Services Layer (Services):** Chứa đựng toàn bộ nghiệp vụ toán học, tổng hợp âm thanh, thị giác máy tính và mạng thời gian thực.
3. **Data Layer (Data, Storage & Supabase):** Đảm nhiệm việc lưu trữ, đồng bộ hóa và bảo toàn dữ liệu trên đám mây.
