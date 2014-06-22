var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'Twitter Fav Bot',
  description: 'nodejs bot that faves like u~~.',
  script: './bot.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();