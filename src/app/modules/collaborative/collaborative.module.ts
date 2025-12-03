import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LaddaModule } from 'angular2-ladda';
import { TranslateModule } from '@ngx-translate/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { ModalModule } from 'ngx-bootstrap/modal';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { TooltipModule } from 'ngx-bootstrap/tooltip';

import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import {
  ProductCarouselModule, ConfigurationSummaryModule, PriceModule, PromotionModule, InputDateModule,
  LineItemTableRowModule, BreadcrumbModule, IconModule, PriceSummaryModule, OutputFieldModule,
  AlertModule, ConstraintRuleModule, SelectAllModule, ButtonModule, InputFieldModule, PipesModule,
  CommentsModule, FileUploaderModule
} from '@congarevenuecloud/elements';

import { CollaborativeRoutingModule } from './collaborative-routing.module';
import { CollaborativeQuoteDetailsComponent } from './layout/collaborative-quote/collaborative-quote-details.component';
import { CollaborativeCartComponent } from './layout/collaborative-cart/collaborative-cart.component';
import { ComponentModule } from '../../components/component.module';
import { QuoteModule } from '../quote/quote.module';
import { DetailsModule } from '../details/details.module';


@NgModule({
  declarations: [
    CollaborativeQuoteDetailsComponent,
    CollaborativeCartComponent
  ],
  imports: [
    CommonModule,
    CollaborativeRoutingModule,
    CongaModule,
    PricingModule,
    FormsModule,
    ComponentModule,
    ConfigurationSummaryModule,
    PriceModule,
    PromotionModule,
    ProductCarouselModule,
    OutputFieldModule,
    TabsModule.forRoot(),
    ModalModule.forRoot(),
    BsDatepickerModule.forRoot(),
    PopoverModule.forRoot(),
    TooltipModule.forRoot(),
    InputDateModule,
    TranslateModule.forChild(),
    LineItemTableRowModule,
    LaddaModule,
    NgScrollbarModule,
    QuoteModule,
    DetailsModule,
    BreadcrumbModule,
    IconModule,
    PriceSummaryModule,
    AlertModule,
    ConstraintRuleModule,
    SelectAllModule,
    ButtonModule,
    InputFieldModule,
    PipesModule,
    CommentsModule,
    FileUploaderModule
  ]
})
export class CollaborativeModule { }