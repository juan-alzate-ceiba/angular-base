// tslint:disable-next-line: no-feature-imports
import { UserSessionService } from 'src/app/feature/account/shared/services/user-session.service';
import { NgModule, ErrorHandler } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SecurityGuard } from './guard/security.guard';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { TokenInterceptor } from './interceptor/token-interceptor';
import { AuthInterceptor } from './interceptor/auth-interceptor';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ManejadorError } from './interceptor/manejador-error';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [ToolbarComponent, NavbarComponent],
  imports: [
    CommonModule,
    RouterModule,
  ],
  exports: [ToolbarComponent, NavbarComponent],
  providers: [
    SecurityGuard,
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: ErrorHandler, useClass: ManejadorError },
    UserSessionService
  ]
})
export class CoreModule { }
