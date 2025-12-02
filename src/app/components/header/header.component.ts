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
  CollaborationAccessType,
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

  // Observable for read-only collaboration mode (Proposal with AcceptReject access)
  // null until collaboration request is loaded, then evaluates to true/false
  isReadOnlyCollaborationMode$: Observable<boolean | null>;

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
    // Check if user is in read-only collaboration mode (Proposal with AcceptReject access on collaborative URL)
    const currentUrl$: Observable<string> = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    );

    // Check collaboration mode when collaboration request exists
    // null until collaboration request is loaded
    this.isReadOnlyCollaborationMode$ = merge(
      of(null),
      combineLatest([
        this.collaborationService.getMyCollaborationRequest(),
        currentUrl$
      ]).pipe(
        map(([request, url]) =>
          url.includes('/collaborative') &&
          request.ParentBusinessObjectType === 'Proposal' &&
          request.AccessType === CollaborationAccessType.AcceptReject
        )
      )
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
    this.userService.login();
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
