# SID.js

SID chip synthesizer emulator for Javascript.

Source code is based mainly on [jsSID](https://github.com/jhohertz/jsSID) by
Joe Hohertz.  The main differences are:

  * Code refactor into ES2015
  * More documentation

Depends on [Pico.js](https://mohayonao.github.io/pico.js/) for a cross-platform
audio processor.

## Example

```javascript
var player = new SID.Player();

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
npm install munshkr/SID.js
```

If you clone the repo, install all dependency packages with `npm install`.

Then run `npm run build` to build everything.

* `src` contains original ES2015 source code
* `lib` contains CommonJS-compatible source modules
* `dist` contains minified and non-minified builds in UMD format, ready to be
  used in a browser without any bundlers.


## Usage

Because SID.js depends on Pico.js to write to the browser's audio context, you must
include it first:

```html
<head>
  <script type="text/javascript" src="pico.min.js"></script>
  <script type="text/javascript" src="sid.min.js"></script>
  <!-- ... -->
</head>
```

## Contributing

Bug reports and pull requests are welcome on GitHub at
https://github.com/munshkr/SID.js


## License

Licensed under GPL v2 or later.  See [LICENSE.md](LICENSE.md) for more information.
