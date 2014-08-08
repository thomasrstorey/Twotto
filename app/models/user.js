var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	twitter 		: {
		id 			: String,
		token		: String,
		tokenSecret : String,
		displayName : String,
		username	: String
	},
	subjects		: { type : Array , "default" : [] },
	actions			: { type : Array , "default" : [] },
	objects			: { type : Array , "default" : [] },
	locations		: { type : Array , "default" : [] },
	tweets			: [String],
	tweetInterval	: Number,
	favorites		: { type : Array , "default" : [] },
	favInterval		: Number,
	friends			: [String],
	followInterval	: Number,
	followers		: [String]
});

userSchema.methods.randIndex = function (arr){
	var index = Math.floor(arr.length*Math.random());
  	return arr[index];
}

userSchema.methods.composeTweet = function (){
	var subject,
				object,
				action,
				location;

	subject = this.randIndex(this.randIndex(this.subjects));
	object = this.randIndex(this.randIndex(this.objects));
	action = this.randIndex(this.randIndex(this.actions));
	location = this.randIndex(this.randIndex(this.locations));

	return subject + " " + action + " " + object;
}

module.exports = mongoose.model('User', userSchema);