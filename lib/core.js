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

/*
export function synthFactory(f_opts) {
  //console.log("factory", f_opts);
  f_opts = f_opts || {};

  let f_quality = f_opts.quality || quality.good;
  let engine = synth[f_quality];

  let o = {};
  let key;
  for (key in engine.opts) {
    o[key] = engine.opts[key];
  }
  for (key in f_opts) {
    o[key] = f_opts[key];
  }

  o.clock = o.clock || chip.clock.PAL;
  o.model = o.model || chip.model.MOS6581;
  o.sampleRate = o.sampleRate || 44100;

  //console.log("factory, class:", engine.class);
  let f_newsid = new window.jsSID[engine.class](o);
  return f_newsid;
}
*/
