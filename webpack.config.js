const path = require('path')

module.exports = {
  entry: './index.js',
  output: {
    filename: 'polywolf.min.js',
    path: path.resolve(__dirname, '')
  },
    module: {
      rules: [
        {
          test: /\.(jpg|png|jpe?g|gif|hdr)?$/,
          use: [
            {
              loader: 'url-loader',
              options: {
                outputPath: 'images',
              },
            },
          ],
        },
      ],
    },
}