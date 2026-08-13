const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: path.join(__dirname, 'src/main.js'),
    // Matches Angular's "application" builder convention (dist/<project>/browser), so
    // demo_server.py's ANGULAR_DIST path did not need to change when the builder did.
    output: {
      path: path.join(__dirname, 'dist/portal-angular/browser'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          // Inlines each component's template as a JS string at build time (`import
          // template from './x.html'`), since there is no server here to resolve Angular's
          // usual templateUrl HTTP fetch. Webpack 5's built-in asset/source type needs no
          // extra loader package for this. `src/index.html` is excluded since
          // HtmlWebpackPlugin needs to process that one as a real HTML template, not as an
          // inlined JS string.
          test: /\.html$/,
          exclude: path.join(__dirname, 'src/index.html'),
          type: 'asset/source',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src/index.html'),
        favicon: path.join(__dirname, 'src/favicon.ico'),
      }),
    ],
    devServer: {
      host: '0.0.0.0',
      port: 4200,
      historyApiFallback: true,
      proxy: [
        {
          context: ['/api'],
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      ],
    },
    performance: {
      // Angular's own budgets (500kb warn / 1mb error) were tuned for a compiled framework
      // runtime; AngularJS's UMD bundle is a different shape, so this keeps the intent
      // (catch runaway bundle growth) without inheriting a threshold sized for the old stack.
      maxAssetSize: 1024 * 1024,
      maxEntrypointSize: 1024 * 1024,
    },
  };
};
