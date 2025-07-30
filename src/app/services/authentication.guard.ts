import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { get } from 'lodash';
import { UserService, CartService, Cart } from '@congarevenuecloud/ecommerce';

@Injectable()
export class AuthenticationGuard {

  constructor(private router: Router, private userService: UserService, private translateService: TranslateService, private cartService: CartService) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.userService.isLoggedIn().pipe(
      switchMap(isLoggedIn => {
        if (isLoggedIn) {
          return of(true);
        } else {
          return this.cartService.getMyCart().pipe(
            take(1),
            switchMap((cart: Cart) => {
              // If the cart has line items, show confirmation popup
              if (get(cart, 'LineItems', [])?.length > 0) {
                return this.translateService.stream('FOOTER.CONFIRM_POPUP_MESSAGE').pipe(
                  take(1),
                  switchMap((message: string) => {
                    const userConfirmed = confirm(message);

                    if (userConfirmed) {
                      this.userService.login();
                      return of(false);
                    } else {
                      this.router.navigate(['/']);
                      return of(false);
                    }
                  })
                );
              }
              // If the cart is empty, redirect to login
              else {
                this.userService.login();
                return of(false);
              }
            })
          );
        }
      })
    );
  }

}
