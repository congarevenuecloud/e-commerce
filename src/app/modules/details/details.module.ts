import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { DatepickerModule, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { CongaModule } from '@congarevenuecloud/core';
import { PricingModule } from '@congarevenuecloud/ecommerce';
import {
  BreadcrumbModule,
  IconModule,
  InputDateModule,
  PriceModule,
  PromotionModule,
  ConfigurationSummaryModule,
  InputFieldModule,
  AddressModule
} from '@congarevenuecloud/elements';
import { DetailsLayoutComponent } from './layout/details-layout.component';
import { DetailSectionComponent } from './detail-section/detail-section.component';
import { ComponentModule } from '../../components/component.module';

/**
 * @ignore
 */
@NgModule({
  imports: [
    CommonModule,
    ComponentModule,
    BreadcrumbModule,
    CongaModule,
    IconModule,
    InputDateModule,
    PriceModule,
    PromotionModule,
    PricingModule,
    TranslateModule.forChild(),
    ConfigurationSummaryModule,
    FormsModule,
    InputFieldModule,
    DatepickerModule.forRoot(),
    BsDatepickerModule.forRoot(),
    AddressModule,
    TooltipModule.forRoot(),
    BsDropdownModule.forRoot()
  ],
  declarations: [DetailsLayoutComponent, DetailSectionComponent],
  exports: [DetailsLayoutComponent, DetailSectionComponent]
})
export class DetailsModule { }
