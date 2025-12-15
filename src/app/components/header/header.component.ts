import {
  Component,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, of, merge } from 'rxjs';
import { map, switchMap, take, tap, filter, startWith } from 'rxjs/operators';
import { first, defaultTo, get, cloneDeep, isEqual } from 'lodash';
import {
  Storefront,
  StorefrontService,
  UserService,
  User,
  CartService,
  Cart,
  AccountService,
  Account,
  CollaborationRequestService,
  CollaborationRequest,
  CollaborationAuthenticationType,
} from '@congarevenuecloud/ecommerce';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnInit {
  pageTop: boolean = true;
  userInitials: string = null;
  storefront$: Observable<Storefront>;
  storeLogo$: Observable<string>;
  user$: Observable<User>;
  myAccount$: Observable<Account>;
  showFavorites$: Observable<boolean>;
  cartView$: BehaviorSubject<Cart> = new BehaviorSubject(null);
  showAccountHome: boolean = false;
  showAccountInfo: boolean = false;
  cart: Cart;
  loading: boolean = true;

  isReadOnlyCollaborationMode$: Observable<boolean>;

  constructor(
    private userService: UserService,
    private storefrontService: StorefrontService,
    private cartService: CartService,
    private accountService: AccountService,
    private collaborationService: CollaborationRequestService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit() {
    const currentUrl$: Observable<string> = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    );

    this.isReadOnlyCollaborationMode$ = currentUrl$.pipe(
      switchMap(url => {
        // For collaborative cart route - always hide header
        if (url.includes('/collaborative/cart')) {
          return of(true);
        }

        if (url.includes('/proposals/')) {
          // Extract quoteId from URL
          const quoteId = url.match(/\/proposals\/([^\/\?]+)/)?.[1];
          if (quoteId) {
            return this.collaborationService.getMyCollaborationRequest('Proposal', quoteId).pipe(
              take(1),
              map((request: CollaborationRequest | null) => {
                return request?.AuthenticationType === CollaborationAuthenticationType.Anonymous;
              })
            );
          }
        }

        return of(false);
      })
    );

    this.updateCartView();
    this.storefront$ = this.storefrontService.getStorefront();
    this.storeLogo$ = combineLatest([
      this.storefront$,
      this.userService.isGuest(),
    ]).pipe(
      switchMap(([storefront, isGuest]) => {
        if (get(storefront, 'Logo') || isGuest) {
          return of(storefront as Storefront);
        } else {
          // Fallback to org-level logo
          return this.storefrontService.getConfigManagementSetting(
            'uithemes',
            'headersettings'
          );
        }
      }),
      map((response) =>
        get(response, response instanceof Storefront ? 'Logo' : 'logo', null)
      )
    );
    this.showFavorites$ = this.storefrontService.isFavoriteEnabled();
    this.user$ = this.userService.me().pipe(
      tap((user: User) => {
        this.userInitials = ((defaultTo(first(user.FirstName), '') as string) +
          defaultTo(first(user.LastName), '')) as string;
      })
    );
  }

  login() {
    this.userService.login(false);
  }

  doLogout() {
    this.userService.logout();
  }

  updateCartView() {
    combineLatest([
      this.cartService.getMyCart(),
      this.accountService.getCurrentAccount(),
    ])
      .pipe(
        take(1),
        map(([cart, account]) => {
          cart.Account = account;
          this.cart = cart;
          this.cartView$.next(cloneDeep(cart));
        })
      )
      .subscribe();
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
      ['basicOption', 'ng-option'].some((className) =>
        clickedElement.classList.contains(className)
      )
    )
      return;
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
    if (
      !isEqual(
        get(this.cartView$, 'value.Account.Id'),
        get(this.cart, 'Account.Id')
      )
    )
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
