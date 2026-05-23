const path = require('path');

const landing = {
  entry: './src/index.ts',
  mode: "production",
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      vm: false
    },
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};

// const app = {
//   entry: './host/src/index.ts',
//   mode: "development",
//   devtool: 'source-map',
//   module: {
//     rules: [
//       {
//         test: /\.tsx?$/,
//         use: 'ts-loader',
//         exclude: /node_modules/,
//       },
//     ],
//   },
//   resolve: {
//     extensions: ['.tsx', '.ts', '.js'],
//     fallback: {
//       fs: false,
//       path: false,
//       crypto: false,
//       stream: false,
//       vm: false
//     },
//   },
//   output: {
//     filename: 'bundle.js',
//     path: path.resolve(__dirname, 'host/dist'),
//   },
// };

module.exports = [landing];