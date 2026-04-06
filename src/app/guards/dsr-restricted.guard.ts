import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, CanActivate, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DsrService } from '../services/dsr.service';

@Injectable({
  providedIn: 'root'
})
export class DsrRestrictedGuard implements CanActivate {

  constructor(
    private router: Router,
    private dsrService: DsrService
  ) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | boolean | UrlTree {
    if (this.dsrService.isDsrMode()) {
      // If user is navigating to home or base URL, exit DSR mode and allow navigation
      if (state.url === '/' || state.url.startsWith('/home') || state.url.startsWith('/#/home')) {
        // Return the observable and map to true after cleanup completes
        return this.dsrService.deactivateDsrMode().pipe(
          map(() => true)
        );
      }
      
      // Otherwise, redirect back to DSR quote
      const quoteId = this.dsrService.getDsrQuoteId();
      if (quoteId) {
        return this.router.createUrlTree(['/proposals', quoteId], {
          queryParams: { dsr: 'true' }
        });
      }
      
      // No valid quote ID - DSR state is corrupted, exit DSR mode and go home
      return this.dsrService.deactivateDsrMode().pipe(
        map(() => this.router.createUrlTree(['/']))
      );
    }
    return true;
  }
}
