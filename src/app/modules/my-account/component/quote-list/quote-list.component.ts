import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map as rmap, switchMap, take, catchError } from 'rxjs/operators';
import moment from 'moment';
import { get, sumBy, map as _map, mapValues, groupBy, omit } from 'lodash';
import { Operator, ApiService, FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { Quote, QuoteService, LocalCurrencyPipe, AccountService, FieldFilter, QuoteResult, DateFormatPipe, GroupByAggregateResponse, AggregateFields } from '@congarevenuecloud/ecommerce';
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
  businessObjectFields: string[];
  constructor(private quoteService: QuoteService, private currencyPipe: LocalCurrencyPipe, private dateFormatPipe: DateFormatPipe, private accountService: AccountService, private apiService: ApiService, private exceptionService: ExceptionService) { }

  ngOnInit() {
    this.loadView();
    this.businessObjectFields = ['Description', 'BillToAccount', 'ShipToAccount', 'SourceChannel'];
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
                  prop: 'RFPResponseDueDate'
                },
                {
                  prop: 'PriceList',
                  label: 'CUSTOM_LABELS.PRICELIST'
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
                  label: 'CUSTOM_LABELS.ACCOUNT'
                },
                {
                  prop: 'ModifiedDate',
                  label: 'CUSTOM_LABELS.LAST_MODIFIED_DATE',
                  value: (record: Quote) => this.getDateFormat(record)
                }
              ],
              filters: this.filterList$.value.concat(this.getFilters()),
              routingLabel: 'proposals'
            }
          }
          this.fetchQuoteTotals();
          return of(tableOptions);
        })
      );
    this.getChartData();
  }

  getChartData() {
    const queryFields = ['ApprovalStage', 'RFPResponseDueDate'];
    const groupByFields = ['ApprovalStage', 'RFPResponseDueDate'];
    return this.quoteService.getQuoteAggregatesByApprovalStage(null, this.aggregateFields, queryFields, groupByFields, this.filterList$.value).pipe(take(1)).subscribe((data) => {
      this.amountsByStatus$ = of(omit(mapValues(groupBy(data, 'ApprovalStage'), (s) => sumBy(s, 'sum(Amount)')), 'null'));
      this.quotesByStatus$ = of(omit(mapValues(groupBy(data, 'ApprovalStage'), (s) => sumBy(s, 'count(ApprovalStage)')), 'null'));
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

  getDateFormat(record: Quote) {
    return this.dateFormatPipe.transform(get(record, 'CreatedDate'));
  }

  getFilters(): Array<FieldFilter> {
    return [{
      field: 'Account.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  fetchQuoteTotals() {
    this.quoteService.getMyQuotes(null, this.filterList$.value.concat(this.getFilters()), null, null, null, null, null, false)
      .pipe(
        rmap((quoteResult: QuoteResult) => {
          this.totalRecords$ = quoteResult ? of(get(quoteResult, 'TotalCount')) : of(0);
          this.totalAmount$ = of(sumBy(get(quoteResult, 'Quotes'), (quote) => get(quote, 'Amount.Value')));
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
}

interface QuoteListView {
  tableOptions: TableOptions;
}