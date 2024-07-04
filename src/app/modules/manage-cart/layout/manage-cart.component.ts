import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectionStrategy, NgZone, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { Cart, CartItem, CartService, Product, ConstraintRuleService, CartItemService, ItemGroup, LineItemService, OrderLineItem, QuoteLineItem, QuoteService, Quote, Order, OrderService, ItemRequest } from '@congarevenuecloud/ecommerce';
import { Observable, combineLatest, of, Subscription, BehaviorSubject } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { get, filter, isNil, isEqual, set, isNull, forEach, lowerCase, pick } from 'lodash';
import { ActivatedRoute, Router } from '@angular/router';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { BatchActionService, RevalidateCartService, ExceptionService, ButtonAction, BatchSelectionService } from '@congarevenuecloud/elements';
import { BsModalService } from 'ngx-bootstrap/modal';
import { plainToClass } from 'class-transformer';

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
  selectedCount:number = 0; 
  customButtonActions: Array<ButtonAction> = [
    {
      label: 'MY_ACCOUNT.CART_LIST.CLONE_CART',
      enabled: true,
      onClick: () => this.openCloneCartModal(),
    },
  ]
  showSideNav: boolean = false;
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
    private exceptionService: ExceptionService,
    public batchSelectionService: BatchSelectionService) { }

  ngOnInit() {
    this.subscriptions.push(combineLatest([
      this.cartService.getMyCart(),
      this.crService.getRecommendationsForCart(),
      this.cartService.isCartActive(get(this.activatedRoute.params, "_value.id")) ? of(null) : this.cartService.getCartWithId(get(this.activatedRoute.params, "_value.id")),
      this.revalidateCartService.revalidateFlag,
      this.batchSelectionService.getSelectedLineItems()]).pipe(
        switchMap(([cart, products, nonactive, revalidateFlag, selectedCount]) => {
          this.selectedCount = selectedCount?.length ? selectedCount.length : 0;
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
          return combineLatest([of(this.cart), this.businessObject$, of(products), this.readOnly ? this.cartService.addAdjustmentInfoToLineItems(this.cart?.Id) : of(null)]);
        }),
        switchMap(([cartInfo, businessObjectInfo, productsInfo, lineItemsWithIncentives]) => {
          if (this.readOnly && !isNil(lineItemsWithIncentives)) {
            set(cartInfo, 'LineItems', lineItemsWithIncentives);
          }
          isEqual(get(cartInfo, 'BusinessObjectType'), 'Proposal') ? set(cartInfo, 'Proposald', businessObjectInfo) : set(cartInfo, 'Order', businessObjectInfo);
          const cartItems = plainToClass(CartItem, get(cartInfo, 'LineItems'));
          return of({
            cart: cartInfo,
            lineItems: LineItemService.groupItems(cartItems as unknown as Array<CartItem>),
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
    this.cartService.cloneCart(this.cart.Id, pick(this.cart, ['Name']) as Cart, true, true).pipe(take(1)).subscribe(
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
    this.showSideNav = true;
  }

  /* Set the width of the side navigation to 0 */
  closeNav() {
    this.showSideNav = false;
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
