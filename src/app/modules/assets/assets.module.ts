import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

import { AssetsRoutingModule } from './assets-routing.module';
import { AssetListComponent } from './list/asset-list.component';
import { RenewalFilterComponent } from './components/renewal-filter.component';
import { PriceTypeFilterComponent } from './components/price-type-filter.component';
import { FormsModule } from '@angular/forms';
import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { FilterModule, AssetListModule, ButtonModule, BreadcrumbModule, TableModule,InputFieldModule,
        ChartModule, DataFilterModule, ConstraintRuleModule, AlertModule } from '@congarevenuecloud/elements';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { AccordionModule } from 'ngx-bootstrap/accordion';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { ComponentModule } from '../../components/component.module';
import { AssetActionFilterComponent } from './components/asset-action-filter.component';


@NgModule({
  imports: [
    CommonModule,
    AssetsRoutingModule,
    BreadcrumbModule,
    FormsModule,
    CongaModule,
    PricingModule,
    FilterModule,
    ComponentModule,
    AssetListModule,
    TableModule,
    ChartModule,
    DataFilterModule,
    TranslateModule.forChild(),
    PaginationModule.forRoot(),
    BsDatepickerModule.forRoot(),
    AccordionModule.forRoot(),
    ButtonModule,
    ConstraintRuleModule,
    InputFieldModule,
    AlertModule
  ],
  declarations: [
    AssetListComponent,
    RenewalFilterComponent,
    PriceTypeFilterComponent,
    AssetActionFilterComponent,
  ]
})
export class AssetsModule { }
