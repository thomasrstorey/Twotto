angular.module('AppRoutes', []).config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
	$routeProvider
		.when('/', {
			templateUrl: '../../views/main.html'
		}).when('/id', {
			templateUrl: '../../views/user.html',
			controller: 'UserController'
		})

	$locationProvider.html5Mode(true);
}]);