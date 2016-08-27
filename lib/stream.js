// Wrapper for accessing strings through sequential reads
export default class Stream {
  constructor(str) {
    this.str = str;
    this.position = 0;
  }

  seek(newpos) {
    this.position = newpos;
  }

  read(length) {
    let result = this.str.substr(this.position, length);
    this.position += length;
    return result;
  }

  // read a big-endian 32-bit integer
  readInt32() {
    let result = ((this.str.charCodeAt(this.position) << 24) +
      (this.str.charCodeAt(this.position + 1) << 16) +
      (this.str.charCodeAt(this.position + 2) << 8) +
      this.str.charCodeAt(this.position + 3));
    this.position += 4;

    return result;
  }

  // read a big-endian 16-bit integer 
  readInt16() {
    let result = ((this.str.charCodeAt(this.position) << 8) +
      this.str.charCodeAt(this.position + 1));
    this.position += 2;
    return result;
  }

  // read an 8-bit integer
  readInt8(signed) {
    let result = this.str.charCodeAt(this.position);
    if (signed && result > 127) result -= 256;
    this.position += 1;
    return result;
  }

  eof() {
    return this.position >= this.str.length;
  }

  /**
   * Read a MIDI-style letiable-length integer (big-endian value in groups of 7
   * bits, with top bit set to signify that another byte follows).
   */
  readVarInt() {
    let result = 0;
    for (;;) {
      let b = this.readInt8();
      if (b & 0x80) {
        result += (b & 0x7f);
        result <<= 7;
      } else {
        // b is the last byte
        return result + b;
      }
    }
  }

  static loadRemoteFile(path, callback) {
    let fetch = new XMLHttpRequest();
    fetch.open('GET', path);
    if (fetch.overrideMimeType) fetch.overrideMimeType('text/plain; charset=x-user-defined');
    if (fetch.responseType) fetch.responseType = 'arraybuffer';
    fetch.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        /* munge response into a binary string */
        let t = this.responseText || '';
        let ff = [];
        let mx = t.length;
        let scc = String.fromCharCode;
        for (let z = 0; z < mx; z++) {
          ff[z] = scc(t.charCodeAt(z) & 255);
        }
        callback(ff.join(''));
      }
    };
    fetch.send();
  }

  static Base64Decode(input) {
    let output = [];

    let enumerator = new Base64DecodeEnumerator(input);
    while (enumerator.moveNext()) {
      let charCode = enumerator.current;
      output.push(String.fromCharCode(charCode));
    }

    return output.join('');
  }
}

class Base64DecodeEnumerator {
  constructor(input) {
    this._input = input;
    this._index = -1;
    this._buffer = [];

    this.current = 64;
    this.codex = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  }

  moveNext() {
    if (this._buffer.length > 0) {
      this.current = this._buffer.shift();
      return true;
    } else if (this._index >= (this._input.length - 1)) {
      this.current = 64;
      return false;
    } else {
      let enc1 = this.codex.indexOf(this._input.charAt(++this._index));
      let enc2 = this.codex.indexOf(this._input.charAt(++this._index));
      let enc3 = this.codex.indexOf(this._input.charAt(++this._index));
      let enc4 = this.codex.indexOf(this._input.charAt(++this._index));

      let chr1 = (enc1 << 2) | (enc2 >> 4);
      let chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      let chr3 = ((enc3 & 3) << 6) | enc4;

      this.current = chr1;

      if (enc3 != 64) {
        this._buffer.push(chr2);
      }

      if (enc4 != 64) {
        this._buffer.push(chr3);
      }

      return true;
    }
  }
}
