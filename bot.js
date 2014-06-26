var Twit = require('twit');
var config = require('./config');

///////////////////////////////

var Bot = module.exports = function(config){

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

			for(var i = 0; i < data.length; i++){
				var name = data[i].user.name;
				if(!user_array.hasOwnProperty(name)){
					user_array[name] = 1;
				} else{
					user_array[name] += 1;
				}

				var id = data[i].id_str;
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
			var fTime = new Date(data[0].created_at);
			var lTime = new Date(data[data.length-1].created_at);

			var span = fTime.getTime() - lTime.getTime();
			var interval = span / data.length;
			return callback(interval);	
		});
	};

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
				})
			});
		});
	}

	var favTweet = function(){
		readHomeTimeline(function(err, timeline){
			if(err) return handleError(err);

			getFavData(function(err, data){
				if(err) return handleError(err);
				var tweetPool = [];

				for(var i = 0; i < timeline.length; i++){
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
			return callback(myid, data);
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
		twit.get('friends/ids', {user_id: userid, cursor: nextCursor}, function(err, friends){
			friendids.push.apply(friendids, friends.ids);
			nextCursor = friends.next_cursor_str;
			if(nextCursor != "0"){
				getAllFollowers(userid, followerids, nextCursor, count, callback);
			} else if(callback){
				return callback(friendids);
			}	
		});
	};

	that.tweet = tweet;
	that.readHomeTimeline = readHomeTimeline;
	that.getFavData = getFavData;
	that.favTweet = favTweet;
	that.getFavInterval = getFavInterval;
	that.getFollowInterval = getFollowInterval;
	that.followUser = followUser;

	return that;
}

///////////////////////////////

var bot = new Bot(config);

bot.getFavInterval(function(favInterval){

	console.log("Bot running. Will fav a tweet every " + favInterval + " milliseconds");

	//setInterval(bot.favTweet(), favInterval);

});

bot.getFollowInterval(function(followInterval){
	console.log("Follow interval = " + followInterval);

	bot.followUser();
});



///////////////////////////////

function randIndex (arr) {
  var index = Math.floor(arr.length*Math.random());
  return arr[index];
};

function handleError(err) {
  console.error('response status:', err.statusCode);
  console.error('data:', err.data);
}