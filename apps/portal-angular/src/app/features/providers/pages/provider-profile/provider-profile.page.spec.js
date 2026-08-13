describe('phProviderProfilePage', () => {
  let $compile;
  let $rootScope;
  let $componentController;
  let $httpBackend;
  let $routeParams;
  let $location;

  beforeEach(angular.mock.module('ngRoute', 'ngSanitize', 'portalApp.core', 'portalApp.providers'));

  beforeEach(inject((
    _$compile_,
    _$rootScope_,
    _$componentController_,
    _$httpBackend_,
    _$routeParams_,
    _$location_,
  ) => {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $componentController = _$componentController_;
    $httpBackend = _$httpBackend_;
    $routeParams = _$routeParams_;
    $location = _$location_;
  }));

  afterEach(() => {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('loads the provider named by the route id', () => {
    $routeParams.id = 'prv_002';
    const provider = {
      id: 'prv_002',
      name: 'Dr. Marcus Bell',
      specialty: 'Dermatology',
      bio: 'Bio text.',
    };
    $httpBackend.expectGET('/api/providers/prv_002').respond(200, provider);

    const ctrl = $componentController('phProviderProfilePage');
    ctrl.$onInit();
    $httpBackend.flush();

    expect(ctrl.provider).toEqual(provider);
    expect(ctrl.loading).toBe(false);
    expect(ctrl.error).toBeNull();
  });

  it('redirects to the directory when the route has no id', () => {
    $routeParams.id = undefined;
    const ctrl = $componentController('phProviderProfilePage');

    ctrl.$onInit();

    expect($location.path()).toBe('/providers');
  });

  it('surfaces a friendly error when the provider cannot be loaded', () => {
    $routeParams.id = 'prv_999';
    $httpBackend
      .expectGET('/api/providers/prv_999')
      .respond(404, { error: { code: 'NOT_FOUND', message: 'Provider not found.' } });

    const ctrl = $componentController('phProviderProfilePage');
    ctrl.$onInit();
    $httpBackend.flush();

    expect(ctrl.error.message).toBe('Provider not found.');
    expect(ctrl.provider).toBeNull();
  });

  it('goes back to the directory route', () => {
    const ctrl = $componentController('phProviderProfilePage');
    ctrl.goBack();
    expect($location.path()).toBe('/providers');
  });

  // This is the regression test for the XSS finding the app previously shipped
  // (bio rendered via [innerHTML] bound to a $sce.trustAsHtml-wrapped string): it compiles
  // the real page template against a provider whose bio carries an onerror handler and
  // asserts the handler never reaches the DOM and never runs.
  it('sanitizes an unsafe bio instead of trusting it outright', () => {
    $routeParams.id = 'prv_002';
    const provider = {
      id: 'prv_002',
      name: 'Dr. Marcus Bell',
      specialty: 'Dermatology',
      locationName: 'Pulse Health Riverside',
      bio: 'Safe text. <img src="x" onerror="window.__pwned = true">',
    };
    $httpBackend.expectGET('/api/providers/prv_002').respond(200, provider);

    const element = $compile('<ph-provider-profile-page></ph-provider-profile-page>')($rootScope);
    $rootScope.$digest();
    $httpBackend.flush();
    $rootScope.$digest();

    const bio = element[0].querySelector('[data-testid="provider-bio"]');
    expect(bio.innerHTML).toContain('<img src="x">');
    expect(bio.innerHTML).not.toContain('onerror');
    expect(window.__pwned).toBeUndefined();
  });
});
