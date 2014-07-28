module.exports = function(app, passport){

	//server routes =========================================
	 //api/db calls
	 //authentication calls
	 app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res){

	 });

	 app.get('/auth/twitter/callback', 
	 	passport.authenticate('twitter', {
        	failureRedirect: '/',
        	successRedirect: '/account'
     	}));

	 app.get('/login', function(req, res){
	 	res.render('login', {
	 		link: 'auth/twitter'
	 	});
	 });

	 app.get('/logout', function(req, res){
     	req.logout();
     	res.redirect('/');
	 });



	 //frontend routes ======================================
	 //route to handle all angular requests
	 app.get('*', function(req, res){
  		res.render('../index', { title: 'Doppeltweeter'});
	});
};

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/login');
};