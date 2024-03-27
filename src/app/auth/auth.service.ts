import { Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map, Observable, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(public oidcSecurityService: OidcSecurityService) { }

  authorize() {
    this.oidcSecurityService.authorize();
  }

  logoff() {
    this.oidcSecurityService.logoff().pipe(take(1)).subscribe();
  }

  isAuthorized(): Observable<boolean> {
    return this.oidcSecurityService.checkAuth().pipe(
      take(1),
      map(({ isAuthenticated, accessToken, errorMessage }) => {
        return (isAuthenticated && accessToken && !errorMessage);
      })
    )
  }

}
