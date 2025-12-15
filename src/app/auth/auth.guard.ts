import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@congarevenuecloud/core';
import { GuestUserService } from '@congarevenuecloud/ecommerce';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationGuard {

  constructor(
    private apiService: ApiService,
    private guestUserService: GuestUserService
  ) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    // Always allow access and initialize guest user if needed
    // Do NOT check authentication state here to avoid creating OIDC state
    return this.apiService.isGuestAuthenticated().pipe(
      map(guestAuthenticated => {
        if (!guestAuthenticated) {
          this.guestUserService.login();
        }
        return true;
      })
    );
  }
}
