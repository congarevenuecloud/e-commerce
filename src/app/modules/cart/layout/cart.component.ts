import { Component, OnInit, ViewChild, ElementRef, TemplateRef, OnDestroy, NgZone, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { TabsetComponent } from 'ngx-bootstrap/tabs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { get, uniqueId, find, defaultTo, isNil, set } from 'lodash';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService } from '@congarevenuecloud/core';
import { User, Account, Cart, CartService, Order, OrderService, Contact, ContactService, UserService, AccountService, EmailService, PaymentTransaction, AccountInfo, EmailTemplate, AttachmentService, ProductInformationService, IntegrationService, TaxAddress } from '@congarevenuecloud/ecommerce';
import { ExceptionService, PriceSummaryComponent, FileOutput } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CartComponent implements OnInit, OnDestroy {
  @ViewChild('addressTabs') addressTabs: any;
  @ViewChild('addressInfo') addressInfo: ElementRef;
  @ViewChild('staticTabs') staticTabs: TabsetComponent;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  @ViewChild('POTemplate') POTemplate: TemplateRef<any>;
  @ViewChild('priceSummary') priceSummary: PriceSummaryComponent;

  /**
   * An Observable containing the current contact record
   */
  primaryContact: Contact;
  /**
   * If shilling and billing addresses are same or not.
   */
  shippingEqualsBilling: boolean = true;
  /**
   * Order Object Model
   */
  order: Order;
  /**
   * Order Response Object Model
   */
  orderConfirmation: Order;
  /**
   * Map to maintain loading state for all payment type buttons
   */
  paymentLoadingStates: Map<string, boolean> = new Map([
    ['PONUMBER', false],
    ['PAYLATER', false],
    ['PLACEORDER', false]
  ]);
  /**
   * Unique Id
   */
  uniqueId: string;
  /**
   * Payment state such as Card, Pay Later and PO Number
   * Optional - only set when a specific payment method is needed
   */
  paymentState?: 'PONUMBER' | 'PAYLATER';
  /**
   * Stores confirmation model
   */
  confirmationModal: BsModalRef;
  /**
   * A hot observable containing the user information
   */
  user$: Observable<User>;
  /**
   * A hot observable containing the account information
   */
  account$: Observable<Account>;
  /**
   * Current selected locale for logged in user
  */
  currentUserLocale: string;
  /**
   * flag to check the payment process
  */
  isPaymentCompleted: boolean = false;
  /**
   * flag to check if the flow started for payment
  */
  isPayForOrderEnabled: boolean = false;
  /**
   * flag to enable make payment button against of payment method
  */
  isMakePaymentRequest: boolean = false;
  /**
   * payment transaction object
  */
  paymentTransaction: PaymentTransaction;
  /**
   * order amount to charge on payment
  */
  orderAmount: string;

  POModalRef: BsModalRef;
  errMessages: any = {
    requiredFirstName: '',
    requiredLastName: '',
    requiredEmail: '',
    requiredPrimaryContact: '',
    requiredOrderName: '',
  };
  cart: Cart;
  isLoggedIn: boolean;
  shipToAccount$: Observable<Account>;
  billToAccount$: Observable<Account>;
  pricingSummaryType: 'checkout' | 'paymentForOrder' | '' = 'checkout';
  breadcrumbs;
  disableSubmit: boolean = false;
  showCaptcha: boolean = false;
  displayCaptcha: boolean;
  supportedFileTypes = '.pdf,.doc,.docx,.jpeg,.jpg,.png';
  poAttachmentFile: File = null;
  isPaymentFeatureEnabled: boolean = false;
  taxAddress: TaxAddress;
  taxCalculationEnabled: boolean = false;
  taxCalculated: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(private cartService: CartService,
    public configurationService: ConfigurationService,
    private orderService: OrderService,
    private modalService: BsModalService,
    public contactService: ContactService,
    private translate: TranslateService,
    private userService: UserService,
    private accountService: AccountService,
    private emailService: EmailService,
    private router: Router,
    private ngZone: NgZone,
    private exceptionService: ExceptionService,
    private attachmentService: AttachmentService,
    private productInformationService: ProductInformationService,
    private integrationService: IntegrationService) {
    this.uniqueId = uniqueId();
  }

  ngOnInit() {
    // Check if payment feature is enabled
    this.subscriptions.push(
      this.integrationService.getPaymentMetadata().pipe(
        catchError((error) => {
          this.exceptionService.showError(error);
          // Return default metadata with payment disabled
          return of({ EnablePaymentIntegration: false });
        })
      ).subscribe((metadata) => {
        this.isPaymentFeatureEnabled = get(metadata, 'EnablePaymentIntegration', false);
      })
    );
    this.subscriptions.push(this.userService.isLoggedIn().subscribe(isLoggedIn => this.isLoggedIn = isLoggedIn));
    this.subscriptions.push(this.userService.getCurrentUserLocale(false).subscribe((currentLocale) => this.currentUserLocale = currentLocale));
    this.primaryContact = new Contact();
    this.order = new Order();
    this.subscriptions.push(combineLatest(this.cartService.getMyCart(), this.accountService.getCurrentAccount()).subscribe(([cart, account]) => {
      this.cart = cart;
      
      // Determine the account to use (prefer cart.Account, fallback to account)
      const accountToUse = get(cart, 'Account') || account;
      
      // Only set default values if they haven't been set yet (preserve user selections)
      if (!this.order.Name) this.order.Name = 'New Order';
      if (!this.order.SoldToAccount?.Id && accountToUse) this.order.SoldToAccount = accountToUse;
      if (!this.order.BillToAccount?.Id && accountToUse) this.order.BillToAccount = accountToUse;
      if (!this.order.ShipToAccount?.Id && accountToUse) this.order.ShipToAccount = accountToUse;
      if (!this.order.PriceList?.Id && get(cart, 'PriceList')) this.order.PriceList = get(cart, 'PriceList');

    }));
    this.user$ = this.userService.me();
    this.subscriptions.push(
      combineLatest([
        this.translate.stream('CHECKOUT_PAGE.INVALID_FIRSTNAME'),
        this.translate.stream('CHECKOUT_PAGE.INVALID_LASTNAME'),
        this.translate.stream('CHECKOUT_PAGE.INVALID_EMAIL'),
        this.translate.stream('CHECKOUT_PAGE.INVALID_PRIMARY_CONTACT'),
        this.translate.stream('CHECKOUT_PAGE.INVALID_ORDER_NAME'),
        this.translate.stream('AOBJECTS.CART'),
      ]).subscribe(
        ([
          invalidFirstName,
          invalidLastName,
          invalidEmail,
          invalidPrimaryContact,
          invalidOrderName,
          cartLabel,
        ]) => {
          this.errMessages.requiredFirstName = invalidFirstName;
          this.errMessages.requiredLastName = invalidLastName;
          this.errMessages.requiredEmail = invalidEmail;
          this.errMessages.requiredPrimaryContact = invalidPrimaryContact;
          this.errMessages.requiredOrderName = invalidOrderName;
          this.breadcrumbs = [
            {
              label: cartLabel,
              route: ['/carts/active'],
            },
          ];
        }
      )
    );

    this.onBillToChange();
    this.onShipToChange();
    this.isButtonDisabled();
  }

  /**
   * Gets the loading state for a specific payment type
   * @param paymentType The payment type to check
   * @returns boolean indicating if the payment type is in loading state
   * @ignore
   */
  getPaymentLoadingState(paymentType?: string): boolean {
    const key = paymentType || 'PLACEORDER';
    return this.paymentLoadingStates.get(key) || false;
  }

  /**
   * Resets all payment loading states to false
   * @ignore
   */
  resetAllPaymentLoadingStates(): void {
    this.paymentLoadingStates.clear();
    this.paymentLoadingStates.set('PONUMBER', false);
    this.paymentLoadingStates.set('PAYLATER', false);
    this.paymentLoadingStates.set('PLACEORDER', false);
  }

  /**
   * Checks if any payment type is currently in loading state
   * @returns boolean indicating if any payment is loading
   * @ignore
   */
  isAnyPaymentLoading(): boolean {
    return Array.from(this.paymentLoadingStates.values()).some(loading => loading);
  }

  // Check if tax calculation is blocking checkout
  isTaxCalculationBlocking(): boolean {
    return this.taxCalculationEnabled && !this.taxCalculated;
  }

  // Check if checkout buttons should be disabled
  isCheckoutDisabled(): boolean {
    return this.disableSubmit || (this.cart?.LineItems?.length < 1) || this.isAnyPaymentLoading() || this.isTaxCalculationBlocking();
  }

  // Handle tax status changes from price summary component
  onTaxStatusChange(status: { calculated: boolean, enabled: boolean, amount: number }): void {
    this.taxCalculated = status.calculated;
    this.taxCalculationEnabled = status.enabled;
  }

  isButtonDisabled() {
    this.disableSubmit = this.isLoggedIn ? (isNil(this.order.PrimaryContact) || isNil(this.order.ShipToAccount)) : (isNil(get(this.primaryContact, 'FirstName')) || isNil(get(this.primaryContact, 'LastName')) || isNil(get(this.primaryContact, 'Email')));
  }

  onPrimaryContactChange($event: Contact) {
    isNil($event) ? set(this.order, 'PrimaryContact', $event) : this.subscriptions.push(
      this.contactService.fetch(get($event, 'Id')).subscribe(c => {
        set(this.order, 'PrimaryContact', c);
        this.order.PrimaryContact.Id = get(c, 'Id');
      })
    );
    this.isButtonDisabled()
  }

  /**
   * Allow to switch address tabs if billing and shipping address are diffrent.
   * @param evt Event that identifies if Shipping and billing addresses are same.
   * @ignore
   */
  selectTab(evt) {
    if (evt)
      this.staticTabs.tabs[0].active = true;
    else {
      setTimeout(() => this.staticTabs.tabs[1].active = true, 50);
    }
    
    // Update tax address when shipping/billing preference changes for guest users
    if (!this.isLoggedIn) {
      this.updateGuestTaxAddress();
    }
  }
  
  // Handle address changes from apt-address component for guest users
  // Tax is always based on shipping address
  onAddressChange(type: 'Billing' | 'Shipping' = 'Billing') {
    if (!this.isLoggedIn) {
      // Only update tax address if the relevant shipping address changed
      // If checkbox is checked (shippingEqualsBilling = true), billing address IS the shipping address
      // If checkbox is NOT checked (shippingEqualsBilling = false), use separate shipping address
      const shouldUpdate = (type === 'Billing' && this.shippingEqualsBilling) ||
        (type === 'Shipping' && !this.shippingEqualsBilling);

      if (shouldUpdate) {
        this.updateGuestTaxAddress();
      }
    }
  }

  updatePrimaryContact(field: string, $event: string) {
    set(this.primaryContact, field, $event.length > 0 ? $event : null)
    this.isButtonDisabled();
    
    // Update taxAddress for guest users when address fields change
    if (!this.isLoggedIn) {
      this.updateGuestTaxAddress();
    }
  }
  
  // Updates tax address from guest user form (primaryContact)
  // Creates a new object reference to trigger change detection in child component
  updateGuestTaxAddress() {
    if (!this.primaryContact) return;
    
    // Normalize Contact to TaxAddress format
    // Always create a new object reference to trigger ngOnChanges in price-summary component
    setTimeout(() => {
      this.ngZone.run(() => {
        if (this.shippingEqualsBilling) {
          // Use billing address (Mailing fields)
          this.taxAddress = {
            Line1: this.primaryContact.MailingStreet || '',
            Line2: '',
            City: this.primaryContact.MailingCity || '',
            Region: this.primaryContact.MailingState || '',
            Country: this.primaryContact.MailingCountry || '',
            PostalCode: this.primaryContact.MailingPostalCode?.toString() || ''
          };
        } else {
          // Use shipping address (Other fields)
          this.taxAddress = {
            Line1: this.primaryContact.OtherStreet || '',
            Line2: '',
            City: this.primaryContact.OtherCity || '',
            Region: this.primaryContact.OtherState || '',
            Country: this.primaryContact.OtherCountry || '',
            PostalCode: this.primaryContact.OtherPostalCode?.toString() || ''
          };
        }
      });
    }, 0);
  }

  /**
   * Allows user to submit order. Convert a cart to order and submit it.
   * @param paymentState - Optional payment state indicating the payment method (PAYLATER, PONUMBER, etc.)
   * @ignore
   */
  submitOrder(paymentState?: 'PONUMBER' | 'PAYLATER' | 'PAYNOW') {
    const orderAmountGroup = find(get(this.cart, 'SummaryGroups'), c => get(c, 'LineType') === 'Grand Total');
    this.orderAmount = defaultTo(get(orderAmountGroup, 'NetPrice', 0).toString(), '0');

    // Set loading state for the specific payment type (only if not already set)
    const key = paymentState || 'PLACEORDER';
    if (!this.paymentLoadingStates.get(key)) {
      this.paymentLoadingStates.set(key, true);
    }

    if (paymentState === 'PAYLATER') {
      this.order.PaymentStatus = 'Pending';
    }

    if (this.isLoggedIn && paymentState !== 'PAYNOW') {
      this.convertCartToOrder(this.order, this.order.PrimaryContact);
    }
    else if (!this.isLoggedIn) {
      // Only populate this.primaryContact for guest users
      if (this.shippingEqualsBilling) {
        this.primaryContact.OtherCity = this.primaryContact.MailingCity;
        this.primaryContact.OtherStreet = this.primaryContact.MailingStreet;
        this.primaryContact.OtherState = this.primaryContact.MailingState;
        this.primaryContact.OtherStateCode =
          this.primaryContact.MailingStateCode;
        this.primaryContact.OtherPostalCode =
          this.primaryContact.MailingPostalCode;
        this.primaryContact.OtherCountryCode =
          this.primaryContact.MailingCountryCode;
        this.primaryContact.OtherCountry = this.primaryContact.MailingCountry;
      }
      this.primaryContact.Name =
        this.primaryContact.FirstName + ' ' + this.primaryContact.LastName;

      // Set the primary contact on the order
      this.order.PrimaryContact = this.primaryContact;
    }
    // For logged-in users with PAYNOW, this.order.PrimaryContact is already set via onPrimaryContactChange

    if (paymentState === 'PAYNOW') {
      // Use order's primary contact if available, otherwise use this.primaryContact
      const contactToPass = this.order.PrimaryContact || this.primaryContact;
      
      this.router
        .navigate(['/checkout/secure-checkout'], {
          state: {
            order: this.order,
            cart: this.cart,
            primaryContact: contactToPass,
            orderAmount: this.orderAmount,
          },
        });
    }
    else if (!this.isLoggedIn) {
      // For guest users without PAYNOW, convert cart to order
      this.convertCartToOrder(this.order, this.primaryContact);
    }
  }

  /**
   * Generates a unique id for different components
   *
   * @param id ids such as 'firstName', 'lastName', 'email', etc
   * @returns uniqueid
   */
  public getId(id: string): string {
    return this.uniqueId + '_' + id;
  }

  onBillToChange() {
    if (get(this.order.BillToAccount, 'Id'))
      this.billToAccount$ = this.accountService.getAccount(
        get(this.order.BillToAccount, 'Id')
      );

    if (this.shippingEqualsBilling && this.billToAccount$ && this.isLoggedIn) {
      this.billToAccount$.pipe(take(1)).subscribe(account => {
        // Use BillingPostalCode, fallback to ShippingPostalCode if billing is not available
        const postalCode = account.BillingPostalCode || account.ShippingPostalCode;

        if (account && postalCode) {
          this.taxAddress = {
            Line1: account.BillingStreet || account.ShippingStreet || '',
            Line2: '',
            City: account.BillingCity || account.ShippingCity || '',
            Region: account.BillingState || account.ShippingState || '',
            Country: account.BillingCountry || account.ShippingCountry || '',
            PostalCode: postalCode.toString()
          };
        } else {
          this.exceptionService.showError(this.translate.instant('TAX.ACCOUNT_MISSING_POSTAL_CODE'));
        }
      })
    }
  }

  onShipToChange() {
    if (get(this.order.ShipToAccount, 'Id'))
      this.shipToAccount$ = this.accountService.getAccount(
        get(this.order.ShipToAccount, 'Id')
      );
    this.isButtonDisabled();

    if (!this.shippingEqualsBilling && this.shipToAccount$ && this.isLoggedIn) {
      this.shipToAccount$.pipe(take(1)).subscribe(account => {
        const postalCode = account.ShippingPostalCode;

        if (account && postalCode) {
          this.taxAddress = {
            Line1: account.ShippingStreet || account.BillingStreet || '',
            Line2: '',
            City: account.ShippingCity || account.BillingCity || '',
            Region: account.ShippingState || account.BillingState || '',
            Country: account.ShippingCountry || account.BillingCountry || '',
            PostalCode: postalCode.toString()
          };
        } else {
          this.exceptionService.showError(this.translate.instant('TAX.ACCOUNT_MISSING_POSTAL_CODE'));
        }
      })
    }
  }

  convertCartToOrder(order: Order, primaryContact: Contact, cart?: Cart, selectedAccount?: AccountInfo, acceptOrder?: boolean) {
    this.orderService.convertCartToOrder(order, primaryContact).pipe(
      take(1)
    ).subscribe(orderResponse => {
      this.orderConfirmation = orderResponse;
      this.orderConfirmation.PrimaryContact = primaryContact;

      // Check if this is a PO order with attachment
      if (order.PONumber && this.poAttachmentFile) {
        // Upload PO attachment after order creation
        this.attachmentService.uploadAttachment(
          this.poAttachmentFile,
          false,
          orderResponse.Id,
          'Order'
        ).pipe(take(1)).subscribe(
          res => {
            this.poAttachmentFile = null;
            this.completeOrderProcess();
          },
          err => {
            this.exceptionService.showError(err);
            this.poAttachmentFile = null;
            this.completeOrderProcess();
          }
        );
      } else {
        this.completeOrderProcess();
      }
    },
      err => {
        this.exceptionService.showError(err);
        this.completeOrderProcess();
        this.poAttachmentFile = null;
      });
  }

  /**
   * Complete the order process by resetting loading states and showing confirmation
   * @ignore
   */
  private completeOrderProcess() {
    // Reset all loading states
    this.resetAllPaymentLoadingStates();

    // Show order confirmation
    this.onOrderConfirmed();
  }

  /**
   * Redirect to Order detail page
   */
  redirectOrderPage() {
    this.ngZone.run(() => {
      this.router.navigate(['/orders', this.orderConfirmation.Id]);
    });
  }

  onOrderConfirmed() {
    const ngbModalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-lg',
    };
    this.confirmationModal = this.modalService.show(
      this.confirmationTemplate,
      ngbModalOptions
    );
    if (get(this.orderConfirmation, 'Id')) {
      this.order.PrimaryContact = this.orderConfirmation.PrimaryContact;
      this.emailService.getEmailTemplateByName('DC Order Notification Template').pipe(
        take(1),
        switchMap((templateInfo: EmailTemplate) => templateInfo ? this.emailService.sendEmailNotificationWithTemplate(get(templateInfo, 'Id'), this.orderConfirmation, get(this.orderConfirmation.PrimaryContact, 'Id')) : of(null))
      ).subscribe();
    }
  }

  closeModal() {
    this.confirmationModal.hide();
    this.redirectOrderPage();
  }

  loadCaptcha() {
    this.displayCaptcha = true;
  }

  captchaSuccess(cart: Cart) {
    this.showCaptcha = false;
    // Set loading state when captcha is successful and proceeding with order
    const key = this.paymentState || 'PLACEORDER';
    this.paymentLoadingStates.set(key, true);
    this.submitOrder(this.paymentState);
  }

  orderPlacement(paymentState?: 'PONUMBER' | 'PAYLATER') {
    this.paymentState = paymentState ?? null;

    // Set loading state for the specific payment type
    const key = paymentState || 'PLACEORDER';
    this.paymentLoadingStates.set(key, true);

    if (this.displayCaptcha) {
      this.showCaptcha = true;
    } else {
      this.submitOrder(paymentState);
    }
  }

  openPOModal() {
    const ngbModalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-md',
    };
    this.POModalRef = this.modalService.show(this.POTemplate, ngbModalOptions);
  }

  uploadPOAttachment(fileInput: FileOutput) {
    const fileList = fileInput.files;
    this.poAttachmentFile =
      fileList && fileList.length > 0 ? fileList[0] : null;
  }

  savePONumber() {
    this.paymentLoadingStates.set('PONUMBER', true);

    if (this.POModalRef) {
      this.POModalRef.hide();
      this.POModalRef = null;
    }

    this.order.PaymentStatus = 'Processed';
    this.submitOrder('PONUMBER');
  }

  closePOModal() {
    if (this.POModalRef) {
      this.POModalRef.hide();
      this.POModalRef = null;
      this.order.PONumber = null;
      this.paymentLoadingStates.set('PONUMBER', false);
      this.poAttachmentFile = null;
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
