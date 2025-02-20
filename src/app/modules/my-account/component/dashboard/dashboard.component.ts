import { Component, OnInit } from '@angular/core';
import { Observable, of, Subscription } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { sumBy, get, defaultTo, forEach, filter, isEmpty, omit, mapValues, groupBy, size, reduce, pickBy } from 'lodash';
import { ApiService, FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { OrderService, Order, UserService, User, FieldFilter, AccountService, LocalCurrencyPipe, QuoteService, Quote, OrderResult, QuoteResult, DateFormatPipe } from '@congarevenuecloud/ecommerce';
import { TableOptions } from '@congarevenuecloud/elements';

import moment from 'moment';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  orderType = Order;
  quoteType = Quote;

  user$: Observable<User>;
  subscription: Subscription;
  totalOrderAmount$: Observable<number>;
  totalOrderRecords$: Observable<number>;
  totalQuoteAmount$: Observable<number>;
  totalQuoteRecords$: Observable<number>;
  orderAmountByStatus$: Observable<number>;
  view$: Observable<TableOptions>;
  quoteView$: Observable<TableOptions>;
  categorizedOrders$: Observable<Object>;
  quotesByDueDateData$: Observable<Object>;
  minDaysFromDueDate: number = 7;
  maxDaysFromDueDate: number = 14;
  colorPalette = [];
  totalCount: number;

  constructor(private orderService: OrderService, private currencyPipe: LocalCurrencyPipe, private userService: UserService, private apiService: ApiService, private accountService: AccountService, private quoteService: QuoteService, private dateFormatPipe: DateFormatPipe) { }

  ngOnInit() {
    this.loadView();
  }

  loadView() {
    this.view$ = this.accountService.getCurrentAccount().pipe(
      map(() => {
        this.totalOrderRecords$ = this.orderService.getMyOrders(null, null, this.getOrderFilters()).pipe(map(orderResult => defaultTo(get(orderResult, 'TotalCount'), 0)))
        this.totalOrderAmount$ = this.orderService.getMyOrders(null, null, this.getFilterForAmount(), null, null, null, null, null, false).pipe(map((orderResult: OrderResult) => {
          const orders = get(orderResult, 'Orders', []);
          this.categorizeOrdersByAge(orders);
          return sumBy(orders, (order) => get(order, 'OrderAmount.DisplayValue'));
        })
        );
        this.totalQuoteRecords$ = this.quoteService.getMyQuotes(null, this.getQuoteFilters(), null, null, null, null, null, false).pipe(map(quoteResult => defaultTo(get(quoteResult, 'TotalCount'), 0)))
        this.totalQuoteAmount$ = this.quoteService.getMyQuotes(null, this.getQuoteFilterForAmount(), null, null, null, 'CreatedDate', 'DESC', false).pipe(
          map((quoteResult: QuoteResult) => {
            const quotes = get(quoteResult, 'Quotes', []);
            this.totalCount = get(quoteResult, 'TotalCount');

            // Group quotes by 'RFPResponseDueDate' and count the number of quotes for each due date.
            const quotesCountByDueDate = mapValues(pickBy(groupBy(quotes, 'RFPResponseDueDate'), (value, date) => date !== 'null'),
              group => size(group));
            const categorizedQuoteCounts = reduce(quotesCountByDueDate, (quotesByCategory, quoteCount, dueDate) => {
              const categoryLabel = this.generateLabel(dueDate); // Generate a category label based on the due dates
              quotesByCategory[categoryLabel] = (quotesByCategory[categoryLabel] || 0) + quoteCount; // Group the quote count by each category label based on the due dates
              return quotesByCategory; // Return the updated object
            }, {});
            this.quotesByDueDateData$ = of(omit(categorizedQuoteCounts, 'null'));

            return sumBy(quotes, (quote) => get(quote, 'Amount.DisplayValue'));
          })
        );
        this.quoteView$ = of({
          tableOptions: {
            columns: [
              {
                prop: 'ProposalNumber',
                enableRouteLink: true  
              },
              {
                prop: 'Name'
              },
              {
                prop: 'GrandTotal',
                label: 'CUSTOM_LABELS.TOTAL_AMOUNT',
                value: (record) => {
                  return this.currencyPipe.transform(get(get(record, 'Amount'), 'DisplayValue'));
                }
              },
              {
                prop: 'CreatedDate',
                label: 'CUSTOM_LABELS.CREATED_DATE',
                value: (record) => this.getDateFormat(record)
              }
            ],
            filters: this.getQuoteFilters(),
            limit: 5,
            routingLabel: 'proposals'
          },
        } as unknown as TableOptions);
        return {
          tableOptions: {
            columns: [
              {
                prop: 'OrderNumber',
                enableRouteLink: true
              },
              {
                prop: 'Name',
                label: 'COMMON.NAME'
              },
              {
                prop: 'OrderAmount'
              },
              {
                prop: 'CreatedDate',
                label: 'CUSTOM_LABELS.CREATED_DATE',
                value: (record) => this.getDateFormat(record)
              }
            ],
            filters: this.getOrderFilters(),
            limit: 5,
            routingLabel: 'orders'
          },
        } as TableOptions;
      },
        take(1))
    );
    this.user$ = this.userService.getCurrentUser();
  }

  categorizeOrdersByAge(orders: Array<Order>): Observable<Object> {
    const currentDate = moment();
    const nonActivatedOrders = filter(orders, order => get(order, 'Status') !== 'Activated'); // Filter out orders where the status is not 'Activated'
    
    // If there are no non-activated orders, return an empty result
    if (isEmpty(nonActivatedOrders)){
      this.categorizedOrders$ = of({});  
      return;
    } 

    // Initialize counts for each category
    const categorizedOrders = { '>30 Days': 0, '20-30 Days': 0, '10-20 Days': 0, '<10 Days': 0 };

    forEach(nonActivatedOrders, (order) => {
      const createdDate = moment(get(order, 'CreatedDate'));
      if (!createdDate.isValid()){
        this.categorizedOrders$ = of({});
        return;
      };

      const differenceInDays = currentDate.diff(createdDate, 'days');
      // Determine which category the order falls into based on the age of the order
      const label = differenceInDays > 30 ? '>30 Days' :
                    differenceInDays >= 20 ? '20-30 Days' :
                    differenceInDays >= 10 ? '10-20 Days' : '<10 Days';
      categorizedOrders[label]++;
    });
    this.categorizedOrders$ = of(categorizedOrders);
  }

  private generateLabel(date): string {
    const dueDate = date ? moment(date) : null;
    if (!dueDate) return;

    const diffDays = Math.abs(dueDate.diff(moment(), 'days')); // Calculate the difference in days from today
    let label: string, color: string;

    // Determine label and color based on the difference in days
    if (diffDays < this.minDaysFromDueDate) {
        label = `< ${this.minDaysFromDueDate} Days`;
        color = 'rgba(208, 2, 27, 1)';
    } else if (diffDays < this.maxDaysFromDueDate) {
        label = `< ${this.maxDaysFromDueDate} Days`;
        color = 'rgba(245, 166, 35, 1)';
    } else {
        label = `> ${this.maxDaysFromDueDate} Days`;
        color = 'rgba(43, 180, 39, 1)';
    }
    // Check if the selected color is already in the colorPalette
    if (!this.colorPalette.includes(color)) 
      this.colorPalette.push(color); // Adds color to colorPalette if not already included
    return label;
}

  getOrderFilters(): Array<FieldFilter> {//Added timestamp in order to fetch order list data within 7 days
    return [{
      field: 'CreatedDate',
      value: moment().format("YYYY-MM-DDT23:59:59"),
      filterOperator: FilterOperator.LESS_EQUAL
    },
    {
      field: 'CreatedDate',
      value: moment().subtract(6, 'days').format("YYYY-MM-DDT00:00:00"),
      filterOperator: FilterOperator.GREATER_EQUAL
    },
    {
      field: 'SoldToAccount.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  getQuoteFilters(): Array<FieldFilter> {//Added timestamp in order to fetch quote list data within 7 days
    return [{
      field: 'CreatedDate',
      value: moment().format("YYYY-MM-DDT23:59:59"),
      filterOperator: FilterOperator.LESS_EQUAL
    },
    {
      field: 'CreatedDate',
      value: moment().subtract(6, 'days').format("YYYY-MM-DDT00:00:00"),
      filterOperator: FilterOperator.GREATER_EQUAL
    },
    {
      field: 'Account.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  getFilterForAmount(): Array<FieldFilter> {
    return [{
      field: 'SoldToAccount.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  getQuoteFilterForAmount(): Array<FieldFilter> {
    return [{
      field: 'Account.Id',
      value: localStorage.getItem(PlatformConstants.ACCOUNT),
      filterOperator: FilterOperator.EQUAL
    }] as Array<FieldFilter>;
  }

  getDateFormat(record: Order | Quote ) {
    return this.dateFormatPipe.transform(get(record, 'CreatedDate'));
  }

  ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
  }
}
