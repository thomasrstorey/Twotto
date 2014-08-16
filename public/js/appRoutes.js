angular.module('AppRoutes', []).config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
	$routeProvider
		.when('/', {
			templateUrl: '../../views/main.html'
		}).when('/id', {
			templateUrl: '../../views/user.html',
			controller: 'UserController'
		}).when('/feed', {
			templateUrl: '../../views/feed.html',
			controller: 'FeedController'
		});

	$locationProvider.html5Mode(true);
}]);