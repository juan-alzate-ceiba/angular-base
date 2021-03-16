import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class JwtService {

  JWT_TOKEN_LOCAL_STORAGE_KEY = 'jwtToken';
  USERNAME_LOCAL_STORAGE_KEY = 'username';
  EMAIL_LOCAL_STORAGE_KEY = 'email';

  getToken() {
    return window.localStorage[this.JWT_TOKEN_LOCAL_STORAGE_KEY];
  }

  saveToken(pToken) {
    window.localStorage[this.JWT_TOKEN_LOCAL_STORAGE_KEY] = pToken;
  }

  destroyToken() {
    window.localStorage.removeItem(this.JWT_TOKEN_LOCAL_STORAGE_KEY);
  }
}
