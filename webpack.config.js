const path = require('path');
const config = require('./package.json');

module.exports = {
  entry: './src/index.js',
  output: {
      path: path.resolve(__dirname, 'lib'),
      filename: `gamerpc${config.version}.js`
  },
  module:{
    rules:[ 
      {
          test:/\.js$/,
          exclude:/node_modules/,
          loader:'babel-loader'
      }
    ]
  }
}
