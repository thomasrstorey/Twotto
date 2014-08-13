angular.module('UserCtrl', []).controller('UserController', ['$scope', '$rootScope', '$http',
	function ($scope, $rootScope, $http) {
		$scope.user = {};
		$scope.loading = false;
		$scope.hide = true;
		$scope.botrunning = false;

		function loadUser() {
			console.log("Hey get a user or whatver");
			$http.get('/app/secured/id')
			.success(function(data){
				$scope.message = data.message || null;
				$scope.hide = data.hide || false;
				$scope.user = data.user || null;
				$scope.botrunning = data.botrunning || false;
			});
		};

		$scope.render = function (name) {
			if(name === 'start'){
				if($scope.botrunning || $scope.hide){
					return true;
				} else {
					return false;
				}
			} else if(name === 'stop'){
				if($scope.botrunning && !$scope.hide){
					return false;
				} else {
					return true;
				}
			}
		}

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

		$scope.friend = function () {
			console.log("follow");
			$scope.loading = true;
			$http.post('app/secured/friend/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.rt = function () {
			console.log("rt");
			$scope.loading = true;
			$http.post('app/secured/rt/' + $scope.user.twitter.username)
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

		$scope.collectFollowers = function () {
			console.log("collect followers");
			$scope.loading = true;
			$http.post('app/secured/collectFollowers/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.collectFriends = function () {
			console.log("collect friends");
			$scope.loading = true;
			$http.post('app/secured/collectFriends/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
			});
		};

		$scope.start = function () {
			console.log("start");
			$scope.loading = true;
			$scope.message = "Starting your bot. This can take a couple minutes, so thanks for being patient.";
			$http.post('app/secured/start/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
				$scope.botrunning = data.botrunning || false;
			});
		};

		$scope.stop = function () {
			console.log("stop");
			$scope.loading = true;
			$http.delete('app/secured/stop/' + $scope.user.twitter.username)
			.success(function(data){
				$scope.loading = false;
				$scope.message = data.message || null;
				$scope.botrunning = data.botrunning || false;
			});
		};

		var deregistration = $rootScope.$on('session-changed', loadUser);
		$scope.$on('$destroy', deregistration);


		loadUser();
	}]);