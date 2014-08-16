angular.module('FeedCtrl', []).controller('FeedController', ['$scope', '$rootScope', '$http',
	function ($scope, $rootScope, $http) {
		$scope.timeline = [];
		$scope.index = 0;
		$scope.analysisObjects = [];
		$scope.analysisObject = {};
		$scope.loading = false;
		function loadUser() {
			console.log("FEED");
			
			$http.get('/app/secured/id')
			.success(function(data){
				$scope.message = data.message || null;
				$scope.hide = data.hide || false;
				$scope.user = data.user || null;
				$scope.botrunning = data.botrunning || false;
				loadTimeline();
			});
		};

		function loadTimeline() {
			
			console.log("LOAD TIMELINE");
			$http.get('/app/secured/timeline')
			.success(function(data){
				if(data.err){
					console.log(err);
				}
				$scope.loading = false;
				$scope.message = data.message || null;
				$scope.timeline = data.timeline || [];
				analyzeTweet($scope.index);
			});
		};

		function analyzeTweet(index) {
			if($scope.timeline.length !== 0){
				if(!$scope.analysisObjects[index]){
					$scope.loading = true;
					$scope.analysisObject = {};
					$scope.analysisObject.created_at = $scope.timeline[index].created_at;
					$scope.analysisObject.text = $scope.timeline[index].text;
					$scope.analysisObject.favorite_count = $scope.timeline[index].favorite_count;
					$scope.analysisObject.retweet_count = $scope.timeline[index].retweet_count;
					$scope.analysisObjects[index] = JSON.stringify($scope.analysisObject, null, 4);
					$http.get('/app/secured/relations/' + index)
					.success(function(data){
						$scope.analysisObject.relations = data.relations;
						$scope.analysisObjects[index] = JSON.stringify($scope.analysisObject, null, 4);
						$scope.loading = false;
					});
					$http.get('/app/secured/keywords/' + index)
					.success(function(data){
						$scope.analysisObject.keywords = data.keywords;
						$scope.analysisObjects[index] = JSON.stringify($scope.analysisObject, null, 4);
						$scope.loading = false;
					});
					$http.get('/app/secured/entities/' + index)
					.success(function(data){
						$scope.analysisObject.entities = data.entities;
						$scope.analysisObjects[index] = JSON.stringify($scope.analysisObject, null, 4);
						$scope.loading = false;
					});
					$http.get('/app/secured/sentiment/' + index)
					.success(function(data){
						$scope.analysisObject.sentiment = data.sentiment;
						$scope.analysisObjects[index] = JSON.stringify($scope.analysisObject, null, 4);
						$scope.loading = false;
					});
				}
				

			} else {
				console.error("Error: No timeline data.");
				$scope.message = "Error: No timeline data."
			}
		};

		$scope.nextTweet = function (){
			if($scope.index < $scope.timeline.length - 1){
				$scope.index++;
				analyzeTweet($scope.index);
			}
		};

		$scope.prevTweet = function (){
			if($scope.index > 0){
				$scope.index--;
			}
		};

		var deregistration = $rootScope.$on('session-changed', loadUser);
		$scope.$on('$destroy', deregistration);

		loadUser();
	}]);