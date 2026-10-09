# 🥁 TÀI LIỆU TOÀN DIỆN CÁC CHỨC NĂNG DỰ ÁN VIRTUAL DRUM PRO

> **Dự án:** Virtual Drum Pro - Hệ thống Trống Ảo Tương Tác Qua Cử Chỉ Bàn Tay (Webcam Hand Gesture)  
> **Công nghệ lõi:** React 19, TypeScript, MediaPipe Tasks-Vision, Web Audio API Synthesis, WebRTC Multi-user, Supabase (Database & Realtime), Vite.

---

## MỤC LỤC TỔNG QUAN CÁC CHỨC NĂNG

1. [Nhóm 1: Hệ thống Cảm biến Cử chỉ & Camera Tracking (MediaPipe)](#nhóm-1-hệ-thống-cảm-biến-cử-chỉ--camera-tracking-mediapipe)
2. [Nhóm 2: Hệ thống Tổng hợp Âm thanh Đa Bộ Trống (Audio Engine Synthesizer)](#nhóm-2-hệ-thống-tổng-hợp-âm-thanh-đa-bộ-trống-audio-engine-synthesizer)
3. [Nhóm 3: Chế độ Chơi Tự Do (Free Play Mode) & Máy Tạo Vòng Lặp (Looper/Recorder)](#nhóm-3-chế-độ-chơi-tự-do-free-play-mode--máy-tạo-vòng-lặp-looperrecorder)
4. [Nhóm 4: Chế độ Thử Thách Nhịp Điệu (Rhythm Challenge Game)](#nhóm-4-chế-độ-thử-thách-nhịp-điệu-rhythm-challenge-game)
5. [Nhóm 5: Bảng Xếp Hạng Toàn Cầu (Global Leaderboard) & Thống Kê Thành Tích](#nhóm-5-bảng-xếp-hạng-toàn-cầu-global-leaderboard--thống-kê-thành-tích)
6. [Nhóm 6: Phòng Jam Nhạc Trực Tuyến Đa Người Dùng (Live Rooms Jam Studio)](#nhóm-6-phòng-jam-nhạc-trực-tuyến-đa-người-dùng-live-rooms-jam-studio)
7. [Nhóm 7: Thư Viện Bản Thu, Xuất File WAV Chuẩn Phòng Thu & Chia Sẻ Qua URL](#nhóm-7-thư-viện-bản-thu-xuất-file-wav-chuẩn-phòng-thu--chia-sẻ-qua-url)
8. [Nhóm 8: Hệ Thống Tài Khoản, Cấp Độ, Phân Quyền Quản Trị (Auth & Role System)](#nhóm-8-hệ-thống-tài-khoản-cấp-độ-phân-quyền-quản-trị-auth--role-system)
9. [Nhóm 9: Bảng Cài Đặt Âm Thanh & Camera Nâng Cao (Settings Modal)](#nhóm-9-bảng-cài-đặt-âm-thanh--camera-nâng-cao-settings-modal)

---

## CHI TIẾT TỪNG CHỨC NĂNG & TÁC DỤNG ĐỐI VỚI DỰ ÁN

---

### NHÓM 1: HỆ THỐNG CẢM BIẾN CỬ CHỈ & CAMERA TRACKING (MEDIAPIPE)

#### 1. Nhận Diện Đầu Ngón Tay Trỏ Thời Gian Thực (Index Finger Tip Tracking)
- **Mô tả chi tiết:** Sử dụng mô hình trí tuệ nhân tạo thị giác máy tính `@mediapipe/tasks-vision` chạy trực tiếp trên luồng WebAssembly/WebGL của trình duyệt để theo dõi landmark bàn tay. Hệ thống tập trung bám sát tọa độ ngón tay trỏ (Landmark số 8 - `INDEX_FINGER_TIP`) của cả 2 bàn tay (Trái và Phải) với tần số lấy mẫu lên đến 60 FPS.
- **Tác dụng đối với dự án:**
  - Loại bỏ hoàn toàn sự phụ thuộc vào dùi trống vật lý hay các bộ điều khiển đắt tiền (hardware controller).
  - Người dùng chỉ cần ngồi trước webcam máy tính là có thể gõ trống tự nhiên trong không khí (Air Drumming).
  - Hệ thống tính toán độc lập tay trái và tay phải, cho phép thực hiện các kỹ thuật gõ trống 2 tay (drum rolls, alternating stickings).

#### 2. Tính Toán Động Lực Học Lực Đánh (Velocity Impact Calculation)
*(Chức năng hiển thị: Thẻ `VELOCITY IMPACT: 85%`)*
- **Mô tả chi tiết:** Khi ngón tay di chuyển vào vùng mặt trống, hệ thống theo dõi đạo hàm vận tốc di chuyển theo trục Y ($\Delta Y / \Delta t$) trong 3 khung hình liên tiếp. Tốc độ bổ ngón tay xuống càng nhanh, chỉ số phần trăm Velocity càng cao (từ 20% đến 120%).
- **Tác dụng đối với dự án:**
  - Mang lại cảm giác chơi nhạc chân thực như bộ trống cơ thật: đánh nhẹ thì âm thanh phát ra êm dịu, đánh mạnh/dứt khoát thì âm thanh vang dội, đanh thép.
  - Tăng độ biểu cảm âm nhạc (musical dynamics) thay vì chỉ phát âm thanh ở một mức âm lượng cố định vô hồn.

#### 3. Chống Rung & Khử Kích Hoạt Nhầm (Debouncing & Spatial Hysteresis)
- **Mô tả chi tiết:** Tích hợp bộ đệm thời gian (debounce 60ms) và kiểm tra trạng thái chuyển đổi quỹ đạo (đổi hướng từ đi xuống sang đi lên) trước khi cho phép kích hoạt cú gõ tiếp theo trên cùng một mặt trống.
- **Tác dụng đối với dự án:**
  - Ngăn ngừa triệt để lỗi "nổ tiếng" (machine gun effect) khi ngón tay vô tình rung nhẹ tại mép ranh giới mặt trống.
  - Đảm bảo mỗi cú bổ tay dứt khoát của người chơi chỉ tạo đúng một nốt trống chuẩn xác.

#### 4. Tùy Biến Bố Cục Mặt Trống & Kéo Thả (Custom Drum Layout & Drag-Resize)
- **Mô tả chi tiết:** Cho phép người dùng chuyển sang chế độ "Edit Layout" để dùng chuột/tay kéo thả (drag) di chuyển vị trí từng mặt trống (Kick, Snare, Hi-Hat, Tom, Crash) và kéo góc dưới-phải để phóng to/thu nhỏ kích thước từng mặt trống. Tích hợp sẵn 3 preset bố cục: Studio Standard, Compact Ergonomic, Wide Spread.
- **Tác dụng đối với dự án:**
  - Phù hợp với mọi góc độ đặt webcam (góc cao, góc thấp, góc nghiêng) và tầm với của sải tay người dùng (trẻ em, người lớn).
  - Tự động lưu vị trí tùy biến vào bộ nhớ máy, người dùng không phải căn chỉnh lại ở các lần chơi sau.

---

### NHÓM 2: HỆ THỐNG TỔNG HỢP ÂM THANH ĐA BỘ TRỐNG (AUDIO ENGINE SYNTHESIZER)

#### 1. Bộ 3 Presets Âm Thanh Trống Độc Lập (Drum Kit Presets)
*(Chức năng hiển thị: Menu lựa chọn `Acoustic Studio Kit`, `808 Electronic Hip-hop`, `Hard Rock Kit`)*
- **Mô tả chi tiết:**
  - 🥁 **Acoustic Studio Kit:** Sử dụng bộ dao động sóng Sine + Triangle kết hợp bộ lọc Bandpass và tiếng ồn Pink Noise với độ suy giảm tự nhiên (exponential decay) mô phỏng âm mộc của da trống và lá cymbal kim loại cao cấp.
  - 🎛️ **808 Electronic Hip-hop:** Mô phỏng các mạch dao động analog huyền thoại của dòng máy Roland TR-808 với tiếng Kick trầm sâu siêu nặng (sub-bass decay), tiếng Snare đanh và Hi-Hat ngắt tiếng sắc bén đặc trưng cho nhạc Hip-hop, Trap, EDM.
  - ⚡ **Hard Rock Kit:** Điều chỉnh tần số cộng hưởng, thêm độ méo nhẹ (soft saturation) và độ nén dynamic compression mang lại âm hưởng uy lực, bùng nổ cho các điệu Rock/Metal.
- **Tác dụng đối với dự án:**
  - Không cần tải về hàng chục Megabyte file `.wav` hay `.mp3` bên ngoài, giúp web app tải cực nhanh và chạy mượt mà ngay cả khi mạng yếu hoặc offline.
  - Cho phép người chơi linh hoạt biến hóa phong cách âm nhạc theo sở thích ngay tức thì mà không bị trễ tiếng.

#### 2. Độ Trễ Siêu Thấp Nhờ Web Audio API Nguồn (Ultra-Low Latency Audio)
- **Mô tả chi tiết:** Sử dụng trực tiếp `AudioContext` và các `AudioNode` bản địa của trình duyệt (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBufferSourceNode`) với thời gian phản hồi dưới 10 mili-giây kể từ khi ngón tay chạm vào vùng trống.
- **Tác dụng đối với dự án:**
  - Loại bỏ hoàn toàn cảm giác "đánh trước - tiếng kêu sau" gây khó chịu vốn là nhược điểm chí mạng của các ứng dụng nhạc cụ nền web thông thường.
  - Giữ vững nhịp phách khi người chơi thực hiện các tiết tấu nhanh, phức tạp.

---

### NHÓM 3: CHẾ ĐỘ CHƠI TỰ DO (FREE PLAY MODE) & MÁY TẠO VÒNG LẶP (LOOPER/RECORDER)

#### 1. Chơi Tự Do Đa Năng (Free Jamming & Visual Glow)
- **Mô tả chi tiết:** Không gian sáng tạo không giới hạn nơi người dùng có thể gõ trống tự do theo cảm hứng. Mặt trống hiển thị các vòng phát quang sinh động (ripple shockwaves) và thanh năng lượng đo cường độ lực gõ.
- **Tác dụng đối với dự án:**
  - Nơi lý tưởng để người mới làm quen với cử chỉ không gian và tập luyện cảm giác đánh trống.
  - Cung cấp giao diện trực quan sống động, tạo hiệu ứng thị giác cuốn hút khi trình diễn.

#### 2. Đếm Combo Nhịp Điệu (Combo Tracking & Max Combo)
*(Chức năng hiển thị: Huy hiệu `COMBO: 0 / max 0` có biểu tượng ngọn lửa)*
- **Mô tả chi tiết:** Đếm chuỗi các cú đánh liên tục giữ đúng nhịp phách trong khoảng thời gian cho phép. Khi người chơi giữ được tiết tấu ổn định, combo sẽ tăng dần và ghi nhận kỷ lục combo cao nhất (`max combo`) trong phiên chơi.
- **Tác dụng đối với dự án:**
  - Thúc đẩy tinh thần luyện tập, biến việc tập gõ trống tự do thành một trải nghiệm có động lực phấn đấu và tính kỷ luật nhịp điệu.

#### 3. Bộ Điều Chỉnh Tốc Độ Phát Lại (Playback Speed Control)
*(Chức năng hiển thị: Nút chọn `0.75x`, `1x`, `1.25x` có biểu tượng đồng hồ tốc độ)*
- **Mô tả chi tiết:** Cho phép tua chậm (0.75x) hoặc tăng tốc (1.25x) vòng lặp âm thanh và các bản thu mà không làm méo mó cao độ âm thanh.
- **Tác dụng đối với dự án:**
  - Giúp người học nhạc dễ dàng bóc tách các đoạn tiết tấu khó ở tốc độ chậm (0.75x) để tập theo.
  - Hỗ trợ sáng tạo ra các bản phối nhịp nhanh, sôi động hơn (1.25x) cho các bản nhạc dance/remix.

#### 4. Máy Tạo Vòng Lặp Trống Đa Tầng (Multi-layer Live Looper)
- **Mô tả chi tiết:** Tích hợp đầy đủ các tính năng của một bàn Looper chuyên nghiệp:
  - **Record:** Bấm thu hoặc Arm-and-Hit (tự động đếm giờ ngay cú gõ đầu tiên).
  - **Overdub:** Thu chồng thêm lớp nhạc cụ khác (ví dụ: thu Kick & Snare trước, sau đó thu đè thêm Hi-Hat và Crash lên trên).
  - **Loop Mode:** Phát lặp lại liên tục tự động theo chu kỳ với thanh kim chỉ nhịp (playhead) chạy thời gian thực.
  - **Trim Loop:** Tự động cắt gọt khoảng thời gian chết ở đầu và đuôi vòng lặp theo số phách chẵn chuẩn nhịp.
- **Tác dụng đối với dự án:**
  - Cho phép một người chơi duy nhất có thể xây dựng trọn vẹn cả một bản nhạc beat đầy đủ như một ban nhạc mini.

---

### NHÓM 4: CHẾ ĐỘ THỬ THÁCH NHỊP ĐIỆU (RHYTHM CHALLENGE GAME)

#### 1. Băng Chuyền Nốt Nhạc & Đại Lộ Nhịp Phách (Beat Highway & Falling Note Lane)
- **Mô tả chi tiết:** Các nốt nhạc di chuyển trực quan theo dòng thời gian đồng bộ với giai điệu bài hát (BPM). Cung cấp 2 chế độ hiển thị:
  - Băng chuyền ngang (Rhythm Conveyor) chạy từ phải qua trái chạm vạch đích.
  - Đại lộ nốt rơi (Beat Highway) chạy từ trên xuống dưới theo từng làn tương ứng với từng loại trống.
- **Tác dụng đối với dự án:**
  - Giúp người chơi đón đầu nốt nhạc chính xác, tập khả năng phản xạ và cảm thụ tiết tấu chuẩn mực như các tựa game nổi tiếng Guitar Hero / Taiko no Tatsujin.

#### 2. Đánh Giá Độ Chuẩn Xác Từng Mili-giây (Hit Precision Rating)
- **Mô tả chi tiết:** So sánh thời điểm người chơi chạm trống với thời điểm nốt nhạc yêu cầu:
  - ✨ **PERFECT:** Lệch dưới 60ms (Điểm tối đa + cộng dồn combo lớn).
  - 🟢 **GOOD:** Lệch từ 60ms - 130ms (Được điểm và duy trì combo).
  - 🔴 **MISS:** Lệch trên 130ms hoặc không đánh nốt (Reset combo về 0).
- **Tác dụng đối với dự án:**
  - Đảm bảo tính công bằng tuyệt đối trong môi trường thi đấu tính điểm và xếp hạng.

#### 3. Bảng Điểm Kết Quả, Xếp Hạng Rank & Hiệu Ứng Pháo Hoa (Result Screen & Confetti)
- **Mô tả chi tiết:** Sau khi hoàn thành bài nhạc, hệ thống tổng hợp:
  - Điểm số chính xác (Score), Độ chuẩn xác tổng thể (Accuracy %), Chuỗi Combo dài nhất (Max Combo).
  - Đánh giá sao (1 - 3 Sao) và Xếp loại Rank (`S`, `A`, `B`, `C`, `D`).
  - Tự động bắn pháo hoa ăn mừng rực rỡ (`canvas-confetti`) nếu đạt hạng A hoặc S.
  - Hiển thị nhận xét chuyên môn và đề xuất bài tập tiếp theo.
- **Tác dụng đối với dự án:**
  - Tạo cảm xúc thăng hoa, khích lệ tinh thần người chơi chinh phục các đỉnh cao mới.

---

### NHÓM 5: BẢNG XẾP HẠNG TOÀN CẦU (GLOBAL LEADERBOARD) & THỐNG KÊ THÀNH TÍCH

#### 1. Lọc Thứ Hạng Theo Từng Bài Nhạc (Per-track Challenge Filter)
- **Mô tả chi tiết:** Menu chọn lựa bài nhạc trực tiếp (Beginner Beat, Basic Rock, Lo-Fi Chill, Pop Pulse, Metal Storm, v.v.). Bảng hiển thị Top các tay trống cừ khôi nhất của bài nhạc đó.
- **Tác dụng đối với dự án:**
  - Phân loại rõ ràng thành tích theo từng thể loại và cấp độ khó khác nhau.

#### 2. Kỷ Lục Cá Nhân (Personal Best Banner)
- **Mô tả chi tiết:** Khối thông tin nổi bật trên đầu trang hiển thị kỷ lục tốt nhất của chính người dùng hiện tại đối với bài nhạc đang chọn (Điểm cao nhất, Accuracy %, Max Combo, Rank cao nhất).
- **Tác dụng đối với dự án:**
  - Người chơi biết ngay mục tiêu của mình cần vượt qua mà không phải cuộn tìm kiếm vị trí của mình trong danh sách dài.

#### 3. Quy Tắc Bảo Vệ Thứ Hạng (Strict Registered Accounts Only)
- **Mô tả chi tiết:** 
  - Khách vãng lai (Guest) không thể ghi điểm lên bảng xếp hạng; giao diện hiển thị cảnh báo hướng dẫn đăng nhập để ghi danh.
  - Mỗi tài khoản chính thức chỉ chiếm đúng 1 vị trí cao nhất trên bảng xếp hạng (loại bỏ trùng lặp thành tích thấp hơn của cùng 1 người).
  - Trao huy chương vàng (Vô địch), bạc (Á quân), đồng (Hạng 3) bắt mắt cho Top 3.
- **Tác dụng đối với dự án:**
  - Bảo vệ tính minh bạch và uy tín của Bảng xếp hạng. Ngăn ngừa tình trạng spam kỷ lục giả hoặc rác dữ liệu từ khách vãng lai.

---

### NHÓM 6: PHÒNG JAM NHẠC TRỰC TUYẾN ĐA NGƯỜI DÙNG (LIVE ROOMS JAM STUDIO)

#### 1. Sảnh Phòng Trực Tuyến & Cập Nhật Tức Thời Không Độ Trễ (Live Rooms Lobby & Server SSE)
- **Mô tả chi tiết:** Sảnh phòng âm nhạc đa thể loại (Rock, Acoustic, Electronic, Jazz, Free Jam). Sử dụng Server-Sent Events (SSE) và BroadcastChannel kết hợp Supabase Realtime để đồng bộ danh sách phòng lập tức giữa các trình duyệt khác nhau mà không cần F5 tải lại trang.
- **Tác dụng đối với dự án:**
  - Tạo không gian kết nối cộng đồng âm nhạc, biến ứng dụng từ một trò chơi cá nhân thành một mạng xã hội âm nhạc tương tác trực tiếp.

#### 2. Âm Thanh / Video / Chia Sẻ Màn Hình Thời Gian Thực (WebRTC Voice, Cam & Screen Sharing)
- **Mô tả chi tiết:** 
  - Đàm thoại bằng giọng nói trực tiếp qua Micro có tính năng lọc ồn (Noise Suppression), khử tiếng vọng (Echo Cancellation) và hiển thị chỉ số âm lượng nói chuyện (Speaking Indicator).
  - Bật/tắt camera để thấy mặt các thành viên trong phòng.
  - Chia sẻ màn hình (Screen Share) chất lượng cao để hướng dẫn kỹ thuật đánh trống hoặc phát nhạc mẫu cho cả phòng cùng nghe.
- **Tác dụng đối với dự án:**
  - Giúp các ban nhạc hoặc nhóm bạn bè có thể tập luyện cùng nhau từ xa mà không cần cài đặt thêm phần mềm bên thứ ba như Zoom hay Discord.

#### 3. Đồng Bộ Cú Đánh Trống Đa Người Dùng (Real-time Drum Hit Synchronization)
- **Mô tả chi tiết:** Khi một thành viên trong phòng gõ vào một mặt trống, tín hiệu gõ (loại trống, lực gõ velocity) sẽ được truyền qua kênh P2P DataChannel/Server Relay đến tất cả các thành viên khác trong vài phần nghìn giây. Người khác sẽ nghe thấy tiếng trống và thấy mặt trống của thành viên đó sáng rực rỡ lên theo thời gian thực.
- **Tác dụng đối với dự án:**
  - Hiện thực hóa trải nghiệm Jamming đích thực: người này giữ nhịp Kick/Snare, người kia solo Hi-Hat và Tom.

#### 4. Phân Quyền Phòng Chặt Chẽ & Tự Động Thu Dọn Rác (Room Lifecycle & Ownership)
- **Mô tả chi tiết:**
  - Chỉ chủ phòng (Host) hoặc Admin mới có quyền xóa phòng, khóa/mở khóa phòng, kick thành viên gây rối.
  - Khi chủ phòng rời đi, quyền Host tự động chuyển giao cho thành viên tiếp theo.
  - Khi toàn bộ thành viên rời khỏi phòng, phòng sẽ được hệ thống tự động xóa sạch để giải phóng tài nguyên. Hoàn toàn không có bot tự sinh phòng rác.
- **Tác dụng đối với dự án:**
  - Đảm bảo hệ thống phòng luôn sạch sẽ, bảo mật và chỉ phục vụ người dùng thực tế.

---

### NHÓM 7: THƯ VIỆN BẢN THU, XUẤT FILE WAV CHUẨN PHÒNG THU & CHIA SẺ QUA URL

#### 1. Xuất Tệp Âm Thanh WAV 16-Bit PCM Bản Quyền Trực Tiếp Từ Trình Duyệt
- **Mô tả chi tiết:** Thuật toán mã hóa nhị phân nội bộ [wavExporter.ts](file:///c:/Users/ASUS%20TUF/Downloads/Documents/FER/Project/src/services/wavExporter.ts) tự động vẽ lại toàn bộ các cú gõ trống thành một luồng âm thanh PCM 44.1kHz / 16-bit chuẩn CD Audio và đóng gói thành file `.wav` để tải về máy tính.
- **Tác dụng đối với dự án:**
  - Không cần máy chủ xử lý âm thanh phức tạp, tiết kiệm băng thông tối đa.
  - Người dùng có thể lấy file WAV này nhập trực tiếp vào các phần mềm hòa âm chuyên nghiệp (DAW) như FL Studio, Ableton Live, Logic Pro để làm nhạc.

#### 2. Chia Sẻ Bản Thu Nhanh Bằng Đường Link (URL Encoded Sharing)
- **Mô tả chi tiết:** Nén toàn bộ cấu trúc các nốt đánh trống thành chuỗi dữ liệu URL an toàn (Base64 Safe Payload) dạng `https://domain/?rec=...`. Bất kỳ ai mở link này đều có thể nghe lại và xem biểu diễn bản thu đó ngay lập tức.
- **Tác dụng đối với dự án:**
  - Giúp chia sẻ tác phẩm của mình lên mạng xã hội, gửi bạn bè cực kỳ dễ dàng mà không cần phải tải file lên hosting lưu trữ nặng nề.

---

### NHÓM 8: HỆ THỐNG TÀI KHOẢN, CẤP ĐỘ, PHÂN QUYỀN QUẢN TRỊ (AUTH & ROLE SYSTEM)

#### 1. Đăng Ký & Đăng Nhập Linh Hoạt (Dual Auth Adapter: Supabase + Local Storage)
- **Mô tả chi tiết:**
  - Khi có kết nối Supabase: Xác thực an toàn qua email/mật khẩu, lưu hồ sơ vào bảng `public.profiles`.
  - Khi chạy offline/mất mạng: Tự động chuyển mạch sang `LocalStorageAuthAdapter` đảm bảo trải nghiệm chơi không bao giờ bị gián đoạn.
- **Tác dụng đối với dự án:**
  - Độ tin cậy cực cao, trải nghiệm người dùng liền mạch trong mọi điều kiện mạng.

#### 2. Cấp Độ Người Chơi (Player Level & EXP Progression)
- **Mô tả chi tiết:** Tích lũy điểm số qua từng bài thi đấu và tự động nâng cấp độ người chơi dựa trên công thức căn bậc hai: $\text{Level} = \lfloor\sqrt{\text{TotalScore} / 500}\rfloor + 1$. Avatar tự động sinh bằng thuật toán Dicebear độc đáo theo tên tài khoản.
- **Tác dụng đối với dự án:**
  - Tăng tính gắn bó và tạo cảm giác tiến bộ rõ rệt theo thời gian cho người chơi.

#### 3. Phân Quyền Quản Trị Viên (Admin Privileges)
- **Mô tả chi tiết:** Nhận diện tài khoản quản trị (Role `admin` hoặc tài khoản có tiền tố/tên `admin`). Admin sở hữu các đặc quyền tối cao:
  - Nút **Clear All (Admin)** trên Sảnh phòng để dọn dẹp toàn bộ phòng khi cần bảo trì.
  - Quyền xóa bất kỳ phòng nào mà không bị giới hạn quyền sở hữu.
- **Tác dụng đối với dự án:**
  - Đảm bảo ban quản trị có đầy đủ công cụ để kiểm soát và vận hành hệ thống một cách trơn tru.

---

### NHÓM 9: BẢNG CÀI ĐẶT ÂM THANH & CAMERA NÂNG CAO (SETTINGS MODAL)
*(Chi tiết các thành phần hiển thị trong cửa sổ Cài Đặt)*

| Tên Cài Đặt | Loại Điều Khiển | Chức Năng Chi Tiết | Tác Dụng Đối Với Dự Án |
|---|---|---|---|
| **MediaPipe Hand Tracking** | Công tắc (Switch) | Bật/tắt mô hình trí tuệ nhân tạo nhận diện tay. | Cho phép người dùng chuyển đổi linh hoạt giữa chơi bằng ngón tay qua webcam hoặc bấm phím bàn phím truyền thống. |
| **Camera Device** | Menu thả (Select) | Lựa chọn thiết bị camera vật lý (webcam tích hợp, webcam USB rời, OBS Virtual Cam). | Linh hoạt cho các máy tính có nhiều camera hoặc streamer muốn truyền hình ảnh qua phần mềm ảo. |
| **Drum Kit Preset** | Menu thả (Select) | Chọn bộ trống mặc định: Acoustic Studio, 808 Electronic, Hard Rock. | Định hình chất âm tổng thể của ứng dụng ngay từ khi khởi động. |
| **Master Volume** | Thanh trượt (Slider: 0 - 100%) | Điều chỉnh âm lượng tổng thể của hệ thống âm thanh. | Bảo vệ thính giác người chơi, phù hợp với từng loại loa và tai nghe. |
| **Velocity Strike Sensitivity** | Thanh trượt (Slider: 0.5x - 2.0x) | Độ nhạy lực đánh ngón tay. | Người chơi có tay yếu hoặc camera đặt xa có thể nâng độ nhạy lên để đánh nhẹ vẫn ra âm thanh rõ ràng. |
| **Sound Effects & SFX** | Công tắc (Switch) | Bật/tắt âm thanh hiệu ứng (tiếng trống, tiếng chuông chúc mừng, tiếng phản hồi). | Tiện lợi khi người dùng muốn tập luyện trong không gian cần sự yên tĩnh mà vẫn theo dõi được nốt thị giác. |
| **Visual Effects & Glow** | Công tắc (Switch) | Bật/tắt hiệu ứng sóng ánh sáng tỏa ra khi gõ trúng mặt trống. | Tối ưu hóa hiệu năng đồ họa cho các máy tính cấu hình yếu, giảm tải cho vi xử lý GPU. |
| **Mirror Video Feed** | Công tắc (Switch) | Lật gương hình ảnh video theo chiều ngang (Horizontal Flip). | Giúp người chơi cử động tự nhiên như đang nhìn vào gương soi thật, không bị ngược hướng tay trái - tay phải. |

---

## 🎯 TỔNG KẾT GIÁ TRỊ DỰ ÁN

Virtual Drum Pro không chỉ là một ứng dụng giải trí âm nhạc đơn thuần mà là một giải pháp công nghệ toàn diện kết hợp giữa:
1. **Thị giác máy tính AI (Computer Vision AI):** Mang lại trải nghiệm gõ trống trong không khí không độ trễ.
2. **Tổng hợp âm thanh thuần Web (Pure Web Audio Synthesis):** Độc lập, gọn nhẹ và độ trung thực cao.
3. **Mạng xã hội âm nhạc P2P (WebRTC Jam Studio):** Kết nối ban nhạc từ xa trong không gian số.
4. **Hệ thống Game hóa (Gamification):** Chấm điểm, combo, xếp hạng và lưu trữ đám mây chuyên nghiệp.
