angular.module('UserCtrl', []).controller('UserController', ['$scope', '$rootScope', '$http',
	function ($scope, $rootScope, $http) {
		$scope.user = {};

		function loadUser() {
			console.log("Hey get a user or whatver");
			$http.get('/app/secured/id')
			.success(function(data){
				$scope.userid = data.message || null;
				$scope.user = data.user || null;
			});
		};

		$scope.fillDB = function () {
			console.log("Fill the database!");
			$http.post('/app/secured/db/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.userid = data.message || null;
			});
		};

		$scope.tweet = function () {
			console.log("tweet tweet");
			$http.post('app/secured/tweet/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.userid = data.message || null;
			});
		};

		var deregistration = $rootScope.$on('session-changed', loadUser);
		$scope.$on('$destroy', deregistration);


		loadUser();
	}]);