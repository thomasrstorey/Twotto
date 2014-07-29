var User = require('./models/user');
var Bot = require('../bot');
module.exports = function(app, passport, config){

	//server routes =========================================
	 //api/db calls
	 app.post('api/bot/start/:username', ensureAuthenticated, function(req, res){
	 	var username = req.params.username;
	 	user = User.findOne({ 'twitter.username' : username}, function(err, user){
	 		if(err){
	 			res.send('Error getting user');
	 		}
	 		if(user){
	 			var postauth = config;
    			postauth.access_token = req.user.token;
    			postauth.access_token_secret = req.user.tokenSecret;
    			if(!app.locals.activeBots.hasOwnProperty(username) || app.locals.activeBots[username] === null){
    				app.locals.activeBots[username] = new Bot(postauth, req.user, user);
    				app.locals.activeBots[username].updateFriendsArray();
    				console.log('made new bot for ' + username + '!');
    				res.send('bot started');
    			} else {
    				res.send('bot already running!');
    			}
	 		}
	 	});
	 });
	 //authentication calls
	 app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res){

	 });

	 app.get('/auth/twitter/callback', allowCrossDomain,
	 	passport.authenticate('twitter', {
        	failureRedirect: '/'
     	}), function(req, res){
	 		res.redirect('/app/');
     	});

	 app.post('/logout', function(req, res){
     	req.logout();
     	console.log("THIS IS HAPPENING");
     	res.render('./main');
	 });

	 app.get('/loggedin', function(req, res){
	 	res.send(req.isAuthenticated() ? req.user : '0');
	 })

	 app.get('/', function(req, res){
	 	res.render('./main');
	 });

	 app.get('/user', ensureAuthenticated, function(req, res){
	 	res.send(req.user);
	 });

	 //frontend routes ======================================
	 //route to handle all angular requests
	 app.get('/app/*', ensureAuthenticated, function(req, res){
  		res.render('../index', { title: 'Doppeltweeter'});
	});
};

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	console.log('THIS IS HAPPENING TOO');
	res.redirect('/');
};

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if ('OPTIONS' == req.method) {
        res.send(200);
    }
    else {
        next();
    }
};