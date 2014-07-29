angular.module('MainCtrl', ['MainService'])
.controller('MainController',['Main', function(Main){
	this.tagline = 'Doppeltweeter :: Main';
}]);