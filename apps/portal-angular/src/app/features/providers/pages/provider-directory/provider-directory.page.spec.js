describe('phProviderDirectoryPage', () => {
  let $componentController;
  let $httpBackend;
  let $location;

  beforeEach(angular.mock.module('portalApp.core', 'portalApp.providers'));

  beforeEach(inject((_$componentController_, _$httpBackend_, _$location_) => {
    $componentController = _$componentController_;
    $httpBackend = _$httpBackend_;
    $location = _$location_;
  }));

  afterEach(() => {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  function createController() {
    return $componentController('phProviderDirectoryPage');
  }

  it('loads providers on init', () => {
    const providers = [
      { id: 'prv_001', name: 'Dr. Alice Nguyen', specialty: 'Primary Care' },
      { id: 'prv_002', name: 'Dr. Marcus Bell', specialty: 'Dermatology' },
    ];
    $httpBackend.expectGET('/api/providers').respond(200, providers);

    const ctrl = createController();
    ctrl.$onInit();
    $httpBackend.flush();

    expect(ctrl.providers).toEqual(providers);
    expect(ctrl.loading).toBe(false);
    expect(ctrl.error).toBeNull();
    expect(ctrl.isEmpty).toBe(false);
  });

  it('filters providers by name or specialty, case-insensitively', () => {
    const providers = [
      { id: 'prv_001', name: 'Dr. Alice Nguyen', specialty: 'Primary Care' },
      { id: 'prv_002', name: 'Dr. Marcus Bell', specialty: 'Dermatology' },
    ];
    $httpBackend.expectGET('/api/providers').respond(200, providers);

    const ctrl = createController();
    ctrl.$onInit();
    $httpBackend.flush();

    ctrl.search = 'dermatology';
    expect(ctrl.filteredProviders).toEqual([providers[1]]);

    ctrl.search = 'NGUYEN';
    expect(ctrl.filteredProviders).toEqual([providers[0]]);

    ctrl.search = '   ';
    expect(ctrl.filteredProviders).toEqual(providers);
  });

  it('flags an empty result set only once loading has finished without an error', () => {
    $httpBackend.expectGET('/api/providers').respond(200, []);

    const ctrl = createController();
    ctrl.$onInit();
    expect(ctrl.isEmpty).toBe(false); // request still in flight, loading is true

    $httpBackend.flush();
    expect(ctrl.isEmpty).toBe(true);
  });

  it('surfaces a friendly error and supports retrying', () => {
    $httpBackend.expectGET('/api/providers').respond(500, {
      error: { code: 'UNKNOWN', message: 'Providers are temporarily unavailable.' },
    });

    const ctrl = createController();
    ctrl.$onInit();
    $httpBackend.flush();

    expect(ctrl.error).toBeTruthy();
    expect(ctrl.error.message).toBe('Providers are temporarily unavailable.');
    expect(ctrl.providers).toEqual([]);
    expect(ctrl.loading).toBe(false);

    $httpBackend.expectGET('/api/providers').respond(200, []);
    ctrl.load();
    $httpBackend.flush();

    expect(ctrl.error).toBeNull();
  });

  it('navigates to a provider profile route', () => {
    const ctrl = createController();

    ctrl.viewProfile({ id: 'prv_001' });

    expect($location.path()).toBe('/providers/prv_001');
  });
});
