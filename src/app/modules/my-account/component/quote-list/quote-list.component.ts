import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { switchMap, take, catchError, map } from 'rxjs/operators';
import moment from 'moment';
import { get, sumBy, mapValues, groupBy, omit } from 'lodash';
import { Operator, FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { Quote, QuoteService, LocalCurrencyPipe, AccountService, FieldFilter, DateFormatPipe, GroupByAggregateResponse, AggregateFields } from '@congarevenuecloud/ecommerce';
import { TableOptions, CustomFilterView, FilterOptions, ExceptionService } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-quote-list',
  templateUrl: './quote-list.component.html',
  styleUrls: ['./quote-list.component.scss']
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
  quoteFields: string[];

  constructor(private quoteService: QuoteService, private currencyPipe: LocalCurrencyPipe, private dateFormatPipe: DateFormatPipe, private accountService: AccountService, private exceptionService: ExceptionService) { }

  ngOnInit() {
    this.loadView();
    this.quoteFields = ['Description', 'BillToAccount', 'ShipToAccount', 'SourceChannel'];
  }

  loadView() {
    let tableOptions = {} as QuoteListView;
    this.view$ = this.accountService.getCurrentAccount()
      .pipe(
        switchMap(() => {
          tableOptions = {
            tableOptions: {
              columns: [
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
              ],
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
      fetchContact: false,
      fetchBillToAccount: false,
      fetchShipToAccount: false
    }).pipe(
      take(1),
      map((updatedQuote: Quote) => {
        return updatedQuote;
      })
    );
  }
}

interface QuoteListView {
  tableOptions: TableOptions;
}