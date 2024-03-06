import { Component, OnInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { first, defaultTo, get, cloneDeep, isEqual } from 'lodash';
import { Storefront, StorefrontService, UserService, User, CartService, Cart, AccountService, Account } from '@congarevenuecloud/ecommerce';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit {

  pageTop: boolean = true;
  userInitials: string = null;
  storefront$: Observable<Storefront>;
  user$: Observable<User>;
  myAccount$: Observable<Account>;
  showFavorites$: Observable<boolean>;
  cartView$: BehaviorSubject<Cart> = new BehaviorSubject(null);
  showAccountHome: boolean = false;
  showAccountInfo: boolean = false;
  cart: Cart;
  loading: boolean = true;

  constructor(
    private userService: UserService,
    private storefrontService: StorefrontService,
    private cartService: CartService,
    private accountService: AccountService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.updateCartView();
    this.storefront$ = this.storefrontService.getStorefront();
    this.showFavorites$ = this.storefrontService.isFavoriteEnabled();
    this.user$ = this.userService.me().pipe(
      tap((user: User) => {
        this.userInitials = defaultTo(first(user.FirstName), '') as string + defaultTo(first(user.LastName), '') as string;
      })
    );
  }

  login() {
    this.userService.login();
  }

  doLogout() {
    this.userService.logout();
  }

  updateCartView() {
    combineLatest([this.cartService.getMyCart(), this.accountService.getCurrentAccount()]).pipe(
      take(1),
      map(([cart, account]) => {
        cart.Account = account;
        this.cart = cart;
        this.cartView$.next(cloneDeep(cart));
      })
    ).subscribe();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event) {
    this.pageTop = window.pageYOffset <= 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedElement = event?.target as HTMLElement;
    const isArrowLeft = clickedElement.closest('.back-icon');

    if (isArrowLeft) this.showAccountInfo = false;

    else if (
      clickedElement.parentElement?.classList.contains('account-section') ||
      clickedElement.closest('.account-info') ||
      ['basicOption', 'ng-option'].some(className => clickedElement.classList.contains(className))) return;

    else {
      this.showAccountHome = false;
      this.showAccountInfo = false;
      this.resetAccountSelection();
    }
  }

  toggleMyAccountDropdown(event?: Event): void {
    event.stopImmediatePropagation();
    this.showAccountHome = !this.showAccountHome;
  }

  loadAccountDetails(): void {
    this.showAccountInfo = true;
    this.showAccountHome = false;
  }

  navigateToAccountHome(): void {
    this.showAccountHome = true;
    this.showAccountInfo = false;
    this.resetAccountSelection();
  }

  resetAccountSelection(): void {
    if (!isEqual(get(this.cartView$, 'value.Account.Id'), get(this.cart, 'Account.Id')))
      this.cartView$.value.Account = this.cart.Account;
  }

  updateAccountInfo(): void {
    const myAccountId = get(this.cartView$.value, 'Account.Id');
    if (myAccountId) {
      this.myAccount$ = this.accountService.getAccount(myAccountId).pipe(
        switchMap((account) => {
          this.cartView$.value.Account = account;
          this.loading = false;
          this.cdr.detectChanges();
          return of(account);
        })
      );
    }
  }
}
