import { of } from 'rxjs';
import { HttpService } from 'src/app/core/services/http.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountComponent } from './account.component';
import { UserSessionService } from '../../shared/services/user-session.service';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';

describe('AccountComponent', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;
  let service: UserSessionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AccountComponent ],
      providers: [UserSessionService, HttpService],
      imports: [
        CommonModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        HttpClientTestingModule
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    service = fixture.debugElement.injector.get(UserSessionService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debería invocar el UserSessionservice', () => {
    const email = component.authForm.controls.email;
    email.setValue('eve.holt@reqres.in');
    const pass = component.authForm.controls.password;
    pass.setValue('cityslicka');

    const spyUserSessionService = spyOn(service, 'login').and.returnValue(of());

    const boton = fixture.debugElement.nativeElement.querySelector('button');
    boton.click();

    expect(spyUserSessionService.calls.any()).toBeTruthy();
    expect(spyUserSessionService).toHaveBeenCalledWith(email.value, pass.value);

  });
});
