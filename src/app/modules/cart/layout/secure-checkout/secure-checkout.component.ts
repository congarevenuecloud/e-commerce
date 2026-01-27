import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  TemplateRef,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { BsModalService, BsModalRef, ModalOptions } from 'ngx-bootstrap/modal';
import { get } from 'lodash';
import {
  Cart,
  CartService,
  Order,
  OrderService,
  IntegrationService
} from '@congarevenuecloud/ecommerce';
import { ExceptionService } from '@congarevenuecloud/elements';

declare var Stripe: any;

// Secure Checkout Component with Stripe Payment Integration for Ecommerce
@Component({
  selector: 'app-secure-checkout',
  templateUrl: './secure-checkout.component.html',
  styleUrls: ['./secure-checkout.component.scss'],
})
export class SecureCheckoutComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @ViewChild('paymentElement') paymentElement: ElementRef;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  @ViewChild('cancelConfirmationTemplate') cancelConfirmationTemplate: TemplateRef<any>;

  stripe: any;
  elements: any;
  paymentElementInstance: any;

  cart: Cart;
  order: Order;
  orderConfirmation: Order;

  loading: boolean = false;
  paymentProcessing: boolean = false;
  errorMessage: string = '';
  formattedAmount: string = '0.00'; // Cache the amount to avoid repeated calculations
  canNavigateAway: boolean = false; // Flag to control navigation
  paymentIntentId: string = null; // Store payment intent ID for retry scenarios
  showRetryButton: boolean = false; // Flag to show retry button for order creation failures

  // Modal properties
  confirmationModal: BsModalRef;
  cancelConfirmationModal: BsModalRef;

  // Stripe publishable key from environment
  stripePublishableKey: string = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    private integrationService: IntegrationService,
    private exceptionService: ExceptionService,
    private translate: TranslateService,
    private modalService: BsModalService
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
      this.showCancelConfirmation();
    }
  }

  ngOnInit() {
    // Get data from navigation state BEFORE preventing back button
    const navigation = this.router.getCurrentNavigation();
    const state = get(navigation, 'extras.state') || get(window, 'history.state');
    
    // Save the state data before we modify history
    const savedState = { ...state };
    
    // Prevent back button from navigating away
    history.pushState(savedState, '', location.href);
    
    // Get Stripe publishable key from payment metadata
    this.subscriptions.push(
      this.integrationService.getPaymentMetadata().subscribe((metadata) => {
        this.stripePublishableKey = get(metadata, 'PublishableKey');
        
        if (!this.stripePublishableKey) {
          this.errorMessage = this.translate.instant('CHECKOUT.STRIPE_KEY_MISSING');
          return;
        }
        
        this.stripe = window['Stripe'] ? Stripe(this.stripePublishableKey) : null;
      })
    );

    if (get(savedState, 'order')) {
      this.order = get(savedState, 'order');
    }

    // Also check for primaryContact passed separately
    if (get(savedState, 'primaryContact')) {
      const primaryContact = get(savedState, 'primaryContact');

      // If order doesn't have primary contact, use the one passed separately
      if (this.order && !get(this.order, 'PrimaryContact')) {
        this.order.PrimaryContact = primaryContact;
      }
    }

    if (get(savedState, 'cart')) {
      this.cart = get(savedState, 'cart');
      this.calculateFormattedAmount();
    }

    // Also get cart data from service (fallback)
    if (!this.cart) {
      this.subscriptions.push(
        this.cartService
          .getMyCart()
          .pipe(take(1))
          .subscribe((cart) => {
            this.cart = cart;
            this.calculateFormattedAmount();

            // If no order was passed, try to create one from cart data
            if (!this.order) {
              if (this.cart && get(savedState, 'primaryContact')) {
                this.order = {
                  PrimaryContact: get(savedState, 'primaryContact'),
                  Name: 'New Order',
                  Account: get(this.cart, 'Account'),
                  PriceList: get(this.cart, 'PriceList'),
                } as any; // Type assertion since we're creating a partial order
              } else {
                // Only show error if we truly can't create an order
                this.errorMessage = this.translate.instant('CHECKOUT.ORDER_DATA_MISSING');
              }
            }
          })
      );
    } else if (!this.order) {
      // We have cart but no order from navigation - try to create one
      if (get(savedState, 'primaryContact')) {
        this.order = {
          PrimaryContact: get(savedState, 'primaryContact'),
          Name: 'New Order',
          Account: get(this.cart, 'Account'),
          PriceList: get(this.cart, 'PriceList'),
        } as any;
      } else {
        // Only show error if we truly can't create an order
        this.errorMessage = this.translate.instant('CHECKOUT.ORDER_DATA_MISSING');
      }
    }
  }

  ngAfterViewInit() {
    this.initializeStripePayment();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    // Clean up modals if they're open
    if (this.confirmationModal) {
      this.confirmationModal.hide();
    }
    if (this.cancelConfirmationModal) {
      this.cancelConfirmationModal.hide();
    }
  }

  // Initialize Stripe Payment Element
  initializeStripePayment() {
    // Check if Stripe publishable key is loaded
    if (!this.stripePublishableKey) {
      // Key not loaded yet, wait and retry
      setTimeout(() => this.initializeStripePayment(), 100);
      return;
    }

    // Initialize Stripe if not already done (fallback in case script loads after ngOnInit)
    if (!this.stripe && window['Stripe'] && this.stripePublishableKey) {
      this.stripe = Stripe(this.stripePublishableKey);
    }

    if (!this.stripe) {
      this.errorMessage = this.translate.instant('CHECKOUT.STRIPE_NOT_LOADED');
      return;
    }

    // We don't strictly need cart to be loaded from service since we have it in state
    // But we need to have some cart data
    const routerState = get(window, 'history.state');
    const hasCartData = this.cart || get(routerState, 'cart');

    if (!hasCartData) {
      this.errorMessage = this.translate.instant('CHECKOUT.CART_DATA_MISSING');
      return;
    }

    // Use cart from state if component cart is not set yet
    if (!this.cart && get(routerState, 'cart')) {
      this.cart = get(routerState, 'cart');
    }

    this.loading = true;

    // Get cart total amount (convert to cents for Stripe)
    let amount = 0;

    // Try to get from router state first
    if (get(routerState, 'orderAmount')) {
      amount = parseFloat(get(routerState, 'orderAmount'));
    }

    // Then try GrandTotal from cart
    if (!amount) {
      amount = get(this.cart, 'GrandTotal', 0);
    }

    // Try to get from SummaryGroups
    if (!amount) {
      const summaryGroups = get(this.cart, 'SummaryGroups', []);
      const grandTotalGroup = summaryGroups.find(
        (group: any) => group.LineType === 'Grand Total'
      );
      if (grandTotalGroup) {
        amount = get(grandTotalGroup, 'NetPrice', 0);
      }
    }

    // Default to Stripe's minimum charge amount if no amount or below minimum
    if (!amount || amount < 0.5) {
      amount = 0.5;
    }

    // Get currency from cart or default to USD
    const currency = get(this.cart, 'Currency', 'USD');

    // Determine BusinessObjectType based on source
    const businessObjectType =
      get(this.cart, 'BusinessObjectType') !== 'Order'
        ? 'ProductConfiguration'
        : 'Order';

    // Create payment intent
    this.subscriptions.push(
      this.integrationService
        .initializePayment(
          get(this.cart, 'Id'),
          amount,
          currency,
          businessObjectType
        )
        .subscribe(
          (response) => {
            const clientSecret = get(response, 'ClientSecret');
            this.paymentIntentId = get(response, 'paymentIntentId'); // Store payment intent ID

            const appearance = {
              theme: 'stripe' as 'stripe',
            };

            this.elements = this.stripe.elements({ 
              appearance, 
              clientSecret
            });

            const paymentElementOptions = {
              layout: 'tabs' as 'tabs',
              paymentMethodOrder: ['card'],
              terms: {
                card: 'never', // Disable display of card terms
              }
            };

            this.paymentElementInstance = this.elements.create(
              'payment',
              paymentElementOptions
            );

            this.loading = false;

            // Wait for Angular to render the DOM element, then mount
            setTimeout(() => {
              const paymentElementDiv =
                document.getElementById('payment-element');
              if (paymentElementDiv) {
                try {
                  this.paymentElementInstance.mount('#payment-element');
                } catch (mountError) {
                  this.errorMessage = this.translate.instant('CHECKOUT.PAYMENT_FORM_LOAD_ERROR');
                }
              } else if (
                this.paymentElement &&
                this.paymentElement.nativeElement
              ) {
                try {
                  this.elements.mount('#payment-element');
                } catch (mountError) {
                  this.errorMessage = this.translate.instant('CHECKOUT.PAYMENT_FORM_LOAD_ERROR');
                }
              } else {
                this.errorMessage = this.translate.instant('CHECKOUT.PAYMENT_FORM_CONTAINER_ERROR');
              }
            }, 200);
          },
          (error) => {
            this.errorMessage = this.translate.instant('CHECKOUT.PAYMENT_INIT_ERROR');
            this.exceptionService.showError(error);
            this.loading = false;
          }
        )
    );
  }

  // Handle payment form submission
  async handleSubmit(event: Event) {
    event.preventDefault();

    if (!get(this, 'stripe') || !get(this, 'elements')) {
      return;
    }

    this.paymentProcessing = true;
    this.errorMessage = '';
    this.showRetryButton = false; // Hide retry button during new payment attempt

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-complete`,
      },
      redirect: 'if_required',
    });

    if (error) {
      if (get(error, 'type') === 'card_error' || get(error, 'type') === 'validation_error') {
        this.errorMessage = get(error, 'message');
      } else {
        this.errorMessage = this.translate.instant('CHECKOUT.PAYMENT_UNEXPECTED_ERROR');
      }
      this.paymentProcessing = false;
    } else {
      // Payment successful - create order
      this.createOrderAfterPayment();
    }
  }

  // Create order after successful payment or update existing order
  createOrderAfterPayment() {
    this.loading = true;

    // Check if order and required properties exist
    if (!this.order) {
      this.errorMessage = this.translate.instant('DETAILS.MISSING_REQ_FIELDS');
      this.showRetryButton = true; // Show retry button for order creation failure
      this.loading = false;
      this.paymentProcessing = false; // Reset payment processing state
      return;
    }

    // Check if this is an existing order (coming from order details page with "Pay Now" button)
    // or a new order that needs to be created from cart
    const isExistingOrder =
      get(this.cart, 'BusinessObjectType') === 'Order' && get(this.order, 'Id');

    if (isExistingOrder) {
      // Update existing order's payment status
      const payload: Partial<Order> = {
        PaymentStatus: 'Processed',
      };

      this.subscriptions.push(
        this.orderService
          .updateOrder(get(this.order, 'Id'), payload as Order)
          .subscribe(
            (orderResponse) => {
              this.loading = false;
              this.paymentProcessing = false;
              this.showSuccessModal(orderResponse);
            },
            (error) => {
              this.loading = false;
              this.paymentProcessing = false;
              this.showRetryButton = true; // Show retry button for order update failure
              this.errorMessage = this.translate.instant('CHECKOUT.ORDER_UPDATE_ERROR');
              this.exceptionService.showError(error);
            }
          )
      );
    } else {
      // Build order from cart data
      if (!this.cart) {
        this.errorMessage = this.translate.instant('CHECKOUT.CART_DATA_MISSING');
        this.showRetryButton = true; // Show retry button for cart data missing after payment
        this.loading = false;
        this.paymentProcessing = false;
        return;
      }

      // Get primary contact from router state (passed from cart component)
      const routerState = get(window, 'history.state');
      let primaryContact = get(routerState, 'primaryContact');

      // If no primary contact from router state, try to get from order
      if (!primaryContact && get(this.order, 'PrimaryContact')) {
        primaryContact = get(this.order, 'PrimaryContact');
      }

      if (!primaryContact) {
        this.errorMessage = this.translate.instant('CHECKOUT.CONTACT_MISSING_ERROR');
        this.showRetryButton = true; // Show retry button for contact missing after payment
        this.loading = false;
        this.paymentProcessing = false;
        return;
      }

      // Validate that PrimaryContact has required fields - only check if Email exists
      // Name might be in FirstName/LastName or in Name field
      if (!get(primaryContact, 'Email')) {
        this.errorMessage = this.translate.instant('CHECKOUT.CONTACT_EMAIL_REQUIRED');
        this.showRetryButton = true; // Show retry button for email validation failure
        this.loading = false;
        this.paymentProcessing = false;
        return;
      }

      // Ensure Name field is set if not already
      if (
        !get(primaryContact, 'Name') &&
        (get(primaryContact, 'FirstName') || get(primaryContact, 'LastName'))
      ) {
        primaryContact.Name = `${get(primaryContact, 'FirstName', '')} ${
          get(primaryContact, 'LastName', '')
        }`.trim();
      }

      // Create order object from cart
      const orderToCreate: any = {
        PrimaryContact: primaryContact,
        Account: get(this.cart, 'Account'),
        BillToAccount: get(this.order, 'BillToAccount') || get(this.cart, 'Account'),
        ShipToAccount: get(this.order, 'ShipToAccount') || get(this.cart, 'Account'),
        SoldToAccount: get(this.order, 'SoldToAccount') || get(this.cart, 'Account'),
        PriceList: get(this.cart, 'PriceList'),
        Name: 'New Order',
        PaymentStatus: 'Processed',
      };

      this.subscriptions.push(
        this.orderService
          .convertCartToOrder(orderToCreate, primaryContact)
          .subscribe(
            (orderResponse) => {
              this.loading = false;
              this.paymentProcessing = false;
              this.showSuccessModal(orderResponse);
            },
            (error) => {
              this.loading = false;
              this.paymentProcessing = false;
              this.showRetryButton = true;
              this.errorMessage = this.translate.instant('DETAILS.MISSING_REQ_FIELDS');
              this.exceptionService.showError(error);
            }
          )
      );
    }
  }

  // Retry order creation after payment success
  retryOrderCreation() {
    this.errorMessage = '';
    this.showRetryButton = false;
    this.createOrderAfterPayment();
  }

  // Show success modal after payment completion
  showSuccessModal(order: Order) {
    this.orderConfirmation = order;
    this.canNavigateAway = true; // Allow navigation after successful payment

    // Ensure the order has proper contact information
    if (!get(this.orderConfirmation, 'PrimaryContact') && get(this.order, 'PrimaryContact')) {
      this.orderConfirmation.PrimaryContact = get(this.order, 'PrimaryContact');
    }

    // Show confirmation modal
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

  // View order - redirect to order details page
  viewOrder() {
    if (get(this, 'confirmationModal')) {
      this.confirmationModal.hide();
    }

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      if (get(this.orderConfirmation, 'Id')) {
        this.router.navigate(['/orders', get(this.orderConfirmation, 'Id')]);
      } else {
        // Fallback to home page if no specific order ID
        this.router.navigate(['/']);
      }
    }, 100);
  }

  // Close and go to home page
  closeAndGoHome() {
    if (get(this, 'confirmationModal')) {
      this.confirmationModal.hide();
    }

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 100);
  }

  // Show cancel confirmation modal
  showCancelConfirmation() {
    const modalOptions: ModalOptions = {
      backdrop: 'static',
      keyboard: false,
      class: 'modal-dialog-centered',
    };

    this.cancelConfirmationModal = this.modalService.show(
      this.cancelConfirmationTemplate,
      modalOptions
    );
  }

  // User confirmed cancellation - navigate to checkout
  confirmCancel() {
    this.canNavigateAway = true;
    if (get(this, 'cancelConfirmationModal')) {
      this.cancelConfirmationModal.hide();
    }
    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      this.router.navigate(['/checkout']);
    }, 100);
  }

  // User cancelled the cancellation - stay on page
  dismissCancel() {
    if (get(this, 'cancelConfirmationModal')) {
      this.cancelConfirmationModal.hide();
    }
  }

  // Cancel button click - show confirmation
  cancel() {
    this.showCancelConfirmation();
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

    this.formattedAmount = amount ? amount.toFixed(2) : '0.00';
  }

  // Get formatted amount for display (cached)
  getFormattedAmount(): string {
    return this.formattedAmount;
  }
}
