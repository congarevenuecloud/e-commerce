import { Component, OnInit, OnDestroy } from '@angular/core';
import { AObject, FilterOperator, Operator } from '@congarevenuecloud/core';
import {
  CartService,
  AssetService,
  AssetLineItemExtended,
  AssetLineItem,
  AccountService, Account,
  Cart, FieldFilter, GroupByAggregateResponse, AggregateFields
} from '@congarevenuecloud/ecommerce';
import { Observable, of, Subscription, take, map, combineLatest } from 'rxjs';
import { isNil, set, get, filter, omit, concat, mapValues, groupBy, sumBy, first, last } from 'lodash';
import {
  AssetModalService,
  TableOptions,
  TableAction,
  FilterOptions
} from '@congarevenuecloud/elements';
import { ToastrService } from 'ngx-toastr';
import { DatePipe } from '@angular/common';
import { ClassType } from 'class-transformer/ClassTransformer';

@Component({
  selector: 'app-asset-list',
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.scss'],
  providers: [DatePipe]
})
export class AssetListComponent implements OnInit, OnDestroy {
  /**
   * The view object used for rendering information in the template.
   */
  view$: Observable<AssetListView>;

  subscription: Subscription;

  /**
   * Value of the days to renew filter.
   */
  renewFilter: Array<FieldFilter> = [];

  /**
   * Value of the price type filter.
   */
  priceTypeFilter: Array<FieldFilter> = [];

  /**
   * Value of the asset action filter.
   */
  assetActionFilter: Array<FieldFilter> = [];

  /**
   * Value of the advanced filter component.
   */
  advancedFilters: Array<FieldFilter> = [];
  /**
   * cart record
   */
  cart: Cart;
  type = AssetLineItemExtended;
  assetByPriceType$: Observable<GroupByAggregateResponse>;
  assetAmountByPriceType$: Observable<GroupByAggregateResponse>;
  aggregateFields: Array<AggregateFields> = [
    {
      AggregateFunction: 'count',
      AggregateField: 'PriceType'
    },
    {
      AggregateFunction: 'sum',
      AggregateField: 'NetPrice'
    }
  ]

  /**
   * Configuration object used to configure the data filter.
   */
  advancedFilterOptions: FilterOptions = {
    visibleFields: [
      'Name',
      'SellingFrequency',
      'StartDate',
      'EndDate',
      'NetPrice',
      'Quantity',
      'AssetStatus',
      'PriceType'
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

  /**
   * Default filters that will be applied to the table and chart components.
   */
  defaultFilters: Array<FieldFilter> = [
    {
      field: 'LineType',
      value: 'Option',
      filterOperator: FilterOperator.NOT_EQUAL
    },
    {
      field: 'IsPrimaryLine',
      value: true,
      filterOperator: FilterOperator.EQUAL
    }
  ];

  /**
   * Flag to pre-select items in the table component.
   */
  preselectItemsInGroups: boolean = false;

  /**
   * Color palette used for the chart component styling.
   */
  colorPalette = [
    '#D22233',
    '#F2A515',
    '#6610f2',
    '#008000',
    '#17a2b8',
    '#0079CC',
    '#CD853F',
    '#6f42c1',
    '#20c997',
    '#fd7e14'
  ];

  /**
   * Map of asset actions to their appropriate filter.
   */
  private assetActionMap = {
    'All': [],
    'Renew': {
      field: 'PriceType',
      value: 'One Time',
      filterOperator: FilterOperator.NOT_EQUAL
    },
    'Terminate': {
      field: 'PriceType',
      value: 'One Time',
      filterOperator: FilterOperator.NOT_EQUAL
    },
    'Buy More': [],
    'Change Configuration': [ 
      {
        field: 'AssetStatus',
        value: 'Cancelled',
        filterOperator: FilterOperator.NOT_EQUAL
      },
      {
        field: 'PriceType',
        value: 'One Time',
        filterOperator: FilterOperator.NOT_EQUAL
      },
      {
        field: 'HasAttributes',
        value: true,
        filterOperator: FilterOperator.EQUAL
      }
    ]
  };

  constructor(
    public assetService: AssetService,
    private assetModalService: AssetModalService,
    protected cartService: CartService,
    protected toastr: ToastrService,
    protected accountService: AccountService
  ) { }

  /**
   * @ignore
   */
  ngOnInit() {
    this.loadView();
  }

  ngOnDestroy() {
    if (this.subscription)
      this.subscription.unsubscribe();
  }

  /**
   * Loads the view data.
   */
  loadView() {
    let tableOptions = {} as AssetListView;
    this.view$ = combineLatest([this.cartService.getMyCart(), this.accountService.getCurrentAccount()])
      .pipe(
        map(([cart, account]) => {
          tableOptions = {
            tableOptions: {
              groupBy: 'Name',
              filters: this.getFilters(),
              defaultSort: {
                column: 'CreatedDate',
                direction: 'ASC'
              },
              stickyColumnCount: 1,
              stickyColumns: [{
                prop: 'Name',
                label: 'ASSET_LIST.ASSET_NAME',
                showPopover: true
              }],
              columns: [
                {
                  prop: 'Name'
                },
                { prop: 'SellingFrequency' },
                { prop: 'StartDate' },
                { prop: 'EndDate' },
                { prop: 'NetPrice' },
                { prop: 'Quantity' },
                { prop: 'AssetStatus' },
                { prop: 'PriceType' }
              ],
              actions: this.getActions(cart),
              disableLink: true,
              routingLabel: 'assets'
            } as TableOptions,
            type: AssetLineItemExtended
          }
          this.getChartData(account);
          return tableOptions;
        })
      );
  }



  /**
   * Event handler for when the advanced filter changes.
   * @param event The event that was fired.
   */
  handleAdvancedFilterChange(event: any) {
    this.advancedFilters = event;
    this.loadView();
  }

  /**
   * Event handler for when the days to renew filter is changed.
   * @param event The Event that was fired.
   */
  onRenewalChange(event: FieldFilter) {
    const eventValue = get(event, 'value');
    isNil(eventValue) ? set(event, 'value', eventValue) : set(event, 'value', isNil(get(eventValue, 'value')) ? eventValue : get(eventValue, 'value').toISOString());
    this.renewFilter = isNil(eventValue) ? [] : [event];
    this.loadView();
  }

  /**
   * Event handler for when price type filter is changed.
   * @param event Event object that was fired.
   */
  onPriceTypeChange(event: FieldFilter) {
    this.priceTypeFilter = isNil(event) ? [] : [event];
    this.loadView();
  }

  /**
   * Event handler for when the asset action filter changes.
   * @param event The event that was fired.
   */
  onAssetActionChange(event: string) {
    this.assetActionFilter = this.assetActionMap[event];
    this.loadView();
  }

  /**
   * Get all the currently applied filters.
   */
  private getFilters() {
    return concat(
      this.defaultFilters,
      this.advancedFilters,
      this.renewFilter,
      this.priceTypeFilter,
      this.assetActionFilter
    );
  }

  private getActions(cart: Cart): Array<TableAction> {
    return [
      {
        icon: 'fa-sync',
        massAction: false,
        label: 'ASSET_ACTIONS.RENEW',
        theme: 'primary',
        validate(record: AssetLineItemExtended, childRecords: Array<AssetLineItemExtended>): boolean {
          return record.canRenew() && record.AssetStatus === 'Activated' && !(filter(get(cart, 'LineItems'), (item) => get(item, 'AssetLineItem.Id') === record.Id).length > 0);
        },
        action: (recordList: Array<AObject>): Observable<void> => {
          this.assetModalService.openRenewModal(
            <AssetLineItem>recordList[0],
            <Array<AssetLineItem>>recordList
          );
          return of(null);
        }
      },
      {
        icon: 'fa-wrench',
        label: 'ASSET_ACTIONS.AMEND',
        theme: 'primary',
        validate(record: AssetLineItemExtended): boolean {
          return record.canChangeConfiguration() && record.AssetStatus === 'Activated' && !(filter(get(cart, 'LineItems'), (item) => get(item, 'AssetLineItem.Id') === record.Id).length > 0);
        },
        action: (recordList: Array<AObject>): Observable<void> => {
          this.assetModalService.openChangeConfigurationModal(
            <AssetLineItem>recordList[0],
            <Array<AssetLineItem>>recordList
          );
          return of(null);
        }
      },
      {
        icon: 'fa-dollar-sign',
        massAction: false,
        label: 'ASSET_ACTIONS.BUY_MORE',
        theme: 'primary',
        validate(record: AssetLineItemExtended): boolean {
          return record.AssetStatus === 'Activated' && !(filter(get(cart, 'LineItems'), (item) => get(item, 'AssetLineItemId') === record.Id).length > 0);
        },
        action: (recordList: Array<AObject>): Observable<void> => {
          this.assetModalService.openBuyMoreModal(
            <AssetLineItem>recordList[0],
            <Array<AssetLineItem>>recordList
          );
          return of(null);
        }
      },
      {
        icon: 'fa-ban',
        massAction: false,
        label: 'ASSET_ACTIONS.TERMINATE',
        theme: 'danger',
        validate(record: AssetLineItemExtended, childRecords: Array<AssetLineItemExtended>): boolean {
          return record.canTerminate(childRecords) && record.AssetStatus === 'Activated' && !(filter(get(cart, 'LineItems'), (item) => get(item, 'AssetLineItemId') === record.Id).length > 0);
        },
        action: (recordList: Array<AObject>): Observable<void> => {
          this.assetModalService.openTerminateModal(
            <AssetLineItem>recordList[0],
            <Array<AssetLineItem>>recordList
          );
          return of(null);
        }
      }
    ];
  }

  private getChartData(account: Account) {
    const queryFields = ['PriceType'];
    const groupByFields = ['PriceType'];
    return this.assetService.getAssetAggregates(account, this.aggregateFields, queryFields, groupByFields, this.getFilters()).pipe(take(1)).subscribe((data) => {
      this.assetByPriceType$ = of(omit(mapValues(groupBy(data, 'PriceType'), s => sumBy(s, 'count(PriceType)')), 'null'))
      this.assetAmountByPriceType$ = of(omit(mapValues(groupBy(data, 'PriceType'), (s) => sumBy(s, 'sum(NetPrice)')), 'null'));
    });
  }
}

/** @ignore */
interface AssetListView {
  tableOptions: TableOptions;
  type: ClassType<AObject>;

}