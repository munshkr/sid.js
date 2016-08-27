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
      for (let i = 0; i < 65536; i++) {
        this.mem[i] = 0;
      }
    }

    if (sid) {
      this.sid = sid;
    }

    this.cpuReset();
  }

  getmem(addr) {
    //if (addr < 0 || addr > 65536) console.log("MOS6510#getmem: out of range addr: " + addr + " (caller: " + arguments.caller + ")");
    //if (addr == 0xdd0d) {
    //	this.mem[addr] = 0;
    //}
    return this.mem[addr];
  }

  setmem(addr, value) {
    //if (addr < 0 || addr > 65535) console.log("MOS6510#getmem: out of range addr: " + addr + " (caller: " + arguments.caller + ")");
    //if (value < 0 || value > 255 ) console.log("MOS6510#getmem: out of range value: " + value + " (caller: " + arguments.caller + ")");
    if ((addr & 0xfc00) == 0xd400 && this.sid !== null) {
      this.sid.poke(addr & 0x1f, value);
      if (addr > 0xd418) {
        //console.log("attempted digi poke:", addr, value);
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
    case mode.imp:
      this.cycles += 2;
      return 0;
    case mode.imm:
      this.cycles += 2;
      return this.getmem(this.pcinc());
    case mode.abs:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      return this.getmem(ad);
    case mode.absx:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= 256 * this.getmem(this.pcinc());
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad2);
    case mode.absy:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= 256 * this.getmem(this.pcinc());
      ad2 = ad + this.y;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad2);
    case mode.zp:
      this.cycles += 3;
      ad = this.getmem(this.pcinc());
      return this.getmem(ad);
    case mode.zpx:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      return this.getmem(ad & 0xff);
    case mode.zpy:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.y;
      return this.getmem(ad & 0xff);
    case mode.indx:
      this.cycles += 6;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      ad2 = this.getmem(ad & 0xff);
      ad++;
      ad2 |= this.getmem(ad & 0xff) << 8;
      return this.getmem(ad2);
    case mode.indy:
      this.cycles += 5;
      ad = this.getmem(this.pcinc());
      ad2 = this.getmem(ad);
      ad2 |= this.getmem((ad + 1) & 0xff) << 8;
      ad = ad2 + this.y;
      ad &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      return this.getmem(ad);
    case mode.acc:
      this.cycles += 2;
      return this.a;
    }
    //console.log("getaddr: attempted unhandled mode");
    return 0;
  }

  setaddr(mode, val) {
    let ad, ad2;
    // FIXME: not checking pc addresses as all should be relative to a valid instruction
    switch (mode) {
    case mode.abs:
      this.cycles += 2;
      ad = this.getmem(this.pc - 2);
      ad |= 256 * this.getmem(this.pc - 1);
      this.setmem(ad, val);
      return;
    case mode.absx:
      this.cycles += 3;
      ad = this.getmem(this.pc - 2);
      ad |= 256 * this.getmem(this.pc - 1);
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles--;
      this.setmem(ad2, val);
      return;
    case mode.zp:
      this.cycles += 2;
      ad = this.getmem(this.pc - 1);
      this.setmem(ad, val);
      return;
    case mode.zpx:
      this.cycles += 2;
      ad = this.getmem(this.pc - 1);
      ad += this.x;
      this.setmem(ad & 0xff, val);
      return;
    case mode.acc:
      this.a = val;
      return;
    }
    //console.log("setaddr: attempted unhandled mode");
  }

  putaddr(mode, val) {
    let ad, ad2;
    switch (mode) {
    case mode.abs:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      this.setmem(ad, val);
      return;
    case mode.absx:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      ad2 = ad + this.x;
      ad2 &= 0xffff;
      this.setmem(ad2, val);
      return;
    case mode.absy:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad |= this.getmem(this.pcinc()) << 8;
      ad2 = ad + this.y;
      ad2 &= 0xffff;
      if ((ad2 & 0xff00) != (ad & 0xff00)) this.cycles++;
      this.setmem(ad2, val);
      return;
    case mode.zp:
      this.cycles += 3;
      ad = this.getmem(this.pcinc());
      this.setmem(ad, val);
      return;
    case mode.zpx:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      this.setmem(ad & 0xff, val);
      return;
    case mode.zpy:
      this.cycles += 4;
      ad = this.getmem(this.pcinc());
      ad += this.y;
      this.setmem(ad & 0xff, val);
      return;
    case mode.indx:
      this.cycles += 6;
      ad = this.getmem(this.pcinc());
      ad += this.x;
      ad2 = this.getmem(ad & 0xff);
      ad++;
      ad2 |= this.getmem(ad & 0xff) << 8;
      this.setmem(ad2, val);
      return;
    case mode.indy:
      this.cycles += 5;
      ad = this.getmem(this.pcinc());
      ad2 = this.getmem(ad);
      ad2 |= this.getmem((ad + 1) & 0xff) << 8;
      ad = ad2 + this.y;
      ad &= 0xffff;
      this.setmem(ad, val);
      return;
    case mode.acc:
      this.cycles += 2;
      this.a = val;
      return;
    }
    //console.log("putaddr: attempted unhandled mode");
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
    let dist = this.getaddr(this.mode.imm);
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
    let cmd = opcodes[opc][0];
    let addr = opcodes[opc][1];

    //console.log(opc, cmd, addr);

    switch (cmd) {
    case inst.adc:
      this.wval = this.a + this.getaddr(addr) + ((this.p & flag.C) ? 1 : 0);
      this.setflags(flag.C, this.wval & 0x100);
      this.a = this.wval & 0xff;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      this.setflags(flag.V, ((this.p & flag.C) ? 1 : 0) ^ ((this.p & flag.N) ? 1 : 0));
      break;
    case inst.and:
      this.bval = this.getaddr(addr);
      this.a &= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case inst.asl:
      this.wval = this.getaddr(addr);
      this.wval <<= 1;
      this.setaddr(addr, this.wval & 0xff);
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.wval & 0x100);
      break;
    case inst.bcc:
      this.branch(!(this.p & flag.C));
      break;
    case inst.bcs:
      this.branch(this.p & flag.C);
      break;
    case inst.bne:
      this.branch(!(this.p & flag.Z));
      break;
    case inst.beq:
      this.branch(this.p & flag.Z);
      break;
    case inst.bpl:
      this.branch(!(this.p & flag.N));
      break;
    case inst.bmi:
      this.branch(this.p & flag.N);
      break;
    case inst.bvc:
      this.branch(!(this.p & flag.V));
      break;
    case inst.bvs:
      this.branch(this.p & flag.V);
      break;
    case inst.bit:
      this.bval = this.getaddr(addr);
      this.setflags(flag.Z, !(this.a & this.bval));
      this.setflags(flag.N, this.bval & 0x80);
      this.setflags(flag.V, this.bval & 0x40);
      break;
    case inst.brk:
      this.pc = 0; // just quit per rockbox
      //this.push(this.pc & 0xff);
      //this.push(this.pc >> 8);
      //this.push(this.p);
      //this.setflags(flag.B, 1);
      // FIXME: should Z be set as well?
      //this.pc = this.getmem(0xfffe);
      //this.cycles += 7;
      break;
    case inst.clc:
      this.cycles += 2;
      this.setflags(flag.C, 0);
      break;
    case inst.cld:
      this.cycles += 2;
      this.setflags(flag.D, 0);
      break;
    case inst.cli:
      this.cycles += 2;
      this.setflags(flag.I, 0);
      break;
    case inst.clv:
      this.cycles += 2;
      this.setflags(flag.V, 0);
      break;
    case inst.cmp:
      this.bval = this.getaddr(addr);
      this.wval = this.a - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.a >= this.bval);
      break;
    case inst.cpx:
      this.bval = this.getaddr(addr);
      this.wval = this.x - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.x >= this.bval);
      break;
    case inst.cpy:
      this.bval = this.getaddr(addr);
      this.wval = this.y - this.bval;
      // FIXME: may not actually be needed (yay 2's complement)
      if (this.wval < 0) this.wval += 256;
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.y >= this.bval);
      break;
    case inst.dec:
      this.bval = this.getaddr(addr);
      this.bval--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.bval < 0) this.bval += 256;
      this.setaddr(addr, this.bval);
      this.setflags(flag.Z, !this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      break;
    case inst.dex:
      this.cycles += 2;
      this.x--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.x < 0) this.x += 256;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case inst.dey:
      this.cycles += 2;
      this.y--;
      // FIXME: may be able to just mask this (yay 2's complement)
      if (this.y < 0) this.y += 256;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case inst.eor:
      this.bval = this.getaddr(addr);
      this.a ^= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case inst.inc:
      this.bval = this.getaddr(addr);
      this.bval++;
      this.bval &= 0xff;
      this.setaddr(addr, this.bval);
      this.setflags(flag.Z, !this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      break;
    case inst.inx:
      this.cycles += 2;
      this.x++;
      this.x &= 0xff;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case inst.iny:
      this.cycles += 2;
      this.y++;
      this.y &= 0xff;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case inst.jmp:
      this.cycles += 3;
      this.wval = this.getmem(this.pcinc());
      this.wval |= 256 * this.getmem(this.pcinc());
      switch (addr) {
      case mode.abs:
        this.pc = this.wval;
        break;
      case mode.ind:
        this.pc = this.getmem(this.wval);
        this.pc |= 256 * this.getmem((this.wval + 1) & 0xffff);
        this.cycles += 2;
        break;
      }
      break;
    case inst.jsr:
      this.cycles += 6;
      this.push(((this.pc + 1) & 0xffff) >> 8);
      this.push((this.pc + 1) & 0xff);
      this.wval = this.getmem(this.pcinc());
      this.wval |= 256 * this.getmem(this.pcinc());
      this.pc = this.wval;
      break;
    case inst.lda:
      this.a = this.getaddr(addr);
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case inst.ldx:
      this.x = this.getaddr(addr);
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case inst.ldy:
      this.y = this.getaddr(addr);
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case inst.lsr:
      this.bval = this.getaddr(addr);
      this.wval = this.bval;
      this.wval >>= 1;
      this.setaddr(addr, this.wval & 0xff);
      this.setflags(flag.Z, !this.wval);
      this.setflags(flag.N, this.wval & 0x80);
      this.setflags(flag.C, this.bval & 1);
      break;
    case inst.nop:
      this.cycles += 2;
      break;
    case inst.ora:
      this.bval = this.getaddr(addr);
      this.a |= this.bval;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case inst.pha:
      this.push(this.a);
      this.cycles += 3;
      break;
    case inst.php:
      this.push(this.p);
      this.cycles += 3;
      break;
    case inst.pla:
      this.a = this.pop();
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      this.cycles += 4;
      break;
    case inst.plp:
      this.p = this.pop();
      this.cycles += 4;
      break;
    case inst.rol:
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
    case inst.ror:
      this.bval = this.getaddr(addr);
      c = (this.p & flag.C) ? 128 : 0;
      this.setflags(flag.C, this.bval & 1);
      this.bval >>= 1;
      this.bval |= c;
      this.setaddr(addr, this.bval);
      this.setflags(flag.N, this.bval & 0x80);
      this.setflags(flag.Z, !this.bval);
      break;
    case inst.rti:
      // treat like RTS
    case inst.rts:
      this.wval = this.pop();
      this.wval |= 256 * this.pop();
      this.pc = this.wval + 1;
      this.cycles += 6;
      break;
    case inst.sbc:
      this.bval = this.getaddr(addr) ^ 0xff;
      this.wval = this.a + this.bval + ((this.p & flag.C) ? 1 : 0);
      this.setflags(flag.C, this.wval & 0x100);
      this.a = this.wval & 0xff;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a > 127);
      this.setflags(flag.V, ((this.p & flag.C) ? 1 : 0) ^ ((this.p & flag.N) ? 1 : 0));
      break;
    case inst.sec:
      this.cycles += 2;
      this.setflags(flag.C, 1);
      break;
    case inst.sed:
      this.cycles += 2;
      this.setflags(flag.D, 1);
      break;
    case inst.sei:
      this.cycles += 2;
      this.setflags(flag.I, 1);
      break;
    case inst.sta:
      this.putaddr(addr, this.a);
      break;
    case inst.stx:
      this.putaddr(addr, this.x);
      break;
    case inst.sty:
      this.putaddr(addr, this.y);
      break;
    case inst.tax:
      this.cycles += 2;
      this.x = this.a;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case inst.tay:
      this.cycles += 2;
      this.y = this.a;
      this.setflags(flag.Z, !this.y);
      this.setflags(flag.N, this.y & 0x80);
      break;
    case inst.tsx:
      this.cycles += 2;
      this.x = this.s;
      this.setflags(flag.Z, !this.x);
      this.setflags(flag.N, this.x & 0x80);
      break;
    case inst.txa:
      this.cycles += 2;
      this.a = this.x;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    case inst.txs:
      this.cycles += 2;
      this.s = this.x;
      break;
    case inst.tya:
      this.cycles += 2;
      this.a = this.y;
      this.setflags(flag.Z, !this.a);
      this.setflags(flag.N, this.a & 0x80);
      break;
    default:
      //console.log("cpuParse: attempted unhandled instruction, opcode: ", opc);
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


// Opcodes Enum
const inst = Object.freeze({
  adc: {},
  and: {},
  asl: {},
  bcc: {},
  bcs: {},
  beq: {},
  bit: {},
  bmi: {},
  bne: {},
  bpl: {},
  brk: {},
  bvc: {},
  bvs: {},
  clc: {},
  cld: {},
  cli: {},
  clv: {},
  cmp: {},
  cpx: {},
  cpy: {},
  dec: {},
  dex: {},
  dey: {},
  eor: {},
  inc: {},
  inx: {},
  iny: {},
  jmp: {},
  jsr: {},
  lda: {},
  ldx: {},
  ldy: {},
  lsr: {},
  nop: {},
  ora: {},
  pha: {},
  php: {},
  pla: {},
  plp: {},
  rol: {},
  ror: {},
  rti: {},
  rts: {},
  sbc: {},
  sec: {},
  sed: {},
  sei: {},
  sta: {},
  stx: {},
  sty: {},
  tax: {},
  tay: {},
  tsx: {},
  txa: {},
  txs: {},
  tya: {},
  xxx: {}
});

// Modes Enum
const mode = Object.freeze({
  imp:  {},
  imm:  {},
  abs:  {},
  absx: {},
  absy: {},
  zp:   {},
  zpx:  {},
  zpy:  {},
  ind:  {},
  indx: {},
  indy: {},
  acc:  {},
  rel:  {},
  xxx:  {}
});

// 256 entries, each entry array pair of [inst, mode]
const opcodes = new Array(
  [inst.brk, mode.imp], // 0x00
  [inst.ora, mode.indx], // 0x01
  [inst.xxx, mode.xxx], // 0x02
  [inst.xxx, mode.xxx], // 0x03
  [inst.xxx, mode.zp], // 0x04
  [inst.ora, mode.zp], // 0x05
  [inst.asl, mode.zp], // 0x06
  [inst.xxx, mode.xxx], // 0x07
  [inst.php, mode.imp], // 0x08
  [inst.ora, mode.imm], // 0x09
  [inst.asl, mode.acc], // 0x0a
  [inst.xxx, mode.xxx], // 0x0b
  [inst.xxx, mode.abs], // 0x0c
  [inst.ora, mode.abs], // 0x0d
  [inst.asl, mode.abs], // 0x0e
  [inst.xxx, mode.xxx], // 0x0f

  [inst.bpl, mode.rel], // 0x10
  [inst.ora, mode.indy], // 0x11
  [inst.xxx, mode.xxx], // 0x12
  [inst.xxx, mode.xxx], // 0x13
  [inst.xxx, mode.xxx], // 0x14
  [inst.ora, mode.zpx], // 0x15
  [inst.asl, mode.zpx], // 0x16
  [inst.xxx, mode.xxx], // 0x17
  [inst.clc, mode.imp], // 0x18
  [inst.ora, mode.absy], // 0x19
  [inst.xxx, mode.xxx], // 0x1a
  [inst.xxx, mode.xxx], // 0x1b
  [inst.xxx, mode.xxx], // 0x1c
  [inst.ora, mode.absx], // 0x1d
  [inst.asl, mode.absx], // 0x1e
  [inst.xxx, mode.xxx], // 0x1f

  [inst.jsr, mode.abs], // 0x20
  [inst.and, mode.indx], // 0x21
  [inst.xxx, mode.xxx], // 0x22
  [inst.xxx, mode.xxx], // 0x23
  [inst.bit, mode.zp], // 0x24
  [inst.and, mode.zp], // 0x25
  [inst.rol, mode.zp], // 0x26
  [inst.xxx, mode.xxx], // 0x27
  [inst.plp, mode.imp], // 0x28
  [inst.and, mode.imm], // 0x29
  [inst.rol, mode.acc], // 0x2a
  [inst.xxx, mode.xxx], // 0x2b
  [inst.bit, mode.abs], // 0x2c
  [inst.and, mode.abs], // 0x2d
  [inst.rol, mode.abs], // 0x2e
  [inst.xxx, mode.xxx], // 0x2f

  [inst.bmi, mode.rel], // 0x30
  [inst.and, mode.indy], // 0x31
  [inst.xxx, mode.xxx], // 0x32
  [inst.xxx, mode.xxx], // 0x33
  [inst.xxx, mode.xxx], // 0x34
  [inst.and, mode.zpx], // 0x35
  [inst.rol, mode.zpx], // 0x36
  [inst.xxx, mode.xxx], // 0x37
  [inst.sec, mode.imp], // 0x38
  [inst.and, mode.absy], // 0x39
  [inst.xxx, mode.xxx], // 0x3a
  [inst.xxx, mode.xxx], // 0x3b
  [inst.xxx, mode.xxx], // 0x3c
  [inst.and, mode.absx], // 0x3d
  [inst.rol, mode.absx], // 0x3e
  [inst.xxx, mode.xxx], // 0x3f

  [inst.rti, mode.imp], // 0x40
  [inst.eor, mode.indx], // 0x41
  [inst.xxx, mode.xxx], // 0x42
  [inst.xxx, mode.xxx], // 0x43
  [inst.xxx, mode.zp], // 0x44
  [inst.eor, mode.zp], // 0x45
  [inst.lsr, mode.zp], // 0x46
  [inst.xxx, mode.xxx], // 0x47
  [inst.pha, mode.imp], // 0x48
  [inst.eor, mode.imm], // 0x49
  [inst.lsr, mode.acc], // 0x4a
  [inst.xxx, mode.xxx], // 0x4b
  [inst.jmp, mode.abs], // 0x4c
  [inst.eor, mode.abs], // 0x4d
  [inst.lsr, mode.abs], // 0x4e
  [inst.xxx, mode.xxx], // 0x4f

  [inst.bvc, mode.rel], // 0x50
  [inst.eor, mode.indy], // 0x51
  [inst.xxx, mode.xxx], // 0x52
  [inst.xxx, mode.xxx], // 0x53
  [inst.xxx, mode.xxx], // 0x54
  [inst.eor, mode.zpx], // 0x55
  [inst.lsr, mode.zpx], // 0x56
  [inst.xxx, mode.xxx], // 0x57
  [inst.cli, mode.imp], // 0x58
  [inst.eor, mode.absy], // 0x59
  [inst.xxx, mode.xxx], // 0x5a
  [inst.xxx, mode.xxx], // 0x5b
  [inst.xxx, mode.xxx], // 0x5c
  [inst.eor, mode.absx], // 0x5d
  [inst.lsr, mode.absx], // 0x5e
  [inst.xxx, mode.xxx], // 0x5f

  [inst.rts, mode.imp], // 0x60
  [inst.adc, mode.indx], // 0x61
  [inst.xxx, mode.xxx], // 0x62
  [inst.xxx, mode.xxx], // 0x63
  [inst.xxx, mode.zp], // 0x64
  [inst.adc, mode.zp], // 0x65
  [inst.ror, mode.zp], // 0x66
  [inst.xxx, mode.xxx], // 0x67
  [inst.pla, mode.imp], // 0x68
  [inst.adc, mode.imm], // 0x69
  [inst.ror, mode.acc], // 0x6a
  [inst.xxx, mode.xxx], // 0x6b
  [inst.jmp, mode.ind], // 0x6c
  [inst.adc, mode.abs], // 0x6d
  [inst.ror, mode.abs], // 0x6e
  [inst.xxx, mode.xxx], // 0x6f

  [inst.bvs, mode.rel], // 0x70
  [inst.adc, mode.indy], // 0x71
  [inst.xxx, mode.xxx], // 0x72
  [inst.xxx, mode.xxx], // 0x73
  [inst.xxx, mode.xxx], // 0x74
  [inst.adc, mode.zpx], // 0x75
  [inst.ror, mode.zpx], // 0x76
  [inst.xxx, mode.xxx], // 0x77
  [inst.sei, mode.imp], // 0x78
  [inst.adc, mode.absy], // 0x79
  [inst.xxx, mode.xxx], // 0x7a
  [inst.xxx, mode.xxx], // 0x7b
  [inst.xxx, mode.xxx], // 0x7c
  [inst.adc, mode.absx], // 0x7d
  [inst.ror, mode.absx], // 0x7e
  [inst.xxx, mode.xxx], // 0x7f

  [inst.xxx, mode.imm], // 0x80
  [inst.sta, mode.indx], // 0x81
  [inst.xxx, mode.xxx], // 0x82
  [inst.xxx, mode.xxx], // 0x83
  [inst.sty, mode.zp], // 0x84
  [inst.sta, mode.zp], // 0x85
  [inst.stx, mode.zp], // 0x86
  [inst.xxx, mode.xxx], // 0x87
  [inst.dey, mode.imp], // 0x88
  [inst.xxx, mode.imm], // 0x89
  [inst.txa, mode.acc], // 0x8a
  [inst.xxx, mode.xxx], // 0x8b
  [inst.sty, mode.abs], // 0x8c
  [inst.sta, mode.abs], // 0x8d
  [inst.stx, mode.abs], // 0x8e
  [inst.xxx, mode.xxx], // 0x8f

  [inst.bcc, mode.rel], // 0x90
  [inst.sta, mode.indy], // 0x91
  [inst.xxx, mode.xxx], // 0x92
  [inst.xxx, mode.xxx], // 0x93
  [inst.sty, mode.zpx], // 0x94
  [inst.sta, mode.zpx], // 0x95
  [inst.stx, mode.zpy], // 0x96
  [inst.xxx, mode.xxx], // 0x97
  [inst.tya, mode.imp], // 0x98
  [inst.sta, mode.absy], // 0x99
  [inst.txs, mode.acc], // 0x9a
  [inst.xxx, mode.xxx], // 0x9b
  [inst.xxx, mode.xxx], // 0x9c
  [inst.sta, mode.absx], // 0x9d
  [inst.xxx, mode.absx], // 0x9e
  [inst.xxx, mode.xxx], // 0x9f

  [inst.ldy, mode.imm], // 0xa0
  [inst.lda, mode.indx], // 0xa1
  [inst.ldx, mode.imm], // 0xa2
  [inst.xxx, mode.xxx], // 0xa3
  [inst.ldy, mode.zp], // 0xa4
  [inst.lda, mode.zp], // 0xa5
  [inst.ldx, mode.zp], // 0xa6
  [inst.xxx, mode.xxx], // 0xa7
  [inst.tay, mode.imp], // 0xa8
  [inst.lda, mode.imm], // 0xa9
  [inst.tax, mode.acc], // 0xaa
  [inst.xxx, mode.xxx], // 0xab
  [inst.ldy, mode.abs], // 0xac
  [inst.lda, mode.abs], // 0xad
  [inst.ldx, mode.abs], // 0xae
  [inst.xxx, mode.xxx], // 0xaf

  [inst.bcs, mode.rel], // 0xb0
  [inst.lda, mode.indy], // 0xb1
  [inst.xxx, mode.xxx], // 0xb2
  [inst.xxx, mode.xxx], // 0xb3
  [inst.ldy, mode.zpx], // 0xb4
  [inst.lda, mode.zpx], // 0xb5
  [inst.ldx, mode.zpy], // 0xb6
  [inst.xxx, mode.xxx], // 0xb7
  [inst.clv, mode.imp], // 0xb8
  [inst.lda, mode.absy], // 0xb9
  [inst.tsx, mode.acc], // 0xba
  [inst.xxx, mode.xxx], // 0xbb
  [inst.ldy, mode.absx], // 0xbc
  [inst.lda, mode.absx], // 0xbd
  [inst.ldx, mode.absy], // 0xbe
  [inst.xxx, mode.xxx], // 0xbf

  [inst.cpy, mode.imm], // 0xc0
  [inst.cmp, mode.indx], // 0xc1
  [inst.xxx, mode.xxx], // 0xc2
  [inst.xxx, mode.xxx], // 0xc3
  [inst.cpy, mode.zp], // 0xc4
  [inst.cmp, mode.zp], // 0xc5
  [inst.dec, mode.zp], // 0xc6
  [inst.xxx, mode.xxx], // 0xc7
  [inst.iny, mode.imp], // 0xc8
  [inst.cmp, mode.imm], // 0xc9
  [inst.dex, mode.acc], // 0xca
  [inst.xxx, mode.xxx], // 0xcb
  [inst.cpy, mode.abs], // 0xcc
  [inst.cmp, mode.abs], // 0xcd
  [inst.dec, mode.abs], // 0xce
  [inst.xxx, mode.xxx], // 0xcf

  [inst.bne, mode.rel], // 0xd0
  [inst.cmp, mode.indy], // 0xd1
  [inst.xxx, mode.xxx], // 0xd2
  [inst.xxx, mode.xxx], // 0xd3
  [inst.xxx, mode.zpx], // 0xd4
  [inst.cmp, mode.zpx], // 0xd5
  [inst.dec, mode.zpx], // 0xd6
  [inst.xxx, mode.xxx], // 0xd7
  [inst.cld, mode.imp], // 0xd8
  [inst.cmp, mode.absy], // 0xd9
  [inst.xxx, mode.acc], // 0xda
  [inst.xxx, mode.xxx], // 0xdb
  [inst.xxx, mode.xxx], // 0xdc
  [inst.cmp, mode.absx], // 0xdd
  [inst.dec, mode.absx], // 0xde
  [inst.xxx, mode.xxx], // 0xdf

  [inst.cpx, mode.imm], // 0xe0
  [inst.sbc, mode.indx], // 0xe1
  [inst.xxx, mode.xxx], // 0xe2
  [inst.xxx, mode.xxx], // 0xe3
  [inst.cpx, mode.zp], // 0xe4
  [inst.sbc, mode.zp], // 0xe5
  [inst.inc, mode.zp], // 0xe6
  [inst.xxx, mode.xxx], // 0xe7
  [inst.inx, mode.imp], // 0xe8
  [inst.sbc, mode.imm], // 0xe9
  [inst.nop, mode.acc], // 0xea
  [inst.xxx, mode.xxx], // 0xeb
  [inst.cpx, mode.abs], // 0xec
  [inst.sbc, mode.abs], // 0xed
  [inst.inc, mode.abs], // 0xee
  [inst.xxx, mode.xxx], // 0xef

  [inst.beq, mode.rel], // 0xf0
  [inst.sbc, mode.indy], // 0xf1
  [inst.xxx, mode.xxx], // 0xf2
  [inst.xxx, mode.xxx], // 0xf3
  [inst.xxx, mode.zpx], // 0xf4
  [inst.sbc, mode.zpx], // 0xf5
  [inst.inc, mode.zpx], // 0xf6
  [inst.xxx, mode.xxx], // 0xf7
  [inst.sed, mode.imp], // 0xf8
  [inst.sbc, mode.absy], // 0xf9
  [inst.xxx, mode.acc], // 0xfa
  [inst.xxx, mode.xxx], // 0xfb
  [inst.xxx, mode.xxx], // 0xfc
  [inst.sbc, mode.absx], // 0xfd
  [inst.inc, mode.absx], // 0xfe
  [inst.xxx, mode.xxx] // 0xff
);
