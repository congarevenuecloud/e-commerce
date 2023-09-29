import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@congarevenuecloud/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationGuard implements CanActivate {

  constructor(private authService: AuthService, private apiService: ApiService) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    return combineLatest([this.authService.isAuthorized(), this.apiService.isGuestAuthenticated()]).pipe(
      map(([isAuthorized, guestAuthenticated]) => {
        if (!guestAuthenticated) this.apiService.loginAsGuest();
        return true;
      })
    );
  }
}
