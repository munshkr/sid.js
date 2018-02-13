'use strict';

const webpack = require('webpack')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const env = process.env.NODE_ENV

let config = {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          },
          "eslint-loader"
        ]
      }
    ]
  },
  externals: {
    pico: 'Pico'
  },
  output: {
    library: 'SID',
    libraryTarget: 'umd'
  },
  plugins: []
};

if (env === 'production') {
  config.plugins.push(
    new UglifyJsPlugin()
  )
}

module.exports = config
