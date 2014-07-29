angular.module('LoginCtrl', [])
	.controller('LoginController', function($scope, $rootScope, $http, $location, $window){
		$scope.user = {};

		$scope.login = function(){
			var authWindow = $window.open('/auth/twitter');
			authWindow.onClose = function(){
				authWindow.close();
				$rootScope.message = 'Authentication succesful';
				$location.url('/user');
			};
			/*$http.get('/auth/twitter')
			.success(function(){
				$rootScope.message = 'Authentication succesful';
				$location.url('/user');
			})
			.error(function(){
				$rootScope.message = 'Authentication failed';
				$location.url('/login');
			});*/
		};
	});