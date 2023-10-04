import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import { ProductCardModule, IconModule, ProductCompareModule, AlertModule } from '@congarevenuecloud/elements';
import { ComponentModule } from '../../components/component.module';
import { CompareRoutingModule } from './compare-routing.module';
import { CompareLayoutComponent } from './layout/compare-layout.component';
@NgModule({
  imports: [
    CommonModule,
    CompareRoutingModule,
    PricingModule,
    CongaModule,
    ComponentModule,
    ProductCardModule,
    IconModule,
    ProductCompareModule,
    AlertModule
  ],
  declarations: [
    CompareLayoutComponent,
  ]
})
export class CompareModule { }
