import { HttpResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { User } from '@core/modelo/user';
import { HttpService } from '@core/services/http.service';

import { UserSessionService } from './user-session.service';

describe('AccountService', () => {
  let httpMock: HttpTestingController;
  let service: UserSessionService;

  const endPointLogin = 'https://reqres.in/api/login';

  beforeEach(() => {
    const injector = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpService]
    });
    httpMock = injector.inject(HttpTestingController);
    service = TestBed.inject(UserSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deberia realizar un post con email y password', (done) => {
    const user = new User('eve.holt@reqres.in', 'cityslicka', '');

    service.login(user).subscribe((respuesta) => {
      expect(respuesta.token).not.toBe(null);
      done();
    });
    const req = httpMock.expectOne(endPointLogin);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });
});
