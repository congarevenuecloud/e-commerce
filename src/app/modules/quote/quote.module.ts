import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuoteRoutingModule } from './quote-routing.module';
import { CreateQuoteComponent } from './layout/quote-create/create-quote.component';
import { RequestQuoteFormComponent } from './component/request-quote-form/request-quote-form.component';
import { TranslateModule } from '@ngx-translate/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { PriceModule, BreadcrumbModule, InputFieldModule, AddressModule, IconModule, LineItemTableRowModule, PriceSummaryModule, ButtonModule, CaptchaModule } from '@congarevenuecloud/elements';
import { DatepickerModule, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { FormsModule } from '@angular/forms';
import { DetailsModule } from '../details/details.module';
import { QuoteDetailsComponent } from './layout/quote-details/quote-details.component';
import { OutputFieldModule } from '@congarevenuecloud/elements';
import { LaddaModule } from 'angular2-ladda';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { CartModule } from '../cart/cart.module';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { CongaModule } from '@congarevenuecloud/core';

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
    DatepickerModule.forRoot(),
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
    ButtonModule
  ],
  declarations: [CreateQuoteComponent, RequestQuoteFormComponent, QuoteDetailsComponent]
})
export class QuoteModule { }
