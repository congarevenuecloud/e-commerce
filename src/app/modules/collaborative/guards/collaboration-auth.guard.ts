import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { PlatformConstants, FilterOperator } from '@congarevenuecloud/core';
import { UserService, CollaborationRequestService, CollaborationRequest, CollaborationAuthenticationType } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';
@Injectable({
  providedIn: 'root'
})
export class CollaborationAuthGuard implements CanActivate {

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

    // Validate collaboration request and check authentication requirement
    return this.validateByQuoteId(quoteId, state);
  }

  private validateByQuoteId(quoteId: string, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.collaborationService.getCollaborationRequest('Proposal', quoteId, [{ field: 'CollaborationType', value: 'Digital Commerce', filterOperator: FilterOperator.EQUAL }]).pipe(
      take(1),
      switchMap((collabRequest: CollaborationRequest) => {
        if (!collabRequest) {
          // No collaboration request exists - allow normal quote access
          return of(true);
        }

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
      }),
      catchError(error => {
        this.exceptionService.showError(this.translateService.instant('COLLABORATION.VALIDATION_ERROR'));
        return of(this.router.createUrlTree(['/']));
      })
    );
  }
}
