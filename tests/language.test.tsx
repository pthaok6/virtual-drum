import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { PostComments } from '../src/components/PostComments';
import { createComment } from '../src/services/community';
import { ResultScreen } from '../src/screens/ResultScreen';
import { CHALLENGES } from '../src/data/challenges';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import { LANGUAGE_STORAGE_KEY, readLanguage, translate, clipTitle, clipDate, type Language } from '../src/i18n/translate';
import { DEMO_CLIPS } from '../src/data/community';
import { createResultImage } from '../src/services/resultImage';

function storage(language: string | null) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === LANGUAGE_STORAGE_KEY ? language : null } });
}

test('English is the default; a saved Vietnamese preference is restored', () => {
  storage(null); assert.equal(readLanguage(), 'en');
  storage('vi'); assert.equal(readLanguage(), 'vi');
  storage('fr'); assert.equal(readLanguage(), 'en');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked'); } });
  assert.equal(readLanguage(), 'en');
});

test('translations support both languages, placeholders, and legacy demo messages', () => {
  assert.equal(translate('Notifications', 'en'), 'Notifications');
  assert.equal(translate('Notifications', 'vi'), 'Thông báo');
  assert.equal(translate('Thông báo', 'en'), 'Notifications');
  assert.equal(translate('Performance: {title}', 'vi', { title: 'Rock' }), 'Lượt chơi Rock');
  assert.equal(translate('Unrecognized text', 'vi'), 'Unrecognized text');
  assert.equal(translate('toString', 'en'), 'toString');
});

test('generated clip titles follow language while user-authored titles remain intact', () => {
  const clip = { ...DEMO_CLIPS[0], id: 'local-test', title: 'Tiêu đề của tôi' };
  assert.equal(clipTitle(clip, 'en'), 'Tiêu đề của tôi');
  assert.equal(clipTitle({ ...clip, title: 'Beginner Beat', generatedTitle: true }, 'en'), 'Performance: Beginner Beat');
  assert.equal(clipTitle({ ...clip, title: 'Beginner Beat', generatedTitle: true }, 'vi'), 'Lượt chơi Nhịp cơ bản');
  assert.equal(clipTitle(DEMO_CLIPS[0], 'en'), 'Warm-up beat');
  assert.equal(clipDate('Hôm qua', 'en'), 'Yesterday');
  assert.notEqual(clipDate('2026-10-08T12:00:00.000Z', 'en'), clipDate('2026-10-08T12:00:00.000Z', 'vi'));
});

const routes = [
  ['/', 'This week', 'Điểm cao nhất tuần này'],
  ['/free-play', 'Drum Console', 'Bảng trống'],
  ['/challenges', 'Song library', 'Thư viện bài hát'],
  ['/songs/neon-drive', 'Choose your difficulty', 'Chọn độ khó của bạn'],
  ['/songs/greensleeves', 'Listen and preview', 'Nghe và xem trước'],
  ['/challenge/play', 'Get Ready', 'Sẵn sàng'],
  ['/login', 'Welcome back', 'Chào mừng trở lại'],
  ['/register', 'Create an account', 'Tạo tài khoản'],
  ['/profile/you', 'Challenge clips', 'Đoạn chơi challenge'],
  ['/replay/demo-you', 'Performance results', 'Kết quả lượt chơi'],
  ['/share/demo-you', 'Let everyone hear your rhythm', 'Cho mọi người nghe nhịp của bạn'],
  ['/notifications', 'No new notifications', 'Chưa có thông báo mới'],
  ['/rooms', 'Play together', 'Phòng chơi cùng nhau'],
  ['/rooms/studio-night', 'Players in room', 'Người trong phòng'],
  ['/users', 'Find players', 'Tìm người chơi'],
  ['/messages', 'Choose a conversation', 'Chọn một cuộc trò chuyện'],
  ['/messages/mai-beats', 'Want to practice a rock challenge together?', 'Bạn muốn cùng luyện một bài rock không?'],
  ['/posts/demo-you', 'Post comment', 'Đăng bình luận'],
  ['/missing', 'Page not found', 'Không tìm thấy trang'],
];
for (const [path, english, vietnamese] of routes) {
  test('page renders in English and Vietnamese: ' + path, () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '' } } });
    for (const language of ['en', 'vi'] as Language[]) {
      storage(language);
      const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></LanguageProvider>);
      assert.ok(html.includes(language === 'en' ? english : vietnamese));
      if (language === 'en') assert.ok(!html.includes(vietnamese));
    }
  });
}

test('shared result image labels follow the selected language', () => {
  const drawn: string[] = [];
  const gradient = { addColorStop() {} };
  const ctx = { createLinearGradient: () => gradient, createRadialGradient: () => gradient, fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, fillText: (text: string) => drawn.push(text) };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:image/png;base64,test' }) } });
  createResultImage(DEMO_CLIPS[0], 'You', 'en');
  assert.ok(drawn.includes('RHYTHM CHALLENGE RESULTS'));
  assert.ok(drawn.includes('TOTAL SCORE'));
  drawn.length = 0;
  createResultImage(DEMO_CLIPS[0], 'Bạn', 'vi');
  assert.ok(drawn.includes('KẾT QUẢ RHYTHM CHALLENGE'));
  assert.ok(drawn.includes('TỔNG ĐIỂM'));
});

test('completed challenge result renders in both languages', () => {
  const result = { challenge: CHALLENGES[0], score: 12345, maxScore: 15000, accuracy: 98, maxCombo: 20, perfectHits: 20, goodHits: 2, misses: 0, stars: 3, rank: 'S' as const };
  const noop = () => {};
  for (const language of ['en', 'vi'] as Language[]) {
    storage(language);
    const html = renderToStaticMarkup(<LanguageProvider><ResultScreen result={result} onPlayAgain={noop} onChooseAnother={noop} onBackToHome={noop} onShareImage={noop} onShareProfile={noop} /></LanguageProvider>);
    assert.ok(html.includes(language === 'en' ? 'Challenge Complete' : 'Hoàn thành thử thách'));
    assert.ok(html.includes(language === 'en' ? 'Share image externally' : 'Chia sẻ ảnh ra ngoài'));
  }
});

test('threaded replies render under their parent in both languages', () => {
  const parent = createComment('demo-you', 'Parent comment');
  const reply = createComment('demo-you', 'Child reply', parent.id);
  const sibling = createComment('demo-you', 'Another root');
  for (const language of ['en', 'vi'] as Language[]) {
    storage(language);
    const noop = () => {};
    const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter><PostComments clipId="demo-you" comments={[parent, sibling, reply]} onAddComment={noop} onRemoveComment={noop} expanded /></MemoryRouter></LanguageProvider>);
    assert.ok(html.indexOf('Parent comment') < html.indexOf('Child reply'));
    assert.ok(html.indexOf('Child reply') < html.indexOf('Another root'));
    assert.ok(html.includes(language === 'en' ? '>Reply</button>' : '>Trả lời</button>'));
  }
});
