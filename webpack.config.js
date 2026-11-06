//@ts-check
'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const chromeExtensionConfig = {
  mode: 'production',
  devtool: 'cheap-module-source-map',
  entry: {
    background: './src/background.ts',
    sidepanel: './src/sidepanel.ts',
    contentScript: './src/contentScript.ts',
    pageInterceptor: './src/pageInterceptor.ts',
    offscreen: './src/offscreen.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/sidepanel.html', to: 'sidepanel.html' },
        { from: 'src/sidepanel.css', to: 'sidepanel.css' },
        { from: 'src/offscreen.html', to: 'offscreen.html' },
        { from: 'resources', to: 'icons' },
      ],
    }),
  ],
  performance: {
    hints: false,
  },
};

module.exports = [chromeExtensionConfig];
