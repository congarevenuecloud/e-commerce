import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule } from 'ngx-bootstrap/modal';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { PaginationModule } from 'ngx-bootstrap/pagination';

import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { IconModule, AddressModule, PriceModule, ConfigurationSummaryModule, BreadcrumbModule, InputFieldModule, OutputFieldModule, ChartModule, DataFilterModule, ConstraintRuleModule, AlertModule, TableModule,
QuickAddModule } from '@congarevenuecloud/elements';

import { MyAccountRoutingModule } from './my-account-routing.module';
import { MyAccountLayoutComponent } from './layout/my-account-layout.component';
import { OrderListComponent } from './component/order-list/order-list.component';
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { QuoteListComponent } from './component/quote-list/quote-list.component';
import { SettingsComponent } from './component/settings/settings.component';
import { ComponentModule } from '../../components/component.module';
import { CartListComponent } from './component/cart-list/cart-list.component';
import { FavoriteListComponent } from './component/favorite-list/favorite-list.component';


@NgModule({
  imports: [
    CommonModule,
    CongaModule,
    MyAccountRoutingModule,
    PricingModule,
    ComponentModule,
    IconModule,
    AddressModule,
    PriceModule,
    TableModule,
    DataFilterModule,
    FormsModule,
    ConfigurationSummaryModule,
    ModalModule.forRoot(),
    BsDropdownModule.forRoot(),
    PaginationModule.forRoot(),
    BreadcrumbModule,
    InputFieldModule,
    OutputFieldModule,
    QuickAddModule,
    ChartModule,
    TableModule,
    ConstraintRuleModule,
    AlertModule
  ],
  declarations: [MyAccountLayoutComponent, OrderListComponent, DashboardComponent, QuoteListComponent, SettingsComponent, CartListComponent, FavoriteListComponent],
  exports: []
})
export class MyAccountModule { }
