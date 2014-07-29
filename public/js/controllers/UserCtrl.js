angular.module('UserCtrl', [])
	.controller('UserController', function($scope, $http){
		$scope.user = {};

		$http.get('/user')
			.success(function(user){
				$scope.user = user;
			});
	});