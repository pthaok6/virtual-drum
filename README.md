# Virtual Drum

Virtual Drum là ứng dụng chơi trống trực tiếp trên trình duyệt. Người chơi có thể dùng webcam để điều khiển bằng đầu ngón trỏ, nhấn các phím tắt trên bàn phím hoặc bấm trực tiếp vào mặt trống.

Toàn bộ nhận diện bàn tay và xử lý âm thanh được thực hiện ngay trong trình duyệt. Ứng dụng không cần backend, tài khoản hay API key.

## Tính năng

- Bộ trống 5 thành phần: Hi-Hat, Tom, Crash, Snare và Kick.
- Nhận diện tối đa hai bàn tay bằng MediaPipe Hand Landmarker.
- Ba cách chơi: webcam, bàn phím và chuột/màn hình cảm ứng.
- Chế độ **Free Play** với bộ đếm combo, tổng số lần đánh và phản hồi trực quan.
- Chế độ **Rhythm Challenge** gồm 4 bài luyện từng bước và 3 bài nhạc gốc: **Neon Drive** (96 BPM), **Sunset Groove** (112 BPM), **Midnight Rush** (132 BPM).
- Thư viện nhạc có tìm kiếm, lọc thể loại, các mục Khám phá / Nhạc của tôi / Luyện trống; trang bài hát cho chọn độ khó, nghe trước và xem nốt theo từng đoạn.
- Hai bản nhạc thật đi kèm: Greensleeves và Ode to Joy. Bản đồ nốt của hai bản thu là dữ liệu minh họa cho prototype, chưa được phân tích tự động. Nguồn và giấy phép nằm trong `public/audio/ATTRIBUTION.md`.
- Luồng thêm nhạc: chọn file → đọc thời lượng → mô phỏng phân tích → xem trước nốt theo độ khó → lưu vào thư viện. BPM và các đoạn trong kết quả mô phỏng là dữ liệu mẫu, không phải kết quả nhận diện âm thanh. File nhạc lưu cục bộ bằng IndexedDB, tối đa 50 MB / 10 phút.
- Bài nhạc có giai điệu, hợp âm, bass và nhịp trống hướng dẫn; chấm Perfect/Good/Miss theo thời gian phát thực tế, có tạm dừng và tiếp tục.
- Bình luận trên bài chia sẻ ở profile và trang riêng `/posts/:clipId`.
- Giao diện chia sẻ lên Facebook, Instagram và X/Twitter: chọn nền tảng, xem ảnh kết quả, nội dung và link bài đăng. Các nút chia sẻ/tải ảnh/sao chép hiện mô phỏng tương tác, chưa mở nền tảng hoặc đăng nội dung thật.
- Tìm người chơi theo tên hoặc handle tại `/users`, mở profile, theo dõi và bắt đầu cuộc trò chuyện.
- Giao diện chat tại `/messages` và `/messages/:userId`, lịch sử và trạng thái đã đọc được lưu trong trình duyệt.
- Tiếng Anh mặc định; tùy chọn tiếng Việt trong Settings → Language.
- Âm trống được tổng hợp bằng Web Audio API. Ba bài nhạc gốc dùng file WAV đi kèm, không tải nhạc từ dịch vụ bên ngoài.
- Tùy chỉnh âm lượng, hiệu ứng âm thanh, camera và chế độ lật gương.
- Giao diện responsive sử dụng Tailwind CSS và các component shadcn/ui.

## Phạm vi frontend cho thử thách nhạc

Hiện chỉ triển khai trải nghiệm giao diện, phát nhạc, hiển thị bản đồ nốt và chấm điểm theo thời gian phát. Không có backend phân tích âm thanh, tách trống hoặc tự nhận diện BPM/cấu trúc bài hát.

Nhạc mẫu của Virtual Drum dùng bản đồ nốt được chuẩn bị từ dữ liệu bài mẫu. Bản thu thật và nhạc người dùng thêm được gắn nhãn **Demo chart**, với BPM, các đoạn và nốt minh họa. Giao diện không trình bày dữ liệu mô phỏng như một kết quả phân tích thật.

Dữ liệu phía giao diện gồm metadata bài hát, file nhạc, các đoạn (thời điểm bắt đầu/kết thúc), và ba bản đồ nốt theo độ khó (loại trống, thời điểm đánh). Khi có backend, có thể thay phần fixture bằng dữ liệu phân tích mà giữ luồng thư viện → trang bài hát → chơi → kết quả.

## Phạm vi dữ liệu cộng đồng

Tài khoản, profile, bình luận và chat hiện là **demo cục bộ**, chưa có backend hoặc xác thực người dùng. Bình luận, tin nhắn và bài đăng được lưu trong localStorage; các tab cùng trình duyệt nhận cập nhật qua sự kiện storage. Tin nhắn không được chuyển tới thiết bị của người khác. Link bài đăng demo có thể mở trên website; bài đăng mới chỉ tồn tại trong trình duyệt đã tạo nó. Để hỗ trợ chia sẻ và chat thực giữa nhiều thiết bị, cần backend, cơ sở dữ liệu và đăng nhập thật.

## Điều khiển

| Trống | Phím |
| --- | --- |
| Hi-Hat | `H` |
| Tom | `T` |
| Crash | `C` |
| Snare | `S` |
| Kick | `K` hoặc `Space` |

Khi dùng webcam, đưa đầu ngón trỏ vào vùng của một mặt trống để kích hoạt nó. Rời khỏi vùng rồi đưa tay vào lại để đánh lần tiếp theo.

## Công nghệ

- React 19 và TypeScript
- Vite 8
- Tailwind CSS 4
- shadcn/ui với Base UI
- MediaPipe Tasks Vision
- Web Audio API
- Lucide React
- Canvas Confetti

## Yêu cầu

- Node.js `20.19+` hoặc `22.12+`
- npm
- Trình duyệt hiện đại có hỗ trợ WebAssembly, Web Audio và `getUserMedia`
- Webcam là tùy chọn; vẫn có thể chơi đầy đủ bằng bàn phím hoặc chuột

Camera chỉ hoạt động trên `localhost` hoặc website được phục vụ qua HTTPS.

## Chạy dự án ở máy local

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Khởi động development server:

   ```bash
   npm run dev
   ```

3. Mở [http://localhost:3000](http://localhost:3000).


## Scripts

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy Vite development server tại cổng `3000` |
| `npm run lint` | Kiểm tra kiểu dữ liệu bằng TypeScript, không tạo file output |
| `npm test` | Kiểm tra ngôn ngữ, tìm kiếm, bình luận, chat, link chia sẻ và chấm nhịp |
| `npm run generate:tracks` | Tạo lại các file WAV nhạc gốc trong public/audio |
| `npm run build` | Tạo production build trong thư mục `dist` |
| `npm run preview` | Chạy thử production build ở máy local |
| `npm run clean` | Xóa output build; cần shell hỗ trợ lệnh `rm` |

## Build và triển khai

```bash
npm run build
npm run preview
```

Thư mục `dist` là website tĩnh và có thể triển khai lên các dịch vụ static hosting. Khi triển khai, cần dùng HTTPS để trình duyệt cho phép truy cập camera.

Model Hand Landmarker và các file WebAssembly đã được lưu trong `public/mediapipe`, vì vậy quá trình nhận diện không cần tải model từ CDN. Ứng dụng ưu tiên GPU và tự chuyển sang CPU nếu GPU delegate không khả dụng.

## Cấu trúc chính

```text
src/
├── components/          # Component dùng chung và camera/drum UI
│   └── ui/              # Component shadcn/ui
├── data/                # Cấu hình bộ trống và rhythm challenges
├── screens/             # Các màn hình của ứng dụng
├── services/
│   ├── audio.ts         # Tổng hợp âm thanh bằng Web Audio API
│   └── cameraTracker.ts # Camera và MediaPipe hand tracking
├── App.tsx              # State và điều hướng chính
└── types.ts             # Kiểu dữ liệu dùng chung

public/mediapipe/
├── models/              # Hand Landmarker model
└── wasm/                # MediaPipe WebAssembly runtime
```

## Quyền riêng tư

Video từ webcam chỉ được xử lý cục bộ để xác định vị trí đầu ngón trỏ. Ứng dụng không ghi hình, không tải video lên server và không yêu cầu kết nối tới dịch vụ AI bên ngoài.
