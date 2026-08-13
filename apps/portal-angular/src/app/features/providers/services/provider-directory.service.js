export function ProviderDirectoryService($http) {
  const baseUrl = '/api/providers';

  return {
    list() {
      return $http.get(baseUrl).then((response) => response.data);
    },

    getById(id) {
      return $http.get(`${baseUrl}/${id}`).then((response) => response.data);
    },
  };
}

ProviderDirectoryService.$inject = ['$http'];
