// tslint:disable-next-line: no-feature-imports
import { UserSessionService } from 'src/app/feature/account/shared/services/user-session.service';
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SecurityGuard implements CanActivate {

  constructor(private userSessionService: UserSessionService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    if (!this.userSessionService.isLogged()) {
      this.router.navigateByUrl('login');
      return false;
    }
    return true;
  }

}
