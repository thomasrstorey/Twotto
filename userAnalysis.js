var Twit = require('twit');
var config = require('./config');

var AlchemyAPI = require('./alchemyapi_node/alchemyapi');
var alchemyapi = new AlchemyAPI();


var Program = module.exports = function(config){
	var twit = new Twit(config);
	var that = {};

	var analyzeUser = function(){
		var friendIds;

		twit.get('friends/ids', {}, function(err, data){

			friendIds=data.ids;

			var id = randIndex(data.ids);

			twit.get('users/show', {user_id: id}, function(err, user){
				var text = user.description;
				console.log(user.screen_name)
				//getKeywords(text);
			});

			twit.get('statuses/user_timeline', {user_id: id}, function(err, timeline){
				var tweets = "";
				var mentions = [];
				for(var i = 0; i < timeline.length; i++){
					tweets = tweets.concat(timeline[i].text);
					tweets = tweets.concat(" ");
					var thisMentions = timeline[i].entities.user_mentions;
					for(var j = 0; j < thisMentions.length; j++){
						mentions.push(thisMentions[j]);
					}

				}
				console.log(mentions);

			});

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

	var getConcepts = function (input) {
		alchemyapi.concepts('text', input, { 'showSourceText': 1 }, function(response) {
			 console.log(response.text);
			 console.log(response.concepts);
		});
	};

	var getKeywords = function (input) {
		alchemyapi.keywords('text', input, { 'sentiment':1, 'showSourceText': 1 }, function(response) {
			console.log(response.text);
			console.log(response.keywords);
		});
	};

	var selfAnalysis = function (){	
		getAuthUserId(function(myid, data){
			var tweets = "";
			for(var i = 0; i < data.length; i++){
				tweets = tweets.concat(data[i].text);
				tweets = tweets.concat(" ");
			}
			getKeywords(tweets);
			twit.get('users/show', {user_id: myid}, function(err, user){
				var description = user.description;
				description = description.replace(/\//g, ' ');
				getConcepts(description);
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

	that.analyzeUser = analyzeUser;
	that.selfAnalysis = selfAnalysis;
	that.followUser = followUser;
	return that;
}

var program = new Program(config);
//program.analyzeUser();
//program.selfAnalysis();
program.followUser();

function randIndex (arr) {
  var index = Math.floor(arr.length*Math.random());
  return arr[index];
};

