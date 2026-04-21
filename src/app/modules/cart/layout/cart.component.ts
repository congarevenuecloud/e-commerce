import { Component, OnInit, ViewChild, ElementRef, TemplateRef, OnDestroy, NgZone, ViewEncapsulation, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { Router } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { switchMap, take, catchError, map, shareReplay } from 'rxjs/operators';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { get, uniqueId, find, defaultTo, isNil, set, isEmpty } from 'lodash';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService } from '@congarevenuecloud/core';
import { User, Account, Cart, CartService, Order, OrderService, Contact, ContactService, UserService, AccountService, EmailService, PaymentTransaction, AccountInfo, EmailTemplate, AttachmentService, IntegrationService, TaxAddress, LocalCurrencyPipe } from '@congarevenuecloud/ecommerce';
import { ExceptionService, FileOutput, PaymentIntegrationComponent, PaymentResult, WizardStep } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartComponent implements OnInit, OnDestroy {
  @ViewChild('addressTabs') addressTabs: any;
  @ViewChild('addressInfo') addressInfo: ElementRef;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  @ViewChild('POTemplate') POTemplate: TemplateRef<any>;
  @ViewChild('navigationConfirmTemplate') navigationConfirmTemplate: TemplateRef<any>;
  @ViewChild('paymentElement') paymentElement: PaymentIntegrationComponent;

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
   * Stored cart items and summary to display on confirmation page
   */
  confirmedCartItems: any[] = [];
  confirmedCartSummary: any[] = [];
  confirmedCart: Cart = null; // Store cart reference for apt-price-summary component
  confirmationPaginationMinVal: number = 0;
  confirmationPaginationMaxVal: number = 0;
  confirmationPaginationTotalVal: number = 0;
  
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
  navigationConfirmModalRef: BsModalRef;
  pendingNavigationIndex: number = null;
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
  isWizardReady: boolean = false;
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
  paymentAmount: number = 0;
  currency: string = 'USD';
  formattedAmount$: Observable<string> = of('$0.00');
  creatingOrder: boolean = false;
  paymentSucceeded: boolean = false;
  enableTaxCalculations: boolean = false;
  isOrderConversionStarted: boolean = false;
  confirmedProductItems: any[] = [];
  paginatedConfirmedItems: any[] = [];

  // Pagination for confirmation step (step 4)
  confirmationCurrentPage: number = 1;
  confirmationItemsPerPage: number = 5;
  confirmationItemsPerPageOptions: number[] = [5, 10, 15];
  Math = Math;

  paginationButtonLabels: any = {
    first: '',
    previous: '',
    next: '',
    last: ''
  };

  // Wizard configuration
  wizardSteps: WizardStep[] = [
    {
      id: 'contact',
      label: 'CART.CHECKOUT',
      completed: false
    },
    {
      id: 'review',
      label: 'WIZARD_CHECKOUT.REVIEW_ORDER',
      completed: false
    },
    {
      id: 'payment',
      label: 'WIZARD_CHECKOUT.PAYMENT',
      completed: false
    },
    {
      id: 'confirmation',
      label: 'WIZARD_CHECKOUT.CONFIRMATION',
      completed: false,
      clickable: false
    }
  ];

  wizardConfig = {
    showStepNumbers: true,
    showNavigation: false
  };

  /**
   * Handle step navigation requests from wizard
   * Returns false to prevent immediate navigation and show modal
   */
  handleStepNavigationRequest = (fromIndex: number, toIndex: number): boolean => {
    const fromStepId = this.wizardSteps[fromIndex]?.id;
    const toStepId = this.wizardSteps[toIndex]?.id;
    
    // If navigating from payment to review, show confirmation modal
    if (fromStepId === 'payment' && toStepId === 'review') {
      this.pendingNavigationIndex = toIndex;
      this.showNavigationConfirmModal();
      return false; // Prevent immediate navigation
    }
    
    return true; // Allow navigation
  };

  // Current wizard step index
  currentStepIndex: number = 0;

  // Flag to control browser reload warning on payment step
  canNavigateAway: boolean = true;

  private subscriptions: Subscription[] = [];
  private beforeUnloadHandler: (event: BeforeUnloadEvent) => void;

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
    private cdr: ChangeDetectorRef,
    private exceptionService: ExceptionService,
    private attachmentService: AttachmentService,
    private integrationService: IntegrationService,
    private localCurrencyPipe: LocalCurrencyPipe) {
    this.uniqueId = uniqueId();
  }

  ngOnInit() {
    // Load pagination button labels
    this.subscriptions.push(
      combineLatest([
        this.translate.stream('PAGINATION.FIRST'),
        this.translate.stream('PAGINATION.PREVIOUS'),
        this.translate.stream('PAGINATION.NEXT'),
        this.translate.stream('PAGINATION.LAST')
      ]).subscribe(([first, previous, next, last]) => {
        this.paginationButtonLabels.first = first;
        this.paginationButtonLabels.previous = previous;
        this.paginationButtonLabels.next = next;
        this.paginationButtonLabels.last = last;
        this.cdr.markForCheck();
      })
    );

    // Setup beforeunload handler to prevent navigation away from payment step
    this.beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      const currentStep = this.wizardSteps[this.currentStepIndex];
      if (!this.canNavigateAway && currentStep?.id === 'payment' && this.isPaymentFeatureEnabled) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
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

        // Remove payment step if payment feature is not enabled
        if (!this.isPaymentFeatureEnabled) {
          this.wizardSteps = this.wizardSteps.filter(step => step.id !== 'payment');
        }
        
        // Mark component as ready after payment metadata is loaded
        this.isWizardReady = true;
        // Set initial step clickability
        this.updateStepClickability(0); // Start at step 0 (contact info)
        this.cdr.detectChanges(); // Trigger view update to show wizard
      })
    );

    // Check if tax calculation is enabled via integration metadata
    this.subscriptions.push(
      this.integrationService.getTaxMetadata().pipe(
        catchError((error) => {
          // Return default metadata with tax disabled if API fails
          return of({ EnableTaxIntegration: false });
        })
      ).subscribe((metadata) => {
        this.enableTaxCalculations = get(metadata, 'EnableTaxIntegration', false);
      })
    );
    this.subscriptions.push(this.userService.isLoggedIn().subscribe(isLoggedIn => this.isLoggedIn = isLoggedIn));
    this.subscriptions.push(this.userService.getCurrentUserLocale(false).subscribe((currentLocale) => this.currentUserLocale = currentLocale));

    // Initialize entities with empty objects
    this.primaryContact = new Contact();
    this.order = new Order();
    this.subscriptions.push(combineLatest(this.cartService.getMyCart(), this.accountService.getCurrentAccount()).subscribe(([cart, account]) => {
      // Skip cart updates after order conversion has started to avoid fetching a new empty cart
      if (this.isOrderConversionStarted) {
        return;
      }
      this.cart = cart;
      this.cdr.detectChanges(); // Immediately render the checkout view on initial load

      // Navigate to manage cart if cart is empty
      if (isEmpty(get(cart, 'LineItems'))) {
        this.ngZone.run(() => {
          this.router.navigate(['/carts/active']);
        });
        return;
      }

      // Calculate payment amount for payment integration
      this.calculateFormattedAmount();

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

  // Check if checkout buttons should be disabled
  isCheckoutDisabled(): boolean {
    return this.disableSubmit || (this.cart?.LineItems?.length < 1) || this.isAnyPaymentLoading();
  }

  // Handle tax status changes from price summary component
  onTaxStatusChange(status: { calculated: boolean, enabled: boolean, amount: number }): void {
    this.taxCalculated = status.calculated;
    this.taxCalculationEnabled = status.enabled;
  }

  // Handle preview order button click - navigate to review step
  onPreviewOrder(): void {
    // Navigate to review step
    this.currentStepIndex++;

    // Update step clickability after moving to step 2
    const reviewIndex = this.wizardSteps.findIndex(step => step.id === 'review');
    if (reviewIndex >= 0) {
      this.updateStepClickability(reviewIndex);
    }
  }

  // Navigate to payment step and update clickability
  goToPaymentStep(): void {
    this.currentStepIndex++;

    // Disable navigation warning when entering payment step
    this.canNavigateAway = false;

    // Update step clickability after moving to step 3 (payment)
    const paymentIndex = this.wizardSteps.findIndex(step => step.id === 'payment');
    if (paymentIndex >= 0) {
      this.updateStepClickability(paymentIndex);
    }
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
   * Handle change in shipping equals billing checkbox.
   * @param evt Event that identifies if Shipping and billing addresses are same.
   * @ignore
   */
  selectTab(evt) {
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
      ).pipe(shareReplay(1));

    // Sync shipping account with billing account when they should be the same
    if (this.shippingEqualsBilling && this.isLoggedIn && this.order.BillToAccount) {
      this.order.ShipToAccount = this.order.BillToAccount;
      this.shipToAccount$ = this.billToAccount$;
    }

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
      ).pipe(shareReplay(1));
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
    if (this.isOrderConversionStarted) {
      return;
    }
    // Store cart reference and data before converting to order
    if (this.cart) {
      this.confirmedCart = this.cart; // Store cart reference for apt-price-summary
      this.confirmedCartItems = [...(this.cart.LineItems || [])];
      this.confirmedCartSummary = [...(this.cart.SummaryGroups || [])];
      this.updateConfirmedProductItems();
    }

    this.isOrderConversionStarted = true;
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

    // Allow navigation away after successful order creation
    this.canNavigateAway = true;

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
    // Mark payment step as completed only if actual payment was processed (not PO Number or Pay Later)
    if (this.isPaymentFeatureEnabled && this.paymentState !== 'PONUMBER' && this.paymentState !== 'PAYLATER') {
    } else if (!this.isPaymentFeatureEnabled) {
      // Mark review step as completed when payment is disabled
      const reviewStep = this.wizardSteps.find(step => step.id === 'review');
      if (reviewStep) {
        reviewStep.completed = true;
      }
    }

    // Mark confirmation step as completed
    const confirmationStep = this.wizardSteps.find(step => step.id === 'confirmation');
    if (confirmationStep) {
      confirmationStep.completed = true;
    }

    // Make all steps non-clickable on confirmation
    const confirmationIndex = this.wizardSteps.findIndex(step => step.id === 'confirmation');
    this.updateStepClickability(confirmationIndex);

    // Navigate to confirmation step instead of showing modal
    if (this.paymentState === 'PONUMBER') {
      this.currentStepIndex += 2;
      this.cdr.detectChanges();
    } else if (this.paymentState === 'PAYLATER') {
      // For Pay Later - payment step already removed, only 1 increment needed
      this.currentStepIndex++;
      this.cdr.detectChanges();
    } else if (!this.isPaymentFeatureEnabled) {
      // When payment is disabled, payment step not in array
      this.ngZone.run(() => {
        this.currentStepIndex++;
        this.cdr.detectChanges();
      });
    } else {
      this.currentStepIndex++;
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    }

    // Update step clickability - confirmation step cannot go back
    if (confirmationIndex >= 0) {
      this.updateStepClickability(confirmationIndex);
    }

    // Send email notification
    this.sendOrderConfirmationEmail();
  }

  closeModal() {
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

    // Remove payment step from wizard when Pay Later is selected
    if (paymentState === 'PAYLATER') {
      this.wizardSteps = this.wizardSteps.filter(step => step.id !== 'payment');
    }

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
    this.paymentState = 'PONUMBER';
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



  /**
   * Handle wizard step changes to track current step
   */
  onWizardStepChange(event: any): void {
    const currentStepId = this.wizardSteps[event.currentIndex]?.id;
    const previousStepId = this.wizardSteps[event.previousIndex]?.id;
    const stepDifference = event.currentIndex - event.previousIndex;

    // Prevent navigation away from confirmation step
    if (previousStepId === 'confirmation' && currentStepId !== 'confirmation') {
      this.currentStepIndex = event.previousIndex;
      this.cdr.detectChanges();
      return;
    }

    // Only allow going back one step at a time
    if (stepDifference < -1) {
      this.currentStepIndex = event.previousIndex;
      this.cdr.detectChanges();
      return;
    }

    // Valid navigation - update currentStepIndex
    this.currentStepIndex = event.currentIndex;

    // Control navigation warning based on current step
    if (currentStepId === 'payment') {
      this.canNavigateAway = false;
    } else {
      this.canNavigateAway = true;
    }

    // Update which steps are clickable based on new position
    this.updateStepClickability(event.currentIndex);
  }

  /**
   * Send order confirmation email notification
   */
  private sendOrderConfirmationEmail(): void {
    if (!get(this.orderConfirmation, 'Id')) return;

    // Get email address from primary contact or order
    const emailAddress = get(this.primaryContact, 'Email') || get(this.order, 'PrimaryContact.Email') || get(this.orderConfirmation, 'PrimaryContact.Email');

    if (!emailAddress) return;

    // Get contact info for display name
    const contactName = get(this.primaryContact, 'Name') || 
                       get(this.order, 'PrimaryContact.Name') || 
                       get(this.orderConfirmation, 'PrimaryContact.Name') ||
                       `${get(this.primaryContact, 'FirstName', '')} ${get(this.primaryContact, 'LastName', '')}`.trim();

    this.emailService.getEmailTemplateByName('DC Order Notification Template').pipe(
      take(1),
      switchMap((templateInfo: EmailTemplate) => {
        if (!templateInfo) return of(null);
        
        // Build email payload
        const emailPayload: any = {
          EmailTemplateId: get(templateInfo, 'Id'),
          EmailRequestWrappers: [
            {
              EmailTemplateParameters: {
                RecipientType: 'User',
                ObjectName: 'Order',
                RecordId: this.orderConfirmation.Id,
                TemplateData: {}
              },
              EmailParameters: {
                To: [
                  {
                    Address: emailAddress,
                    DisplayName: contactName || emailAddress
                  }
                ]
              }
            }
          ]
        };

        return this.emailService.sendEmailByTemplate(emailPayload);
      }),
      catchError(() => of(null))
    ).subscribe();
  }

  /**
   * Show confirmation modal when navigating back from payment step
   * @ignore
   */
  showNavigationConfirmModal() {
    const ngbModalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-dialog-centered modal-md',
    };
    this.navigationConfirmModalRef = this.modalService.show(this.navigationConfirmTemplate, ngbModalOptions);
  }

  /**
   * Confirm navigation back from payment step
   * @ignore
   */
  confirmNavigationBack() {
    if (this.navigationConfirmModalRef) {
      this.navigationConfirmModalRef.hide();
      this.navigationConfirmModalRef = null;
    }

    // Proceed with navigation to the pending index
    if (this.pendingNavigationIndex !== null) {
      const targetIndex = this.pendingNavigationIndex;
      this.pendingNavigationIndex = null;

      // Navigate to target step
      this.currentStepIndex = targetIndex;
      this.canNavigateAway = true;

      // Update which steps are clickable based on new position
      this.updateStepClickability(targetIndex);
    }
  }

  /**
   * Cancel navigation back from payment step
   * @ignore
   */
  cancelNavigationBack() {
    if (this.navigationConfirmModalRef) {
      this.navigationConfirmModalRef.hide();
      this.navigationConfirmModalRef = null;
    }
    
    // Reset pending navigation
    this.pendingNavigationIndex = null;
  }

  // Update which steps are clickable: only the immediate previous step
  private updateStepClickability(currentIndex: number): void {
    const currentStep = this.wizardSteps[currentIndex];
    this.wizardSteps.forEach((step, index) => {
      if (currentStep?.id === 'confirmation') {
        // On confirmation step, no steps are clickable
        step.clickable = false;
      } else if (step.id === 'confirmation') {
        // Confirmation step is never clickable
        step.clickable = false;
      } else if (index === currentIndex - 1) {
        // Only the immediate previous step is clickable
        step.clickable = true;
      } else {
        // All other steps are not clickable
        step.clickable = false;
      }
    });
  }

  // Filter confirmed cart items to primary product line items only
  private updateConfirmedProductItems(): void {
    if (!this.confirmedCartItems || this.confirmedCartItems.length === 0) {
      this.confirmedProductItems = [];
      this.confirmationPaginationMinVal = 0;
      this.confirmationPaginationMaxVal = 0;
      this.confirmationPaginationTotalVal = 0;
      return;
    }
    this.confirmedProductItems = this.confirmedCartItems.filter(item =>
      get(item, 'LineType') === 'Product/Service' &&
      !get(item, 'ParentBundleNumber') &&
      !get(item, 'IsOptionRollupLine') &&
      get(item, 'IsPrimaryLine') === true
    );
    this.updateConfirmationPaginationDisplay();
    this.cdr.markForCheck();
  }

  private updateConfirmationPaginationDisplay(): void {
    this.confirmationPaginationTotalVal = this.confirmedProductItems.length;
    if (this.confirmationPaginationTotalVal === 0) {
      this.confirmationPaginationMinVal = 0;
      this.confirmationPaginationMaxVal = 0;
      this.paginatedConfirmedItems = [];
      return;
    }
    const startIndex = (this.confirmationCurrentPage - 1) * Number(this.confirmationItemsPerPage);
    const endIndex = startIndex + Number(this.confirmationItemsPerPage);
    this.confirmationPaginationMinVal = startIndex + 1;
    this.confirmationPaginationMaxVal = Math.min(endIndex, this.confirmationPaginationTotalVal);
    this.paginatedConfirmedItems = this.confirmedProductItems.slice(startIndex, endIndex);
    this.cdr.markForCheck();
  }

  // Pagination methods for confirmation step
  onConfirmationItemsPerPageChange(newSize: number): void {
    this.confirmationItemsPerPage = Number(newSize);
    this.confirmationCurrentPage = 1; // Reset to first page
    this.updateConfirmationPaginationDisplay();
  }

  onConfirmationPageChange(event: any): void {
    this.confirmationCurrentPage = event.page;
    this.updateConfirmationPaginationDisplay();
  }

  // Calculate and cache the formatted amount
  private calculateFormattedAmount(): void {
    let amount = 0;

    // Get GrandTotal from cart
    if (this.cart) {
      amount = get(this.cart, 'GrandTotal', 0);
    }

    // Try to get from SummaryGroups if GrandTotal not available
    if (!amount && this.cart) {
      const summaryGroups = get(this.cart, 'SummaryGroups', []);
      const grandTotalGroup = summaryGroups?.find(
        (group: any) => group.LineType === 'Grand Total'
      );
      if (grandTotalGroup) {
        amount = get(grandTotalGroup, 'NetPrice', 0);
      }
    }

    this.paymentAmount = amount;
    this.formattedAmount$ = amount ? this.localCurrencyPipe.transform(amount) : of('$0.00');
  }

  // Get formatted amount for display (cached)
  getFormattedAmount(): Observable<string> {
    return this.formattedAmount$;
  }

  // Handle payment success - create/update order
  handlePaymentSuccess(result: PaymentResult): void {
    if (!result.success || this.creatingOrder) {
      return;
    }

    this.paymentSucceeded = true;
    this.createOrUpdateOrder();
  }

  // Create or update order after payment success
  private createOrUpdateOrder(): void {
    this.creatingOrder = true;

    // Convert cart to order - similar to orderPlacement flow but without navigation
    if (!this.isLoggedIn) {
      // For guest users, ensure primary contact is set
      if (this.primaryContact) {
        this.primaryContact.Name =
          this.primaryContact.FirstName + ' ' + this.primaryContact.LastName;
        this.order.PrimaryContact = this.primaryContact;
      }
    }

    // Set payment status to Processed since payment was successful
    this.order.PaymentStatus = 'Processed';

    // Convert cart to order
    this.convertCartToOrder(this.order, this.primaryContact);
  }


  // Handle confirm cancel navigation - go back to manage cart
  handleConfirmCancel(): void {
    // Reset payment element state
    if (this.paymentElement) {
      this.creatingOrder = false;
    }

    // Navigate to manage cart page
    this.router.navigate(['/carts/active']);
  }

  ngOnDestroy() {
    // Remove beforeunload event listener
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
