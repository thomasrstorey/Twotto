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
var MongoClient = require('mongodb').MongoClient;
var format = require('util').format;
var _ = require('underscore');

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
var account = require('./routes/account');

var user;

var app = express();
var botLoop;
var botLoops = {};
var activeBots = {};

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

app.get('/account', ensureAuthenticated, function(req, res){
    var username = req.user.username;
    user = req.user;
    if(!activeBots.hasOwnProperty(username) || activeBots[username] === null){
        MongoClient.connect("mongodb://localhost:27017/" + username + "_BDB", function(err, db){
            if(!err){
                console.log("We are connected!");
                activeBots[username] = new Bot(config, user, db);
                activeBots[username].updateFriendsArray();
                console.log("Made a new bot for " + username + "!");
            }else{
                console.log("Error: " + err.data);
            }
        });
    }
    res.render('account', { user: req.user,
                            title: 'Twotto',
                            userLoop: botLoops[req.user.username]||null });
    
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

app.get('/filldb/:username', ensureAuthenticated, function(req, res){
    var username = req.params.username;
    activeBots[username].clearDB(function(){
        activeBots[username].getFullUserTimeline(function(tweetsTextArr){
            activeBots[username].getAllRelations(tweetsTextArr, username, function(){
                console.log("done");
            });
        }, username);
    });
    

    res.render('filldb', {title: "Twotto", user: req.params.username});

});

app.get('/launchbot/:username', ensureAuthenticated, function(req, res){
    var username = req.params.username;
    var testInterval = 60000*16;
    var dbInterval = 86400000;
    botLoops[req.params.username] = [];

    /*(function queryBehavior(dbi){
        activeBots[username].getFullUserTimeline(function(tweetsTextArr){
            activeBots[username].getAllRelations(tweetsTextArr, username, function(){
                console.log("done");
                setTimeout(queryBehavior, dbi, dbi);
            });
         }, username);
    })(dbInterval);*/

    (function tweetBehavior(twti){
        activeBots[username].composeTweetText(username);
        botLoop = setTimeout(tweetBehavior, twti, twti);
        botLoops[req.params.username].push(botLoop);
    })(testInterval);

    activeBots[username].getRTInterval(function(rtInterval){

        console.log("Will retweet a tweet every " + rtInterval + " milliseconds");

        (function rtBehavior(rti){
            activeBots[username].RTaTweet();
            botLoop = setTimeout(rtBehavior, rti, rti);
            botLoops[req.params.username].push(botLoop);
        })(testInterval);
        
    });

    activeBots[username].getFollowInterval(function(followInterval){

        console.log("Will follow a user every " + followInterval + " milliseconds");

        (function followBehavior(foli){
            activeBots[username].addFriend();
            activeBots[username].updateFriendsArray();
            botLoop = setTimeout(followBehavior, foli, foli);
            botLoops[req.params.username].push(botLoop);
        })(testInterval);
        
    });

    activeBots[username].getFavInterval(function(favInterval){

        console.log("Will fav a tweet every " + favInterval + " milliseconds");

        (function favBehavior(fi){
            activeBots[username].favTweet();
            botLoop = setTimeout(favBehavior, fi, fi);
            botLoops[req.params.username].push(botLoop);
        })(testInterval);

    });

    console.log("Started " + req.params.username + "'s twitter bot loop.");

    res.render('launchbot', {title: "Twotto", user: req.params.username});

});

app.get('/stopbot/:username', ensureAuthenticated, function(req, res){
    botLoops[req.params.username] = clearTimeoutsArray(botLoops[req.params.username]);
    console.log("cleared " + req.params.username + "'s twitter bot loops.");
    botLoops[req.params.username] = null;
    botLoop = null;
    res.redirect('/account');
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

function clearTimeoutsArray(timeoutArray){
    clearTimeout(timeoutArray[0]);
    remainingTOs = timeoutArray.slice(1);
    if(remainingTOs.length === 0){
        return remainingTOs;
    } else{
        return clearTimeoutsArray(remainingTOs);
    }
}


module.exports = app;