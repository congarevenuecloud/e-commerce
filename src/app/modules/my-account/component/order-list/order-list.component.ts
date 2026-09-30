import { Component, OnInit, OnDestroy } from '@angular/core';
import { of, Observable, Subscription, BehaviorSubject, combineLatest } from 'rxjs';
import { switchMap, take, map, catchError } from 'rxjs/operators';
import { get, groupBy, omit, sumBy, mapValues } from 'lodash';
import { Operator, FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { OrderService, Order, AccountService, FieldFilter, DateFormatPipe, GroupByAggregateResponse, AggregateFields, LocalCurrencyPipe, StorefrontService, DisplayColumn, DisplayColumnSection } from '@congarevenuecloud/ecommerce';
import { TableOptions, TableColumn, FilterOptions, ExceptionService, DisplayColumnService } from '@congarevenuecloud/elements';
@Component({
    selector: 'app-order-list',
    templateUrl: './order-list.component.html',
    styleUrls: ['./order-list.component.scss'],
    standalone: false
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

  // Columns rendered in the order list, from the 'Order List' section of the displayColumns API;
  // empty means the storefront has no configuration, so the built-in columns are used.
  private configuredColumns: Array<DisplayColumn> = [];

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

  constructor(private orderService: OrderService, private accountService: AccountService, private exceptionService: ExceptionService, private dateFormatPipe: DateFormatPipe, private currencyPipe: LocalCurrencyPipe, private storefrontService: StorefrontService, private displayColumnService: DisplayColumnService) { }

  ngOnInit() {
    this.loadColumnConfig();
  }

  /**
   * Loads the configured order list columns, then renders the view. The view is built either way,
   * so a storefront without configuration still gets the built-in columns.
   */
  private loadColumnConfig(): void {
    this.storefrontService.getStorefront().pipe(
      take(1),
      switchMap((storefront) => {
        const flow = get(storefront, 'DefaultFlow') || 'system';
        return this.storefrontService.getStorefrontDisplayColumns(flow, get(storefront, 'Id'));
      }),
      catchError(() => of<Array<DisplayColumn>>([]))
    ).subscribe((response) => {
      this.configuredColumns = this.displayColumnService.columnsForSection(response, DisplayColumnSection.OrderList);
      this.loadView();
    });
  }

  // The built-in order list columns, used when the storefront has no configuration.
  private getDefaultColumns(): Array<TableColumn> {
    return [
      {
        prop: 'OrderNumber',
        enableRouteLink: true
      },
      {
        prop: 'Name',
        label: 'COMMON.NAME'
      },
      {
        prop: 'Status'
      },
      {
        prop: 'PriceList',
        sortable: false
      },
      {
        prop: 'BillToAccount',
        label: 'CUSTOM_LABELS.BILL_TO',
        sortable: false
      },
      {
        prop: 'ShipToAccount',
        label: 'CUSTOM_LABELS.SHIP_TO',
        sortable: false
      },
      {
        prop: 'OrderAmount'
      },
      {
        prop: 'CreatedDate',
        value: (record: Order) => this.getDateFormat(record, 'CreatedDate')
      },
      {
        prop: 'ActivatedDate',
        value: (record: Order) => this.getDateFormat(record, 'ActivatedDate')
      }
    ];
  }

  loadView() {
    let tableOptions = {} as OrderListView;
    this.view$ = this.accountService.getCurrentAccount()
      .pipe(
        switchMap(() => {
          tableOptions = {
            tableOptions: {
              columns: this.displayColumnService.toTableColumns(this.configuredColumns, this.getDefaultColumns(), (column) => this.displayColumnService.formatColumnValue(column)),
              fields: [
                'Description',
                'Status',
                'PriceList.Name',
                'BillToAccount.Name',
                'ShipToAccount.Name',
                'OrderAmount',
                'CreatedDate',
                'ActivatedDate',
                'OrderNumber'
              ],
              filters: this.filterList$.value.concat(this.getFilters()),
              routingLabel: 'orders',
              callback: (recordList?: Array<Order>) => {
                if (recordList && recordList.length > 0) {
                  return combineLatest(
                    recordList.map((record) => this.updateOrderValue(record)));
                }
                return of([]);
              }
            }
          }
          return of(tableOptions);
        }));
    this.getChartData();
  }

  getChartData() {
    const queryFields = ['Status'];
    const groupByFields = ['Status'];
    return this.orderService.getOrderAggregatesByStatus(null, this.aggregateFields, queryFields, groupByFields, this.filterList$.value)
      .pipe(
        take(1),
        catchError(error => {
          this.totalRecords$ = of(0);
          this.totalAmount$ = of(0);
          this.orderAmountByStatus$ = of({});
          this.ordersByStatus$ = of({});
          this.exceptionService.showError(error, 'ERROR.INVALID_REQUEST_ERROR_TOASTR_TITLE');
          return of([]);
        })
      )
      .subscribe((data : any[]) => {
        const groupedByStatus = groupBy(data, 'Status');
        const totalRecords = get(data,'total_records') ?? sumBy(data, 'count(Status)');
        const totalAmount = sumBy(data, 'sum(OrderAmount)');

        this.totalRecords$ = of(totalRecords || 0);
        this.totalAmount$ = of(totalAmount || 0);
        this.orderAmountByStatus$ = of(omit(mapValues(groupedByStatus, (s) => sumBy(s, 'sum(OrderAmount)')), 'null'));
        this.ordersByStatus$ = of(omit(mapValues(groupedByStatus, s => sumBy(s, 'count(Status)')), 'null'));
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
        value: localStorage.getItem(PlatformConstants.ACCOUNT),
        filterOperator: FilterOperator.EQUAL
      }] as Array<FieldFilter>;
  }

  getDateFormat(record: Order, field: string, dateTimeFormat: string = 'ShortDatePattern'): Observable<string> {
    const dateValue = get(record, field);
    if (!dateValue) return of('');
    return this.dateFormatPipe.transform(dateValue, dateTimeFormat);
  }

  updateOrderValue(order: Order): Observable<Order> {
    return this.orderService.updateOrderValue(order, {
      fetchQuote: false,
      fetchContact: false,
      fetchSoldToAccount: false,
      fetchLocation: false
    }).pipe(
      take(1),
      map((updatedOrder: Order) => {
        return updatedOrder;
      })
    );
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