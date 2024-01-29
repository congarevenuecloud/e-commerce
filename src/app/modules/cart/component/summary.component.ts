import { Component, OnChanges, Input, TemplateRef, ViewChild  } from '@angular/core';
import {
  Cart,
  QuoteService,
  CartItem,
  Quote,
  CartItemService,
  LineItemService
} from '@congarevenuecloud/ecommerce';
import * as _ from 'lodash';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { TranslateService } from '@ngx-translate/core';
import { ProductConfigurationSummaryComponent } from '@congarevenuecloud/elements';

@Component({
  selector: 'cart-summary',
  templateUrl: `./summary.component.html`,
  styles: [`
    .small{
      font-size: smaller;
    }
    li.group-item .details small:not(:last-child){
      border-right: 1px solid gray;
      padding-right: 6px;
      margin-right: 6px;
    }
    .confirmation .oi{
        padding: 26px;
        font-size: 75px;
    }
  `]
})
export class SummaryComponent implements OnChanges {
  @Input() cart: Cart;
  @ViewChild('confirmationTemplate') confirmationTemplate: TemplateRef<any>;
  @ViewChild(ProductConfigurationSummaryComponent)
  summaryModal: ProductConfigurationSummaryComponent;

  state: SummaryState;
  modalRef: BsModalRef;
  lineItem: CartItem;
  confirmationModal: BsModalRef;
  generatedQuote: Quote;
  /** @ignore */
  generatedQuoteName: string;

  lineItems: Array<CartItem>;

  get itemCount(): number{
    let count = 0;
    if(_.get(this.cart, 'LineItems'))
      this.cart.LineItems.filter(p => p.LineType === 'Product/Service').forEach(r => count += Number(r.Quantity));
    return count;
  }

  constructor(private quoteService: QuoteService,
              private cartItemService: CartItemService,
              private modalService: BsModalService,
              private translate: TranslateService) {
    this.state = {
      configurationMessage: null,
      downloadLoading: false,
      requestQuoteMessage: null,
      requestQuoteLoading: false
    };
  }

  ngOnChanges() {
    this.lineItems = _.map(LineItemService.groupItems(_.get(this, 'cart.LineItems')), i => _.get(i, 'MainLine')) as Array<CartItem>;
  }

  createQuote() {
    this.state.requestQuoteLoading = true;
    this.quoteService.convertCartToQuote().subscribe(
      res => {
        this.generatedQuote = res;
        this.translate.stream('CART.CART_SUMMARY.QUOTE_GENERATED', {value: this.generatedQuote.Name}).subscribe((
          quoteMessage:string) => {
            this.generatedQuoteName = quoteMessage;
        });
        this.state.requestQuoteLoading = false;
        this.confirmationModal = this.modalService.show(this.confirmationTemplate);
      },
      err => {
        this.state.requestQuoteMessage = 'An error occurred generating your quote. Please contact an administrator';
        this.state.requestQuoteLoading = false;
      }
    );
  }

  generatePdf(){}

  openModal(lineItem: CartItem) {
    this.lineItem = lineItem;
    setTimeout(() => {
      this.summaryModal.show();
    });
    // this.modalRef = this.modalService.show(template);
  }
}

/**
 * Used to hold state information about a cart summary.
 * @ignore
 */
export interface SummaryState{
  /**
   * Configuration message.
   */
  configurationMessage: string;
  /**
   * Flag to check if download is currently loading.
   */
  downloadLoading: boolean;
  /**
   * Request quote message.
   */
  requestQuoteMessage: string;
  /**
   * Flag to check if request quote is loading.
   */
  requestQuoteLoading: boolean;
}
