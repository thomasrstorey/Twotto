var mongoose       = require('mongoose');
module.exports = function(app, passport, config, User, Bot){

	//server routes =========================================
	 //api/db calls
	 //authentication calls
	 app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res){

	 });

	 app.get('/auth/twitter/callback',
	 	passport.authenticate('twitter', {
        	failureRedirect: '/auth/failure',
        	successRedirect: '/auth/success'
     	}));

	 app.get('/auth/success', function (req, res){
	 	res.render('after-auth', { state: 'success', user: req.user ? req.user : null});
	 });

	 app.get('/auth/failure', function (req, res){
	 	res.render('after-auth', { state: 'failure', user: null});
	 });

	 app.delete('/auth', function(req, res){
     	req.logout();
     	res.writeHead(200);
     	res.end();
	 });

	 app.get('/app/secured/id', ensureAuthenticated, function(req, res){
	 	var username = req.user.twitter.username;
	 	config.access_token = req.user.twitter.token;
	 	config.access_token_secret = req.user.twitter.tokenSecret;
	 	console.log(JSON.stringify(config));
	 	if(!app.locals.activeBots.hasOwnProperty(username) || app.locals.activeBots[username] === null){
	       app.locals.activeBots[username] = new Bot(config, req.user, User);
	        console.log("Made a new bot for " + username + "!");
	    } else {
	        console.log(username + " already has a bot running");
	    }
  		res.json({ message: req.user.twitter.id,
  				   user: req.user
  				});
	});

	app.post('/app/secured/db/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postRelations(function(err, requser){
				requser.save(function(err){
					if(err){
						console.error("Error saving to db: " + err);
						res.json({ message: "Error"});
					}
					console.log("done");
					res.json({ message: "done"});
				});
			});
		} else {
			res.json({ message: "error: no user"});
		}
		
	});

	app.post('/app/secured/tweet/:username', ensureAuthenticated, function(req, res){

		var username = req.params.username;
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postComposedTweet(username, function(err, tweet){
				if(err){
					res.json({ message: "error: " + err});
				} else {
					res.json({ message: "tweet: " + tweet});
				}
			});
		} else {
			res.json({ message: "error: no user"});
		}

	});

	app.post('/app/secured/fav/:username', ensureAuthenticated, function(req, res){

		var username = req.params.username;
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postFav(function(err, tweetdata){
				if(err){
					res.json({ message: "error: " + err});
				} else {
					app.locals.activeBots[username].postFavDB(tweetdata, function(err, data){
						if(err){
							res.json({ message: "error: " + err});
						}
						data.save(function(err){
							if(err){
								console.error("Error saving to db: " + err);
								res.json({ message: "Error"});
							}
							res.json({ message: "faved " + tweetdata.id_str + " from " + tweetdata.user.screen_name});
						});
						
					});
				}
			});
		} else {
			res.json({ message: "error: no user"});
		}

	});

	app.post('/app/secured/collectFavs/:username', ensureAuthenticated, function(req, res){

		var username = req.params.username;
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].getFavs(function(err, favdata){
				if(err){
					res.json({ message: "error: " + err});
				} else {
					app.locals.activeBots[username].postDBdata(favdata, 'favorites', username, function(err, data, response){
						if(err){
							console.error(err);
							res.json({ message: "error: " + err});
						}
						data.save(function(err){
							if(err){
								console.error("Error saving to db: " + err);
								res.json({ message: "Error"});
							}
							res.json({ message: response });
						});
					});
					
				}
			}, username);
		} else {
			res.json({ message: "error: no user"});
		}

	});

	 app.get('/app/secured/*', ensureAuthenticated, function(req, res){
  		res.json({ message: 'logged in' });
	});

	 //frontend routes ======================================
	 //route to handle all angular requests
	 app.get('/app/*', function(req, res){
  		res.json({ message: 'log in' });
	});

	 app.get('/*', function(req, res){
	 	res.render('./index', { user: req.user ? req.user : null });
	});


};

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.json({ message: 'access denied', hide: true});
};