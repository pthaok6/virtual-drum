# Virtual Drum

Virtual Drum là ứng dụng chơi trống trực tiếp trên trình duyệt. Người chơi có thể dùng webcam để điều khiển bằng đầu ngón trỏ, nhấn các phím tắt trên bàn phím hoặc bấm trực tiếp vào mặt trống.

Toàn bộ nhận diện bàn tay và xử lý âm thanh được thực hiện ngay trong trình duyệt. Ứng dụng không cần backend, tài khoản hay API key.

## Tính năng

- Bộ trống 5 thành phần: Hi-Hat, Tom, Crash, Snare và Kick.
- Nhận diện tối đa hai bàn tay bằng MediaPipe Hand Landmarker.
- Ba cách chơi: webcam, bàn phím và chuột/màn hình cảm ứng.
- Chế độ **Free Play** với bộ đếm combo, tổng số lần đánh và phản hồi trực quan.
- Chế độ **Rhythm Challenge** gồm 4 bài với nhiều mức độ, BPM, điểm số, combo, độ chính xác và xếp hạng.
- Âm trống được tổng hợp bằng Web Audio API, không phụ thuộc file âm thanh hoặc dịch vụ bên ngoài.
- Tùy chỉnh âm lượng, hiệu ứng âm thanh, camera và chế độ lật gương.
- Giao diện responsive sử dụng Tailwind CSS và các component shadcn/ui.

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
