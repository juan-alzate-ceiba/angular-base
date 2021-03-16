import { Router } from '@angular/router';
import { UserSessionService } from './../../../feature/account/shared/services/user-session.service';
import { Subscription } from 'rxjs';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { MenuItem } from '@core/modelo/menu-item';

@Component({
  selector: 'app-navbar',
  templateUrl: 'navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {

  @Input()
  items: MenuItem[];

  token: string;

  tokenSubscription: Subscription;

  constructor(private userSessionService: UserSessionService, private router: Router) { }

  ngOnInit() {
    this.tokenSubscription = this.userSessionService.tokenSubject.subscribe(
      data => {
        this.token = data ? data : '';
      }
    );
  }

  ngOnDestroy() {
    this.tokenSubscription.unsubscribe();
  }

  logout() {
    this.userSessionService.logout();
    this.router.navigateByUrl('login');
    this.token = '';
  }

}
