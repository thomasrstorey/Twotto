angular.module('BotService', []).factory('Bot', ['$http', function($http){
	return {
		get : function(id){
			return $http.get('/api/bot/' + id);
		},

		post : function(id, data){
			return $http.post('/api/bot/' + id, data);
		},

		delete : function(id){
			return $http.delete('/api/delete/' + id);
		}
	}
}])