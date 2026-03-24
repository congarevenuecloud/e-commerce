import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap, take, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { PlatformConstants, FilterOperator } from '@congarevenuecloud/core';
import { UserService, CollaborationRequestService, CollaborationRequest, CollaborationAuthenticationType } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';
import { DsrService } from '../../../services/dsr.service';

@Injectable({
  providedIn: 'root'
})
export class CollaborationAuthGuard implements CanActivate {

  constructor(
    private userService: UserService,
    private collaborationService: CollaborationRequestService,
    private router: Router,
    private exceptionService: ExceptionService,
    private translateService: TranslateService,
    private dsrService: DsrService
  ) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    // Support both 'id' (regular route) and 'quoteId' (DSR redirect route)
    const quoteId = route.params['id'] || route.params['quoteId'];
    const isDsrMode = route.queryParams['dsr'] === 'true' || this.dsrService.isDsrMode();
    
    // If coming from /dsr/proposals/:quoteId route, redirect to /proposals/:quoteId with dsr=true
    if (route.params['quoteId'] && state.url.includes('/dsr/')) {
      return this.router.createUrlTree(['/proposals', quoteId], {
        queryParams: { dsr: 'true' }
      });
    }

    if (!quoteId) {
      this.exceptionService.showError(this.translateService.instant('COLLABORATION.INVALID_LINK'));
      return this.router.createUrlTree(['/']);
    }

    // Validate collaboration request and check authentication requirement
    return this.validateByQuoteId(quoteId, state, isDsrMode);
  }

  private validateByQuoteId(quoteId: string, state: RouterStateSnapshot, isDsrMode: boolean = false): Observable<boolean | UrlTree> {
    return this.collaborationService.getCollaborationRequest('Proposal', quoteId, [{ field: 'CollaborationType', value: 'Digital Commerce', filterOperator: FilterOperator.EQUAL }]).pipe(
      take(1),
      switchMap((collabRequest: CollaborationRequest) => {
        if (!collabRequest) {
          // DSR mode requires collaboration
          if (isDsrMode) {
            return this.deactivateDsrAndRedirect('COLLABORATION.NO_COLLABORATION_FOUND');
          }
          // No collaboration request exists - allow normal quote access
          return of(true);
        }

        // DSR Mode: Activate DSR state and set pricelist for FullEdit
        if (isDsrMode) {
          return this.activateDsrMode(quoteId, collabRequest).pipe(
            switchMap(() => this.validateAuthentication(collabRequest, state)),
            catchError(error => {
              return this.deactivateDsrAndRedirect('COLLABORATION.VALIDATION_ERROR');
            })
          );
        }

        // Normal mode: Just validate authentication
        return this.validateAuthentication(collabRequest, state);
      }),
      catchError(error => {
        // Clear DSR state on error
        if (isDsrMode) {
          return this.deactivateDsrAndRedirect('COLLABORATION.VALIDATION_ERROR');
        }
        this.exceptionService.showError(this.translateService.instant('COLLABORATION.VALIDATION_ERROR'));
        return this.redirectToHome();
      })
    );
  }

  private validateAuthentication(collabRequest: CollaborationRequest, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    // Check authentication requirement
    if (collabRequest.AuthenticationType === CollaborationAuthenticationType.AuthenticatedWithLogin) {
      // User must be logged in
      return this.userService.isLoggedIn().pipe(
        map((isLoggedIn: boolean) => {
          if (!isLoggedIn) {
            localStorage.setItem(PlatformConstants.REDIRECT_URL, state.url);
            this.exceptionService.showInfo(this.translateService.instant('COLLABORATION.LOGIN_REQUIRED'));
            this.userService.login(false);
            return false;
          }
          return true;
        })
      );
    } else if (collabRequest.AuthenticationType === CollaborationAuthenticationType.Anonymous) {
      // Guest users can proceed without login
      return of(true);
    } else {
      // Unknown authentication type
      this.exceptionService.showError(this.translateService.instant('COLLABORATION.INVALID_CONFIG'));
      return of(this.router.createUrlTree(['/']));
    }
  }

  private activateDsrMode(quoteId: string, collabRequest: CollaborationRequest): Observable<boolean> {
    // Set pricelist only for FullEdit access type
    const setPriceList = collabRequest.AccessType === 'FullEdit';
    
    return this.dsrService.activateDsrMode(quoteId, setPriceList).pipe(
      map(() => true)
    );
  }

  private deactivateDsrAndRedirect(errorKey: string): Observable<UrlTree> {
    return this.dsrService.deactivateDsrMode().pipe(
      tap(() => this.exceptionService.showError(this.translateService.instant(errorKey))),
      switchMap(() => this.redirectToHome()),
      catchError(() => {
        return this.redirectToHome();
      })
    );
  }

  private redirectToHome(): Observable<UrlTree> {
    const urlTree = this.router.createUrlTree(['/home']);
    return of(urlTree);
  }
}
