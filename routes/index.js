var express = require('express');
var router = express.Router();
var config = require('../config');

var oAuthToken;
var oAuthTokenSecret;


/* GET home page. */
router.get('/', function(req, res) {
  
  res.render('index', { title: 'Twotto',
  						signin: 'https://dev.twitter.com/sites/default/files/images_documentation/sign-in-with-twitter-link.png',
  						link: '/auth/twitter' });
});



module.exports = router;