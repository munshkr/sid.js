import { chip, quality, synthFactory } from './core' 
import Stream from 'stream'

export default class Player {
  constructor(opts) {
    opts = opts || {};

    this.quality = opts.quality || quality.good;
    this.clock = opts.clock || chip.clock.PAL;
    this.model = opts.model || chip.model.MOS6581;

    this.play_active = true;
    this.samplesToNextFrame = 0;

    // state signaled to audio manager
    this.ready = false;
    this.finished = false;

    this.synth = synthFactory({
      quality: this.quality,
      clock: this.clock,
      model: this.model,
      sampleRate: pico.samplerate
    });
  }

  getSidFile() {
    return this.sidfile;
  }

  // Pico.js hook for processing
  process(L, R) {
    if (this.ready) {
      var written = this.generateIntoBuffer(L.length, L, 0);
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

  play() {
    this.ready = true;
    pico.play(this);
  }

  stop() {
    pico.pause();
    this.ready = false;
  }

  // load the .sid file into a 64k memory image array
  loadFileFromData(data) {
    this.stop();
    this.sidfile = new jsSID.SIDPlayer.SIDFile(data);

    this.sidspeed = this.sidfile.speed ? 100 : 50; // 0=50hz, 1=100hz
    this.samplesPerFrame = this.synth.mix_freq / this.sidspeed;
    this.cpu = new jsSID.MOS6510(this.sidfile.mem, this.synth);

    // now everything is setup, initialize the sid if needed
    if (this.sidfile.play_addr === 0) {
      this.cpu.cpuJSR(this.sidfile.init_addr, 0);
      this.sidfile.play_addr = (this.cpu.mem[0x0315] << 8) + this.cpu.mem[0x0314];
      console.log("new play_addr: ", this.sidfile.play_addr);
    }

    this.synth.poke(24, 15); // turn up volume
    this.changeTrack(this.sidfile.startsong);
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
      this.getNextFrame();
    }
  }

  // will not exceed bounds
  nextTrack() {
    this.changeTrack(this.sidfile.currentsong + 1);
  }

  prevTrack() {
    this.changeTrack(this.sidfile.currentsong - 1);
  }

  getTrack() {
    return this.sidfile.currentsong;
  }

  getTracks() {
    return this.sidfile.subsongs;
  }

  getNextFrame() {
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

  generate(samples) {
    var data = new Array(samples * 2);
    this.generateIntoBuffer(samples, data, 0);
    return data;
  }

  // generator
  generateIntoBuffer(samples, data, dataOffset) {
    if (!this.ready) return 0;
    dataOffset = dataOffset || 0;
    let dataOffsetStart = dataOffset;

    //console.log("Generating " + samples + " samples (" + samplesToNextFrame + " to next frame)");
    let samplesRemaining = samples;
    let generated;
    while (true) {
      if (this.samplesToNextFrame !== null && this.samplesToNextFrame <= samplesRemaining) {
        let samplesToGenerate = Math.ceil(this.samplesToNextFrame);
        //console.log("next frame: " + samplesToNextFrame + ", remaining: " + samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
        if (samplesToGenerate > 0) {
          generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
          dataOffset += generated;
          samplesRemaining -= generated;
          this.samplesToNextFrame -= generated;
        }

        this.getNextFrame();
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
    //console.log("data: ", data);
    return dataOffset - dataOffsetStart;
  }
}

class SIDFile {
  constructor(data) {
    this.loaded = false;
    if (data) {
      this.loadFileFromData(data);
    }
  }

  // TODO Fix this, support older PSIDs, not just RSIDs
  loadFileFromData(data) {
    let stream = Stream(data);

    stream.seek(0x07);
    this.data_offset = stream.readInt8(); // 0x07
    this.load_addr = stream.readInt16(); // 0x08
    this.init_addr = stream.readInt16(); // 0x0a
    this.play_addr = stream.readInt16(); // 0x0c
    stream.seek(0x0f);
    this.subsongs = stream.readInt8() - 1; // 0x0f
    stream.seek(0x11);
    this.startsong = stream.readInt8() - 1; // 0x11
    this.currentsong = this.startsong;
    stream.seek(0x15);
    this.speed = stream.readInt8(); // 0x15
    stream.seek(0x16);
    this.name = stream.read(32);
    stream.seek(0x36);
    this.author = stream.read(32);
    stream.seek(0x56);
    this.published = stream.read(32);

    stream.seek(this.data_offset);
    //this.load_addr       = stream.readInt8();
    //this.load_addr      |= stream.readInt8() << 8;
    let loadptr = this.load_addr;

    // create new memory array and zero
    this.mem = new Array(65536);
    for (let i = 0; i < 65536; i++) {
      this.mem[i] = 0;
    }

    while (!stream.eof()) {
      this.mem[loadptr] = stream.readInt8();
      loadptr++;
    }
  }

  infostring() {
    let ret = "";
    ret += this.name + " ";
    if (this.subsongs > 0) {
        ret += "( " + (this.currentsong + 1) + " / " + (this.subsongs + 1) + " ) ";
    }
    ret += "| " + this.author + ", Published: " + this.published;
    return ret;
  }

  getCurrentSong() {
    return this.currentsong;
  }

  getSubSongs() {
    return this.subsongs;
  }
}
