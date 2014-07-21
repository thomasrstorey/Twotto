pc = require('punycode');
_ = require('underscore');
jsesc = require('jsesc');

//Twitter Emoji Handler - reconverts utf16 codes from twitter api (example: /u0001F510) into surrogate pairs that javascript understands (example: \uD83D\uDD10)
//By Thomas Storey
//USAGE:
//Tweh = require('./twitteremojihandler');
//tweh = new Tweh();
//var handledTweet = tweh.handleEmoji(tweetString);

var TwitterEmojiHandler = module.exports = function(){

	var that = {};

	function handleEmoji(tweet){
		var handledTweet = getCodepointsFromutf16(jsesc(tweet, {
			json: true
		}));
		return handledTweet;
	};

	function getCodepointsFromutf16 (string){
		var pattern = /\\u\w{1,8}/gi;
		var nonglobal = /\\u\w{1,8}/;
		var utfs = string.match(pattern);
		if(utfs){
			console.log(utfs);
			utfs = _.map(utfs, function(str){
				var front = '0x';
				str = str.slice(2);
				return front.concat(str);
			});
			var pairs = convertCodepoints(utfs);
			var replaced = replaceutf16(string, pairs, nonglobal);
			var finalstring = "";
			for (var i = 0; i < replaced.length; i++) {
				finalstring += replaced[i]+"";
			};
			return finalstring;
		} else{
			return string;
		}
		
	};

	function convertCodepoints (codesArray, convertedArray){
		convertedArray = convertedArray||[];
		convertedArray.push(pc.ucs2.encode([parseInt(codesArray[0])]));
		var remaining = codesArray.slice(1);
		if(remaining.length === 0){
			return convertedArray;
		} else{
			return convertCodepoints(remaining, convertedArray);
		}
	};

	function replaceutf16 (instring, pairsArr, ng, outArr){
		outArr = outArr||[];
		instring = instring.replace(ng, pairsArr[0]);
		var index = instring.indexOf(pairsArr[0]);
		var remainingString = instring.slice(index+pairsArr[0].length);
		outArr.push(instring.substring(0, index+pairsArr[0].length));
		var remainingPairs = pairsArr.slice(1);
		if(remainingPairs.length === 0){
			outArr.push(remainingString);
			return outArr;
		} else {
			return replaceutf16(remainingString, remainingPairs, ng, outArr);
		}
	};

	that.handleEmoji = handleEmoji;

	return that;
};