import { Component, OnInit, ViewChild, TemplateRef, Input, OnChanges } from '@angular/core';
import { Cart, StorefrontService, Storefront, UserService, CartService, ConstraintRuleService } from '@congarevenuecloud/ecommerce';
import { Router } from '@angular/router';
import { QuoteService, Quote, SummaryGroup } from '@congarevenuecloud/ecommerce';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { Observable } from 'rxjs';
import { find, get, sum } from 'lodash';
import { take, flatMap } from 'rxjs/operators';

@Component({
  selector: 'app-cart-summary',
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.scss']
})


export class CartSummaryComponent implements OnInit, OnChanges {
  @Input() cart: Cart;
  @ViewChild('discardChangesTemplate') discardChangesTemplate: TemplateRef<any>;

  loading:boolean = false;
  discardChangesModal: BsModalRef;
  _cart: Cart;
 /**
  * @ignore
  */
  generatedQuote: Quote;
  isLoggedIn$: Observable<boolean>;
  hasErrors: boolean = true;
  /**
   * Gives the total amount of promotion applied to the cart
   */
  totalPromotions: number = 0;
  storefront$: Observable<Storefront>;
  /** @ignore */
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  /** tax related local properties */
  showTaxPopUp: boolean = false;
  totalEstimatedTax: number = 0;
  taxPopHoverModal:BsModalRef;
  cartTotal:SummaryGroup;
  cartSubTotal: SummaryGroup;

  constructor(private quoteService: QuoteService, private modalService: BsModalService, private crService: ConstraintRuleService, private storefrontService: StorefrontService, private router :Router, private userService: UserService, private cartService: CartService,
   ) {  }

  ngOnInit() {
    this.isLoggedIn$ = this.userService.isLoggedIn();
    this.crService.hasPendingErrors().subscribe(val => this.hasErrors = val);
    this.storefront$ = this.storefrontService.getStorefront();
  }

  ngOnChanges() {
    this.totalPromotions = ((this.cart && get(this.cart, 'LineItems.length') > 0)) ? sum(this.cart.LineItems.map(res => res.IncentiveAdjustmentAmount)) : 0;
    this.cartTotal = find(this.cart.SummaryGroups, grp => grp.LineType === 'Grand Total'); 
    this.cartSubTotal = find(this.cart.SummaryGroups, grp => grp.LineType === 'Subtotal'); 
  }
  /**
   * Method opens the discard changes confirmation modal dialog.
   */

  openDiscardChageModals() {
    this.discardChangesModal = this.modalService.show(this.discardChangesTemplate);
  }

/**
 * Method is invoked when abonding the cart while editing the quote line item.
 * @fires this.quoteService.abandonCart()
 */
  onDiscardChages() {
    this.loading = true;
    this.quoteService.abandonCart()
      .pipe(
        take(1),
        flatMap(() => this.cartService.createNewCart()),
        flatMap(cart => this.cartService.setCartActive(cart))
      )
      .subscribe(()  => {
        this.loading = false;
        this.router.navigate(['/proposals', get(this.cart, 'Proposald.Id')]);
        this.discardChangesModal.hide();
      });
  }

  getCartState(): string {
    return get(this.cart, '_state', '');
  }
}
