var Twit = require('twit');
var _ = require('underscore');
var MongoClient = require('mongodb').MongoClient;
var mongoose       = require('mongoose');
var format = require('util').format;
var AlchemyAPI = require('./alchemyapi_node/alchemyapi');
var alchemyapi = new AlchemyAPI();
var Tweh = require('./twitteremojihandler');
var User = require('./app/models/user');

///////////////////////////////

var Bot = module.exports = function(config, requser, User){

	var twit = new Twit(config);
	var that = {};
	var defaultInterval = 21600000;
	var friendsArray;
	var tweh = new Tweh();

	// DB ===================================================================

	//insert data into db
	//retrieve data from db
	//delete data from db

	var postDBdata = function(data, element, username, callback){
		//takes array data, inserts into arrayType array in 
		//the username's db, calls the callback when it's done
		User.findOne({ 'twitter.username' : username}, function(err, userdata){
			if(err){
				console.error("Error finding user: " + err);
				return callback(err, null);
			}
			userdata[element] = data;
		});
	};

	var postRelations = function(callback){
		getUserTimeline(function(tweets){
			getAllRelations(tweets, requser.twitter.username, function(relationsObjects){
				var withSubjects = _.filter(relationsObjects, function(item){
					return item.subjects.length > 0;
				});
				requser.subjects = _.pluck(withSubjects, 'subjects');
				var withActions = _.filter(relationsObjects, function(item){
					return item.actions.length > 0;
				});
				requser.actions = _.pluck(withActions, 'actions');
				var withObjects = _.filter(relationsObjects, function(item){
					return item.objects.length > 0;
				});
				requser.objects = _.pluck(withObjects, 'objects');
				var withLocations = _.filter(relationsObjects, function(item){
					return item.locations.length > 0;
				});
				requser.locations = _.pluck(withLocations, 'locations');
				return callback(null, requser);
			});
		}, true, true, requser.twitter.username);
		
	};

	var getDBTweets = function(username, callback){
		User.findOne({ 'twitter.username' : username}, function(err, userdata){
			if(err){
				return callback(err, null);
			}
			return callback(null, userdata.tweets);
		});
	};

	var getDBFavs = function(username, callback){
		User.findOne({ 'twitter.username' : username}, function(err, userdata){
			if(err){
				return callback(err, null);
			}
			return callback(null, userdata.favorites);
		});
	};

	var getDBFriends = function(username, callback){
		User.findOne({ 'twitter.username' : username}, function(err, userdata){
			if(err){
				return callback(err, null);
			}
			return callback(null, userdata.friends);
		});
	};

	var getDBFollowers = function(username, callback){
		User.findOne({ 'twitter.username' : username}, function(err, userdata){
			if(err){
				return callback(err, null);
			}
			return callback(null, userdata.followers);
		});
	};

	var composeTweetText = function(username, callback){
		User.findOne({ 'twitter.username' : username}, function(err, user){
			if(err){
				return callback(err, null);
			}

			var tweetString = user.composeTweet(); 

			tweetString = tweh.handleEmoji(tweetString);
			return callback(null, tweetString);
		});
	};

	// ALCHEMY API ==========================================================

	//get alchemy analysis from input text

	var getRelations = function (input, callback){
		alchemyapi.relations('text', input, {}, function(response){
			return callback(response.relations);
		});
	};

	var getAllRelations = function (inputArr, username, callback, parsedArray){
		parsedArray = parsedArray || [];
		getRelations(inputArr[0], function(relations){
			var relationsObject = parseRelations(relations);
			parsedArray.push(relationsObject);
			
			var remainingInput = inputArr.slice(1);
			if(remainingInput.length === 0){
				return callback(parsedArray);
			}
			else{
				return getAllRelations(remainingInput, username, callback, parsedArray);
			}
		});
	};

	// TWITTER API ==========================================================

	var getHomeTimeline = function(callback){
		twit.get('statuses/home_timeline', {count: 200}, function(err, reply){
			if(err){
				return callback(err, null);
			}
			return callback(null, reply);
		});
	};

	var getUserTimeline = function (callback, rts, textOnly, screenName, tweetData, maxId, n){
		//returns up to 3000 texts extracted from user_timeline
		tweetData = tweetData || [];
		n = n || 0;
		twit.get('statuses/user_timeline', {screen_name: screenName, count: 200, include_rts: rts, trim_user: true, max_id: maxId}, function(err, res){
			if(err){
				console.log("ERROR: " + err);
				return callback(tweetData);
			}
			if(res.length > 0){
				if(textOnly){
					tweetData.push.apply(tweetData, getMyTweetsText(res));
				} else {
					tweetData.push.apply(tweetData, res);
				}
				maxId = _.last(res).id_str;
			}
			if(tweetData.length >= 3000 || res.length === 1 || n === 179){
				
				return callback(tweetData);
			} else{
				n++;
				return getUserTimeline(callback, rts, textOnly, screenName, tweetData, maxId, n);
			}
		}); 
	};

	var getFavs = function(callback, maxid, screenName, favData){
		favData = favData || [];
		maxid = maxid || null;
		twit.get('favorites/list', {count: 200, screen_name: screenName, max_id: maxid}, function(err, data){
			if(err){
				return callback(err, null);
			}
			if(data.length > 0){
				var mappedFavs = _.map(data, function(item){
					return {
						id: item.id_str,
						username: item.user.screen_name,
						text: item.text
					};
				});
				favData.push.apply(favData, mappedFavs);
				maxid = _.last(data).id_str;
			}
			if(favData.length >= 3000 || data.length === 1){
				return callback(favData);
			} else {
				return getFavs(callback, maxid, screenName, favData);
			}
		});
	};

	var getFollowers = function(userid, followerids, nextCursor, count, callback){
		followerids = followerids || [];
		twit.get('followers/ids', {user_id: userid, count: count, cursor: nextCursor}, function(err, followers){
			if(err){
				console.log("error getting all followers: " + err);
				return callback(followerids);
			}
			followerids.push.apply(followerids, followers.ids);
			nextCursor = followers.next_cursor_str;
			if(nextCursor != "0"){
				getFollowers(userid, followerids, nextCursor, count, callback);
			} else if(callback){
				return callback(followerids);
			}	
		});
	};

	var getFriends = function(userid, friendids, nextCursor, count, callback){
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
				getFriends(userid, friendids, nextCursor, count, callback);
			} else if(callback){
				console.log("get all friends return");
				return callback(friendids);
			}	
		});
	};

	var postComposedTweet = function(username, callback){
		composeTweetText(username, function(err, tweetString){
			if(err){
				return callback(err, null);
			}
			tweetString = tweetString.substr(1, tweetString.length-2);
			tweet(tweetString, function(err){
				if(err){
					console.log(err);
					return callback(err, null);
				} else{
					console.log("TWEETED: " + tweetString);
					return callback(null, tweetString);
				}
			});
		});
	};

	var tweet = function(status, callback){
		if(typeof status !== 'string'){
			return callback(new Error('tweet must be of type String'));
		} else if(status.length > 140){
			return callback(new Error('tweet is too long: ' + status.length));
		}
		twit.post('statuses/update', { status: status }, callback);
	};


	var postFav = function(callback){
		selectFavTweet(function(err, favTweet){
			if(err){
				return callback(err, null);
			}
			twit.post('favorites/create', {id: favTweet}, function(err, data, response){
				if(err) return callback(err, null);
				else return callback(null, data);
			});
		});
		
	};

	var postRetweet = function(){
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
	};

	var postFriend = function(){
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
	};

	var getFollowInterval = function(callback){
		var friendids = [];
		var myid = requser.twitter.id;
		getAllFriends(myid, friendids, -1, 5000, function(frids){

			twit.get('users/show', {user_id: myid}, function(err, mydata){
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
	};

	var getTweetInterval = function(callback){
		getUserTimeline(function(data){
			var last = new Date(_.first(data).created_at);
			var first = new Date(_.last(data).created_at);
			var span = last.getTime() - first.getTime();
			var interval = span / data.length;
			return callback(interval);
		}, false, false, requser.twitter.username);
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

	// UTILITY ==============================================================

	var getUserFavCount = function(username, favorites){
		var filteredFavs = _.filter(favorites, function(fav){
			return fav.username === username;
		});
		return filteredFavs.length;
	};

	var selectFavTweet = function(callback){
		//for each tweet in the home timeline, check the username against the usernames
		//in the fav db array.
		//score = number of past favs * 100 + number of favs & RTs on tweet
		getHomeTimeline(function(err, timeline){
			if(err) return callback(err, null);
			getDBFavs(requser.twitter.username, function(err, favdata){
				if(err) return callback(err, null);
				var scores = _.map(timeline, function(tweet){
					var screenName = tweet.user.screen_name;
					var score = getUserFavCount(screenName, favdata)*100 + tweet.favorite_count + tweet.retweet_count;
					return {
						screen_name: screenName,
						score: score,
						tweetid: tweet.id_str
					};
				});
				var favTweet = _.max(scores, function(item){
					return item.score;
				});
				return callback(null, favTweet.tweetid);
			});
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

	var parseRelations = function (relationsArr){
		var subjectsArr = [];
		var actionsArr = [];
		var objectsArr = [];
		var locationsArr = [];

		subjectsArr = _.reject(_.pluck(relationsArr, 'subject'), function(item){
			return typeof item == 'undefined';
		});
		actionsArr = _.reject(_.pluck(relationsArr, 'action'), function(item){
			return typeof item == 'undefined';
		});
		objectsArr = _.reject(_.pluck(relationsArr, 'object'), function(item){
			return typeof item == 'undefined';
		});
		locationsArr = _.reject(_.pluck(relationsArr, 'location'), function(item){
			return typeof item == 'undefined';
		});
		subjectsArr = _.pluck(subjectsArr, 'text');
		actionsArr = _.pluck(actionsArr, 'text');
		objectsArr = _.pluck(objectsArr, 'text');
		locationsArr = _.pluck(locationsArr, 'text');

		return {
			subjects: subjectsArr,
			actions: actionsArr,
			objects: objectsArr,
			locations: locationsArr
		};
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
		}
		tweetArr = tweetArr.slice(1);
		if(tweetArr.length === 0){
			return cleanArr;
		} else{
	 		return cleanRetweets(tweetArr, cleanArr);
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

	//======================================================================

	// PUBLIC ==============================================================
	//get user timeline
	that.getUserTimeline = getUserTimeline;
	//get home timeline
	that.getHomeTimeline = getHomeTimeline;
	//get favorites
	that.getFavs = getFavs;
	//get followers
	that.getFollowers = getFollowers;
	//get friends
	that.getFriends = getFriends;
	//get intervals
	that.getFavInterval = getFavInterval;
	that.getFollowInterval = getFollowInterval;
	that.getRTInterval = getRTInterval;
	//
	//post tweet
	that.postComposedTweet = postComposedTweet;
	//post fav
	that.postFav = postFav;
	//post RT
	that.postRetweet = postRetweet;
	//post follow
	that.postFriend = postFriend;
	//
	//create+update db
	that.postRelations = postRelations;
	that.postDBdata = postDBdata;
	//read db
	that.getDBTweets = getDBTweets;
	that.getDBFavs = getDBFavs;
	that.getDBFriends = getDBFriends;
	that.getDBFollowers = getDBFollowers;
	//
	//get alchemy analysis
	that.getAllRelations = getAllRelations;

	return that;
}

///////////////////////////////
///////////////////////////////

function randIndex (arr) {
  var index = Math.floor(arr.length*Math.random());
  return arr[index];
};

function handleError(err) {
  console.error('response status:', err.statusCode);
  console.error('data:', err.data);
}