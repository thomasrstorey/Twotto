angular.module('appRoutes', []).config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
	$routeProvider
		.when('/', {
			templateUrl: 'home.ejs',
			controller: 'MainController'
		})
		.when('/login', {
			templateUrl: 'login.ejs',
			controller: 'LoginController'
		})
		.when('/account', {
			templateUrl: 'account.ejs',
			controller: 'BotController'
		});

	$locationProvider.html5mode(true);
}]);