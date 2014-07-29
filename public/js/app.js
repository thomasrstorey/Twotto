var app = angular.module('App', ['ngResource',
					   'ngRoute', 
					   'appRoutes', 
					   'MainCtrl',
					   'MainService',
					   'LoginCtrl',
					   'UserCtrl'])
		.config(function($routeProvider, $locationProvider, $httpProvider){
			//check if user is connected=====================
			var checkLoggedin = function($q, $timeout, $http, $location, $rootScope){
				//initialize new promise
				var deferred = $q.defer();

				//Make an AJAX call to check if user is loggedin
				$http.get('/loggedin').success(function(user){
					//authenticated
					if(user !== '0')
						$timeout(deferred.resolve, 0);
					//not authenticated
					else{
						$rootScope.message = 'You need to log in.';
						$timeout(function(){deferred.reject();}, 0);
						$location.url('/login');
					}
				});
				return deferred.promise;
			};

			//Interceptor for AJAX Errors==========================

			$httpProvider.responseInterceptors.push(function($q, $location){
				return function(promise){
					return promise.then(
						//Succes, return the response
						function(response){
							return response;
						},
						//Error, check error status to get only 401
						function(response){
							if(response.status === 401)
								$location.url('/login');
							return $q.reject(response);
							
						}
					);
				}
			});
		}).run(function($rootScope, $http, $location, $route){
			$rootScope.message = '';

			$rootScope.logout = function(){
				$rootScope.message = 'Logged out.';
				$http.post('/logout');
				$route.reload();
			}
		});