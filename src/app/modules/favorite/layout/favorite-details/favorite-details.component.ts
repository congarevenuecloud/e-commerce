import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { get, set, isEmpty, forEach, map as _map } from 'lodash';
import { Favorite, FavoriteService, LineItemService, ItemGroup, User, UserService, FavoriteScope, Cart, ComplexArray } from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';

/** Favorite details component shows the details of the selected favorite configuration. */
@Component({
  selector: 'app-favorite-details',
  templateUrl: './favorite-details.component.html',
  styleUrls: ['./favorite-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FavoriteDetailsComponent implements OnInit, OnDestroy {

  constructor(private activatedRoute: ActivatedRoute,
    private favoriteService: FavoriteService,
    private userService: UserService,
    private exceptionService: ExceptionService) { }

  favorite$: BehaviorSubject<Favorite> = new BehaviorSubject<Favorite>(null);

  lineItems$: BehaviorSubject<Array<ItemGroup>> = new BehaviorSubject<Array<ItemGroup>>(null);

  user$: Observable<User>;

  subscriptions: Array<Subscription> = new Array();

  isLoading: boolean = false;

  cart: Cart;

  favoriteScopes = [FavoriteScope.Private, FavoriteScope.Public];

  picklistValues: Array<ComplexArray> = [];

  ngOnInit() {
    this.user$ = this.userService.getCurrentUser();
    this.getFavorite();
    this.picklistValues = this.favoriteScopes.map(scope => ({
        'Key': scope,
        'Value': scope,
        'Sequence': 1
      }));
  }

  private getFavorite() {
    this.subscriptions.push(this.activatedRoute.params.pipe(
      filter(params => get(params, 'id') != null),
      map(params => get(params, 'id')),
      switchMap(favoriteId => this.favoriteService.getFavoriteById(favoriteId)),
      switchMap(res => {
        this.getFavoriteItems(get(res, 'ProductConfiguration.Id'));
        return of(res);
      })
    ).subscribe((favorite: Favorite) => {
      this.favorite$.next(favorite);
    }));
  }

  addFavoriteToCart(favorite: Favorite) {
    this.isLoading = true;
    this.subscriptions.push(this.favoriteService.addFavoriteToCart(favorite.Id)
      .subscribe(() => {
        this.isLoading = false;
        this.exceptionService.showSuccess('SUCCESS.FAVORITE.ADD_FAVORITE_TO_CART', 'SUCCESS.FAVORITE.TITLE', { name: favorite.Name });
      },
        (err) => this.exceptionService.showError(err)
      ));
  }

  updateFavorite(fieldValue, favorite, fieldName) {
    set(favorite, fieldName, fieldValue);
    this.subscriptions.push(this.favoriteService.updateFavorite(favorite).subscribe(c => this.favorite$.next(c)));
  }

  private getFavoriteItems(configurationId: string) {
    this.subscriptions.push(this.favoriteService.getFavoriteConfiguration(configurationId)
      .subscribe(res => {
        this.cart = res;
        const cartItems = get(res, 'LineItems');
        const lines = LineItemService.groupItems(cartItems);
        this.lineItems$.next(lines);
      }));
  }

  ngOnDestroy() {
    if (!isEmpty(this.subscriptions)) {
      forEach(this.subscriptions, item => item.unsubscribe());
    }
  }

}
