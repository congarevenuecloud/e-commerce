import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ConfigurationService } from '@congarevenuecloud/core';
import { UserService, User, Cart, CartService, StorefrontService } from '@congarevenuecloud/ecommerce';
import { defaultTo, first } from 'lodash';

@Component({
  selector: 'app-my-account-layout',
  templateUrl: './my-account-layout.component.html',
  styleUrls: ['./my-account-layout.component.scss']
})
export class MyAccountLayoutComponent implements OnInit {

  /** An observable object of user type. */
  me$: Observable<User>;
  /** @ignore */
  userInitials: string = null;
  showFavorites$: Observable<boolean>;

  /** @ignore */
  constructor(
    private userService: UserService,
    private config: ConfigurationService,
    private cartService: CartService,
    private storefrontService: StorefrontService
  ) { }

  /** @ignore */
  ngOnInit() {
    this.me$ = this.userService.me().pipe(
      tap((user: User) => {
        this.userInitials = defaultTo(first(user.FirstName), '') + defaultTo(first(user.LastName), '');
      })
    );
    this.showFavorites$ = this.storefrontService.isFavoriteEnabled();
  }

}
