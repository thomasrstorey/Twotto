var TwitterStrategy = require('passport-twitter').Strategy;
var User = require('../app/models/user');
var config = require('./oauth');

module.exports = function(passport){
  // serialize and deserialize
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});
	passport.deserializeUser(function(id, done) {
		User.findById(id, function(err, user){
			done(err, user);
		});
	});
	// twitter ===========================================
	passport.use(new TwitterStrategy({
	    consumerKey: config.consumer_key,
	    consumerSecret: config.consumer_secret,
	    callbackURL: config.callback_url
	},
	function(token, tokenSecret, profile, done){
		process.nextTick(function(){
			//look for existing user in database
			//if found, return that user
			//else, make new user and return it
			User.findOne({ 'twitter.id' : profile.id}, function(err, user){
				if(err){
					return done(err);
				}
				if(user){
					return done(null, user);
				} else {
					var newUser = new User();
					newUser.twitter.id = profile.id;
					newUser.twitter.token = token;
					newUser.twitter.tokenSecret = tokenSecret;
					newUser.twitter.username = profile.username;
					newUser.twitter.displayName = profile.displayName;

					newUser.save(function(err){
						if(err){
							throw err;
						}
						return done(null, newUser);
					});
				}
			});
		});
	}));
}