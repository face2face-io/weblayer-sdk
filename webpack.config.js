const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

require("dotenv").config();

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "weblayer-sdk.min.js",
    path: path.resolve(__dirname, "dist"),
    library: "WebLayerSDK",
    libraryTarget: "window",
    globalObject: "this",
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.API_URL": JSON.stringify(process.env.API_URL || "https://api.weblayer.ai"),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: false,
        },
      }),
    ],
  },
};


