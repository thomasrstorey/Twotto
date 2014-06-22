var Twit = require('twit');
var config = require('./config');

var T = new Twit(config);

//
//  tweet 'hello world!'
//
T.post('statuses/update', { status: 'hello world! testing twit node module' }, function(err, data, response) {
	if (err){console.log(err);}
	else{console.log(data);}
});

