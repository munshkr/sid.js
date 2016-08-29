import Stream from './stream';

export default class SIDFile {
  constructor(data) {
    this.loaded = false;
    if (data) {
      this.loadFileFromData(data);
    }
  }

  // TODO Fix this, support older PSIDs, not just RSIDs
  loadFileFromData(data) {
    let stream = new Stream(data);

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

    // create new memory array and zero
    this.mem = new Array(65536);
    for (let i = 0; i < 65536; i++) {
      this.mem[i] = 0;
    }

    // go to data offset
    stream.seek(this.data_offset);

    // if loadAddress header is 0, *real* load address is
    // first two bytes of dataOffset.
    if (this.load_addr == 0) {
      this.load_addr  = stream.readInt8();
      this.load_addr |= stream.readInt8() << 8;
    }

    // load data into memory
    let loadptr = this.load_addr;
    while (!stream.eof()) {
      this.mem[loadptr] = stream.readInt8();
      loadptr++;
    }
  }

  infostring() {
    let ret = '';
    ret += this.name + ' ';
    if (this.subsongs > 0) {
      ret += '( ' + (this.currentsong + 1) + ' / ' + (this.subsongs + 1) + ' ) ';
    }
    ret += '| ' + this.author + ', Published: ' + this.published;
    return ret;
  }

  getCurrentSong() {
    return this.currentsong;
  }

  getSubSongs() {
    return this.subsongs;
  }
}
