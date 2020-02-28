const path = require('path')

module.exports = {
  entry: './index.js',
  output: {
    filename: 'polywolf.min.js',
    path: path.resolve(__dirname, '')
  }
}