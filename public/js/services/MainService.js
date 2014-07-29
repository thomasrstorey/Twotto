angular.module('MainService', []).factory('Main', ['$http', function($http){
	return {
		logout : function(){
			return $http.get('/logout');
		}
	}
}]);