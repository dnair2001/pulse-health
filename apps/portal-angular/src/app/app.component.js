import template from './app.component.html';

class AppRootController {
  static $inject = ['$location', 'telemetryService'];

  constructor($location, telemetryService) {
    this.$location = $location;
    this.patientName = 'Jordan Reyes';
    telemetryService.checkApiHealth();
  }

  isActive(path) {
    const current = this.$location.path();
    return current === path || current.startsWith(`${path}/`);
  }
}

export const AppRootComponent = {
  template,
  controller: AppRootController,
};
