import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { switchMap, take, catchError, map, tap, filter } from 'rxjs/operators';
import moment from 'moment';
import { get, sumBy, mapValues, groupBy, omit, isNil } from 'lodash';
import { Operator, FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { Quote, QuoteService, LocalCurrencyPipe, AccountService, FieldFilter, DateFormatPipe, GroupByAggregateResponse, AggregateFields, StorefrontService, DisplayColumn, DisplayColumnSection, UserService, ContactService, Contact } from '@congarevenuecloud/ecommerce';
import { TableOptions, TableColumn, CustomFilterView, FilterOptions, ExceptionService, DisplayColumnService, QuickAddField } from '@congarevenuecloud/elements';

@Component({
    selector: 'app-quote-list',
    templateUrl: './quote-list.component.html',
    styleUrls: ['./quote-list.component.scss'],
    standalone: false
})
export class QuoteListComponent implements OnInit {
  type = Quote;

  totalAmount$: Observable<number>;
  totalRecords$: Observable<number>;
  view$: Observable<QuoteListView>;
  amountsByStatus$: Observable<GroupByAggregateResponse>;
  quotesByStatus$: Observable<GroupByAggregateResponse>;
  colorPalette = ['#D22233', '#F2A515', '#6610f2', '#008000', '#17a2b8', '#0079CC', '#CD853F', '#6f42c1', '#20c997', '#fd7e14'];


  filterList$: BehaviorSubject<Array<FieldFilter>> = new BehaviorSubject<Array<FieldFilter>>([]);

  aggregateFields: Array<AggregateFields> = [
    {
      AggregateFunction: 'count',
      AggregateField: 'ApprovalStage'
    },
    {
      AggregateFunction: 'count',
      AggregateField: 'RFPResponseDueDate'
    },
    {
      AggregateFunction: 'sum',
      AggregateField: 'Amount'
    }
  ]

  filterOptions: FilterOptions = {
    visibleFields: [
      'ApprovalStage',
      'CreatedDate',
      'RFPResponseDueDate',
      'GrandTotal',
      'BillToAccount',
      'ShipToAccount',
    ],
    visibleOperators: [
      Operator.EQUAL,
      Operator.NOT_EQUAL,
      Operator.IN,
      Operator.LESS_THAN,
      Operator.LESS_EQUAL,
      Operator.GREATER_THAN,
      Operator.GREATER_EQUAL,
      Operator.LIKE
    ]
  };
  customfilter: Array<CustomFilterView> = [
    {
      label: 'Pending Duration',
      mapApiField: 'RFPResponseDueDate',
      type: 'double',
      minVal: -99,
      execute: (val: number, condition: any): Date => {
        return this.handlePendingDuration(val, condition);
      }
    }
  ];
  quoteFields: Array<string | QuickAddField>;
  isExternalUser: boolean = false;
  quickAddPresetFields: Record<string, any> = { SourceChannel: 'E-Commerce' };

  // Columns rendered in the quote list, from the 'Quote List' section of the displayColumns API;
  // empty means the storefront has no configuration, so the built-in columns are used.
  private configuredColumns: Array<DisplayColumn> = [];

  constructor(private quoteService: QuoteService, private currencyPipe: LocalCurrencyPipe, private dateFormatPipe: DateFormatPipe, private accountService: AccountService, private exceptionService: ExceptionService, private storefrontService: StorefrontService, private displayColumnService: DisplayColumnService, private userService: UserService, private contactService: ContactService) { }

  ngOnInit() {
    this.loadColumnConfig();
    // External (Contact) users have a single contact; preset it read-only on the quick add form (parity with checkout).
    this.userService.isExternalUser().pipe(
      tap(isExternal => this.isExternalUser = isExternal),
      filter(isExternal => isExternal),
      switchMap(() => this.userService.getUserContactMapping()),
      filter(mapping => get(mapping, 'ContactObjectName') === 'Contact' && !isNil(get(mapping, 'ContactObjectId'))),
      map(mapping => get(mapping, 'ContactObjectId')),
      switchMap(contactId => this.contactService.getContactById(contactId)),
      take(1)
    ).subscribe((contact: Contact) => {
      this.quickAddPresetFields = { ...this.quickAddPresetFields, PrimaryContact: contact };
    });
  }

  // Reads the 'Quote List' column configuration once, then renders the view either way.
  private loadColumnConfig(): void {
    this.storefrontService.getStorefront().pipe(
      take(1),
      switchMap((storefront) => {
        const flow = get(storefront, 'DefaultFlow') || 'system';
        return this.storefrontService.getStorefrontDisplayColumns(flow, get(storefront, 'Id'));
      }),
      catchError(() => of<Array<DisplayColumn>>([]))
    ).subscribe((response) => {
      this.configuredColumns = this.displayColumnService.columnsForSection(response, DisplayColumnSection.QuoteList);
      this.loadView();
    });
  }

  // The built-in quote list columns, used when the storefront has no configuration.
  private getDefaultColumns(): Array<TableColumn> {
    return [
      {
        prop: 'ProposalNumber',
        enableRouteLink: true
      },
      {
        prop: 'Name',
        label: 'COMMON.NAME'
      },
      {
        prop: 'ApprovalStage'
      },
      {
        prop: 'RFPResponseDueDate',
        value: (record: Quote) => this.getDateFormat(record, 'RFPResponseDueDate')
      },
      {
        prop: 'PriceList',
        sortable: false
      },
      {
        prop: 'GrandTotal',
        label: 'CUSTOM_LABELS.TOTAL_AMOUNT',
        value: (record) => {
          return this.currencyPipe.transform(get(get(record, 'Amount'), 'DisplayValue'));
        }
      },
      {
        prop: 'Account',
        label: 'CUSTOM_LABELS.ACCOUNT',
        sortable: false
      },
      {
        prop: 'ModifiedDate',
        label: 'CUSTOM_LABELS.LAST_MODIFIED_DATE',
        value: (record: Quote) => this.getDateFormat(record, 'ModifiedDate')
      }
    ];
  }

  loadView() {
    let tableOptions = {} as QuoteListView;
    this.view$ = this.accountService.getCurrentAccount()
      .pipe(
        switchMap((account) => {
          // Scope the Primary Contact lookup to the current account (parity with checkout).
          this.quoteFields = ['Description', 'BillToAccount', 'ShipToAccount', 'SourceChannel',
            { field: 'PrimaryContact', required: true, lookupOptions: { primaryTextField: 'Name', filters: [{ field: 'Account.Id', value: get(account, 'Id'), filterOperator: FilterOperator.EQUAL }] } }];
          const columns = this.displayColumnService.toTableColumns(this.configuredColumns, this.getDefaultColumns(), (column) => this.displayColumnService.formatColumnValue(column));
          tableOptions = {
            tableOptions: {
              columns: columns,
              filters: this.filterList$.value.concat(this.getFilters()),
              routingLabel: 'proposals',
              callback: (recordList?: Array<Quote>) => {
                if (recordList && recordList.length > 0) {
                  return combineLatest(
                    recordList.map((record) => this.updateQuoteValue(record)));
                }
                return of([]);
              }
            }
          }
          return of(tableOptions);
        })
      );
    this.getChartData();
  }

  getChartData() {
    const queryFields = ['ApprovalStage', 'RFPResponseDueDate'];
    const groupByFields = ['ApprovalStage', 'RFPResponseDueDate'];
    return this.quoteService.getQuoteAggregatesByApprovalStage(null, this.aggregateFields, queryFields, groupByFields, this.filterList$.value)
      .pipe(
        take(1),
        catchError(error => {
          this.totalRecords$ = of(0);
          this.totalAmount$ = of(0);
          this.amountsByStatus$ = of({});
          this.quotesByStatus$ = of({});
          this.exceptionService.showError(error, 'ERROR.INVALID_REQUEST_ERROR_TOASTR_TITLE');
          return of([]);
        })
      )
      .subscribe((data: any[]) => {
        const groupedByStatus = groupBy(data, 'ApprovalStage');
        const totalRecords = get(data,'total_records') ?? sumBy(data, 'count(ApprovalStage)');
        const totalAmount = sumBy(data, 'sum(Amount)');

        this.totalRecords$ = of(totalRecords || 0);
        this.totalAmount$ = of(totalAmount || 0);
        this.amountsByStatus$ = of(omit(mapValues(groupedByStatus, (s) => sumBy(s, 'sum(Amount)')), 'null'));
        this.quotesByStatus$ = of(omit(mapValues(groupedByStatus, (s) => sumBy(s, 'count(ApprovalStage)')), 'null'));
      });
  }

  handleFilterListChange(event: any) {
    this.filterList$.next(event);
    this.loadView();
  }

  handlePendingDuration(val: number, condition: any): Date {
    const date = moment(new Date()).format('YYYY-MM-DD');
    let momentdate;
    if (condition.filterOperator === 'GreaterThan')
      momentdate = moment(date).add(val, 'd').format('YYYY-MM-DD');
    else if (condition.filterOperator === 'LessThan')
      momentdate = moment(date).subtract(val, 'd').format('YYYY-MM-DD');
    return momentdate;
  }

  getDateFormat(record: Quote, field: string, dateTimeFormat: string = 'ShortDatePattern'): Observable<string> {
    const dateValue = get(record, field);
    if (!dateValue) return of('');
    return this.dateFormatPipe.transform(dateValue, dateTimeFormat);
  }

  getFilters(): Array<FieldFilter> {
    return [{
      field: 'Account.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  updateQuoteValue(quote: Quote): Observable<Quote> {
    return this.quoteService.updateQuoteValue(quote, {
      fetchContact: this.isColumnConfigured('PrimaryContact'),
      fetchBillToAccount: this.isColumnConfigured('BillToAccount'),
      fetchShipToAccount: this.isColumnConfigured('ShipToAccount'),
      fetchLocation: false
    }).pipe(
      take(1),
      map((updatedQuote: Quote) => {
        return updatedQuote;
      })
    );
  }

  // A configured lookup column needs its related record fetched so its quick-view popover populates.
  private isColumnConfigured(fieldName: string): boolean {
    return this.configuredColumns.some(column => {
      const configuredField = get(column, 'FieldName', '');
      return configuredField === fieldName || configuredField.startsWith(`${fieldName}.`);
    });
  }
}

interface QuoteListView {
  tableOptions: TableOptions;
}