import { Component, Output, EventEmitter } from '@angular/core';
import { FieldFilter } from '@congarevenuecloud/ecommerce';
import { FilterOperator } from '@congarevenuecloud/core';

@Component({
  selector: 'app-price-type-filter',
  template: `
    <div class="card animated fadeIn">
      <div class="card-body">
        <h5 class="card-title">{{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.PRICE_TYPE' | translate}} </h5>
        <ul class="list-unstyled pl-2">
          <li>
            <div class="custom-control custom-radio">
              <input
                type="radio"
                  id="priceTypeAll"
                  class="custom-control-input"
                  name="priceType"
                  value=""
                  (change)="handleCheckChange($event)"
                  checked
                >
              <label class="custom-control-label pt-1" for="priceTypeAll">
              {{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.ALL' | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                type="radio"
                id="oneTime"
                class="custom-control-input"
                name="priceType"
                value="One Time"
                (change)="handleCheckChange($event)"
              >
              <label class="custom-control-label pt-1" for="oneTime">
              {{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.ONE_TIME' | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                type="radio"
                id="recurring"
                class="custom-control-input"
                name="priceType"
                value="Recurring"
                (change)="handleCheckChange($event)"
              >
              <label class="custom-control-label pt-1" for="recurring">
              {{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.RECURRING' | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                type="radio"
                id="usage"
                class="custom-control-input"
                name="priceType"
                value="Usage"
                (change)="handleCheckChange($event)"
              >
              <label class="custom-control-label pt-1" for="usage">
              {{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.USAGE' | translate}}
              </label>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `
})
export class PriceTypeFilterComponent {
  /**
   * Event emitter for the value of the filter.
   */
  @Output() value: EventEmitter<FieldFilter> = new EventEmitter();
  private eventMap = {
    /**
     * Filter for 'One Time' price type assets.
     */
    'One Time': {
      field: 'PriceType',
      value: 'One Time',
      filterOperator: FilterOperator.EQUAL
    } as FieldFilter,
    /**
     * Filter for 'Recurring' price type assets.
     */
    'Recurring': {
      field: 'PriceType',
      value: 'Recurring',
      filterOperator: FilterOperator.EQUAL
    } as FieldFilter,
    /**
     * Filter for 'Usage' price type assets.
     */
    'Usage': {
      field: 'PriceType',
      value: 'Usage',
      filterOperator: FilterOperator.EQUAL
    } as FieldFilter,
  };
  /**
   * Event handler for when a checkbox value has been changed.
   * @param event Event object that was fired.
   */
  handleCheckChange(event: any) {
    this.value.emit(this.eventMap[event.target.value]);
  }
}
