var Twit = require('twit');
var _ = require('underscore');
var config = require('./config');
var MongoClient = require('mongodb').MongoClient;
var format = require('util').format;
var AlchemyAPI = require('./alchemyapi_node/alchemyapi');
var alchemyapi = new AlchemyAPI();


///////////////////////////////

var Bot = module.exports = function(config, req_user, db){

	var twit = new Twit(config);
	var that = {};
	var defaultInterval = 21600000;
	var requser = req_user;
	var friendsArray;

	//console.log(requser);

	var tweet = function(status, callback){
		if(typeof status !== 'string'){
			return callback(new Error('tweet must be of type String'));
		} else if(status.length > 140){
			return callback(new Error('tweet is too long: ' + status.length));
		}
		twit.post('statuses/update', { status: status }, callback);
	};

	var updateFriendsArray = function(){
		getAllFriends(requser._json.id_str, [], -1, 5000, function(friendids){
			friendsArray = friendids;
			console.log(requser.username + " now has " + friendsArray.length + " friends.")
		});
	};

	var readHomeTimeline = function(callback){
		twit.get('statuses/home_timeline', {count: 200}, function(err, reply){
			if(err){
				return callback(err);
			}
			return callback(err, reply);
		});
	};

	var getFavData = function(callback){
		//return an object with interval, favorited screen names w/ numbers
		//of favs
		var favData = {};

		twit.get('favorites/list', {count: 200}, function(err, data){
			if(err){return callback(err);}

			var user_array = [];
			var id_array = [];

			for(var i = 0; i < data.length; i++){
				var name = data[i].user.name;
				if(!user_array.hasOwnProperty(name)){
					user_array[name] = 1;
				} else{
					user_array[name] += 1;
				}

				var id = data[i].id_str;
				if(data[i].retweeted_status){
					var retweetedid = data[i].retweeted_status.id_str;
					id_array.push(retweetedid);
				}

				if(id_array.indexOf(id) <= -1){
					id_array.push(id);
					
				}
			}
			favData.id_array = id_array;

			favData.user_array = user_array;

			return callback(err, favData);
		});
	};

	var getFavInterval = function(callback){
		twit.get('favorites/list', {count: 200}, function(err, data){
			if(err){
				console.log(err);
				return callback(30000);
			}
			var fTime = new Date(data[0].created_at);
			var lTime = new Date(data[data.length-1].created_at);

			var span = fTime.getTime() - lTime.getTime();
			var interval = span / data.length;
			return callback(interval);	
		});
	};

	var getRTInterval = function(callback){
		twit.get('statuses/user_timeline', {include_rts: true, count: 200}, function(err, data){
			var rts = [];
			for (var i = data.length - 1; i >= 0; i--) {
				if(data[i].retweeted){
					rts.push(data[i]);
				}
			};
			if(rts.length >= 2){
				var start = new Date(rts[rts.length-1].created_at);
				var end = new Date(rts[0].created_at);
				var span = start.getTime() - end.getTime();
				var interval = span / rts.length;
				return callback(interval);
			} else{
				return callback(-1);
			}
		});
	}

	var getFollowInterval = function(callback){
		console.log("begin getting followinterval");
		getAuthUserId(function(myid, data){
			var friendids = [];
			console.log("got user id. now get all friends");
			getAllFriends(myid, friendids, -1, 5000, function(frids){
				console.log("got all friends. now get my user data.");
				twit.get('users/show', {user_id: myid}, function(err, mydata){
					console.log("got my user data, now get and return interval");
					if(!err){
						var start = new Date(mydata.created_at);
						var end = new Date();

						var span = end.getTime() - start.getTime();
						var interval = span / frids.length;
						return callback(interval);
					} else {
						console.log(err);
						return callback(defaultInterval);
					}
				});
			});
		});
	};

	var getTweetInterval = function(callback){
		getAuthUserId(function(myid, data){
			var last = new Date(_.first(data).created_at);
			var first = new Date(_.last(data).created_at);
			var span = last.getTime() - first.getTime();
			var interval = span / data.length;
			return callback(interval);
		});
	};

	var getFullUserTimeline = function (callback, screenName, tweetData, maxId){
		//returns up to 3000 texts extracted from user_timeline
		tweetData = tweetData || [];
		twit.get('statuses/user_timeline', {screen_name: screenName, count: 200, include_rts: true, trim_user: true, max_id: maxId}, function(err, res){
			if(err){
				console.log("ERROR: " + err.data);
			}
			if(res.length > 0){
				tweetData.push.apply(tweetData, getMyTweetsText(res));
				maxId = _.last(res).id_str;
			}
			if(tweetData.length >= 3000 || res.length === 1){
				
				return callback(tweetData);
			} else{
				return getFullUserTimeline(callback, screenName, tweetData, maxId);
			}
		}); 
	};

	var getMyTweetsText = function(responseData, myTweetsArr){
		//this function will return an array of strings
		//each string will be the text element from a tweet
		//object from the user_timeline
		myTweetsArr = myTweetsArr || [];
		myTweetsArr.push(responseData[0].text);
		var remainingResponse = responseData.slice(1);
		if(remainingResponse.length === 0){
			return myTweetsArr;
		}else{
			return getMyTweetsText(remainingResponse, myTweetsArr);
		}
	};

	var clearDB = function(callback){
		var subjectcollection = db.collection('bot_subjects');
		var actioncollection = db.collection('bot_actions');
		var objectcollection = db.collection('bot_objects');
		var locationcollection = db.collection('bot_locations');
		subjectcollection.remove(function(err, result){
			if(err){
				console.log(err);
			}
			actioncollection.remove(function(err, result){
				if(err){
					console.log(err);
				}
				objectcollection.remove(function(err, result){
					if(err){
						console.log(err);
					}
					locationcollection.remove(function(err, result){
						if(err){
							console.log(err);
						}
						return callback();
					});
				});
			});

		});

	}

	var getAllRelations = function (inputArr, username, callback){
		getRelations(inputArr[0], function(relations){
			var relationsObject = parseRelations(relations);
			insertTextDB(relationsObject, username, db);
			var remainingInput = inputArr.slice(1);
			if(remainingInput.length === 0){
				return callback();
			}
			else{
				return getAllRelations(remainingInput, username, callback);
			}
		});
	}

	var getRelations = function (input, callback){
		alchemyapi.relations('text', input, {}, function(response){
			return callback(response.relations);
		});
	};

	var parseRelations = function (relationsArr, subjectsArr, actionsArr, objectsArr, locationsArr){
		subjectsArr = subjectsArr || [];
		actionsArr = actionsArr || [];
		objectsArr = actionsArr || [];
		locationsArr = locationsArr || [];

		subjectsArr = _.reject(pluck(relationsArr, 'subject'), function(item){
			return typeof item == 'undefined';
		});
		actionsArr = _.reject(pluck(relationsArr, 'action'), function(item){
			return typeof item == 'undefined';
		});
		objectsArr = _.reject(pluck(relationsArr, 'object'), function(item){
			return typeof item == 'undefined';
		});
		locationsArr = _.reject(pluck(relationsArr, 'location'), function(item){
			return typeof item == 'undefined';
		});

		return {
			subjects: subjectsArr,
			actions: actionsArr,
			objects: objectsArr,
			locations: locationsArr
		};
	};

	var composeTweetText = function(username){
		//username = username.replace(/ /g, '');
		var subject,
			object,
			action,
			location;

		var subjectcollection = db.collection('bot_subjects');
		var actioncollection = db.collection('bot_actions');
		var objectcollection = db.collection('bot_objects');
		var locationcollection = db.collection('bot_locations');
		subjectcollection.find().toArray(function(err, subjects){
			if(!err && subjects.length > 0) subject = _.sample(subjects).text;
			actioncollection.find().toArray(function(err, actions){
				if(!err && actions.length > 0) action = _.sample(actions).text;
				objectcollection.find().toArray(function(err, objects){
					if(!err && objects.length > 0) object = _.sample(objects).text;
					locationcollection.find().toArray(function(err, locations){
						if(!err && locations.length > 0) location = _.sample(locations).text;
						var tweetString = subject + " " + action + " " + object;
						
						tweet(tweetString, function(err){
							if(err){
								console.log(err);
							} else{
								console.log("TWEETED: " + tweetString);
							}
						})

					});
				});
			});
		});
	};


	var insertTextDB = function(relationsObject, username, db){
		//username = username.replace(/ /g, '');
		
		var subjectcollection = db.collection('bot_subjects');
		if(relationsObject.subjects.length > 0){
			subjectcollection.insert(relationsObject.subjects, {w:1}, function(err, result){
				if(err){
					console.log(err.data);
				}else{
					console.log("Inserted " + result + " docs into bot_subjects");
				}
			});
		}

		var actioncollection = db.collection('bot_actions');
		if(relationsObject.actions.length > 0){
			actioncollection.insert(relationsObject.actions, {w:1}, function(err, result){
				if(err){
					console.log(err.data);
				}else{
					console.log("Inserted " + result + " docs into bot_actions");
				}
			});
		}

		var objectcollection = db.collection('bot_objects');
		if(relationsObject.objects.length > 0){
			objectcollection.insert(relationsObject.objects, {w:1}, function(err, result){
				if(err){
					console.log(err.data);
				}else{
					console.log("Inserted " + result + " docs into bot_objects");
				}
			});
		}

		var locationcollection = db.collection('bot_locations');
		if(relationsObject.locations.length > 0){
			locationcollection.insert(relationsObject.locations, {w:1}, function(err, result){
				if(err){
					console.log(err.data);
				}else{
					console.log("Inserted " + result + " docs into bot_locations");
				}
			});
		}
	};

	var removeURL = function(text){
		//this function will remove all URLs from text,
		//leaving only human speech
		var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    	return text.replace(urlRegex, function(url) {
        	return '';
    	});
	};

	var RTaTweet = function(){
		readHomeTimeline(function(err, timeline){
			if(err) return handleError(err);
			var rts = cleanRetweets(timeline);
			var tweetID = _.sample(rts).id_str;
			console.log(tweetID);
			twit.post('statuses/retweet/:id', {id: tweetID}, function(err, res){
				if(!err){
					console.log("RETWEETED: \n" + res.text);
				} else{
					console.log("ERROR: \n" + err.data);
				}
			});
		});
	}

	var pluck = function(arr, propertyName) {
  		return arr.map(getItem(propertyName));
	};

	var getItem = function(propertyName){
		return function(item){
			return item[propertyName];
		}
	};

	var cleanRetweets = function(tweetArr, cleanArr){
		cleanArr = cleanArr || [];
		if(tweetArr[0].retweeted_status){
			cleanArr.push(tweetArr[0].retweeted_status);
		}
		tweetArr = tweetArr.slice(1);
		if(tweetArr.length === 0){
			return cleanArr;
		} else{
	 		return cleanRetweets(tweetArr, cleanArr);
		}
	}

	var compareToFriends = function(myid, topTen, callback){
		compareArrays(topTen, friendsArray, [], function(matchesArray){
			var topMatches = combineArrays(topTen, matchesArray);
			return callback(topMatches);
		});
	};

	var combineArrays = function(left, right, finalArr){
		finalArr = finalArr || [];

		finalArr.push([left[0], right[0]]);

		var remainingLeft = left.slice(1),
			remainingRight = right.slice(1);

		if(remainingLeft.length === 0 && remainingRight. length ===0){
			return finalArr;
		} else {
			return combineArrays(remainingLeft, remainingRight, finalArr);
		}
	};

	var areEqual = function(a, b){
		if(a === b){
			return true;
		} else{ return false;}
	};

	//returns array of matches between the retweeters of the top 
	//retweeted tweets, and the user's friends
	var compareArrays = function(topTen, friendArr, matchesArr, callback){
		matchesArr = matchesArr || [];
		var matches = 0;
		getAllRTers(topTen[0][1], function(rterids){
			if(rterids){
				matches = getMatches(rterids, friendArr, 0);
			}
			var remainingTop = topTen.slice(1);
			matchesArr.push(matches);
			if(remainingTop.length === 0){
				return callback(matchesArr);
			} else{
				return compareArrays(remainingTop, friendArr, matchesArr, callback);
			}
		});
		
	};

	//returns the number of element matches between two arrays
	var getMatches = function(left, right, matches){
		
		matches += _.reduce(left, function(memo, item){
			if(areEqual(item, right[0])){
				return memo + 1;
			}else{
				return memo;
			};
		}, 0);
		var remainingRight = right.slice(1);
		if(remainingRight.length === 0){
			return matches;
		} else{
			return getMatches(left, remainingRight, matches);
		}
	};

	var favTweet = function(){
		readHomeTimeline(function(err, timeline){
			if(err) return handleError(err);

			getFavData(function(err, data){
				if(err) return handleError(err);
				var tweetPool = [];

				for(var i = 0; i < timeline.length; i++){
					if(!timeline[i].favorited){
						var score = 0;
						var name = timeline[i].user.name;
						var id = timeline[i].id_str;
						if(data.user_array.hasOwnProperty(name)){
							score += data[name]*200;
						}
						if(timeline[i].entities.urls[0]){
							score+=10;
						}

						if(timeline[i].favorite_count){
							score += timeline[i].favorite_count;
						}

						if(timeline[i].retweet_count){
							score += timeline[i].retweet_count;
						}

						for(var j = 0; j < score; j++){
							tweetPool.push(id);
						}
					}
				}
				console.log("Tweet pool length: " + tweetPool.length);
				do {
					var tweetToFav = randIndex(tweetPool);
				} while(data.id_array.indexOf(tweetToFav) > -1);
				console.log("faving tweet id: " + tweetToFav);
				if(tweetToFav){
					twit.post('favorites/create', {id: tweetToFav}, function(err, data, response){
						if(err) console.log(err);
					});
				}
			});

		});
	}

	var getAuthUserId = function(callback){
		var myid;
		twit.get('statuses/user_timeline', {include_rts: false}, function(err, data){
			if(!err)myid = data[0].user.id;
			console.log(requser._json.id_str);
			console.log(requser._json.screen_name);
			return callback(requser._json.id_str, data);
		});
	}

	var addFriend = function(){
		randomFriend = _.sample(friendsArray);
		getAllFriends(randomFriend, [], -1, 5000, function(friendFriends){
			selectedFriends = _.sample(friendFriends, 10);
			getUsersNumFollowers(selectedFriends, function(fcounts){
				console.log(fcounts);
				var friendToAdd = _.max(fcounts, function(item){
					return item.followers_count;
				});
				console.log(friendToAdd);
				twit.post('friendships/create', {user_id: friendToAdd.id_str}, function(err, newFollow){
					if(!err){
			    		console.log("Now Following " + newFollow.name + " id: " + newFollow.id_str);
			   		} else {
			   			console.log(err);
			   		}
			    });
			});
		});
	};

	var getUsersNumFollowers = function(usersIds, callback, fcounts){
		var followersCounts = fcounts || [];
		twit.get('users/show', {user_id: usersIds[0], include_entities: false}, function(err, data){
			if(!err){
				console.log(data.screen_name);
				followersCounts.push({screen_name: data.screen_name, followers_count: data.followers_count, id_str: data.id_str});
			} else {
				console.log(err);
			}
			var remainingids = usersIds.slice(1);
			if(remainingids.length === 0){
				return callback(followersCounts);
			} else {
				return getUsersNumFollowers(remainingids, callback, followersCounts);
			}
			
		});
	}; 

	var getAllFollowers = function(userid, followerids, nextCursor, count, callback){
		followerids = followerids || [];
		twit.get('followers/ids', {user_id: userid, count: count, cursor: nextCursor}, function(err, followers){
			if(err){
				console.log("error getting all followers: " + err);
				return callback(followerids);
			}
			followerids.push.apply(followerids, followers.ids);
			nextCursor = followers.next_cursor_str;
			if(nextCursor != "0"){
				getAllFollowers(userid, followerids, nextCursor, count, callback);
			} else if(callback){
				return callback(followerids);
			}	
		});
	};

	var getAllFriends = function(userid, friendids, nextCursor, count, callback){
		console.log("time to get all friends");
		friendids = friendids || [];
		count = count || 5000;
		twit.get('friends/ids', {user_id: userid, cursor: nextCursor, count: count, stringify_ids: true}, function(err, friends){
			if(err){
				console.log("error getting all friends: " + err);
				return callback(friendids);
			}
			friendids.push.apply(friendids, friends.ids);
			nextCursor = friends.next_cursor_str;
			if(nextCursor != "0"){
				console.log("get all friends recurse");
				getAllFriends(userid, friendids, nextCursor, count, callback);
			} else if(callback){
				console.log("get all friends return");
				return callback(friendids);
			}	
		});
	};

	var getAllRTers = function(tweetid, callback, rterids){
		rterids = rterids || [];
		twit.get('statuses/retweeters/ids', {id: tweetid, stringify_ids: true}, function(err, retweeters){
			if(err){
				console.log("error: " + err);
				return callback(null);
			}
			return callback(retweeters.ids);
		});
	};

	that.tweet = tweet;
	that.readHomeTimeline = readHomeTimeline;
	that.getFavData = getFavData;
	that.favTweet = favTweet;
	that.getFavInterval = getFavInterval;
	that.getFollowInterval = getFollowInterval;
	that.getRTInterval = getRTInterval;
	that.RTaTweet = RTaTweet;
	that.insertTextDB = insertTextDB;
	that.getFullUserTimeline = getFullUserTimeline;
	that.getAllRelations = getAllRelations;
	that.composeTweetText = composeTweetText;
	that.updateFriendsArray = updateFriendsArray;
	that.clearDB = clearDB;
	that.addFriend = addFriend;

	return that;
}

///////////////////////////////

//var bot = new Bot(config);
//var testInterval = 900000 //15 minutes

/*(function fillUserBotDB(){
	bot.getFullUserTimeline(function(tweetsTextArr){
		bot.getAllRelations(tweetsTextArr, function(){
			console.log("done");
			setTimeout(fillUserBotDB, testInterval);
		});
	});
})();


bot.getFavInterval(function(favInterval){

	console.log("Will fav a tweet every " + favInterval + " milliseconds");

	(function favBehavior(favInterval){
		bot.favTweet();
		setTimeout(favBehavior, testInterval);
	})();

});

bot.getFollowInterval(function(followInterval){
	console.log("Will follow a user every " + followInterval + " milliseconds");

	bot.followUser();
});

bot.getRTInterval(function(rtInterval){
	console.log("Will retweet a tweet every " + rtInterval + " milliseconds");
	bot.rtTweet();
});



bot.composeTweetText();*/



///////////////////////////////

function randIndex (arr) {
  var index = Math.floor(arr.length*Math.random());
  return arr[index];
};

function handleError(err) {
  console.error('response status:', err.statusCode);
  console.error('data:', err.data);
}