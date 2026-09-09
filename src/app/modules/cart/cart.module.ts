import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PopoverModule as BSPopoverModule } from 'ngx-bootstrap/popover';
import { CartRoutingModule } from './cart-routing.module';
import { CartComponent } from './layout/cart.component';
import { SecureCheckoutComponent } from './layout/secure-checkout/secure-checkout.component';
import { SummaryComponent } from './component/summary.component';
import {
  ConfigurationSummaryModule,
  PaymentComponentModule,
  OutputFieldModule,
  MiniProfileModule,
  BreadcrumbModule,
  PriceSummaryModule,
  InputFieldModule,
  AddressModule,
  PriceModule,
  IconModule,
  CaptchaModule,
  FileUploaderModule,
  PaymentIntegrationModule,
  WizardModule,
  TaxBreakupModule,
  LocationPickerModule
} from '@congarevenuecloud/elements';

import { ComponentModule } from '../../components/component.module';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { ModalModule } from 'ngx-bootstrap/modal';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { TranslateModule } from '@ngx-translate/core';
import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';

@NgModule({
  imports: [
    CommonModule,
    CartRoutingModule,
    FormsModule,
    ComponentModule,
    CaptchaModule,
    ConfigurationSummaryModule,
    PriceModule,
    IconModule,
    TabsModule,
    ModalModule,
    AddressModule,
    CongaModule,
    PaymentComponentModule,
    PaymentIntegrationModule,
    OutputFieldModule,
    TooltipModule,
    TranslateModule.forChild(),
    BsDropdownModule,
    MiniProfileModule,
    BreadcrumbModule,
    PriceSummaryModule,
    InputFieldModule,
    PricingModule,
    FileUploaderModule,
    WizardModule,
    TaxBreakupModule,
    BSPopoverModule,
    PaginationModule,
    LocationPickerModule
  ],
  declarations: [CartComponent, SecureCheckoutComponent, SummaryComponent],
  exports : [SummaryComponent]
})

export class CartModule { }
