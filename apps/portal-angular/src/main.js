import angular from 'angular';
import 'angular-route';
import 'angular-sanitize';

import './styles.scss';
import './app/app.module';

angular.bootstrap(document, ['portalApp'], { strictDi: true });
