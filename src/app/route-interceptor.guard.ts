import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { NavigationInterceptorService } from '@congarevenuecloud/ecommerce';


// Guard to intercept and manage navigation URLs by prepending a base path.
@Injectable({
  providedIn: 'root',
})
export class RouteInterceptorGuard implements CanActivate {

  constructor(private navigationInterceptorService: NavigationInterceptorService, private router: Router) {
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    const currentUrl = state.url;

    // Retrieve the 'storefront' parameter from the route
    const paramMap = route.paramMap.get('storefront') || '';

    // Determine the updated URL after navigation
    const updatedUrl = this.navigationInterceptorService.getModifiedUrl(paramMap, currentUrl);

    // Allow access if the URL hasn't changed; otherwise, redirect to the updated URL
    return updatedUrl === currentUrl ? true : this.router.parseUrl(updatedUrl);
  }
}
