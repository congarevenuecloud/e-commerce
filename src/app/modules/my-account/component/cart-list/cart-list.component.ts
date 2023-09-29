import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { TranslateService } from '@ngx-translate/core';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { Observable, of } from 'rxjs';
import { map, mergeMap, take, tap } from 'rxjs/operators';
import { ClassType } from 'class-transformer/ClassTransformer';
import { find, first, get, isNil } from 'lodash';
import { AObject, FilterOperator } from '@congarevenuecloud/core';
import { CartService, Cart, PriceService, CartResult, FieldFilter, SummaryGroup, LocalCurrencyPipe, DateFormatPipe } from '@congarevenuecloud/ecommerce';
import { TableOptions, TableAction, ExceptionService } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-cart-list',
  templateUrl: './cart-list.component.html',
  styleUrls: ['./cart-list.component.scss']
})
export class CartListComponent implements OnInit {
  type = Cart;

  modalRef: BsModalRef;
  message: string;
  loading: boolean = false;
  cart: Cart;
  view$: Observable<CartListView>;
  cartAggregate$: Observable<any>;

  @ViewChild('effectiveDateTemplate') effectiveDateTemplate: TemplateRef<any>;

  constructor(private cartService: CartService, public priceService: PriceService, private currencyPipe: LocalCurrencyPipe, private dateFormatPipe: DateFormatPipe,
    private modalService: BsModalService, private translateService: TranslateService, private exceptionService: ExceptionService,) { }

  ngOnInit() {
    this.loadView();
  }

  loadView() {
    let tableOptions = {} as CartListView;
    this.view$ = this.cartService.getMyCart()
      .pipe(
        map(() => {
          tableOptions = {
            tableOptions: {
              columns: [
                {
                  prop: 'Name',
                  showPopover: true
                },
                {
                  prop: 'CreatedDate',
                  value: (record: Cart) => this.getDateFormat(record)
                },
                {
                  prop: 'NumberOfItems'
                },
                {
                  prop: 'IsActive',
                  label: 'CUSTOM_LABELS.IS_ACTIVE',
                  sortable: false,
                  value: (record: Cart) => (CartService.getCurrentCartId() === record.Id && !isNil(record.ActivationDate)) ? of('Yes') : of('No')
                },
                {
                  prop: 'TotalAmount',
                  label: 'CUSTOM_LABELS.TOTAL_AMOUNT',
                  sortable: false,
                  value: (record: Cart) => this.getCartTotal(record)
                },
                {
                  prop: 'Status'
                }
              ],
              lookups: ['SummaryGroups'],
              actions: [
                {
                  enabled: true,
                  icon: 'fa-check',
                  massAction: false,
                  label: 'Set Active',
                  theme: 'primary',
                  validate: (record: Cart) => this.canActivate(record),
                  action: (recordList: Array<Cart>) => this.cartService.setCartActive(first(recordList), true).pipe(map(res => {
                    this.exceptionService.showSuccess('SUCCESS.CART.ACTIVATED');
                  })),
                  disableReload: true
                } as TableAction,
                {
                  enabled: true,
                  icon: 'fa-calendar',
                  massAction: false,
                  label: 'Set Effective Date',
                  theme: 'primary',
                  validate: (record: Cart) => this.canPerformAction(record),
                  action: (recordList: Array<Cart>) => this.showEffectiveDateModal(first(recordList), this.effectiveDateTemplate),
                  disableReload: true
                } as TableAction,
                {
                  enabled: true,
                  icon: 'fa-trash',
                  massAction: true,
                  label: 'Delete',
                  theme: 'danger',
                  validate: (record: Cart) => this.canPerformAction(record),
                  action: (recordList: Array<Cart>) => this.cartService.deleteCart(recordList).pipe(map(res => {
                    this.exceptionService.showSuccess('SUCCESS.CART.DELETED');
                    this.getCartAggregate();
                    this.loadView();
                  })),
                  disableReload: true
                } as TableAction
              ],
              highlightRow: (record: Cart) => of(CartService.getCurrentCartId() === record.Id && !isNil(record.ActivationDate)),
              filters: this.getFilters(),
              routingLabel: 'carts'
            },
            type: Cart
          }
          this.getCartAggregate();
          return tableOptions;
        })
      );
  }


  private getCartAggregate(): Observable<CartResult> {
    return this.cartAggregate$ = this.cartService.getCartList(this.getFilters()).pipe(take(1), map(res => res));
  }

  /**
   * Creates new cart for logged in user based on input.
   * @param template Modal input for taking user inputs for new cart.
   */
  newCart(template: TemplateRef<any>) {
    this.cart = new Cart();
    this.message = null;
    this.modalRef = this.modalService.show(template);
  }

  getDateFormat(record: Cart) {
    return this.dateFormatPipe.transform(get(record, 'CreatedDate'));
  }

  createCart() {
    this.loading = true;
    this.cartService.createNewCart(this.cart).pipe(take(1)).subscribe(
      res => {
        this.loading = false;
        this.modalRef.hide();
        this.exceptionService.showSuccess('SUCCESS.CART.NEW_CART_CREATED');
        this.loadView();
      },
      err => {
        this.loading = false;
        this.translateService.stream('MY_ACCOUNT.CART_LIST.CART_CREATION_FAILED').subscribe((val: string) => {
          this.message = val;
        });
      }
    );
  }

  getCartTotal(currentCart: Cart): Observable<SummaryGroup> {
    return this.currencyPipe.transform(get(find(get(currentCart, 'SummaryGroups', []), r => r.LineType === 'Grand Total'), 'NetPrice'));
  }


  canPerformAction(cart: Cart) {
    return (cart.Status !== 'Finalized');
  }


  canActivate(cartToActivate: Cart) {
    return (CartService.getCurrentCartId() !== cartToActivate.Id && cartToActivate.Status !== 'Finalized');
  }

  showEffectiveDateModal(cart: Cart, template: TemplateRef<any>) {
    this.cart = cart;
    this.modalRef = this.modalService.show(template);
    return of(null);
  }

  setEffectiveDate() {
    this.loading = true;
    this.cartService.setEffectiveDate(this.cart).pipe(take(1)).subscribe(res => {
      this.loading = false;
      this.modalRef.hide();
      this.exceptionService.showSuccess('SUCCESS.CART.EFFECTIVE_DATE');
    },
      err => {
        this.loading = false;
        this.translateService.stream('MY_ACCOUNT.CART_LIST.EFFECTIVE_DATE_NOT_UPDATED').subscribe((val: string) => {
          this.message = val;
        });
      })
  }

  getFilters(): Array<FieldFilter> {
    return [{
      field: 'Account.Id',
      value: localStorage.getItem('account'),
      filterOperator: FilterOperator.EQUAL
    },
    {
      field: 'UseType',
      value: 'Shadow',
      filterOperator: FilterOperator.NOT_EQUAL
    }] as Array<FieldFilter>;
  }
}

interface CartListView {
  tableOptions: TableOptions;
  type: ClassType<AObject>;
}
