import { JwtService } from './../../../../core/services/jwtService';
import { UserSession } from './../../../../core/modelo/user-session';
import { User } from './../../../../core/modelo/user';
import { map } from 'rxjs/operators';
import { HttpService } from './../../../../core/services/http.service';
import { Observable, Subject } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable()
export class UserSessionService {

  tokenSubject = new Subject<string>();

  constructor(protected http: HttpService, protected jwtService: JwtService) { }

  login(pCredenciales: User): Observable<UserSession> {
    const LOGINOBJECT = {
      email: pCredenciales.email,
      password: pCredenciales.password,
      userName: pCredenciales.userName
    };

    return this.http.post('https://reqres.in/api/login', LOGINOBJECT,
    this.http.optsName('User Session'))
    .pipe(
      map(data => {
        this.tokenSubject.next(data.token);
        this.setAuth({
          token: data.token,
          user: pCredenciales
        });
        return data;
      })
    );
  }

  private setAuth(pUser: UserSession) {
    this.jwtService.saveToken(pUser.token);
  }

  logout() {
    this.jwtService.destroyToken();
  }

}
