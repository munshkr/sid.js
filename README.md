# sid.js

SID chip synthesizer emulator for Javascript.

Source code is based mainly on [jsSID](https://github.com/jhohertz/jsSID) by
Joe Hohertz.  For now the main difference is that code was refactored into
ES2015 classes, and it's an NPM-installable package.

Depends on [Pico.js](https://mohayonao.github.io/pico.js/) for a cross-platform
audio processor (not included).

## Example

```javascript
var player = new SID.Player(SID.ReSID);

/* fetch SID file and start playing */
player.loadURL('music/song.sid', function() {
  this.play();   /* `this` binded to player instance */

  /* stop after 5 seconds... */
  setTimeout(function() { player.stop() }, 5000);
});
```


## Install

You can install with npm:

```bash
npm install munshkr/sid.js
```

If you clone the repo, install all dependency packages with `npm install`.

Then run `npm run build` to build everything.

* `src` contains original ES2015 source code
* `lib` contains CommonJS-compatible source modules
* `dist` contains minified and non-minified builds in UMD format, ready to be
  used in a browser without any bundlers.


## Usage

Because sid.js depends on Pico.js to write to the browser's audio context, you must
include it first:

```html
<head>
  <script type="text/javascript" src="pico.min.js"></script>
  <script type="text/javascript" src="sid.min.js"></script>
  <!-- ... -->
</head>
```

If you use `sid.min.js`, remember that Player, or the synth classes are inside
the SID *namespace* object, so you have to prefix them with `SID.` (see example
above).

You can pass an options object when constructing Player with the following keys:

* `synth`: Type of synthesis emulator to use. You must provide a synth class,
  one of these: `TinySID`, `FastSID` or `ReSID`.

* `clock`: (optional) Force clock to be PAL-B or NTSC. Possible values are: `pal`, `ntsc`
  Default: clock suggested by SID file.

* `model`: (optional) Force SID chip model. Possible values are: `6581`, `8580`.
  Default: model suggested by SID file.

* `sample`: (optional, *only applies to ReSID*) Select a sampling method.
  Possible values are: `fast`, `interpolate`, `resample_interpolate`, `resample_fast`
  Default: `fast`


## Contributing

Bug reports and pull requests are welcome on GitHub at
https://github.com/munshkr/sid.js


## License

Licensed under GPL v2 or later.  See [LICENSE.md](LICENSE.md) for more information.
