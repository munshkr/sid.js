import {chip} from './core';
import Stream from './stream';
import SIDFile from './sid_file';
import CPU from './cpu';
import Pico from 'pico';
import debug from 'debug';

const log = debug('sid:player');

const clock = Object.freeze({
  'pal': chip.clock.PAL,
  'ntsc': chip.clock.NTSC
});

const model = Object.freeze({
  '6581': chip.model.MOS6581,
  '8580': chip.model.MOS8580
});

export default class Player {
  constructor(synthClass, opts) {
    opts = Object.assign({}, opts);
    opts.clock = clock[opts.clock] || chip.clock.PAL;
    opts.model = model[opts.model] || chip.model.MOS6581;

    this.clock = opts.clock;
    this.model = opts.model;

    this.play_active = true;
    this.samplesToNextFrame = 0;

    // state signaled to audio manager
    this.ready = false;
    this.finished = false;

    const synthOpts = Object.assign({
      sampleRate: Pico.samplerate
    }, opts);

    this.synth = new synthClass(synthOpts);
  }

  loadURL(url, callback) {
    Stream.loadRemoteFile(url, data => {
      this.loadData(data);
      callback.call(this);
    });
  }

  // load the .sid file into a 64k memory image array
  loadData(data) {
    this.stop();
    this.sidfile = new SIDFile(data);

    this.sidspeed = this.sidfile.speed ? 100 : 50; // 0=50hz, 1=100hz
    this.samplesPerFrame = this.synth.mix_freq / this.sidspeed;
    this.cpu = new CPU(this.sidfile.mem, this.synth);

    // now everything is setup, initialize the sid if needed
    if (this.sidfile.play_addr === 0) {
      this.cpu.cpuJSR(this.sidfile.init_addr, 0);
      this.sidfile.play_addr = (this.cpu.mem[0x0315] << 8) + this.cpu.mem[0x0314];
      log('new play_addr: ', this.sidfile.play_addr);
    }

    this.synth.poke(24, 15); // turn up volume
    this.changeTrack(this.sidfile.startsong);
  }

  play() {
    this.ready = true;
    Pico.play((e) => this._audioprocess(e));
  }

  stop() {
    Pico.pause();
    this.ready = false;
  }

  changeTrack(track) {
    if (track >= 0 && track <= this.sidfile.subsongs) {
      this.stop();
      this.cpu.cpuReset();
      this.sidfile.currentsong = track;
      this.cpu.cpuJSR(this.sidfile.init_addr, this.sidfile.currentsong);

      this.finished = false;
      this.samplesToNextFrame = 0;

      // get the first frame
      this._getNextFrame();
    }
  }

  // will not exceed bounds
  nextTrack() {
    this.changeTrack(this.sidfile.currentsong + 1);
  }

  prevTrack() {
    this.changeTrack(this.sidfile.currentsong - 1);
  }

  getSidFile() {
    return this.sidfile;
  }

  getTrack() {
    return this.sidfile.currentsong;
  }

  getTracks() {
    return this.sidfile.subsongs;
  }

  // Pico.js hook for processing
  _audioprocess(e) {
    let L = e.buffers[0];
    let R = e.buffers[1];

    if (this.ready) {
      var written = this._generateIntoBuffer(L.length, L, 0);
      if (written === 0) {
        //play_mod(random_mod_href());
        this.ready = false;
        this.finished = true;
        this.stop();
      } else {
        // copy left channel to right
        for (var i = 0; i < L.length; i++) {
          R[i] = L[i];
        }
      }
    } else {
      this.stop();
    }
  }

  _getNextFrame() {
    if (this.play_active) {
      this.cpu.cpuJSR(this.sidfile.play_addr, 0);
      // check if CIA timing is used, and adjust

      let nRefreshCIA = Math.floor(20000 * (this.cpu.getmem(0xdc04) | (this.cpu.getmem(0xdc05) << 8)) / 0x4c00);
      if ((nRefreshCIA === 0) || (this.sidspeed === 0)) nRefreshCIA = 20000;
      this.samplesPerFrame = Math.floor(this.synth.mix_freq * nRefreshCIA / 1000000);

      this.samplesToNextFrame += this.samplesPerFrame;
    } else {
      // FIXME: currently, this is not reachable really

      // no frames left
      this.samplesToNextFrame = null;

      // FIXME: this should be a feature of SidSynth we call
      // zero out sid registers at end to prevent noise
      let count = 0;
      while (count < 25) {
        this.synth.poke(count, 0);
        count++;
      }
      this.finished = true;
    }
  }

  // generator
  _generateIntoBuffer(samples, data, dataOffset) {
    if (!this.ready) return 0;
    dataOffset = dataOffset || 0;
    let dataOffsetStart = dataOffset;

    log(`Generating ${samples} samples (${this.samplesToNextFrame} to next frame)`);

    let samplesRemaining = samples;
    let generated;
    for (;;) {
      if (this.samplesToNextFrame !== null && this.samplesToNextFrame <= samplesRemaining) {
        let samplesToGenerate = Math.ceil(this.samplesToNextFrame);

        log(`next frame: ${this.samplesToNextFrame}, remaining: ${samplesRemaining}, offset: ${dataOffset}, generate: ${samplesToGenerate}`);

        if (samplesToGenerate > 0) {
          generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
          dataOffset += generated;
          samplesRemaining -= generated;
          this.samplesToNextFrame -= generated;
        }

        this._getNextFrame();
      } else {
        /* generate samples to end of buffer */
        if (samplesRemaining > 0) {
          generated = this.synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
          dataOffset += generated;
          samplesRemaining -= generated;
          this.samplesToNextFrame -= generated;
        }
        break;
      }
    }

    log(`data: ${data}`);

    return dataOffset - dataOffsetStart;
  }
}
