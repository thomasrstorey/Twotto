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
	        console.log(username + " already has a bot");
	    }
	    var botrunning = false;
	    if(app.locals.botLoops[username]){
	    	botrunning = true;
	    }
	    if(botrunning){
	    	var message = "Your bot is active."
	    } else {
	    	var message = "Your bot is inactive."
	    }
  		res.json({ message: message,
  				   user: req.user,
  				   botrunning: botrunning
  				});
	});

	app.post('/app/secured/db/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		relationDB(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});	
	});

	app.post('/app/secured/tweet/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		tweet(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}

			res.json({ message: response });
		});		
	});

	app.post('/app/secured/fav/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		fav(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/friend/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		befriend(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/rt/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		retweet(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/collectFollowers/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		collectFollowers(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/collectFriends/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		collectFriends(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/collectFavs/:username', ensureAuthenticated, function(req, res){
		var username = req.params.username;
		collectFavs(req, res, username, function(err, response){
			if(err){
				res.json({ message: err });
			}
			res.json({ message: response });
		});
	});

	app.post('/app/secured/start/:username', ensureAuthenticated, function(req, res){
		console.log("got to the route");
		var dbInterval = 86400000;
		var ti = 900000;
		var username = req.params.username;
		if(app.locals.botLoops[username]){
			res.json({message: "Bot already running!"});
		}
		app.locals.botLoops[username] = [];
		if(app.locals.activeBots.hasOwnProperty(username)){
			relationDB(req, res, username, function(err, response){
				if(err){
					res.json({ message: err });
				}
				collectFavs(req, res, username, function(err, response){
					if(err){
						res.json({ message: err });
					}
					collectFriends(req, res, username, function(err, response){
						if(err){
							res.json({ message: err });
						}
						collectFollowers(req, res, username, function(err, response){
							if(err){
								res.json({ message: err });
							}
							app.locals.activeBots[username].getTweetInterval(function(twti){
								 (function tweetBehavior(twti){
								 	tweet(req, res, username, function(err, tweetres){
								 		if(err){
								 			console.error(err);
								 		} else {
								 			console.log("tweet " + tweetres);
								 		}
								 	});
								 	var botLoop = setTimeout(tweetBehavior, twti, twti);
        							app.locals.botLoops[username].push(botLoop);
								 })(ti);
							});
							app.locals.activeBots[username].getRTInterval(function(rti){
								(function rtBehavior(rti){
								 	retweet(req, res, username, function(err, rtres){
										if(err){
								 			console.error(err);
								 		} else {
								 			console.log("rt " + rtres);
								 		}
								 	});
								 	var botLoop = setTimeout(rtBehavior, rti, rti);
        							app.locals.botLoops[username].push(botLoop);
								 })(ti);	
							});
							app.locals.activeBots[username].getFavInterval(function(favi){
								(function favBehavior(favi){
								 	fav(req, res, username, function(err, favres){
										if(err){
								 			console.error(err);
								 		} else {
								 			console.log("fav " + favres);
								 		}
								 	});
								 	var botLoop = setTimeout(favBehavior, favi, favi);
        							app.locals.botLoops[username].push(botLoop);
								 })(ti);		
							});
							app.locals.activeBots[username].getFollowInterval(function(flwi){
								(function followBehavior(flwi){
								 	befriend(req, res, username, function(err, bfres){
										if(err){
								 			console.error(err);
								 		} else {
								 			console.log("befriend " + bfres);
								 		}
								 	});
								 	var botLoop = setTimeout(followBehavior, flwi, flwi);
        							app.locals.botLoops[username].push(botLoop);
								 })(ti);
							});
							res.json({message: "bot started",
									  botrunning: true});
						});
					});
				});
			});
		} else {
			res.json({ message: "error: no user",
					   botrunning: false });
		}
	});

	app.delete('/app/secured/stop/:username', ensureAuthenticated, function(req, res){
		app.locals.botLoops[req.params.username] = clearTimeoutsArray(app.locals.botLoops[req.params.username]);
   		console.log("cleared " + req.params.username + "'s twitter bot loops.");
   		app.locals.botLoops[req.params.username] = null;
    	res.json({message: "bot stopped",
    			  botrunning: false});
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

	//===============================================================================

	function relationDB(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			console.log("get relations time");
			User.findOne({ 'twitter.username' : username}, function(err, userdata){
				if(err){
					console.error("Error finding user: " + err);
					return cb(err, null);
				}
				if(userdata.subjects.length + userdata.actions.length + userdata.objects.length + userdata.locations.length === 0){
					app.locals.activeBots[username].postRelations(function(err, requser){
						requser.save(function(err){
							if(err){
								console.error("Error saving to db: " + err);
								return cb(err, null);
							}
							console.log("done");
							return cb(null, "done");
						});
					});
				} else {
					console.log("user database already exists.");
					return cb(null, "Your database already exists.");
				}
				
			});
		} else {
			return cb("error: no user", null);
		}
	};

	function startDBLoop(req, res, username, cb){
		var botloop = setInterval()
	};

	function tweet(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postComposedTweet(username, function(err, tweetText){
				if(err){
					return cb(err, null);
				} else {
					app.locals.activeBots[username].postTweetDB(tweetText, function(err, data){
						if(err){
							return cb(err, null);
						}
						data.save(function(err){
							if(err){
								console.error("Error saving new tweet to db: " + err);
								return cb(err, null);
							}
							return cb(null, tweetText);
						});
					});
				}
			});
		} else {
			return cb("error: no user", null);
		}
	};

	function fav(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postFav(function(err, tweetdata){
				if(err){
					return cb(err, null);
				} else {
					app.locals.activeBots[username].postFavDB(tweetdata, function(err, data){
						if(err){
							return cb(err, null);
						}
						data.save(function(err){
							if(err){
								console.error("Error new fav saving to db: " + err);
								return cb(err, null);
							}
							return cb(null, tweetdata.id_str);
						});
					});
				}
			});
		} else {
			return cb("error: no user", null);
		}
	};

	function befriend(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postFriend(function(err, frienddata){
				if(err){
					return cb(err, null);
				} else {
					app.locals.activeBots[username].postFriendDB(frienddata.id_str, function(err, data){
						if(err){
							return cb(err, null);
						}
						data.save(function(err){
							if(err){
								console.error("Error new friend saving to db: " + err);
								return cb(err, null);
							}
							return cb(null, frienddata.screen_name);
						});
						
					});
				}
			});
		} else {
			return cb("error: no user", null);
		}
	};

	function retweet(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			app.locals.activeBots[username].postRetweet(function(err, rtdata){
				if(err){
					return cb(err, null);
				} else {
					return cb(null, rtdata.text);
				}
			});
		} else {
			return cb("error: no user", null);
		}
	};

	function collectFollowers(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			User.findOne({ 'twitter.username' : username}, function(err, userdata){
				if(err){
					console.error("Error finding user: " + err);
					return cb(err, null);
				}
				if(userdata.followers.length === 0){
					app.locals.activeBots[username].getFollowers(req.user.twitter.id, function(err, followerids){
						if(err){
							return cb(err, null);
						} else {
							app.locals.activeBots[username].postDBdata(followerids, "followers", userdata, function(err, data, message){
								if(err){
									return cb(err, null);
								}
								data.save(function(err){
									if(err){
										console.error("Error saving collected followers to db: " + err);
										return cb(err, null);
									}
									return cb(null, message);
								});
								
							});
						}
					});
				} else {
					console.log("user database already exists.");
					return cb(null, "done");
				}
			});
			
		} else {
			return cb("error: no user", null);
		}
	};

	function collectFriends(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			User.findOne({ 'twitter.username' : username}, function(err, userdata){
				if(err){
					console.error("Error finding user: " + err);
					return cb(err, null);
				}
				if(userdata.friends.length === 0){
					app.locals.activeBots[username].getFriends(req.user.twitter.id, function(err, friendids){
						if(err){
							return cb(err, null);
						} else {
							app.locals.activeBots[username].postDBdata(friendids, "friends", userdata, function(err, data, message){
								if(err){
									return cb(err, null);
								}
								data.save(function(err){
									if(err){
										console.error("Error saving collected friends to db: " + err);
										return cb(err, null);
									}
									return cb(null, message);
								});
								
							});
						}
					});
				} else {
					console.log("user database already exists.");
					return cb(null, "done");
				}
			});
			
		} else {
			return cb("error: no user", null);
		}
	};

	function collectFavs(req, res, username, cb){
		if(app.locals.activeBots.hasOwnProperty(username)){
			User.findOne({ 'twitter.username' : username}, function(err, userdata){
				if(err){
					console.error("Error finding user: " + err);
					return cb(err, null);
				}
				if(userdata.favorites.length === 0){
					app.locals.activeBots[username].getFavs(function(err, favdata){
						if(err){
							return cb(err, null);
						} else {
							app.locals.activeBots[username].postDBdata(favdata, 'favorites', userdata, function(err, data, response){
								if(err){
									console.error(err);
									return cb(err, null);
								}
								data.save(function(err){
									if(err){
										console.error("Error saving collected favs to db: " + err);
										return cb(err, null);
									}
									return cb(null, response);
								});
							});
							
						}
					}, username);
				} else {
					console.log("user database already exists.");
					return cb(null, "done");
				}
			});

		} else {
			return cb("error: no user", null);
		}
	};


};



function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.json({ message: 'access denied', hide: true});
};

function clearTimeoutsArray(timeoutArray){
    clearTimeout(timeoutArray[0]);
    remainingTOs = timeoutArray.slice(1);
    if(remainingTOs.length === 0){
        return remainingTOs;
    } else{
        return clearTimeoutsArray(remainingTOs);
    }
};