import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy, NgZone, ViewEncapsulation } from '@angular/core';
import { Cart, CartItem, CartService, Product, ConstraintRuleService, CartItemService, ItemGroup, LineItemService, OrderLineItem, QuoteLineItem, QuoteService, Quote, Order, OrderService } from '@congarevenuecloud/ecommerce';
import { Observable, combineLatest, of, Subscription } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { get, filter, isNil, isEqual, set, isNull } from 'lodash';
import { ActivatedRoute, Router } from '@angular/router';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { BatchActionService, RevalidateCartService } from '@congarevenuecloud/elements';
import { plainToClass } from 'class-transformer';

@Component({
  selector: 'app-manage-cart',
  templateUrl: './manage-cart.component.html',
  styleUrls: ['./manage-cart.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ManageCartComponent implements OnInit {

  @ViewChild('discardChangesTemplate') discardChangesTemplate: TemplateRef<any>;

  /**
   * Observable of the information for rendering this view.
   */
  discardChangesModal: BsModalRef;
  view$: Observable<ManageCartState>;
  businessObject$: Observable<Order | Quote> = of(null);
  quoteConfirmation: Quote;
  confirmationModal: BsModalRef;
  loading: boolean = false;
  primaryLI: Array<CartItem> = [];
  readonly: boolean = false;
  cart: Cart;
  disabled: boolean;
  subscription: Subscription;

  constructor(private cartService: CartService,
    private cartItemService: CartItemService,
    private orderService: OrderService,
    private crService: ConstraintRuleService,
    private quoteService: QuoteService,
    private activatedRoute: ActivatedRoute,
    public batchActionService: BatchActionService,
    private revalidateCartService: RevalidateCartService,
    private router: Router,
    private ngZone: NgZone) { }

  ngOnInit() {
    this.view$ = combineLatest([
      this.cartService.getMyCart(),
      this.crService.getRecommendationsForCart(), get(this.activatedRoute.params, "_value.id") ? this.cartService.getCartWithId(get(this.activatedRoute.params, "_value.id")) : of(null), this.revalidateCartService.revalidateFlag]).pipe(
        switchMap(([cart, products, nonactive, revalidateFlag]) => {
          this.disabled = revalidateFlag;
          this.readonly = get(cart, 'Id') === get(nonactive, 'Id') || isNull(nonactive) ? false : true;
          if (this.readonly) {
            this.batchActionService.setShowCloneAction(true);
          } else {
            this.batchActionService.setShowCloneAction(false);
          }
          cart = this.readonly ? nonactive : cart;
          this.cart = cart;
          this.primaryLI = filter((get(cart, 'LineItems')), (i) => i.IsPrimaryLine && i.LineType === 'Product/Service');
          if (!isNil(get(cart, 'BusinessObjectId'))) {
            this.businessObject$ = isEqual(get(cart, 'BusinessObjectType'), 'Proposal') ?
              this.quoteService.getQuoteById(get(cart, 'BusinessObjectId'), false) : this.orderService.getOrder(get(cart, 'BusinessObjectId'));
          }
          return combineLatest([of(cart), this.businessObject$, of(products)]);
        }),
        switchMap(([cartInfo, businessObjectInfo, productsInfo]) => {
          isEqual(get(cartInfo, 'BusinessObjectType'), 'Proposal') ? set(cartInfo, 'Proposald', businessObjectInfo) : set(cartInfo, 'Order', businessObjectInfo);
          const cartItems = get(cartInfo, 'LineItems');
          return of({
            cart: cartInfo,
            lineItems: LineItemService.groupItems(cartItems),
            orderOrQuote: isNil(get(cartInfo, 'Order')) ? get(cartInfo, 'Proposald') : get(cartInfo, 'Order'),
            productList: productsInfo
          } as ManageCartState);
        })
      );
  }

  trackById(index, record): string {
    return get(record, 'MainLine.Id');
  }

  refreshCart(fieldValue, cart, fieldName) {
    set(cart, fieldName, fieldValue);
    const payload = {
      "Name": fieldValue
    }

    this.subscription = this.cartService.updateCartById(cart.Id, payload).subscribe(r => {
      this.cart = r;

    })
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

  ngOnDestroy() {
    if (!isNil(this.subscription))
      this.subscription.unsubscribe();
  }
}

/** @ignore */
export interface ManageCartState {
  cart: Cart;
  lineItems: Array<ItemGroup>;
  productList: Array<Product>;
}
