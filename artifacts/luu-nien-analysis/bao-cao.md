# Phân tích LƯU NIÊN trong Virtual Drum

Ngày kiểm tra: 10/11/2026.

File nguồn: `JACK - J97 - LƯU NIÊN - Album TAM THÁI TỬ - Track No.4.mp3` do người dùng cung cấp. Việc xử lý diễn ra trên máy, không gửi file tới dịch vụ bên ngoài. Không thay đổi mã ứng dụng trong lần phân tích này.

## Phạm vi và phương pháp

- Đọc toàn bộ bài để ước lượng tempo, kiểm tra theo từng cửa sổ 30 giây.
- Chạy 60 giây đầu qua chính hàm `analyze()` trong `backend/app.py`, với đầu vào WAV PCM 16-bit giống luồng chuyển đổi MP3 của frontend.
- Backend dùng Librosa HPSS, phát hiện onset với `backtrack=True`, rồi phân loại theo ba dải tần. Chưa dùng Demucs hoặc mô hình nhận diện từng nhạc cụ.
- Chạy kết quả qua chính `buildCustomChallenge()` để kiểm tra chart Easy/Medium/Hard.
- Không có nhãn trống chuẩn do người nghe đánh dấu cho bài này, nên các số lượng nhạc cụ dưới đây là kết quả máy gán, không phải xác nhận cấu trúc trống thực tế. Không suy ra độ chính xác phân loại của bài này từ bài mẫu khác.

## Thông tin file và tempo

| Thuộc tính | Kết quả |
| --- | --- |
| Thời lượng | 194,444 giây, khoảng 3 phút 14 giây |
| Định dạng nguồn | MP3, stereo, 44.100 Hz |
| Dung lượng | 3.112.167 byte |
| BPM ước lượng từ toàn bài | 92,29 |
| BPM backend trả cho 60 giây đầu | 92,3 |

| Đoạn | BPM ước lượng từ phần âm gõ HPSS |
| --- | ---: |
| 0–30 giây | 184,57 |
| 30–60 giây | 92,29 |
| 60–90 giây | 184,57 |
| 90–120 giây | 92,29 |
| 120–150 giây | 92,29 |
| 150–180 giây | 92,29 |
| 180–194,44 giây | 92,29 |

184,57 gần đúng gấp đôi 92,29. Đây là dấu hiệu mơ hồ giữa cách đếm nhịp gốc và chia đôi phách của bộ ước lượng; chưa có bằng chứng bài đổi tốc độ ở các mốc này. 92,3 BPM là giá trị khởi điểm hợp lý để kiểm tra thủ công, không phải BPM đã được người nghe xác nhận.

## Kết quả phân loại 60 giây đầu

| Nhãn | Số nốt | Tỷ lệ |
| --- | ---: | ---: |
| Kick | 0 | 0% |
| Snare | 143 | 74,9% |
| Hi-Hat | 48 | 25,1% |
| Tổng | 191 | 100% |

Trong 20 giây đầu, toàn bộ 38 nốt được gán thành Snare. Trong các khoảng giữa hai nốt Snare kế tiếp, có 46 khoảng ngắn hơn 250 ms; khoảng ngắn nhất là 93 ms. Những số liệu này là dấu hiệu cần kiểm tra chất lượng phân loại, không chứng minh bài gốc không có Kick hoặc thực sự có 143 tiếng Snare.

Nguyên nhân liên quan trực tiếp trong code:

1. `classify_onset()` chỉ kiểm tra phổ của một đoạn 80 ms; nếu không đạt ngưỡng Kick/Hi-Hat thì mặc định trả Snare. Những âm gõ hoặc âm bật của nhạc cụ khác có thể bị gom vào Snare.
2. HPSS tách phần harmonic/percussive, không nhận biết riêng bộ trống. Phần percussive có thể còn các âm bật khác.
3. Mỗi onset chỉ có một nhãn, nên không biểu diễn được nhiều loại trống đánh đồng thời.
4. Game phát sample theo bộ trống đang chọn, không phát lại âm sắc của trống gốc. Vì vậy nhận đúng nhãn cũng không bảo đảm nghe giống bản nhạc.

## Chart thực tế mà game sẽ tạo

| Độ khó | Tổng nốt | Phân bố |
| --- | ---: | --- |
| Easy | 53 | 53 Snare |
| Medium | 191 | 143 Snare, 48 Hi-Hat |
| Hard | 201 | 143 Snare, 48 Hi-Hat, thêm 5 Tom và 5 Crash |

Easy hiện giữ Kick/Snare và giảm mật độ. Vì backend không gán được Kick, Easy chỉ còn Snare. Điều này giải thích vì sao giảm mật độ vẫn chưa tạo được groove Kick–Snare cân bằng cho bài này.

Tom/Crash ở Hard được frontend thêm để tạo thử thách; không phải các tiếng Tom/Crash đã được nhận diện trong bản nhạc.

## Lỗi mốc mở nhận cú đánh

`beatTimes[0]` của bài là **16,765 giây**. Frontend dùng giá trị đó làm `startSeconds` và sau đó là `music.introMs`. Trong khi đó, các nốt onset đã bắt đầu từ khoảng 1,4 giây.

Ở tốc độ 1×:

| Độ khó | Nốt đầu | Bắt đầu nhận cú đánh | Nốt hết hạn trước khi mở nhận cú đánh |
| --- | ---: | ---: | ---: |
| Easy | 1,695 giây | 16,515 giây | 14 |
| Medium | 1,393 giây | 16,585 giây | 33 |
| Hard | 1,393 giây | 16,615 giây | 33 |

Đây là lỗi logic có thể tái hiện từ dữ liệu và điều kiện trong `SongGameScreen.tsx`, không cần giả định người chơi đánh trễ. Nốt hết hạn theo thời gian bài hát nhưng hàm nhận HIT vẫn khóa đầu vào. Beat đầu tiên mà thuật toán tin cậy phát hiện được không nên mặc định được coi là thời điểm bắt đầu cho phép chơi.

## Backtracking và đồng bộ thời gian

Trước bước loại các nốt quá sát, có 194 onset. So với chính các onset phát hiện khi không backtrack:

- Mức lùi trung vị: 69,66 ms.
- Phân vị 90: 109,13 ms.
- Mức lùi lớn nhất: 255,42 ms.

Đây là độ thay đổi do backtracking, **không phải sai số đã đo so với cú đánh chuẩn trong bài**. Không nên cộng cố định 70 ms vào mọi nốt để sửa, vì mức lùi không đồng đều.

HPSS giữ nguyên độ dài tín hiệu trong lần kiểm tra này. Chưa có bằng chứng từ phép kiểm tra cho thấy toàn bộ nhạc đệm bị kéo dài, rút ngắn hay trôi nhịp do đổi sample rate.

## Thứ tự xử lý đề xuất

1. Sửa điều kiện mở nhận HIT: phân biệt beat đầu tiên ước lượng được với thời điểm nốt đầu tiên có thể chơi.
2. Cải thiện hoặc thay bộ phân loại loại trống; bổ sung độ tin cậy và khả năng nhiều nhạc cụ cùng lúc. Không tạo Easy chỉ bằng cách lọc Kick/Snare khi nhãn gốc thiếu tin cậy.
3. Giữ lựa chọn nghe bản gốc khi chơi để đối chiếu. Nếu cần âm sắc giống bài, phải giữ/tái sử dụng tiếng trống gốc; đổi sample không giải quyết đầy đủ.
4. Đánh giá lại backtracking bằng một đoạn được người nghe đánh dấu; không căn mọi âm vào phách nếu chưa kiểm tra đảo phách và fill.
5. Khi nâng cấp tách stem, có thể đánh giá Demucs; việc tách stem tốt hơn không tự sửa nhãn trống và âm sắc sample.

## Tệp đối chiếu

- `ban-goc-60s.wav`: 60 giây đầu bản gốc, chuyển sang WAV.
- `phan-am-go-hpss-60s.wav`: phần percussive HPSS; không phải stem trống đã được xác nhận sạch.
- `nhac-dem-hpss-60s.wav`: phần harmonic mà backend trả về làm nhạc đệm.
- `notes-first-60s.csv`: danh sách 191 nốt backend gán.
- `analysis.json`: số liệu chi tiết và chart theo độ khó.
- `phan-tich.png`: biểu đồ tempo và phân bố nhãn nốt.
