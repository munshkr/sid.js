import debug from 'debug';

const log = debug('sid:mos6510');

export default class MOS6510 {
  constructor(mem, sid) {
    this.cycles = 0;
    this.bval = 0;
    this.wval = 0;
    this.sid = null;

    if (mem) {
      this.mem = mem;
    } else {
      this.mem = new Array(65536);
      this.mem.fill(0);
    }

    if (sid) {
      this.sid = sid;
    }

    this.cpuReset();
  }

  getmem(addr) {
    if (addr < 0 || addr > 65536) {
      log(`getmem: out of range addr: ${addr} (caller: ${arguments.caller})`);
    }
    //if (addr == 0xdd0d) {
    //	this.mem[addr] = 0;
    //}
    return this.mem[addr];
  }

  setmem(addr, value) {
    if (addr < 0 || addr > 65535) {
      log(`setmem: out of range addr=${addr} (caller: ${arguments.caller})`);
    }
    if (value < 0 || value > 255) {
      log(`setmem: out of range value=${value} (caller: ${arguments.caller})`);
    }

    if ((addr & 0xfc00) == 0xd400 && this.sid !== null) {
      this.sid.poke(addr & 0x1f, value);
      if (addr > 0xd418) {
        log(`setmem: attempted digi poke addr=${addr} value=${value}`);
        this.sid.pokeDigi(addr, value);
      }
    } else {
      this.mem[addr] = value;
    }
  }

  // just like pc++, but with bound check on pc after
  pcinc() {
    let pc = this.pc++;
    this.pc &= 0xffff;
    return pc;
  }

  getaddr(mode) {
    let ad, ad2;

    switch (mode) {
    case 'imp':
      this.cycles += 2;
      return 0;
    case 'imm':
      this.cycles += 2;
      return this.getmem(this.pcinc());
    case 'abs':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      return this.getmem(ad);
    case 'absx':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= 256 * this.getmem(this.pcinc());
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad2);
    case 'absy':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= 256 * this.getmem(this.pcinc());
      ad2 = ad + this.y;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad2);
    case 'zp':
      this.cycles += 3;
      ad = this.getmem(this.pcinc());
      return this.getmem(ad);
    case 'zpx':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      return this.getmem(ad & 0xff);
    case 'zpy':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.y;
      return this.getmem(ad & 0xff);
    case 'indx':
      this.cycles += 6;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      ad2 = this.getmem(ad & 0xff);
      ad++;
      ad2 |= this.getmem(ad & 0xff) << 8;
      return this.getmem(ad2);
    case 'indy':
      this.cycles += 5;
      ad = this.getmem(this.pcinc());
      ad2 = this.getmem(ad);
      ad2 |= this.getmem((ad + 1) & 0xff) << 8;
      ad = ad2 + this.y;
      ad &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad);
    case 'acc':
      this.cycles += 2;
      return this.a;
    case 'ind':
      log('getaddr: attempted indirect addressing mode');
      return 0;
    case 'rel':
      log('getaddr: attempted relative addressing mode');
      return 0;
    }

    log('getaddr: attempted unhandled mode');

    return 0;
  }

  setaddr(mode, val) {
    let ad, ad2;

    // FIXME: not checking pc addresses as all should be relative to a valid instruction
    switch (mode) {
    case 'abs':
      this.cycles += 2;
      ad = this.getmem(this.pc - 2);
      ad |= 256 * this.getmem(this.pc - 1);
      this.setmem(ad, val);
      return;
    case 'absx':
      this.cycles += 3;
      ad = this.getmem(this.pc - 2);
      ad |= 256 * this.getmem(this.pc - 1);
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles--;
      this.setmem(ad2, val);
      return;
    case 'zp':
      this.cycles += 2;
      ad = this.getmem(this.pc - 1);
      this.setmem(ad, val);
      return;
    case 'zpx':
      this.cycles += 2;
      ad = this.getmem(this.pc - 1);
      ad += this.x;
      this.setmem(ad & 0xff, val);
      return;
    case 'acc':
      this.a = val;
      return;
    }

    log('setaddr: attempted unhandled mode');
  }

  putaddr(mode, val) {
    let ad, ad2;

    switch (mode) {
    case 'abs':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      this.setmem(ad, val);
      return;
    case 'absx':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      this.setmem(ad2, val);
      return;
    case 'absy':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      ad2 = ad + this.y;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      this.setmem(ad2, val);
      return;
    case 'zp':
      this.cycles += 3;
      ad = this.getmem(this.pcinc());
      this.setmem(ad, val);
      return;
    case 'zpx':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      this.setmem(ad & 0xff, val);
      return;
    case 'zpy':
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.y;
      this.setmem(ad & 0xff, val);
      return;
    case 'indx':
      this.cycles += 6;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      ad2 = this.getmem(ad & 0xff);
      ad++;
      ad2 |= this.getmem(ad & 0xff) << 8;
      this.setmem(ad2, val);
      return;
    case 'indy':
      this.cycles += 5;
      ad = this.getmem(this.pcinc());
      ad2 = this.getmem(ad);
      ad2 |= this.getmem((ad + 1) & 0xff) << 8;
      ad = ad2 + this.y;
      ad &= 0xffff;
      this.setmem(ad, val);
      return;
    case 'acc':
      this.cycles += 2;
      this.a = val;
      return;
    }

    log(`putaddr: attempted unhandled mode (${mode})`);
  }

  setflags(flag, cond) {
    if (cond) {
      this.p |= flag;
    } else {
      this.p &= ~flag & 0xff;
    }
  }

  push(val) {
    this.setmem(0x100 + this.s, val);
    if (this.s) this.s--;
  }

  pop() {
    if (this.s < 0xff) this.s++;
    return this.getmem(0x100 + this.s);
  }

  branch(flag) {
    let dist = this.getaddr('imm');
    // FIXME: while this was checked out, it still seems too complicated
    // make signed
    if (dist & 0x80) {
      dist = 0 - ((~dist & 0xff) + 1);
    }

    // this here needs to be extracted for general 16-bit rounding needs
    this.wval = this.pc + dist;
    // FIXME: added boundary checks to wrap around. Not sure this is whats needed
    if (this.wval < 0) this.wval += 65536;
    this.wval &= 0xffff;
    if (flag) {
      this.cycles += ((this.pc & 0x100) != (this.wval & 0x100)) ? 2 : 1;
      this.pc = this.wval;
    }
  }

  cpuReset() {
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.p = 0;
    this.s = 255;
    this.pc = this.getmem(0xfffc);
    this.pc |= 256 * this.getmem(0xfffd);
  }

  cpuResetTo(npc, na) {
    this.a = na || 0;
    this.x = 0;
    this.y = 0;
    this.p = 0;
    this.s = 255;
    this.pc = npc;
  }

  cpuParse() {
    let c;
    this.cycles = 0;

    let opc = this.getmem(this.pcinc());
    let [cmd, addr] = opcodes[opc].split(' ');

    log(`cpuParse: opc=${opc.toString(16)}, cmd=${cmd}, addr=${addr}`);

    switch (cmd) {
    case 'adc':
      this.wval = this.a + this.getaddr(addr) + ((this.p & flag.C) ? 1 : 0);
      this.setflags(flag.C, this.wval & 0x100);
      this.a = this.wval & 0xff;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      this.setflags(flag.V, ((this.p & flag.C) ? 1 : 0) ^ ((this.p & flag.N) ? 1 : 0));
      break;
    case 'and':
      this.bval = this.getaddr(addr);
      this.a &= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case 'asl':
      this.wval = this.getaddr(addr);
      this.wval <<= 1;
      this.setaddr(addr, this.wval & 0xff);
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.wval & 0x100);
      break;
    case 'bcc':
      this.branch(!(this.p & flag.C));
      break;
    case 'bcs':
      this.branch(this.p & flag.C);
      break;
    case 'bne':
      this.branch(!(this.p & flag.Z));
      break;
    case 'beq':
      this.branch(this.p & flag.Z);
      break;
    case 'bpl':
      this.branch(!(this.p & flag.N));
      break;
    case 'bmi':
      this.branch(this.p & flag.N);
      break;
    case 'bvc':
      this.branch(!(this.p & flag.V));
      break;
    case 'bvs':
      this.branch(this.p & flag.V);
      break;
    case 'bit':
      this.bval = this.getaddr(addr);
      this.setflags(flag.Z, !(this.a & this.bval));
      this.setflags(flag.N, this.bval & 0x80);
      this.setflags(flag.V, this.bval & 0x40);
      break;
    case 'brk':
      this.pc = 0; // just quit per rockbox
      //this.push(this.pc & 0xff);
      //this.push(this.pc >> 8);
      //this.push(this.p);
      //this.setflags(flag.B, 1);
      // FIXME: should Z be set as well?
      //this.pc = this.getmem(0xfffe);
      //this.cycles += 7;
      break;
    case 'clc':
      this.cycles += 2;
      this.setflags(flag.C, 0);
      break;
    case 'cld':
      this.cycles += 2;
      this.setflags(flag.D, 0);
      break;
    case 'cli':
      this.cycles += 2;
      this.setflags(flag.I, 0);
      break;
    case 'clv':
      this.cycles += 2;
      this.setflags(flag.V, 0);
      break;
    case 'cmp':
      this.bval = this.getaddr(addr);
      this.wval = this.a - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.a >= this.bval);
      break;
    case 'cpx':
      this.bval = this.getaddr(addr);
      this.wval = this.x - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.x >= this.bval);
      break;
    case 'cpy':
      this.bval = this.getaddr(addr);
      this.wval = this.y - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.y >= this.bval);
      break;
    case 'dec':
      this.bval = this.getaddr(addr);
      this.bval--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.bval < 0) this.bval += 256;
      this.setaddr(addr, this.bval);
      this.setflags(flag.Z, !this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      break;
    case 'dex':
      this.cycles += 2;
      this.x--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.x < 0) this.x += 256;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case 'dey':
      this.cycles += 2;
      this.y--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.y < 0) this.y += 256;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case 'eor':
      this.bval = this.getaddr(addr);
      this.a ^= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case 'inc':
      this.bval = this.getaddr(addr);
      this.bval++;
      this.bval &= 0xff;
      this.setaddr(addr, this.bval);
      this.setflags(flag.Z, !this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      break;
    case 'inx':
      this.cycles += 2;
      this.x++;
      this.x &= 0xff;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case 'iny':
      this.cycles += 2;
      this.y++;
      this.y &= 0xff;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case 'jmp':
      this.cycles += 3;
      this.wval = this.getmem(this.pcinc());
      this.wval |= 256 * this.getmem(this.pcinc());
      switch (addr) {
      case 'abs':
        this.pc = this.wval;
        break;
      case 'ind':
        this.pc = this.getmem(this.wval);
        this.pc |= 256 * this.getmem((this.wval + 1) & 0xffff);
        this.cycles += 2;
        break;
      }
      break;
    case 'jsr':
      this.cycles += 6;
      this.push(((this.pc + 1) & 0xffff) >> 8);
      this.push((this.pc + 1) & 0xff);
      this.wval = this.getmem(this.pcinc());
      this.wval |= 256 * this.getmem(this.pcinc());
      this.pc = this.wval;
      break;
    case 'lda':
      this.a = this.getaddr(addr);
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case 'ldx':
      this.x = this.getaddr(addr);
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case 'ldy':
      this.y = this.getaddr(addr);
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case 'lsr':
      this.bval = this.getaddr(addr);
      this.wval = this.bval;
      this.wval >>= 1;
      this.setaddr(addr, this.wval & 0xff);
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.bval & 1);
      break;
    case 'nop':
      this.cycles += 2;
      break;
    case 'ora':
      this.bval = this.getaddr(addr);
      this.a |= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case 'pha':
      this.push(this.a);
      this.cycles += 3;
      break;
    case 'php':
      this.push(this.p);
      this.cycles += 3;
      break;
    case 'pla':
      this.a = this.pop();
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      this.cycles += 4;
      break;
    case 'plp':
      this.p = this.pop();
      this.cycles += 4;
      break;
    case 'rol':
      this.bval = this.getaddr(addr);
      c = (this.p & flag.C) ? 1 : 0;
      this.setflags(flag.C, this.bval & 0x80);
      this.bval <<= 1;
      this.bval |= c;
      this.bval &= 0xff;
      this.setaddr(addr, this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      this.setflags(flag.Z, !this.bval);
      break;
    case 'ror':
      this.bval = this.getaddr(addr);
      c = (this.p & flag.C) ? 128 : 0;
      this.setflags(flag.C, this.bval & 1);
      this.bval >>= 1;
      this.bval |= c;
      this.setaddr(addr, this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      this.setflags(flag.Z, !this.bval);
      break;
    case 'rti':
      // treat like RTS
    case 'rts':
      this.wval = this.pop();
      this.wval |= 256 * this.pop();
      this.pc = this.wval + 1;
      this.cycles += 6;
      break;
    case 'sbc':
      this.bval = this.getaddr(addr) ^ 0xff;
      this.wval = this.a + this.bval + ((this.p & flag.C) ? 1 : 0);
      this.setflags(flag.C, this.wval & 0x100);
      this.a = this.wval & 0xff;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a > 127);
      this.setflags(flag.V, ((this.p & flag.C) ? 1 : 0) ^ ((this.p & flag.N) ? 1 : 0));
      break;
    case 'sec':
      this.cycles += 2;
      this.setflags(flag.C, 1);
      break;
    case 'sed':
      this.cycles += 2;
      this.setflags(flag.D, 1);
      break;
    case 'sei':
      this.cycles += 2;
      this.setflags(flag.I, 1);
      break;
    case 'sta':
      this.putaddr(addr, this.a);
      break;
    case 'stx':
      this.putaddr(addr, this.x);
      break;
    case 'sty':
      this.putaddr(addr, this.y);
      break;
    case 'tax':
      this.cycles += 2;
      this.x = this.a;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case 'tay':
      this.cycles += 2;
      this.y = this.a;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case 'tsx':
      this.cycles += 2;
      this.x = this.s;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case 'txa':
      this.cycles += 2;
      this.a = this.x;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case 'txs':
      this.cycles += 2;
      this.s = this.x;
      break;
    case 'tya':
      this.cycles += 2;
      this.a = this.y;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    default:
      log(`cpuParse: attempted unhandled instruction, opc=${opc}`);
    }
    return this.cycles;
  }

  cpuJSR(npc, na) {
    let ccl = 0;

    this.a = na;
    this.x = 0;
    this.y = 0;
    this.p = 0;
    this.s = 255;
    this.pc = npc;
    this.push(0);
    this.push(0);

    while (this.pc > 1) {
      ccl += this.cpuParse();
    }
    return ccl;
  }
}

// Flags Enum
const flag = Object.freeze({
  N: 128,
  V: 64,
  B: 16,
  D: 8,
  I: 4,
  Z: 2,
  C: 1
});

// 256 entries, each entry array pair of [inst, mode]
const opcodes = [
  'brk imp', // 0x00
  'ora indx', // 0x01
  'xxx xxx', // 0x02
  'xxx xxx', // 0x03
  'xxx zp', // 0x04
  'ora zp',   // 0x05
  'asl zp', // 0x06
  'xxx xxx', // 0x07
  'php imp', // 0x08
  'ora imm', // 0x09
  'asl acc', // 0x0a
  'xxx xxx', // 0x0b
  'xxx abs', // 0x0c
  'ora abs', // 0x0d
  'asl abs', // 0x0e
  'xxx xxx', // 0x0f

  'bpl rel', // 0x10
  'ora indy', // 0x11
  'xxx xxx', // 0x12
  'xxx xxx', // 0x13
  'xxx xxx', // 0x14
  'ora zpx', // 0x15
  'asl zpx', // 0x16
  'xxx xxx', // 0x17
  'clc imp', // 0x18
  'ora absy', // 0x19
  'xxx xxx', // 0x1a
  'xxx xxx', // 0x1b
  'xxx xxx', // 0x1c
  'ora absx', // 0x1d
  'asl absx', // 0x1e
  'xxx xxx', // 0x1f

  'jsr abs', // 0x20
  'and indx', // 0x21
  'xxx xxx', // 0x22
  'xxx xxx', // 0x23
  'bit zp', // 0x24
  'and zp', // 0x25
  'rol zp', // 0x26
  'xxx xxx', // 0x27
  'plp imp', // 0x28
  'and imm', // 0x29
  'rol acc', // 0x2a
  'xxx xxx', // 0x2b
  'bit abs', // 0x2c
  'and abs', // 0x2d
  'rol abs', // 0x2e
  'xxx xxx', // 0x2f

  'bmi rel', // 0x30
  'and indy', // 0x31
  'xxx xxx', // 0x32
  'xxx xxx', // 0x33
  'xxx xxx', // 0x34
  'and zpx', // 0x35
  'rol zpx', // 0x36
  'xxx xxx', // 0x37
  'sec imp', // 0x38
  'and absy', // 0x39
  'xxx xxx', // 0x3a
  'xxx xxx', // 0x3b
  'xxx xxx', // 0x3c
  'and absx', // 0x3d
  'rol absx', // 0x3e
  'xxx xxx', // 0x3f

  'rti imp', // 0x40
  'eor indx', // 0x41
  'xxx xxx', // 0x42
  'xxx xxx', // 0x43
  'xxx zp', // 0x44
  'eor zp', // 0x45
  'lsr zp', // 0x46
  'xxx xxx', // 0x47
  'pha imp', // 0x48
  'eor imm', // 0x49
  'lsr acc', // 0x4a
  'xxx xxx', // 0x4b
  'jmp abs', // 0x4c
  'eor abs', // 0x4d
  'lsr abs', // 0x4e
  'xxx xxx', // 0x4f

  'bvc rel', // 0x50
  'eor indy', // 0x51
  'xxx xxx', // 0x52
  'xxx xxx', // 0x53
  'xxx xxx', // 0x54
  'eor zpx', // 0x55
  'lsr zpx', // 0x56
  'xxx xxx', // 0x57
  'cli imp', // 0x58
  'eor absy', // 0x59
  'xxx xxx', // 0x5a
  'xxx xxx', // 0x5b
  'xxx xxx', // 0x5c
  'eor absx', // 0x5d
  'lsr absx', // 0x5e
  'xxx xxx', // 0x5f

  'rts imp', // 0x60
  'adc indx', // 0x61
  'xxx xxx', // 0x62
  'xxx xxx', // 0x63
  'xxx zp', // 0x64
  'adc zp', // 0x65
  'ror zp', // 0x66
  'xxx xxx', // 0x67
  'pla imp', // 0x68
  'adc imm', // 0x69
  'ror acc', // 0x6a
  'xxx xxx', // 0x6b
  'jmp ind', // 0x6c
  'adc abs', // 0x6d
  'ror abs', // 0x6e
  'xxx xxx', // 0x6f

  'bvs rel', // 0x70
  'adc indy', // 0x71
  'xxx xxx', // 0x72
  'xxx xxx', // 0x73
  'xxx xxx', // 0x74
  'adc zpx', // 0x75
  'ror zpx', // 0x76
  'xxx xxx', // 0x77
  'sei imp', // 0x78
  'adc absy', // 0x79
  'xxx xxx', // 0x7a
  'xxx xxx', // 0x7b
  'xxx xxx', // 0x7c
  'adc absx', // 0x7d
  'ror absx', // 0x7e
  'xxx xxx', // 0x7f

  'xxx imm', // 0x80
  'sta indx', // 0x81
  'xxx xxx', // 0x82
  'xxx xxx', // 0x83
  'sty zp', // 0x84
  'sta zp', // 0x85
  'stx zp', // 0x86
  'xxx xxx', // 0x87
  'dey imp', // 0x88
  'xxx imm', // 0x89
  'txa acc', // 0x8a
  'xxx xxx', // 0x8b
  'sty abs', // 0x8c
  'sta abs', // 0x8d
  'stx abs', // 0x8e
  'xxx xxx', // 0x8f

  'bcc rel', // 0x90
  'sta indy', // 0x91
  'xxx xxx', // 0x92
  'xxx xxx', // 0x93
  'sty zpx', // 0x94
  'sta zpx', // 0x95
  'stx zpy', // 0x96
  'xxx xxx', // 0x97
  'tya imp', // 0x98
  'sta absy', // 0x99
  'txs acc', // 0x9a
  'xxx xxx', // 0x9b
  'xxx xxx', // 0x9c
  'sta absx', // 0x9d
  'xxx absx', // 0x9e
  'xxx xxx', // 0x9f

  'ldy imm', // 0xa0
  'lda indx', // 0xa1
  'ldx imm', // 0xa2
  'xxx xxx', // 0xa3
  'ldy zp', // 0xa4
  'lda zp', // 0xa5
  'ldx zp', // 0xa6
  'xxx xxx', // 0xa7
  'tay imp', // 0xa8
  'lda imm', // 0xa9
  'tax acc', // 0xaa
  'xxx xxx', // 0xab
  'ldy abs', // 0xac
  'lda abs', // 0xad
  'ldx abs', // 0xae
  'xxx xxx', // 0xaf

  'bcs rel', // 0xb0
  'lda indy', // 0xb1
  'xxx xxx', // 0xb2
  'xxx xxx', // 0xb3
  'ldy zpx', // 0xb4
  'lda zpx', // 0xb5
  'ldx zpy', // 0xb6
  'xxx xxx', // 0xb7
  'clv imp', // 0xb8
  'lda absy', // 0xb9
  'tsx acc', // 0xba
  'xxx xxx', // 0xbb
  'ldy absx', // 0xbc
  'lda absx', // 0xbd
  'ldx absy', // 0xbe
  'xxx xxx', // 0xbf

  'cpy imm', // 0xc0
  'cmp indx', // 0xc1
  'xxx xxx', // 0xc2
  'xxx xxx', // 0xc3
  'cpy zp', // 0xc4
  'cmp zp', // 0xc5
  'dec zp', // 0xc6
  'xxx xxx', // 0xc7
  'iny imp', // 0xc8
  'cmp imm', // 0xc9
  'dex acc', // 0xca
  'xxx xxx', // 0xcb
  'cpy abs', // 0xcc
  'cmp abs', // 0xcd
  'dec abs', // 0xce
  'xxx xxx', // 0xcf

  'bne rel', // 0xd0
  'cmp indy', // 0xd1
  'xxx xxx', // 0xd2
  'xxx xxx', // 0xd3
  'xxx zpx', // 0xd4
  'cmp zpx', // 0xd5
  'dec zpx', // 0xd6
  'xxx xxx', // 0xd7
  'cld imp', // 0xd8
  'cmp absy', // 0xd9
  'xxx acc', // 0xda
  'xxx xxx', // 0xdb
  'xxx xxx', // 0xdc
  'cmp absx', // 0xdd
  'dec absx', // 0xde
  'xxx xxx', // 0xdf

  'cpx imm', // 0xe0
  'sbc indx', // 0xe1
  'xxx xxx', // 0xe2
  'xxx xxx', // 0xe3
  'cpx zp', // 0xe4
  'sbc zp', // 0xe5
  'inc zp', // 0xe6
  'xxx xxx', // 0xe7
  'inx imp', // 0xe8
  'sbc imm', // 0xe9
  'nop acc', // 0xea
  'xxx xxx', // 0xeb
  'cpx abs', // 0xec
  'sbc abs', // 0xed
  'inc abs', // 0xee
  'xxx xxx', // 0xef

  'beq rel', // 0xf0
  'sbc indy', // 0xf1
  'xxx xxx', // 0xf2
  'xxx xxx', // 0xf3
  'xxx zpx', // 0xf4
  'sbc zpx', // 0xf5
  'inc zpx', // 0xf6
  'xxx xxx', // 0xf7
  'sed imp', // 0xf8
  'sbc absy', // 0xf9
  'xxx acc', // 0xfa
  'xxx xxx', // 0xfb
  'xxx xxx', // 0xfc
  'sbc absx', // 0xfd
  'inc absx', // 0xfe
  'xxx xxx' // 0xff
];
