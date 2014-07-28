var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	twitter 		: {
		id 			: String,
		token		: String,
		tokenSecret : String,
		displayName : String,
		username	: String
	},
	subjects		: [String],
	actions			: [String],
	objects			: [String],
	locations		: [String],
	tweets			: [String],
	favorites		: [String],
	friends			: [String],
	followers		: [String]
});

module.exports = mongoose.model('User', userSchema);