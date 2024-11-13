import { Component, EventEmitter, Output, Input } from '@angular/core';
import {AssetActionLabels} from '@congarevenuecloud/ecommerce';

@Component({
  selector: 'app-asset-action-filter',
  template: `
    <div class="card animated fadeIn">
      <div class="card-body">
        <h5 class="card-title">{{'INSTALLED_PRODUCTS.ASSET_ACTION_FILTER.ASSET_ACTION' | translate}} </h5>
        <ul class="list-unstyled pl-2">
          <li>
            <div class="custom-control custom-radio">
              <input
                #all
                type="radio"
                id="assetActionAll"
                class="custom-control-input"
                name="assetAction"
                value="All"
                (change)="handleChange($event)"
                [checked]="value === 'All' || value == null"
              >
              <label class="custom-control-label pt-1" for="assetActionAll">
                {{'INSTALLED_PRODUCTS.PRICE_TYPE_FILTER.ALL' | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                #renew
                type="radio"
                id="renew"
                class="custom-control-input"
                name="assetAction"
                value="Renew"
                (change)="handleChange($event)"
                [checked]="value === 'Renew'"
              >
              <label class="custom-control-label pt-1" for="renew">
                {{labels?.renewLabel | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                #amend
                type="radio"
                id="amend"
                class="custom-control-input"
                name="assetAction"
                value="Amend"
                (change)="handleChange($event)"
                [checked]="value === 'Amend'"
              >
              <label class="custom-control-label pt-1" for="amend">
                {{labels?.amendLabel | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                #terminate
                type="radio"
                id="terminate"
                class="custom-control-input"
                name="assetAction"
                value="Terminate"
                (change)="handleChange($event)"
                [checked]="value === 'Terminate'" >
              <label class="custom-control-label pt-1" for="terminate">
                {{labels?.terminateLabel | translate}}
              </label>
            </div>
          </li>
          <li class="pt-1">
            <div class="custom-control custom-radio">
              <input
                #buyMore
                type="radio"
                id="buyMore"
                class="custom-control-input"
                name="assetAction"
                value="Buy More"
                (change)="handleChange($event)"
                [checked]="value === 'Buy More'">
              <label class="custom-control-label pt-1" for="buyMore">
                {{labels?.buyMoreLabel| translate}}
              </label>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `
})
export class AssetActionFilterComponent {
  /**
   * The property specifies the asset action value. defaulted to 'All' if not provided.
   */
  @Input() value: string = 'All';
  /**
   * Labels for asset actions
   */
  @Input() labels:AssetActionLabels
  /**
   * Event emitter for the asset action value of the filter.
   */
  @Output() valueChange: EventEmitter<string> = new EventEmitter();

  /**
   * Event handler for when the asset action filter value changes.
   * @param event Event that was fired.
   */
  handleChange(event: any) {
    this.valueChange.emit(event.target.value);
  }
}
