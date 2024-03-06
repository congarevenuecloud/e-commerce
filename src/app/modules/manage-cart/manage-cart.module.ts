import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManageCartRoutingModule } from './manage-cart-routing.module';
import { ManageCartComponent } from './layout/manage-cart.component';
import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { ComponentModule } from '../../components/component.module';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { ModalModule } from 'ngx-bootstrap/modal';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { CartTableComponent } from './component/cart-table/cart-table.component';
import { CartSummaryComponent } from './component/cart-summary/cart-summary.component';
import { DatepickerModule, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import {
  ProductCarouselModule, ConfigurationSummaryModule, PriceModule, PromotionModule, InputDateModule,
  LineItemTableRowModule, BreadcrumbModule, IconModule, PriceSummaryModule, OutputFieldModule,
  AlertModule, ConstraintRuleModule, SelectAllModule, ButtonModule, InputFieldModule
} from '@congarevenuecloud/elements';
import { TranslateModule } from '@ngx-translate/core';
import { QuoteModule } from '../quote/quote.module';

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
    DatepickerModule.forRoot(),
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
    InputFieldModule
  ],
  declarations: [ManageCartComponent, CartTableComponent, CartSummaryComponent]
})
export class ManageCartModule { }
