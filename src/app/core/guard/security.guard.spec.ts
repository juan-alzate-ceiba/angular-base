import { HttpService } from 'src/app/core/services/http.service';
import { UserSessionService } from 'src/app/feature/account/shared/services/user-session.service';
import { TestBed, inject } from '@angular/core/testing';

import { SecurityGuard } from './security.guard';

describe('SecurityGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SecurityGuard, UserSessionService, HttpService]
    });
  });

  xit('should ...', inject([SecurityGuard, UserSessionService, HttpService], (guard: SecurityGuard) => {
    expect(guard).toBeTruthy();
  }));
});
