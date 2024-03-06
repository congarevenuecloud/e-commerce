import { Component, OnInit, ViewChild, ElementRef, TemplateRef, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { TabsetComponent } from 'ngx-bootstrap/tabs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { get, uniqueId, find, defaultTo, isNil, set } from 'lodash';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService } from '@congarevenuecloud/core';
import { User, Account, Cart, CartService, Order, OrderService, Contact, ContactService, UserService, AccountService, EmailService, PaymentTransaction, AccountInfo, EmailTemplate } from '@congarevenuecloud/ecommerce';
import { ExceptionService, PriceSummaryComponent } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {
  @ViewChild('addressTabs') addressTabs: any;
  @ViewChild('addressInfo') addressInfo: ElementRef;
  @ViewChild('staticTabs') staticTabs: TabsetComponent;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
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
   * Loading flag for spinner
   */
  loading: boolean = false;
  /**
   * Unique Id
   */
  uniqueId: string;
  /**
   * Payment state such as Card and Invoice
   * Default is blank
   */
  paymentState: 'PONUMBER' | 'INVOICE' | 'PAYNOW' | '' = '';
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
    private exceptionService: ExceptionService) {
    this.uniqueId = uniqueId();
  }

  ngOnInit() {
    this.subscriptions.push(this.userService.isLoggedIn().subscribe(isLoggedIn => this.isLoggedIn = isLoggedIn));
    this.subscriptions.push(this.userService.getCurrentUserLocale(false).subscribe((currentLocale) => this.currentUserLocale = currentLocale));
    this.primaryContact = new Contact();
    this.order = new Order();
    this.subscriptions.push(this.cartService.getMyCart().subscribe(cart => {
      this.cart = cart;
      // Setting default values
      this.order.Name = 'New Order'
      this.order.SoldToAccount = get(cart, 'Account');
      this.order.BillToAccount = get(cart, 'Account');
      this.order.ShipToAccount = get(cart, 'Account');
      this.order.PriceList = get(cart, 'PriceList');

    }));
    this.user$ = this.userService.me();
    this.subscriptions.push(this.translate.stream(['CHECKOUT_PAGE', 'AOBJECTS']).subscribe((val: string) => {
      this.errMessages.requiredFirstName = val['CHECKOUT_PAGE']['INVALID_FIRSTNAME'];
      this.errMessages.requiredLastName = val['CHECKOUT_PAGE']['INVALID_LASTNAME'];
      this.errMessages.requiredEmail = val['CHECKOUT_PAGE']['INVALID_EMAIL'];
      this.errMessages.requiredPrimaryContact = val['CHECKOUT_PAGE']['INVALID_PRIMARY_CONTACT'];
      this.errMessages.requiredOrderName = val['CHECKOUT_PAGE']['INVALID_ORDER_NAME'];
      this.breadcrumbs = [
        {
          label: val['AOBJECTS']['CART'],
          route: [`/carts/active`]
        }
      ];
    }));

    this.onBillToChange();
    this.onShipToChange();
    this.isButtonDisabled();
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
   *
   * @param evt Event that identifies if Shipping and billing addresses are same.
   *
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
   */
  submitOrder() {
    const orderAmountGroup = find(get(this.cart, 'SummaryGroups'), c => get(c, 'LineType') === 'Grand Total');
    this.orderAmount = defaultTo(get(orderAmountGroup, 'NetPrice', 0).toString(), '0');
    this.loading = true;
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
    this.loading = true;
    this.orderService.convertCartToOrder(order, primaryContact).pipe(
      take(1)
    ).subscribe(orderResponse => {
      this.loading = false;
      this.orderConfirmation = orderResponse;
      this.orderConfirmation.PrimaryContact = primaryContact;
      this.onOrderConfirmed();
    },
      err => {
        this.exceptionService.showError(err);
        this.loading = false;
      });
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
    this.submitOrder();
  }

  orderPlacement() {
    if (this.displayCaptcha)
      this.showCaptcha = true;
    else {
      this.submitOrder();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
