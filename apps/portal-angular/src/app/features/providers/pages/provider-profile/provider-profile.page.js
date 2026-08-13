import template from './provider-profile.page.html';

class ProviderProfilePageController {
  static $inject = ['providerDirectoryService', '$routeParams', '$location'];

  constructor(providerDirectoryService, $routeParams, $location) {
    this.providerDirectoryService = providerDirectoryService;
    this.$routeParams = $routeParams;
    this.$location = $location;
    this.provider = null;
    this.loading = false;
    this.error = null;
  }

  $onInit() {
    const id = this.$routeParams.id;
    if (!id) {
      this.$location.path('/providers');
      return;
    }
    this.load(id);
  }

  load(id) {
    this.loading = true;
    this.error = null;

    this.providerDirectoryService.getById(id).then(
      (provider) => {
        this.provider = provider;
        this.loading = false;
      },
      (error) => {
        this.error = error;
        this.provider = null;
        this.loading = false;
      },
    );
  }

  goBack() {
    this.$location.path('/providers');
  }
}

export const ProviderProfilePageComponent = {
  template,
  controller: ProviderProfilePageController,
};
