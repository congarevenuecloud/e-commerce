import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { ModalModule } from 'ngx-bootstrap/modal';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TranslateModule } from '@ngx-translate/core';

import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import {
  ProductCarouselModule, ConfigurationSummaryModule, PriceModule, PromotionModule, InputDateModule,
  LineItemTableRowModule, BreadcrumbModule, IconModule, PriceSummaryModule, OutputFieldModule,
  AlertModule, ConstraintRuleModule, SelectAllModule, ButtonModule, InputFieldModule, PipesModule
} from '@congarevenuecloud/elements';

import { ComponentModule } from '../../components/component.module';
import { ManageCartRoutingModule } from './manage-cart-routing.module';
import { QuoteModule } from '../quote/quote.module';
import { CartTableComponent } from './component/cart-table/cart-table.component';
import { CartSummaryComponent } from './component/cart-summary/cart-summary.component';
import { ManageCartComponent } from './layout/manage-cart.component';

@NgModule({
  imports: [
    CongaModule,
    CommonModule,
    PromotionModule,
    ManageCartRoutingModule,
    ProductCarouselModule,
    PricingModule,
    FormsModule,
    ComponentModule,
    ConfigurationSummaryModule,
    PriceModule,
    PromotionModule,
    OutputFieldModule,
    TabsModule.forRoot(),
    ModalModule.forRoot(),
    BsDatepickerModule.forRoot(),
    PopoverModule.forRoot(),
    InputDateModule,
    TranslateModule.forChild(),
    LineItemTableRowModule,
    QuoteModule,
    BreadcrumbModule,
    IconModule,
    PriceSummaryModule,
    AlertModule,
    ConstraintRuleModule,
    SelectAllModule,
    ButtonModule,
    InputFieldModule,
    PipesModule
  ],
  declarations: [ManageCartComponent, CartTableComponent, CartSummaryComponent]
})
export class ManageCartModule { }
