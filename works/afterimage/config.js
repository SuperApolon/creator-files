window.AFTERIMAGE_CONFIG = Object.freeze({
  colors: {
    '薄い水色': '#9BCEDB', '淡い光': '#D9D5C4', '余白の白': '#DEDCD4',
    '丸い青': '#6B9DDB', '群青': '#596EC0', 'ランプの灯': '#D5B782',
    '小さな緑': '#88B69E', '眠った画面の光': '#A7B6C8', '緑': '#78AF99',
    'インクの青': '#718CBF'
  },
  fallbackColor: '#9EABB9',
  shapes: { '輪': 'ring-aqua', '帯': 'band-thin', '余白': null,
    '点': 'dot-blue', '線': 'line-green', 'にじみ': 'bleed-0094e6' },
  colorArt: { '群青': 'glint-ultramarine', 'ランプの灯': 'point-breath',
    '小さな緑': 'point-breath', '眠った画面の光': 'point-breath' },
  background: 'art-in/bg-dark.jpg',
  taps: Array.from({ length: 5 }, (_, i) => `audio-in/tap-afterimage-${i + 1}.mp3`),
  sleep: 'audio-in/sleep-one.mp3',
  fadeSeconds: 7.5, traceOpacity: 0.105
});
