export const chip = Object.freeze({
  model: {
    MOS6581: 0,
    MOS8580: 1
  },
  clock: {
    PAL: 985248,
    NTSC: 1022730
  }
});

export const quality = Object.freeze({
  low: 'tinysid',
  medium: 'fastsid',
  good: 'resid_fast',
  better: 'resid_interpolate',
  best: 'resid_resample_interpolate',
  broken: 'resid_resample_fast'
});
