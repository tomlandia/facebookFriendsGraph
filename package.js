var NwBuilder = require('node-webkit-builder');
var nw = new NwBuilder({
  files: 'facebookFriendsGraph/**',
  platforms: ['win32', 'osx64', 'linux64'],
  version: '0.12.1',
  appName: 'facebookFriendsGraph',
  appVersion: '1.0.0',
  winIco: /^win/.test(process.platform) ? 'icons/win.ico' : null,
  macIcns: 'icons/mac.icns'
});

nw.on('log', console.log);

nw.build().then(function () {
  console.log('all done!');
}).catch(function (error) {
  console.error(error);
});
