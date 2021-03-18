// tslint:disable-next-line: no-feature-imports
import { UserSessionService } from 'src/app/feature/account/shared/services/user-session.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Component, OnInit, Input } from '@angular/core';
import { MenuItem } from '@core/modelo/menu-item';
import { JwtService } from '@core/services/jwtService';

@Component({
  selector: 'app-navbar',
  templateUrl: 'navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {

  @Input()
  items: MenuItem[];

  token: string;

  tokenSubscription: Subscription;

  constructor(
    private userSessionService: UserSessionService,
    private router: Router,
    private jwtService: JwtService
    ) {
    }

  ngOnInit() {
    this.tokenSubscription = this.userSessionService.tokenSubject.subscribe(
      data => {
        this.token = data ? data : '';
      }
    );
  }

  logout() {
    this.userSessionService.logout();
    this.router.navigateByUrl('login');
    this.token = this.jwtService.getToken() ? this.jwtService.getToken().toString() : '';
  }

}
