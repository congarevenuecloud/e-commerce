import { Component, OnInit, ViewChild, TemplateRef, NgZone } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {get, set, find, defaultTo, isEmpty, isNil} from 'lodash';
import { Quote, QuoteService, StorefrontService, Storefront, Cart, CartService, UserService, CartItem } from '@congarevenuecloud/ecommerce';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-create-quote',
  templateUrl: `./create-quote.component.html`,
  styles: []
})
export class CreateQuoteComponent implements OnInit {
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  @ViewChild('form', { static: false }) form: NgForm;
  /**
   * Observable of cart
   */
  cart$: Observable<Cart>;
  /**
   * Observable of storfront
   */
  storefront$: Observable<Storefront>;
  /**
 * Stores confirmation model
 */
  confirmationModal: BsModalRef;
  /**
 * Quote Response Object Model
 */
  quoteConfirmation: Quote;
  /**
 * Loading flag for spinner
 */
  loading: boolean = false;
  quoteRequestObj: Quote;
  quoteBreadCrumbObj$: Observable<Quote>;
  disableSubmit: boolean = false;
  isLoggedIn: boolean;
  subscriptions: Subscription;

  constructor(private cartService: CartService, private quoteService: QuoteService,private userService: UserService, private modalService: BsModalService, private translate: TranslateService, private storefrontService: StorefrontService, private ngZone: NgZone) { }

  ngOnInit() {
    this.quoteRequestObj = new Quote();
    this.cart$ = this.cartService.getMyCart();
    this.subscriptions=this.userService.isLoggedIn().subscribe(isLoggedIn => this.isLoggedIn = isLoggedIn);
  }

  onUpdate($event: Quote) {
    this.quoteRequestObj = $event;
    this.disableSubmit = this.isLoggedIn ? isEmpty(this.quoteRequestObj.PrimaryContact && this.quoteRequestObj.ProposalName) : (!this.form?.form?.valid || this.form?.form?.pristine);
  }

  /**
   * Method converts cart to quote.
   * @fires convertCartToQuote method.
   * @param instance of quote
   * @returns quote object.
   */
  convertCartToQuote(cart: Cart) {
    const quoteAmountGroup = find(get(cart, 'SummaryGroups'), c => get(c, 'LineType') === 'Grand Total');
    set(this.quoteRequestObj, 'GrandTotal.Value', defaultTo(get(quoteAmountGroup, 'NetPrice', 0).toString(), '0'));
    if (this.quoteRequestObj.PrimaryContact) {
      this.loading = true;
      this.quoteService.convertCartToQuote(this.quoteRequestObj).pipe(take(1)).subscribe(res => {
        this.quoteConfirmation = res;
        this.confirmationModal = this.modalService.show(this.confirmationTemplate, { class: 'modal-lg' });
      },
        err => {
          this.loading = false;
        });
    }
  }

  ngOnDestroy() {
    if (!isNil(this.subscriptions))
    this.subscriptions.unsubscribe();
}

}
