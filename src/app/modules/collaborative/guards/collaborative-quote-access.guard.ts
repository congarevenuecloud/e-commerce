import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { UserService, CollaborationRequestService, CollaborationRequest, CollaborationAuthenticationType } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';
import { TranslateService } from '@ngx-translate/core';

/**
 * CollaborativeQuoteAccessGuard
 * 
 * Guards the collaborative quote route and enforces authentication based on CollaborationRequest settings
 * - If AuthenticationType = 'AuthenticatedWithLogin': Redirects to login if user is not authenticated
 * - If AuthenticationType = 'Anonymous': Allows access without authentication
 * - Validates collaboration request exists and is not expired
 */
@Injectable({
  providedIn: 'root'
})
export class CollaborativeQuoteAccessGuard implements CanActivate {

  constructor(
    private userService: UserService,
    private collaborationService: CollaborationRequestService,
    private router: Router,
    private exceptionService: ExceptionService,
    private translateService: TranslateService
  ) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    const quoteId = route.params['id'];

    if (!quoteId) {
      this.exceptionService.showError(this.translateService.instant('COLLABORATION.INVALID_LINK'));
      return this.router.createUrlTree(['/']);
    }

    // Otherwise, validate by quoteId
    return this.validateByQuoteId(quoteId, state);
  }

  /**
   * Validates collaboration request by quoteId and checks authentication requirement
   * @ignore
   */
  private validateByQuoteId(quoteId: string, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.collaborationService.getCollaborationRequest('Proposal', quoteId).pipe(
      switchMap((collabRequest: CollaborationRequest) => {
        if (!collabRequest) {
          this.exceptionService.showError(this.translateService.instant('COLLABORATION.NOT_FOUND'));
          return of(this.router.createUrlTree(['/']));
        }

        // Check authentication requirement
        if (collabRequest.AuthenticationType === CollaborationAuthenticationType.AuthenticatedWithLogin) {
          // User must be logged in
          return this.userService.isLoggedIn().pipe(
            map((isLoggedIn: boolean) => {
              if (!isLoggedIn) {
                // Trigger login flow
                this.exceptionService.showInfo(this.translateService.instant('COLLABORATION.LOGIN_REQUIRED'));
                this.userService.login();
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
      }),
      catchError(error => {
        this.exceptionService.showError(this.translateService.instant('COLLABORATION.VALIDATION_ERROR'));
        return of(this.router.createUrlTree(['/']));
      })
    );
  }
}
