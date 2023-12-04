/**
* Conga Digital Commerce
*
* The home module is the landing page for the ecommerce application. It utilizes the
* product carousel and jumbotron component from the conga elements library test.
*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './layout/home.component';
import { ComponentModule } from '../../components/component.module';

import { ProductCarouselModule, JumbotronModule, IconModule, AlertModule } from '@congarevenuecloud/elements';

@NgModule({
  imports: [
    CommonModule,
    HomeRoutingModule,
    ComponentModule,
    JumbotronModule,
    ProductCarouselModule,
    IconModule,
    AlertModule,
    TranslateModule.forChild()
  ],
  declarations: [HomeComponent]
})
export class HomeModule { }
