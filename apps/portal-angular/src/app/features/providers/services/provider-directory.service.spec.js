describe('providerDirectoryService', () => {
  let providerDirectoryService;
  let $httpBackend;

  beforeEach(angular.mock.module('portalApp.providers'));

  beforeEach(
    inject((_providerDirectoryService_, _$httpBackend_) => {
      providerDirectoryService = _providerDirectoryService_;
      $httpBackend = _$httpBackend_;
    }),
  );

  afterEach(() => {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('lists providers from /api/providers', () => {
    const providers = [{ id: 'prv_001', name: 'Dr. Alice Nguyen', specialty: 'Primary Care' }];
    $httpBackend.expectGET('/api/providers').respond(200, providers);

    let result;
    providerDirectoryService.list().then((response) => {
      result = response;
    });
    $httpBackend.flush();

    expect(result).toEqual(providers);
  });

  it('fetches a single provider by id', () => {
    const provider = { id: 'prv_002', name: 'Dr. Marcus Bell', specialty: 'Dermatology' };
    $httpBackend.expectGET('/api/providers/prv_002').respond(200, provider);

    let result;
    providerDirectoryService.getById('prv_002').then((response) => {
      result = response;
    });
    $httpBackend.flush();

    expect(result).toEqual(provider);
  });
});
