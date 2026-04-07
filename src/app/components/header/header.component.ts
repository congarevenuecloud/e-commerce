import {
  Component,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, of, merge } from 'rxjs';
import { map, switchMap, take, tap, filter, startWith, distinctUntilChanged, shareReplay, catchError } from 'rxjs/operators';
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
import { DsrService } from '../../services/dsr.service';
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
  isDsrMode$: Observable<boolean>;
  showMiniCart$: Observable<boolean>;
  showProductSearch$: Observable<boolean>; // true when in normal mode OR DSR editing mode
  
  isRestrictedMode$: Observable<boolean>; // true when in DSR or readonly collaboration mode
  isNormalMode$: Observable<boolean>; // true when NOT in DSR or readonly collaboration mode

  constructor(
    private userService: UserService,
    private storefrontService: StorefrontService,
    private cartService: CartService,
    private accountService: AccountService,
    private collaborationService: CollaborationRequestService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private dsrService: DsrService
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
            return this.collaborationService.getCollaborationRequest('Proposal', quoteId).pipe(
              take(1),
              switchMap((request: CollaborationRequest) => {
                return this.userService.isLoggedIn().pipe(
                  map((isLoggedIn: boolean) => {
                    // Hide header only for anonymous collaboration when user is not logged in
                    return request?.AuthenticationType === CollaborationAuthenticationType.Anonymous && !isLoggedIn;
                  }),
                  catchError(() => of(false))
                );
              }),
              catchError(() => of(false))
            );
          }
        }

        return of(false);
      })
    );

    // Initialize DSR mode observable
    this.isDsrMode$ = this.dsrService.getDsrState().pipe(
      map((state) => state.isDsrMode),
      shareReplay(1)
    );

    this.showMiniCart$ = combineLatest([
      this.isDsrMode$,
      currentUrl$
    ]).pipe(
      map(([isDsrMode, url]) => {
        if (!isDsrMode) {
          return true; // Always show in normal mode
        }
        
        // In DSR mode: hide on quote details, show on products/cart/checkout pages
        const isOnQuotePage = url.includes('/proposals/');
        return !isOnQuotePage;
      }),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.isRestrictedMode$ = combineLatest([
      this.isReadOnlyCollaborationMode$,
      this.isDsrMode$
    ]).pipe(
      map(([isCollabMode, isDsrMode]) => isCollabMode || isDsrMode),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.isNormalMode$ = this.isRestrictedMode$.pipe(
      map(isRestricted => !isRestricted),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Show product search in normal mode OR when in DSR FullEdit mode editing line items
    // Query collaboration service for accessType instead of storing it in DSR state
    this.showProductSearch$ = this.dsrService.getDsrState().pipe(
      switchMap(state => {
        // Show in normal mode (not DSR, not restricted)
        if (!state.isDsrMode) {
          return of(true);
        }
        
        // In DSR mode with editing line items - check if FullEdit access
        if (state.isDsrMode && state.editedLineItems && state.quoteId) {
          return this.collaborationService.getCollaborationRequest('Proposal', state.quoteId).pipe(
            take(1),
            map((collabRequest: CollaborationRequest) => {
              // Show search only for FullEdit access
              return collabRequest?.AccessType === 'FullEdit';
            }),
            catchError(error => {
              return of(true);
            })
          );
        }
        
        // DSR mode but not editing - hide search
        return of(false);
      }),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.updateCartView();
    this.storefront$ = this.storefrontService.getStorefront();
    this.storeLogo$ = combineLatest([
      this.storefront$,
      this.userService.isGuest(),
    ]).pipe(
      switchMap(([storefront, isGuest]) => {
        const storefrontLogo = get(storefront, 'Logo');
        if (storefrontLogo) {
          return of(storefront as Storefront);
        } else if (!isGuest) {
          // Fallback to org-level logo when not a guest
          return this.storefrontService.getConfigManagementSetting(
            'uithemes',
            'headersettings'
          );
        } else {
          // Guest user without storefront logo - return storefront (will use default)
          return of(storefront as Storefront);
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
