import template from './provider-directory.page.html';

class ProviderDirectoryPageController {
  static $inject = ['providerDirectoryService', '$location'];

  constructor(providerDirectoryService, $location) {
    this.providerDirectoryService = providerDirectoryService;
    this.$location = $location;
    this.providers = [];
    this.search = '';
    this.loading = false;
    this.error = null;
  }

  $onInit() {
    this.load();
  }

  get filteredProviders() {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.providers;
    }
    return this.providers.filter(
      (provider) =>
        provider.name.toLowerCase().includes(term) ||
        provider.specialty.toLowerCase().includes(term),
    );
  }

  get isEmpty() {
    return !this.loading && !this.error && this.filteredProviders.length === 0;
  }

  load() {
    this.loading = true;
    this.error = null;

    this.providerDirectoryService.list().then(
      (providers) => {
        this.providers = providers;
        this.loading = false;
      },
      (error) => {
        this.error = error;
        this.providers = [];
        this.loading = false;
      },
    );
  }

  viewProfile(provider) {
    this.$location.path(`/providers/${provider.id}`);
  }
}

export const ProviderDirectoryPageComponent = {
  template,
  controller: ProviderDirectoryPageController,
};
