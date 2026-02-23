import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  HostListener,
  TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, take, Observable, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { BsModalService, BsModalRef, ModalOptions } from 'ngx-bootstrap/modal';
import { plainToClass } from 'class-transformer';
import { get } from 'lodash';
import {
  Cart,
  CartService,
  Order,
  Contact,
  UserService,
  OrderService,
  AccountService,
  LocalCurrencyPipe
} from '@congarevenuecloud/ecommerce';
import { PaymentIntegrationComponent, PaymentResult, ExceptionService } from '@congarevenuecloud/elements';

// Secure Checkout Component with Stripe Payment Integration for Ecommerce
@Component({
  selector: 'app-secure-checkout',
  templateUrl: './secure-checkout.component.html',
  styleUrls: ['./secure-checkout.component.scss'],
})
export class SecureCheckoutComponent implements OnInit, OnDestroy {
  @ViewChild('paymentElement') paymentElement: PaymentIntegrationComponent;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;

  cart: Cart;
  order: Order;
  primaryContact: Contact;
  paymentAmount: number = 0;
  currency: string = 'USD';
  formattedAmount$: Observable<string> = of('$0.00');
  canNavigateAway: boolean = false;
  isExistingOrderPayment: boolean = false;
  isLoggedIn: boolean = false;
  creatingOrder: boolean = false;

  // Order confirmation modal
  orderConfirmation: Order = null;
  confirmationModal: BsModalRef;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    private translate: TranslateService,
    private userService: UserService,
    private exceptionService: ExceptionService,
    private accountService: AccountService,
    private modalService: BsModalService,
    private localCurrencyPipe: LocalCurrencyPipe
  ) {}

  // Prevent navigation away from page without confirmation
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (!this.canNavigateAway) {
      $event.returnValue = true;
    }
  }

  // Intercept browser back button
  @HostListener('window:popstate', ['$event'])
  onPopState(event: any): void {
    if (!this.canNavigateAway) {
      // Push state again to prevent navigation
      history.pushState(null, '', location.href);
      if (this.paymentElement) {
        this.paymentElement.showCancelConfirmation();
      }
    }
  }

  ngOnInit() {
    // Check if user is logged in
    this.subscriptions.push(
      this.userService.isLoggedIn().subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
      })
    );

    // Get data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = get(navigation, 'extras.state') || get(window, 'history.state');
    const savedState = { ...state };
    
    // Prevent back button from navigating away
    history.pushState(savedState, '', location.href);

    // Get order data
    if (get(savedState, 'order')) {
      this.order = get(savedState, 'order');
      
      // Check if this is an existing order payment (coming from order details page)
      if (get(this.order, 'Id')) {
        this.isExistingOrderPayment = true;
      }

      // Fetch full ShipToAccount with address details only if address fields are missing
      // If ShipToAccount already has address fields, no need to fetch (it was passed from cart)
      if (get(this.order, 'ShipToAccount.Id') && !get(this.order, 'ShipToAccount.ShippingStreet')) {
        this.subscriptions.push(
          this.accountService.getAccount(get(this.order, 'ShipToAccount.Id')).subscribe((account) => {
            this.order.ShipToAccount = account;
          })
        );
      }
    }

    // Get primary contact
    if (get(savedState, 'primaryContact')) {
      // Convert plain object to Contact instance to ensure class methods are available
      this.primaryContact = plainToClass(Contact, get(savedState, 'primaryContact'));
      if (this.order && !get(this.order, 'PrimaryContact')) {
        this.order.PrimaryContact = this.primaryContact;
      }
    }

    // Get cart data
    if (get(savedState, 'cart')) {
      this.cart = get(savedState, 'cart');
      
      // Calculate payment amount immediately when cart is from state
      if (get(savedState, 'orderAmount')) {
        this.paymentAmount = parseFloat(get(savedState, 'orderAmount'));
      } else {
        this.paymentAmount = get(this.cart, 'GrandTotal', 0);
      }
      this.currency = get(this.cart, 'Currency', 'USD');
      this.calculateFormattedAmount();
    } else {
      // Fallback to cart service - calculate amount after cart loads
      this.subscriptions.push(
        this.cartService
        .getMyCart()
        .pipe(take(1))
        .subscribe((cart) => {
          this.cart = cart;
          
          // Calculate payment amount after cart is loaded
          if (get(savedState, 'orderAmount')) {
            this.paymentAmount = parseFloat(get(savedState, 'orderAmount'));
          } else {
            this.paymentAmount = get(this.cart, 'GrandTotal', 0);
          }
          this.currency = get(this.cart, 'Currency', 'USD');
          this.calculateFormattedAmount();
        })
      );
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // Calculate and cache the formatted amount
  private calculateFormattedAmount(): void {
    let amount = 0;

    // First, try to get from router state
    const state = get(window, 'history.state');
    if (get(state, 'orderAmount')) {
      amount = parseFloat(get(state, 'orderAmount'));
    }

    // Then try GrandTotal from cart
    if (!amount && this.cart) {
      amount = get(this.cart, 'GrandTotal', 0);
    }

    // Try to get from SummaryGroups
    if (!amount && this.cart) {
      const summaryGroups = get(this.cart, 'SummaryGroups', []);
      const grandTotalGroup = summaryGroups.find(
        (group: any) => group.LineType === 'Grand Total'
      );
      if (grandTotalGroup) {
        amount = get(grandTotalGroup, 'NetPrice', 0);
      }
    }

    this.formattedAmount$ = amount ? this.localCurrencyPipe.transform(amount) : of('$0.00');
  }

  // Get formatted amount for display (cached)
  getFormattedAmount(): Observable<string> {
    return this.formattedAmount$;
  }

  // Handle payment success - create/update order
  handlePaymentSuccess(result: PaymentResult): void {
    if (!result.success) {
      return;
    }

    this.createOrUpdateOrder();
  }

  // Create or update order after payment success
  private createOrUpdateOrder(): void {
    this.creatingOrder = true;

    if (this.isExistingOrderPayment && this.order?.Id) {
      // Update existing order
      const payload: Partial<Order> = {
        PaymentStatus: 'Processed'
      };

      this.subscriptions.push(
        this.orderService.updateOrder(this.order.Id, payload as Order).subscribe(
          (orderResponse) => {
            this.handleOrderSuccess(orderResponse);
          },
          (error) => {
            this.handleOrderError(error);
          }
        )
      );
    } else {
      // Create new order from cart
      if (!this.primaryContact) {
        this.creatingOrder = false;
        this.exceptionService.showError(this.translate.instant('CHECKOUT.CONTACT_MISSING_ERROR'));
        return;
      }

      const orderToCreate: any = {
        PrimaryContact: this.primaryContact,
        Account: get(this.cart, 'Account'),
        BillToAccount: get(this.order, 'BillToAccount') || get(this.cart, 'Account'),
        ShipToAccount: get(this.order, 'ShipToAccount') || get(this.cart, 'Account'),
        SoldToAccount: get(this.order, 'SoldToAccount') || get(this.cart, 'Account'),
        PriceList: get(this.cart, 'PriceList'),
        Name: get(this.order, 'Name') || 'New Order',
        PaymentStatus: 'Processed'
      };

      this.subscriptions.push(
        this.orderService.convertCartToOrder(orderToCreate, this.primaryContact).subscribe(
          (orderResponse) => {
            this.handleOrderSuccess(orderResponse);
          },
          (error) => {
            this.handleOrderError(error);
          }
        )
      );
    }
  }

  // Handle successful order creation/update
  private handleOrderSuccess(order: Order): void {
    this.creatingOrder = false;
    this.canNavigateAway = true;
    
    // Show success modal
    this.showSuccessModal(order);
  }

  // Handle order creation/update error
  private handleOrderError(error: any): void {
    this.creatingOrder = false;
    if (error) {
      this.exceptionService.showError(error);
    }
  }

  // Handle view order navigation
  handleViewOrder(order: Order): void {
    this.closeSuccessModal();
    if (get(order, 'Id')) {
      this.router.navigate(['/orders', get(order, 'Id')]);
    } else {
      this.router.navigate(['/']);
    }
  }

  // Handle close and go home navigation
  handleCloseSuccess(): void {
    this.closeSuccessModal();
    this.router.navigate(['/']);
  }

  // Show success modal after order creation
  showSuccessModal(order: Order): void {
    this.orderConfirmation = order;

    const modalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-lg',
    };

    this.confirmationModal = this.modalService.show(
      this.confirmationTemplate,
      modalOptions
    );
  }

  // Close success modal
  closeSuccessModal(): void {
    if (this.confirmationModal) {
      this.confirmationModal.hide();
    }
  }

  // Handle confirm cancel navigation
  handleConfirmCancel(): void {
    this.canNavigateAway = true;
    if (this.isExistingOrderPayment && get(this.order, 'Id')) {
      this.router.navigate(['/orders', get(this.order, 'Id')]);
    } else {
      this.router.navigate(['/checkout']);
    }
  }

  // Cancel/Back button - trigger payment element's cancel confirmation
  cancel(): void {
    if (this.paymentElement) {
      this.paymentElement.showCancelConfirmation();
    }
  }
}
