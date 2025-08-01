import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LaddaModule } from 'angular2-ladda';
import { TranslateModule } from '@ngx-translate/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TooltipModule } from 'ngx-bootstrap/tooltip';

import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import {
  PriceModule, BreadcrumbModule, InputFieldModule, AddressModule, IconModule, LineItemTableRowModule,
  PriceSummaryModule, ButtonModule, CaptchaModule, OutputFieldModule, FileUploaderModule
} from '@congarevenuecloud/elements';

import { DetailsModule } from '../details/details.module';
import { QuoteRoutingModule } from './quote-routing.module';
import { CartModule } from '../cart/cart.module';
import { CreateQuoteComponent } from './layout/quote-create/create-quote.component';
import { RequestQuoteFormComponent } from './component/request-quote-form/request-quote-form.component';
import { QuoteDetailsComponent } from './layout/quote-details/quote-details.component';
import { ComponentModule } from '../../components/component.module';


@NgModule({
  imports: [
    CommonModule,
    CaptchaModule,
    TooltipModule,
    CongaModule,
    QuoteRoutingModule,
    FormsModule,
    PriceModule,
    PricingModule,
    TabsModule.forRoot(),
    BsDatepickerModule.forRoot(),
    BreadcrumbModule,
    InputFieldModule,
    AddressModule,
    IconModule,
    DetailsModule,
    TranslateModule.forChild(),
    OutputFieldModule,
    LineItemTableRowModule,
    LaddaModule,
    NgScrollbarModule,
    PriceSummaryModule,
    CartModule,
    ButtonModule,
    FileUploaderModule,
    ComponentModule
  ],
  declarations: [CreateQuoteComponent, RequestQuoteFormComponent, QuoteDetailsComponent]
})
export class QuoteModule { }
