import { Component, Output, EventEmitter } from '@angular/core';
import { SimpleDate } from '@congarevenuecloud/core';
import { FieldFilter } from '@congarevenuecloud/ecommerce';
import { FilterOperator } from '@congarevenuecloud/core';

@Component({
  selector: 'app-renewal-filter',
  template: `
    <div class="card animated fadeIn">
      <div class="card-body">
        <form>
          <h5 class="card-title">{{'INSTALLED_PRODUCTS.RENEW_FILTER.DAYS_TO_RENEW' | translate}}</h5>
          <ul class="list-unstyled pl-2">
            <li>
              <div class="custom-control custom-radio">
                <input
                  type="radio"
                  id="all"
                  class="custom-control-input"
                  name="renewRadio"
                  value="all"
                  (change)="handleCheckChange($event)"
                  checked
                >
                <label class="custom-control-label pt-1" for="all">
                {{'INSTALLED_PRODUCTS.RENEW_FILTER.ALL' | translate}}
                </label>
              </div>
            </li>
            <li class="pt-1">
              <div class="custom-control custom-radio">
                <input
                  type="radio"
                  id="less30"
                  class="custom-control-input"
                  name="renewRadio"
                  value="less30"
                  (change)="handleCheckChange($event)"
                >
                <label class="custom-control-label pt-1" for="less30">
                {{'INSTALLED_PRODUCTS.RENEW_FILTER.LT30DAYS' | translate}}
                </label>
              </div>
            </li>
            <li class="pt-1">
              <div class="custom-control custom-radio">
                <input
                  type="radio"
                  id="30-60"
                  class="custom-control-input"
                  name="renewRadio"
                  value="30-60"
                  (change)="handleCheckChange($event)"
                >
                  <label class="custom-control-label pt-1" for="30-60">
                  {{'INSTALLED_PRODUCTS.RENEW_FILTER.LT60DAYS' | translate}}
                </label>
              </div>
            </li>
            <li class="pt-1">
              <div class="custom-control custom-radio">
                <input
                  type="radio"
                  id="60-90"
                  class="custom-control-input"
                  name="renewRadio"
                  value="60-90"
                  (change)="handleCheckChange($event)"
                >
                <label class="custom-control-label pt-1" for="60-90">
                {{'INSTALLED_PRODUCTS.RENEW_FILTER.LT90DAYS' | translate}}
                </label>
              </div>
            </li>
            <li class="pt-1">
              <div class="custom-control custom-radio">
                <input
                  type="radio"
                  id="more90"
                  class="custom-control-input"
                  name="renewRadio"
                  value="more90"
                  (change)="handleCheckChange($event)"
                >
                <label class="custom-control-label pt-1" for="more90">
                {{'INSTALLED_PRODUCTS.RENEW_FILTER.GT90DAYS' | translate}}
                </label>
              </div>
            </li>
          </ul>
        </form>
      </div>
    </div>
  `
})
export class RenewalFilterComponent {
  /**
   * Event emitter for the current value of this control.
   */
  @Output() value: EventEmitter<FieldFilter> = new EventEmitter<any>();
  /**
   * Map of checkbox values to AConditions used for the event emitter.
   */
  private eventMap = {
    'all': {
      field: 'EndDate',
      value: null,
      filterOperator: FilterOperator.NOT_EQUAL
    } as FieldFilter,
    'less30': {
      field: 'EndDate',
      value: this.dateGetter(30),
      filterOperator: FilterOperator.LESS_EQUAL
    } as FieldFilter,
    '30-60': {
      field: 'EndDate',
      value: this.dateGetter(60),
      filterOperator: FilterOperator.LESS_EQUAL
    } as FieldFilter,
    '60-90': {
      field: 'EndDate',
      value: this.dateGetter(90),
      filterOperator: FilterOperator.LESS_EQUAL
    } as FieldFilter,
    'more90': {
      field: 'EndDate',
      value: this.dateGetter(90),
      filterOperator: FilterOperator.GREATER_THAN
    } as FieldFilter
  };
  /**
   * Event handler for when the checkbox value changes.
   * @param event Event that was fired.
   */
  handleCheckChange(event: any) {
    this.value.emit(this.eventMap[event.target.value]);
  }
  /**
   * Gets SimpleDate objects with the value set to today plus the given number of days.
   * @param days Number of days from today to get date.
   */
  private dateGetter(days: number): SimpleDate {
    let today = new Date();
    today.setDate(today.getDate() + days);
    let date = new SimpleDate(today);
    return date;
  }

}
