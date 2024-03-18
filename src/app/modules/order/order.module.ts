import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  OutputFieldModule,
  PriceModule,
  LineItemTableRowModule,
  BreadcrumbModule,
  PriceSummaryModule,
  ButtonModule,
  AddressModule,
  InputFieldModule,
  DataFilterModule,
  IconModule,
  AlertModule,
  TableModule,
  ChartModule,
  FilesModule
} from '@congarevenuecloud/elements';
import { OrderRoutingModule } from './order-routing.module';
import { DetailsModule } from '../details/details.module';
import { PricingModule } from '@congarevenuecloud/ecommerce';

import { TranslateModule }from'@ngx-translate/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { ComponentModule } from '../../components/component.module';
import { LaddaModule } from 'angular2-ladda';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { CongaModule } from '@congarevenuecloud/core';
import { OrderDetailComponent } from './layout/order-details/order-detail.component';


@NgModule({
  declarations: [OrderDetailComponent],
  imports: [
    CommonModule,
    CongaModule,
    OrderRoutingModule,
    TableModule,
    ChartModule,
    DetailsModule,
    OutputFieldModule,
    ComponentModule,
    PriceModule,
    LineItemTableRowModule,
    BreadcrumbModule,
    PriceSummaryModule,
    PricingModule,
    AddressModule,
    TranslateModule.forChild(),
    TooltipModule.forRoot(),
    NgScrollbarModule,
    ButtonModule,
    LaddaModule,
    InputFieldModule,
    DataFilterModule,
    IconModule,
    AlertModule,
    FilesModule
  ]
})
export class OrderModule { }
