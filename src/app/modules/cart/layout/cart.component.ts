import { Component, OnInit, ViewChild, ElementRef, TemplateRef, OnDestroy, NgZone, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { TabsetComponent } from 'ngx-bootstrap/tabs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { get, uniqueId, find, defaultTo, isNil, set } from 'lodash';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService } from '@congarevenuecloud/core';
import { User, Account, Cart, CartService, Order, OrderService, Contact, ContactService, UserService, AccountService, EmailService, PaymentTransaction, AccountInfo, EmailTemplate, AttachmentService, ProductInformationService } from '@congarevenuecloud/ecommerce';
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
    requiredOrderName: ''
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
    private productInformationService: ProductInformationService) {
    this.uniqueId = uniqueId();
  }

  ngOnInit() {
    this.subscriptions.push(this.userService.isLoggedIn().subscribe(isLoggedIn => this.isLoggedIn = isLoggedIn));
    this.subscriptions.push(this.userService.getCurrentUserLocale(false).subscribe((currentLocale) => this.currentUserLocale = currentLocale));
    this.primaryContact = new Contact();
    this.order = new Order();
    this.subscriptions.push(combineLatest(this.cartService.getMyCart(), this.accountService.getCurrentAccount()).subscribe(([cart, account]) => {
      this.cart = cart;
      // Setting default values
      this.order.Name = 'New Order'
      this.order.SoldToAccount = isNil(get(cart, 'Account')) ? account : get(cart, 'Account');
      this.order.BillToAccount = isNil(get(cart, 'Account')) ? account : get(cart, 'Account');
      this.order.ShipToAccount = isNil(get(cart, 'Account')) ? account : get(cart, 'Account');
      this.order.PriceList = get(cart, 'PriceList');

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

  isButtonDisabled() {
    this.disableSubmit = this.isLoggedIn ? (isNil(this.order.PrimaryContact) || isNil(this.order.ShipToAccount)) : isNil(get(this.primaryContact, 'FirstName')) || isNil(get(this.primaryContact, 'LastName')) || isNil(get(this.primaryContact, 'Email')) || isNil(get(this.order, 'Name'));
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
  }

  updatePrimaryContact(field: string, $event: string) {
    set(this.primaryContact, field, $event.length > 0 ? $event : null)
    this.isButtonDisabled();
  }

  /**
   * Allows user to submit order. Convert a cart to order and submit it.
   * @param paymentState - Optional payment state indicating the payment method (PAYLATER, PONUMBER, etc.)
   * @ignore
   */
  submitOrder(paymentState?: 'PONUMBER' | 'PAYLATER') {
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

    if (this.isLoggedIn) {
      this.convertCartToOrder(this.order, this.order.PrimaryContact);
    }
    else {
      if (this.shippingEqualsBilling) {
        this.primaryContact.OtherCity = this.primaryContact.MailingCity;
        this.primaryContact.OtherStreet = this.primaryContact.MailingStreet;
        this.primaryContact.OtherState = this.primaryContact.MailingState;
        this.primaryContact.OtherStateCode = this.primaryContact.MailingStateCode;
        this.primaryContact.OtherPostalCode = this.primaryContact.MailingPostalCode;
        this.primaryContact.OtherCountryCode = this.primaryContact.MailingCountryCode;
        this.primaryContact.OtherCountry = this.primaryContact.MailingCountry;
      }
      this.primaryContact.Name = this.primaryContact.FirstName + ' ' + this.primaryContact.LastName;
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
      this.billToAccount$ = this.accountService.getAccount(get(this.order.BillToAccount, 'Id'));
  }

  onShipToChange() {
    if (get(this.order.ShipToAccount, 'Id'))
      this.shipToAccount$ = this.accountService.getAccount(get(this.order.ShipToAccount, 'Id'));
    this.isButtonDisabled();
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
      class: 'modal-lg'
    };
    this.confirmationModal = this.modalService.show(this.confirmationTemplate, ngbModalOptions);
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
    }
    else {
      this.submitOrder(paymentState);
    }
  }

  openPOModal() {
    const ngbModalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-md'
    };
    this.POModalRef = this.modalService.show(this.POTemplate, ngbModalOptions);
  }

  uploadPOAttachment(fileInput: FileOutput) {
    const fileList = fileInput.files;
    this.poAttachmentFile = fileList && fileList.length > 0 ? fileList[0] : null;
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
