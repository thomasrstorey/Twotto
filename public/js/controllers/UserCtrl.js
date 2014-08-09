angular.module('UserCtrl', []).controller('UserController', ['$scope', '$rootScope', '$http',
	function ($scope, $rootScope, $http) {
		$scope.user = {};
		$scope.loading = false;
		$scope.hide = true;

		function loadUser() {
			console.log("Hey get a user or whatver");
			$http.get('/app/secured/id')
			.success(function(data){
				$scope.message = data.message || null;
				$scope.hide = data.hide || false;
				$scope.user = data.user || null;
			});
		};

		$scope.fillDB = function () {
			console.log("Fill the database!");
			$scope.loading = true;
			$http.post('/app/secured/db/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.tweet = function () {
			console.log("tweet tweet");
			$scope.loading = true;
			$http.post('app/secured/tweet/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.fav = function () {
			console.log("fav");
			$scope.loading = true;
			$http.post('app/secured/fav/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.collectFavs = function () {
			console.log("collect favs");
			$scope.loading = true;
			$http.post('app/secured/collectFavs/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		var deregistration = $rootScope.$on('session-changed', loadUser);
		$scope.$on('$destroy', deregistration);


		loadUser();
	}]);