var Twit = require('twit');
var _ = require('underscore');
var config = require('./config');
var MongoClient = require('mongodb').MongoClient;
var format = require('util').format;
var AlchemyAPI = require('./alchemyapi_node/alchemyapi');
var alchemyapi = new AlchemyAPI();


///////////////////////////////

var Bot = module.exports = function(config, requser){

	var twit = new Twit(config);
	var that = {};

	var tweet = function(status, callback){
		if(typeof status !== 'string'){
			return callback(new Error('tweet must be of type String'));
		} else if(status.length > 140){
			return callback(new Error('tweet is too long: ' + status.length));
		}
		twit.post('statuses/update', { status: status }, callback);
	};

	var readHomeTimeline = function(callback){
		twit.get('statuses/home_timeline', {count: 200}, function(err, reply){
			if(err){
				return callback(err);
			}
			//console.log(reply);
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
			console.log(data.length);

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
		getAuthUserId(function(myid, data){
			var friendids = [];
			getAllFriends(myid, friendids, -1, function(frids){
				twit.get('users/show', {user_id: myid}, function(err, mydata){
					var start = new Date(mydata.created_at);
					var end = new Date();

					var span = end.getTime() - start.getTime();
					var interval = span / frids.length;
					return callback(interval);
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

	var getFullUserTimeline = function (callback, tweetData, maxId){
		//returns up to 3000 texts extracted from user_timeline
		tweetData = tweetData || [];
		twit.get('statuses/user_timeline', {count: 200, include_rts: true, trim_user: true, max_id: maxId}, function(err, res){
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
				console.log("\n");
				console.log("RECURSE");
				console.log("\n");
				return getFullUserTimeline(callback, tweetData, maxId);
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

	var getAllRelations = function (inputArr, callback){
		getRelations(inputArr[0], function(relations){
			var relationsObject = parseRelations(relations);
			insertTextDB(relationsObject);
			var remainingInput = inputArr.slice(1);
			if(remainingInput.length === 0){
				return callback();
			}
			else{
				return getAllRelations(remainingInput, callback);
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
		MongoClient.connect("mongodb://localhost:27017/" + username + "botDB", function(err, db){
			var subject,
				object,
				action,
				location;

			if(!err){
				var subjectcollection = db.collection('bot_subjects');
				var actioncollection = db.collection('bot_actions');
				var objectcollection = db.collection('bot_objects');
				var locationcollection = db.collection('bot_locations');
				subjectcollection.find().toArray(function(err, subjects){
					if(!err) subject = _.sample(subjects).text;
					actioncollection.find().toArray(function(err, actions){
						if(!err) action = _.sample(actions).text;
						objectcollection.find().toArray(function(err, objects){
							if(!err) object = _.sample(objects).text;
							locationcollection.find().toArray(function(err, locations){
								if(!err) location = _.sample(locations).text;

								console.log(subject + " " + action + " " + object);
								db.close();

							});
						});
					});
				});
			}
		});
	};

	var insertTextDB = function(relationsObject, username){
		MongoClient.connect("mongodb://localhost:27017/" + username + "botDB", function(err, db){
			if(!err){
				console.log("We are connected!");
				var subjectcollection = db.collection('bot_subjects');
				if(relationsObject.subjects.length > 0){
					subjectcollection.insert(relationsObject.subjects, {w:1}, function(err, result){
						if(err){
							console.log(err.data);
						}else{
							console.log("Inserted " + result + " docs into bot_subjects");
						}
						var actioncollection = db.collection('bot_actions');
						if(relationsObject.actions.length > 0){
							actioncollection.insert(relationsObject.actions, {w:1}, function(err, result){
								if(err){
									console.log(err.data);
								}else{
									console.log("Inserted " + result + " docs into bot_actions");
								}

								var objectcollection = db.collection('bot_objects');
								if(relationsObject.objects.length > 0){
									objectcollection.insert(relationsObject.objects, {w:1}, function(err, result){
										if (err) {
											console.log(err.data);
										}else{
											console.log("Inserted " + result + " docs into bot_objects");
										}

										var locationcollection = db.collection('bot_locations');
										if(relationsObject.locations.length > 0){
											locationcollection.insert(relationsObject.locations, {w:1}, function(err, result){
												if (err) {
													console.log(err.data);
												}else{
													console.log("Inserted " + result + " docs into bot_locations");
												}
												db.close();
											});
										}
									});
								}
							});
						}
					});
				}

			}else{
				console.log("Error: " + err.data);
			}
		});
	};

	var removeURL = function(text){
		//this function will remove all URLs from text,
		//leaving only human speech
		var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    	return text.replace(urlRegex, function(url) {
        	return '';
    	});
	};



	var rtTweet = function(){
		readHomeTimeline(function(err, timeline){
			if(err) return handleError(err);
			var sortedByRTCount = _.sortBy(timeline, 'retweet_count');
			var truncatedTop = _.rest(sortedByRTCount, sortedByRTCount.length-10);
			var cleanTop = cleanRetweets(truncatedTop);
			var idsAndCounts = combineArrays(pluck(cleanTop, 'retweet_count'), 
											 pluck(cleanTop, 'id_str'));
			console.log(idsAndCounts);

			getAuthUserId(function(myid, usertimeline){
				compareToFriends(myid, idsAndCounts, function(topMatches){
					var narrowed = _.filter(topMatches, function(item){
						return item[1] != 0;
					});
					if(narrowed){
						var tweetID = _.sample(narrowed)[0][1];
						console.log(tweetID);
						twit.post('statuses/retweet/:id', {id: tweetID}, function(err, res){
							if(!err){
								console.log("RETWEETED: \n" + res.text);
							} else{
								console.log("ERROR: \n" + err.data);
							}
						});
					} else{
						console.log("Tried to retweet, but no likely candidates found.");
					}	
				});
			});
		});
	};

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
		} else{
			cleanArr.push(tweetArr[0]);
		}
		tweetArr = tweetArr.slice(1);
		if(tweetArr.length === 0){
			return cleanArr;
		} else{
	 		return cleanRetweets(tweetArr, cleanArr);
		}
	}

	var compareToFriends = function(myid, topTen, callback){
		getAllFriends(myid, [], -1, function(friendids){
			compareArrays(topTen, friendids, [], function(matchesArray){
				var topMatches = combineArrays(topTen, matchesArray);
				return callback(topMatches);
			});
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
		//console.log("TOP TEN: " + topTen);
		getAllRTers(topTen[0][1], function(rterids){
			if(rterids){
				console.log(rterids.length);
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
			//console.log("ITEM: " + item + " RIGHT: " + right[0]);
			if(areEqual(item, right[0])){
				console.log("MATCH!");
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
							console.log("found one: " + name);
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
				console.log(data.id_array);
				console.log(tweetPool.length);
				do {
					var tweetToFav = randIndex(tweetPool);
				} while(data.id_array.indexOf(tweetToFav) > -1);
				console.log("tweet id: " + tweetToFav);
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
			return callback(requser.id_str, data);
		});
	}

	var followUser = function(){
	    var friendIds;

		twit.get('friends/ids', {}, function(err, data){

			friendIds=data.ids;
			var id = randIndex(data.ids);

			twit.get('statuses/user_timeline', {user_id: id}, function(err, timeline){
				var mentions = [];
				for(var i = 0; i < timeline.length; i++){
					var thisMentions = timeline[i].entities.user_mentions;
					for(var j = 0; j < thisMentions.length; j++){
						mentions.push(thisMentions[j]);
					}
				}
				console.log(mentions);
			    var candidates = [];
			    for (var i = mentions.length - 1; i >= 0; i--) {
			    	if(friendIds.indexOf(mentions[i].id) === -1 &&
			    	candidates.indexOf(mentions[i].id) === -1){
			    		candidates.push(mentions[i].id);
			    	}
			    };

			    console.log(candidates);

			    for (var i = candidates.length - 1; i >= 0; i--) {
			    	console.log("candidate " + candidates[i]);
			    	if(i < 1){
			    		(function(cand){
			    			var count = 0;
			    			var emptyids = [];
			    			getAllFollowers(cand, emptyids, -1, count, function(foids){
			    				console.log("num of followers: " + foids.length);
			    				var numInCommon = 0;
					    		for (var j = foids.length - 1; j >= 0; j--) {
					    			if(friendIds.indexOf(foids[j]) > -1){
					    				numInCommon++;
					    			}
					    		};

					    		console.log("numInCommon = " + numInCommon);
					    		var tries = 0;
					    		var followed = false;
					    		while(tries < numInCommon && followed === false){
					    			tries++;
					    			if(Math.random() < 0.5){
					    				followed = true;
					    				twit.post('friendships/create', {user_id: cand}, function(err, newFollow){
					    					console.log("Now Following " + newFollow.name + " id: " + newFollow.id_str);
					    				});
					    			}
					    		}


			    			});
			    		})(candidates[i]);
			    	}
			    };
			});

		});

	};

	var getAllFollowers = function(userid, followerids, nextCursor, count, callback){
		twit.get('followers/ids', {user_id: userid, cursor: nextCursor}, function(err, followers){
			if(err){
				console.log("error: " + err);
				return callback(followerids);
			}
			followerids.push.apply(followerids, followers.ids);
			nextCursor = followers.next_cursor_str;
			if(nextCursor != "0"){
				console.log("keep going! cursor = " + nextCursor);
				getAllFollowers(userid, followerids, nextCursor, count, callback);
			} else if(callback){
				console.log("bring it back");
				return callback(followerids);
			}	
		});
	};

	var getAllFriends = function(userid, friendids, nextCursor, callback){
		friendids = friendids || [];
		twit.get('friends/ids', {user_id: userid, cursor: nextCursor, stringify_ids: true}, function(err, friends){
			friendids.push.apply(friendids, friends.ids);
			nextCursor = friends.next_cursor_str;
			if(nextCursor != "0"){
				getAllFollowers(userid, followerids, nextCursor, count, callback);
			} else if(callback){
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
	that.followUser = followUser;
	that.rtTweet = rtTweet;
	that.insertTextDB = insertTextDB;
	that.getFullUserTimeline = getFullUserTimeline;
	that.getAllRelations = getAllRelations;
	that.composeTweetText = composeTweetText;

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