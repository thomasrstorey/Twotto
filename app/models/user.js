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
	favorites		: [String],
	friends			: [String],
	followers		: [String]
});

module.exports = mongoose.model('User', userSchema);