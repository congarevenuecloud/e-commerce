import { Component, OnInit, OnDestroy } from '@angular/core';
import { of, Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { switchMap, take, map as rmap, catchError } from 'rxjs/operators';
import { get, groupBy, isArray, map, omit, sumBy, zipObject, mapValues } from 'lodash';
import { Operator, ApiService, FilterOperator } from '@congarevenuecloud/core';
import { OrderService, Order, AccountService, FieldFilter, OrderResult, DateFormatPipe, GroupByAggregateResponse, AggregateFields } from '@congarevenuecloud/ecommerce';
import { TableOptions, FilterOptions, ExceptionService } from '@congarevenuecloud/elements';
@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit, OnDestroy {
  type = Order;

  totalRecords$: Observable<number>;
  totalAmount$: Observable<number>;
  subscription: Subscription;
  view$: Observable<OrderListView>;
  filterList$: BehaviorSubject<Array<any>> = new BehaviorSubject<Array<any>>([]);
  ordersByStatus$: Observable<GroupByAggregateResponse>;
  orderAmountByStatus$: Observable<GroupByAggregateResponse>;
  colorPalette = ['#D22233', '#F2A515', '#6610f2', '#008000', '#17a2b8', '#0079CC', '#CD853F', '#6f42c1', '#20c997', '#fd7e14'];
  aggregateFields: Array<AggregateFields> = [
    {
      AggregateFunction: 'count',
      AggregateField: 'Status'
    },
    {
      AggregateFunction: 'sum',
      AggregateField: 'OrderAmount'
    }
  ]

  filterOptions: FilterOptions = {
    visibleFields: [
      'BillToAccount',
      'Status',
      'OrderAmount',
      'CreatedDate'
    ],
    visibleOperators: [
      Operator.EQUAL,
      Operator.LESS_THAN,
      Operator.GREATER_THAN,
      Operator.GREATER_EQUAL,
      Operator.LESS_EQUAL,
      Operator.IN
    ]
  };

  constructor(private orderService: OrderService, private accountService: AccountService, private apiService: ApiService, private exceptionService: ExceptionService, private dateFormatPipe: DateFormatPipe) { }

  ngOnInit() {
    this.loadView();
  }

  loadView() {
    let tableOptions = {} as OrderListView;
    this.view$ = this.accountService.getCurrentAccount()
      .pipe(
        switchMap(() => {
          tableOptions = {
            tableOptions: {
              columns: [
                {
                  prop: 'Name',
                  label: 'CUSTOM_LABELS.ORDER_NAME'
                },
                {
                  prop: 'Status'
                },
                {
                  prop: 'PriceList.Name',
                  label: 'CUSTOM_LABELS.PRICELIST'
                },
                {
                  prop: 'BillToAccount.Name',
                  label: 'CUSTOM_LABELS.BILL_TO'
                },
                {
                  prop: 'ShipToAccount.Name',
                  label: 'CUSTOM_LABELS.SHIP_TO'
                },
                {
                  prop: 'OrderAmount'
                },
                {
                  prop: 'CreatedDate',
                  value: (record: Order) => this.getDateFormat(record)
                },
                {
                  prop: 'ActivatedDate'
                }
              ],
              fields: [
                'Description',
                'Status',
                'PriceList.Name',
                'BillToAccount.Name',
                'ShipToAccount.Name',
                'OrderAmount',
                'CreatedDate',
                'ActivatedDate'
              ],
              filters: this.filterList$.value.concat(this.getFilters()),
              routingLabel: 'orders'
            }
          }
          this.fetchOrderTotals();
          this.getChartData();
          return of(tableOptions);
        }));
  }

  getChartData() {
    const queryFields = ['Status'];
    const groupByFields = ['Status'];
    return this.orderService.getOrderAggregatesByStatus(null, this.aggregateFields, queryFields, groupByFields, this.filterList$.value).pipe(take(1)).subscribe((data) => {
      this.orderAmountByStatus$ = of(omit(mapValues(groupBy(data, 'Status'), (s) => sumBy(s, 'sum(OrderAmount)')), 'null'));
      this.ordersByStatus$ = of(omit(mapValues(groupBy(data, 'Status'), s => sumBy(s, 'count(Status)')), 'null'))
    });
  }

  handleFilterListChange(event: any) {
    this.filterList$.next(event);
    this.loadView();
  }

  getFilters(): Array<FieldFilter> {
    return [
      {
        field: 'SoldToAccount.Id',
        value: localStorage.getItem('account'),
        filterOperator: FilterOperator.EQUAL
      }] as Array<FieldFilter>;
  }

  fetchOrderTotals() {
    this.orderService.getMyOrders(null, null, this.filterList$.value.concat(this.getFilters()), null, null, null, null, null, false)
      .pipe(
        rmap((orderResult: OrderResult) => {
          this.totalRecords$ = orderResult ? of(get(orderResult, 'TotalCount')) : of(0);
          this.totalAmount$ = of(sumBy(get(orderResult, 'Orders'), order => get(order, 'OrderAmount.DisplayValue')));
        }),
        take(1),
        catchError(error => {
          this.totalRecords$ = of(0);
          this.totalAmount$ = of(0);
          this.exceptionService.showError(error, 'ERROR.INVALID_REQUEST_ERROR_TOASTR_TITLE');
          return of(error);
        })
      ).subscribe();
  }

  getDateFormat(record: Order) {
    return this.dateFormatPipe.transform(get(record, 'CreatedDate'));
  }

  ngOnDestroy() {
    if (this.subscription)
      this.subscription.unsubscribe();
  }

}

/** @ignore */
interface OrderListView {
  tableOptions: TableOptions;
}