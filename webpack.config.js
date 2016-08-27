'use strict';

var webpack = require('webpack')

var env = process.env.NODE_ENV
var config = {
  module: {
    loaders: [
      {
        loader: 'babel',
        query: { presets: ['es2015'] },
        test: /\.js$/,
        exclude: /node_modules/
      }
    ]
  },
  devtool: 'source-map',
  externals: {
    pico: 'Pico'
  },
  output: {
    library: 'SID',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env)
    })
  ]
};

if (env === 'production') {
  config.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false
      }
    })
  )
}

module.exports = config
