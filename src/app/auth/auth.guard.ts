import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, delay, catchError } from 'rxjs/operators';
import { ApiService } from '@congarevenuecloud/core';
import { GuestUserService } from '@congarevenuecloud/ecommerce';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationGuard {

  constructor(private authService: AuthService, private apiService: ApiService, private guestUserService: GuestUserService) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    // Add delay to prevent race condition between auth initialization and guest session setup
    return of(null).pipe(
      delay(100),
      switchMap(() => {
        // Check both auth status and guest authentication
        return combineLatest([
          this.authService.isAuthorized().pipe(catchError(() => of(false))),
          this.apiService.isGuestAuthenticated().pipe(catchError(() => of(false)))
        ]);
      }),
      map(([isAuthorized, guestAuthenticated]) => {
        // If user is already logged in, allow access
        if (isAuthorized) {
          return true;
        }
        
        // If not guest authenticated, setup guest session
        if (!guestAuthenticated) {
          this.guestUserService.login();
        }
        
        // Always allow access (ecommerce works in guest mode)
        return true;
      }),
      catchError(() => {
        // If any error occurs, setup guest session and continue
        this.guestUserService.login();
        return of(true);
      })
    );
  }
}
