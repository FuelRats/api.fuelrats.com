var BowerWebpackPlugin, Webpack;

BowerWebpackPlugin = require( 'bower-webpack-plugin' );
Webpack = require( 'webpack' );

module.exports = {
  app: {
    target: 'node',

    devtool: 'source-map',

    entry: './js/index.js',

    output: {
      filename: 'bundle.js',
      sourceMapFilename: 'bundle.js.map'
    },

    module: {
      loaders: [
        {
          test: /\.hbs$/,
          loader: 'handlebars-loader'
        },
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel?optional[]=runtime'
        }
      ]
    },

    plugins: [
      new BowerWebpackPlugin,
      new Webpack.ProvidePlugin({
        $: 'jquery',
        _:'underscore',
        Backbone: 'backbone',
        Marionette: 'backbone.marionette',
        SuperModel: 'supermodel'
      })
    ],

    resolve: {
      alias: {
        collections: __dirname + '/../js/collections',
        models: __dirname + '/../js/models',
        routes: __dirname + '/../js/routes',
        shims: __dirname + '/../js/shims',
        templates: __dirname + '/../templates',
        views: __dirname + '/../js/views',
      }
    },

    stats: {
      colors: true,
      reasons: true
    }
  }
}
