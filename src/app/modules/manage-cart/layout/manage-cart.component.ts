import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy, NgZone, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { Cart, CartItem, CartService, Product, ConstraintRuleService, CartItemService, ItemGroup, LineItemService, OrderLineItem, QuoteLineItem, QuoteService, Quote, Order, OrderService, ItemRequest } from '@congarevenuecloud/ecommerce';
import { Observable, combineLatest, of, Subscription, BehaviorSubject } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { get, filter, isNil, isEqual, set, isNull, forEach, lowerCase } from 'lodash';
import { ActivatedRoute, Router } from '@angular/router';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { BatchActionService, RevalidateCartService, ExceptionService, ButtonAction } from '@congarevenuecloud/elements';
import { plainToClass } from 'class-transformer';
import { BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-manage-cart',
  templateUrl: './manage-cart.component.html',
  styleUrls: ['./manage-cart.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ManageCartComponent implements OnInit {

  @ViewChild('discardChangesTemplate') discardChangesTemplate: TemplateRef<any>;
  @ViewChild('cloneCartTemplate') cloneCartTemplate: TemplateRef<any>;
  /**
   * Observable of the information for rendering this view.
   */
  modalRef: BsModalRef;
  view$: BehaviorSubject<ManageCartState> = new BehaviorSubject<ManageCartState>(null);
  businessObject$: Observable<Order | Quote> = of(null);
  quoteConfirmation: Quote;
  confirmationModal: BsModalRef;
  loading: boolean = false;
  primaryLI: Array<CartItem> = [];
  readOnly: boolean = false;
  cart: Cart;
  disabled: boolean;
  subscriptions: Array<Subscription> = new Array();

  searchText: string;
  cartName: string;
  customButtonActions: Array<ButtonAction> = [
    {
      label: 'MY_ACCOUNT.CART_LIST.CLONE_CART',
      enabled: true,
      onClick: () => this.openCloneCartModal(),
    },
  ]
  showSideNav: boolean= false;
  constructor(private cartService: CartService,
    private cartItemService: CartItemService,
    private orderService: OrderService,
    private crService: ConstraintRuleService,
    private quoteService: QuoteService,
    private activatedRoute: ActivatedRoute,
    public batchActionService: BatchActionService,
    private revalidateCartService: RevalidateCartService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private modalService: BsModalService,
    private exceptionService: ExceptionService) { }

  ngOnInit() {
    this.subscriptions.push(combineLatest([
      this.cartService.getMyCart(),
      this.crService.getRecommendationsForCart(), get(this.activatedRoute.params, "_value.id") ? this.cartService.getCartWithId(get(this.activatedRoute.params, "_value.id")) : of(null), this.revalidateCartService.revalidateFlag]).pipe(
        switchMap(([cart, products, nonactive, revalidateFlag]) => {
          this.disabled = revalidateFlag;
          this.readOnly = get(cart, 'Id') === get(nonactive, 'Id') || isNull(nonactive) ? false : true;
          if (this.readOnly) {
            this.batchActionService.setShowCloneAction(true);
          } else {
            this.batchActionService.setShowCloneAction(false);
          }
          cart = this.readOnly ? nonactive : cart;
          this.cart = cart;
          this.primaryLI = filter((get(cart, 'LineItems')), (i) => i.IsPrimaryLine && i.LineType === 'Product/Service');
          if (!isNil(get(cart, 'BusinessObjectId'))) {
            this.businessObject$ = isEqual(get(cart, 'BusinessObjectType'), 'Proposal') ?
              this.quoteService.getQuoteById(get(cart, 'BusinessObjectId'), false) : this.orderService.getOrder(get(cart, 'BusinessObjectId'));
          } else {
            this.businessObject$ = of(null);
          }
          return combineLatest([this.cartService.fetchCartStatus(get(this.cart, 'Id')), this.businessObject$, of(products)]);
        }),
        switchMap(([cartInfo, businessObjectInfo, productsInfo]) => {
          isEqual(get(cartInfo, 'BusinessObjectType'), 'Proposal') ? set(cartInfo, 'Proposald', businessObjectInfo) : set(cartInfo, 'Order', businessObjectInfo);
          cartInfo.set('error',get(this.cart,'_metadata.error'));
          cartInfo.set('ConfigResponse',get(this.cart,'ConfigResponse'));
          const cartItems = get(cartInfo, 'LineItems');
          return of({
            cart: cartInfo,
            lineItems: LineItemService.groupItems(cartItems),
            orderOrQuote: isNil(get(cartInfo, 'Order')) ? get(cartInfo, 'Proposald') : get(cartInfo, 'Order'),
            productList: productsInfo
          } as ManageCartState);
        })
      ).subscribe(cartState => this.view$.next(cartState)))
  }

  trackById(index, record): string {
    return get(record, 'MainLine.Id');
  }

  refreshCart(fieldValue, cart, fieldName) {
    set(cart, fieldName, fieldValue);
    const payload = {
      "Name": fieldValue
    }

    this.subscriptions.push(this.cartService.updateCartById(cart.Id, payload).subscribe(r => {
      this.cart = r;
    }))
  }
  createQuote(cart: Cart) {
    this.quoteService.convertCartToQuote(cart.Proposald).pipe(take(1)).subscribe(
      res => {
        this.quoteConfirmation = res;
        this.ngZone.run(() => {
          this.router.navigate(['/proposals', this.quoteConfirmation.Id]);
        });
      }
    );
  }
  searchChange() {
    if (this.searchText.length > 2) {
      forEach(this.view$.value.lineItems, (lineItem) => {
        let lowercaseSearchTerm = lowerCase(get(lineItem, 'MainLine.Name'));
        if (lowercaseSearchTerm) {
          if (lowercaseSearchTerm.indexOf(lowerCase(this.searchText)) > -1) {
            lineItem.MainLine.set('hide', false);
          }
          else {
            lineItem.MainLine.set('hide', true);
          }
        }
      });
    } else {
      forEach(this.view$.value.lineItems, (lineItem) => {
        lineItem.MainLine.set('hide', false);
      });
    }
  }

  openCloneCartModal() {
    this.cartName = `Clone of ${this.cart.Name}`
    this.modalRef = this.modalService.show(this.cloneCartTemplate);
  }

  closeCloneCartModal() {
    this.cartName = '';
    this.modalRef.hide()
  }

  cloneCart() {
    this.loading = true;
    if (this.cartName) {
      this.cart.Name = this.cartName
    }
    delete this.cart.Status;
    this.cartService.cloneCart(this.cart.Id, this.cart, true, true).pipe(take(1)).subscribe(
      res => {
        this.loading = false;
        this.modalRef.hide();
        this.exceptionService.showSuccess('SUCCESS.CART.CLONE_CART_SUCCESS');
      },
      err => {
        this.loading = false;
        this.exceptionService.showError('MY_ACCOUNT.CART_LIST.CART_CREATION_FAILED');
      }
    );
  }

  convertCartToQuote(quote: Quote) {
    this.quoteService.convertCartToQuote(quote).pipe(take(1)).subscribe(
      res => {
        this.loading = false;
        this.quoteConfirmation = res;
        this.ngZone.run(() => {
          this.router.navigate(['/proposals', this.quoteConfirmation.Id]);
        });
      },
      err => {
        this.loading = false;
      }
    );
  }

  openNav() {
    this.showSideNav= true;
  }
  
  /* Set the width of the side navigation to 0 */
  closeNav() {
    this.showSideNav=false;
  }

  ngOnDestroy() {
    if (!isNil(this.subscriptions))
      this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}

/** @ignore */
export interface ManageCartState {
  cart: Cart;
  lineItems: Array<ItemGroup>;
  productList: Array<ItemRequest>;
}
