var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var Twit = require('twit');
var config = require('./config');
var methodOverride = require('method-override');
var session = require('express-session');
var Bot = require('./bot');

var passport = require('passport')
  , TwitterStrategy = require('passport-twitter').Strategy;

  // serialize and deserialize
passport.serializeUser(function(user, done) {
done(null, user);
});
passport.deserializeUser(function(obj, done) {
done(null, obj);
});

passport.use(new TwitterStrategy({
    consumerKey: config.consumer_key,
    consumerSecret: config.consumer_secret,
    callbackURL: "http://127.0.0.1:3000/auth/twitter/callback"
},
function(token, tokenSecret, profile, done){
    config.access_token = token;
    config.access_token_secret = tokenSecret;
    process.nextTick(function(){
        return done(null, profile);
    });
    
}));

var routes = require('./routes/index');
var users = require('./routes/users');
var ping = require('./routes/ping');
var account = require('./routes/account');

var user;

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(methodOverride());
app.use(session({secret: 'my_secret'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon());


app.set('port', process.env.PORT || 3000);

// routes
app.use('/', routes);
app.use('/ping', ping);

app.get('/account', ensureAuthenticated, function(req, res){
    res.render('account', { user: req.user,
                            title: 'Twotto' });
    user = req.user;
});

app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res){

});

app.get('/auth/twitter/callback',
    passport.authenticate('twitter', {
        failureRedirect: '/'
    }), function(req, res){
        res.redirect('/account')
    });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

app.get('/launchbot', function(req, res){
    
    var bot = new Bot(config, user);
    var testInterval = 30000;
    /*bot.tweet('Testing the bot, dont mind me doop de doop', function(err){
        if(err){
            console.log(err.message);
            res.send(err.message);
        }else{
            console.log('tweeted');
            res.send('Launched!');
        }
    });*/

    bot.getFavInterval(function(favInterval){

        console.log("Will fav a tweet every " + favInterval + " milliseconds");

        (function favBehavior(favInterval){
            bot.favTweet();
            setTimeout(favBehavior, testInterval);
        })();

    });

    res.send('Launched!');

});

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


http.createServer(app).listen(app.get('port'), function(){
console.log("Express server listening on port " + app.get('port'));
});

function ensureAuthenticated(req, res, next) {
if (req.isAuthenticated()) { return next(); }
res.redirect('/')
}


module.exports = app;