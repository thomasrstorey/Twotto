// modules =========================================================
var express        = require('express');
var path           = require('path');
var favicon        = require('static-favicon');
var logger         = require('morgan');
var cookieParser   = require('cookie-parser');
var bodyParser     = require('body-parser');
var http           = require('http');
var Twit           = require('twit');
var methodOverride = require('method-override');
var session        = require('express-session');
var passport       = require('passport');
var MongoClient    = require('mongodb').MongoClient;
var mongoose       = require('mongoose');
var format         = require('util').format;
var _              = require('underscore');
var cors           = require('cors');

var AlchemyAPI     = require('./alchemyapi_node/alchemyapi');

var User = require('./app/models/user');
var Bot = require('./bot');

var alchemyapi = new AlchemyAPI();

//configuration ====================================================== 

var config = require('./config/oauth');
var db = require('./config/db');
require('./config/passport')(passport, config);

//authorization ======================================================
var user;
var usertimeline;

var app = express();
app.locals.activeBots = {};
app.locals.botLoops = {};
app.locals.botIntervals = {};

// view engine setup =====================================================
app.set('views', path.join(__dirname, './public/views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(cors());
// get all data/stuff of the body (POST) parameters
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json
app.use(bodyParser.urlencoded({extended: true}));// parse application/x-www-form-urlencoded
app.use(methodOverride('X-HTTP-Method-Override'));// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
app.use(cookieParser());
app.use(methodOverride());
app.use(session({secret: 'my_secret', resave: true, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));// set the static files location /public/img will be /img for users
app.use(favicon());


app.set('port', process.env.PORT || 3000);
mongoose.connect(db.url);

//routes ==================================================================
require('./app/routes')(app, passport, config, User, Bot);

//////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////

app.get('/launchbot/:username', ensureAuthenticated, function(req, res){
    var username = req.params.username;
    var testInterval = 60000*16;
    var dbInterval = 86400000;
    app.locals.botLoops[req.params.username] = [];

    (function queryBehavior(dbi){
        app.locals.activeBots[username].getFullUserTimeline(function(tweetsTextArr){
            app.locals.activeBots[username].getAllRelations(tweetsTextArr, username, function(){
                console.log("done");
                setTimeout(queryBehavior, dbi, dbi);
            });
         }, username);
    })(dbInterval);

    (function tweetBehavior(twti){
        app.locals.activeBots[username].composeTweetText(username);
        var botLoop = setTimeout(tweetBehavior, twti, twti);
        app.locals.botLoops[req.params.username].push(botLoop);
    })(testInterval);

    app.locals.activeBots[username].getRTInterval(function(rtInterval){

        console.log("Will retweet a tweet every " + rtInterval + " milliseconds");

        (function rtBehavior(rti){
            app.locals.activeBots[username].RTaTweet();
            var botLoop = setTimeout(rtBehavior, rti, rti);
            app.locals.botLoops[req.params.username].push(botLoop);
        })(testInterval);
        
    });

    app.locals.activeBots[username].getFollowInterval(function(followInterval){

        console.log("Will follow a user every " + followInterval + " milliseconds");

        (function followBehavior(foli){
            app.locals.activeBots[username].addFriend();
            app.locals.activeBots[username].updateFriendsArray();
            var botLoop = setTimeout(followBehavior, foli, foli);
            app.locals.botLoops[req.params.username].push(botLoop);
        })(testInterval);
        
    });

    app.locals.activeBots[username].getFavInterval(function(favInterval){

        console.log("Will fav a tweet every " + favInterval + " milliseconds");

        (function favBehavior(fi){
            app.locals.activeBots[username].favTweet();
            var botLoop = setTimeout(favBehavior, fi, fi);
            app.locals.botLoops[req.params.username].push(botLoop);
        })(testInterval);

    });

    console.log("Started " + req.params.username + "'s twitter bot loop.");

    res.render('launchbot', {title: "Doppeltweeter", user: req.params.username});

});

///////////////////////////////////////////////////////////////////////

app.get('/stopbot/:username', ensureAuthenticated, function(req, res){
    app.locals.botLoops[req.params.username] = clearTimeoutsArray(botLoops[req.params.username]);
    console.log("cleared " + req.params.username + "'s twitter bot loops.");
    app.locals.botLoops[req.params.username] = null;
    res.redirect('/account');
});

//////////////////////////////////////////////////////////////////////


//get most recent activity from bot
//list tweets alongside alchemy analysis of those tweets
app.get('/checkbot/:username', ensureAuthenticated, function(req, res){
    var username = req.params.username;
    if(activeBots[username]){
        app.locals.activeBots[username].getFullUserTimeline(function(tweetdata){
            var usertimeline = tweetdata;
            var tweetsForPage = usertimeline.slice(0, 10);
            var relations = [];
            getKeywords(req, res, relations, tweetsForPage, function(relationArray){
                console.log(tweetsForPage);
                res.render('checkbot', {title: "Doppeltweeter", tweets: tweetsForPage, rels: relationArray, user: username});
            });
        }, false, username);
    } else {
        res.redirect('/account');
    }
});

/////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////

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
};

function clearTimeoutsArray(timeoutArray){
    clearTimeout(timeoutArray[0]);
    remainingTOs = timeoutArray.slice(1);
    if(remainingTOs.length === 0){
        return remainingTOs;
    } else{
        return clearTimeoutsArray(remainingTOs);
    }
};

function getRelations(req, res, relations, tweets, callback){
    alchemyapi.relations('text', tweets[0], {}, function(response) {
            relations.push(response);
            remainingTweets = tweets.slice(1);
            if(remainingTweets.length !== 0){
               return getRelations(req, res, relations, remainingTweets, callback);
            } else {
                return callback(relations);
            }
    });
};

function getKeywords(req, res, keywords, tweets, callback){
    alchemyapi.keywords('text', tweets[0], {}, function(response) {
            keywords.push(response);
            remainingTweets = tweets.slice(1);
            if(remainingTweets.length !== 0){
               return getKeywords(req, res, keywords, remainingTweets, callback);
            } else {
                return callback(keywords);
            }
    });
};


exports = module.exports = app;