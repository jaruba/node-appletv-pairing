const webpack = require('webpack')

//require('source-map-support').install({ environment: 'node', hookRequire: true, handleUncaughtExceptions: true })

const path = require('path')

const opts = {
  entry: path.resolve('./lib/atv.js'),
  target: 'node',
  output: {
    library: 'atv-pairing',
    libraryTarget: 'umd',
    filename: 'atv.js',
    path: path.resolve('./build')
  },
}

webpack(opts).run((err, stats) => {
  if (err || stats.hasErrors()) {
    if (err)
        console.log(err)
    else {
        if ((((stats || {}).compilation || {}).errors || []).length)
            stats.compilation.errors.forEach(err => {
                console.log(err)
            })
        else
            console.log('Unknown bundling error')
    }
    console.log('error')
    return
  }
    console.log('success')
})
