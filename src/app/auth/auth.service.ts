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
    // Use isAuthenticated$ to check auth state without calling checkAuth()
    // checkAuth() creates authorization state that conflicts with authorize() when called in quick succession
    return this.oidcSecurityService.isAuthenticated$.pipe(
      take(1),
      map((result) => {
        // Handle null, boolean, and AuthenticatedResult types
        if (!result) {
          return false;
        }
        if (typeof result === 'boolean') {
          return result;
        }
        // AuthenticatedResult includes isAuthenticated, userData, accessToken, idToken, configId, etc.; only isAuthenticated is used here
        return result.isAuthenticated;
      })
    )
  }

}
